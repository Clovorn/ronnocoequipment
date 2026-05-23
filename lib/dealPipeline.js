/**
 * Deal-pipeline cross-project Supabase client.
 *
 * The catalog app writes finalized deals to a different Supabase project
 * (deal-pipeline) so they appear in the existing pipeline dashboard alongside
 * deals submitted through the legacy Jotform.
 *
 * Configure via env vars:
 *   VITE_DEAL_PIPELINE_URL       - https://<ref>.supabase.co
 *   VITE_DEAL_PIPELINE_ANON_KEY  - the anon JWT for that project
 *
 * If unset, deal submission is disabled and the UI will surface a clear
 * configuration message instead of failing silently.
 */
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_DEAL_PIPELINE_URL;
const KEY = import.meta.env.VITE_DEAL_PIPELINE_ANON_KEY;

export const isDealPipelineConfigured = Boolean(URL && KEY);

// Build a separate Supabase client only when configured. This client uses
// the deal-pipeline project's anon key — it has no session of its own, since
// the deal pipeline is treated as a write-only endpoint from the catalog
// app's perspective. RLS on the pipeline project's `deals` table controls
// what's permitted.
export const dealPipeline = isDealPipelineConfigured
  ? createClient(URL, KEY, {
      auth: {
        // Don't try to persist a session — this is a write-only client.
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

/**
 * Submit a deal to the pipeline project.
 *
 * payload should match the columns of public.deals in the pipeline project.
 * Returns { data, error } in Supabase style.
 */
export async function submitDealToPipeline(payload) {
  if (!dealPipeline) {
    return { data: null, error: { message: 'Deal pipeline not configured. Set VITE_DEAL_PIPELINE_URL and VITE_DEAL_PIPELINE_ANON_KEY.' } };
  }
  const { data, error } = await dealPipeline
    .from('deals')
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

/**
 * Generate a new quote number via the DB function. Returns `Q-YYYY-NNNN`.
 * The DB-side function is atomic (insert..on conflict do update returning),
 * so concurrent calls don't collide.
 */
export async function generateQuoteNumber() {
  if (!dealPipeline) return { data: null, error: { message: 'Deal pipeline not configured.' } };
  const { data, error } = await dealPipeline.rpc('generate_quote_number');
  return { data, error };
}

/**
 * Fetch a quote for the public customer-facing page. Only returns a record
 * if both the quote_number AND the token match — this is the access control.
 * No auth required; anyone with the URL+token can view.
 *
 * Returns a *limited* projection — only fields safe to show the customer.
 * Internal info (cost, ROM, distributor details, internal notes) is omitted.
 */
export async function fetchQuoteForCustomer(quoteNumber, token) {
  if (!dealPipeline) return { data: null, error: { message: 'Deal pipeline not configured.' } };
  if (!quoteNumber || !token) return { data: null, error: { message: 'Missing quote number or token.' } };

  const { data, error } = await dealPipeline
    .from('deals')
    .select(`
      id, quote_number, quote_revision, quote_cover_note, quote_valid_until,
      quote_first_sent_at, quote_last_sent_at,
      first_name, last_name, contact_name, contact_email,
      store_name, address, city, state, zip_code,
      sales_rep, sales_rep_email,
      deal_type, equipment_selection, total_eq_cost,
      target_install_date,
      raw_csv,
      deal_status, customer_decision,
      created_at, updated_at
    `)
    .eq('quote_number', quoteNumber)
    .eq('quote_token', token)
    .eq('is_quote', true)
    .maybeSingle();

  return { data, error };
}

/**
 * Best-effort "the customer opened the quote" tracker. Called from the public
 * quote page when it loads. Updates quote_first_viewed_at if null, and always
 * bumps quote_last_viewed_at. Failures are swallowed — viewing should never
 * be blocked by tracking.
 */
export async function recordQuoteView(quoteNumber, token) {
  if (!dealPipeline || !quoteNumber || !token) return;
  try {
    const now = new Date().toISOString();
    // Update last_viewed_at always; set first_viewed_at only if null.
    await dealPipeline
      .from('deals')
      .update({
        quote_last_viewed_at: now,
        quote_first_viewed_at: now,  // ignored if first_viewed_at is already set; see below
      })
      .eq('quote_number', quoteNumber)
      .eq('quote_token', token)
      .is('quote_first_viewed_at', null);

    // Always bump last_viewed_at regardless of first_viewed status
    await dealPipeline
      .from('deals')
      .update({ quote_last_viewed_at: now })
      .eq('quote_number', quoteNumber)
      .eq('quote_token', token);
  } catch (err) {
    console.warn('Quote view tracking failed (non-fatal):', err);
  }
}

/**
 * Fetch every deal in the pipeline submitted by this rep (by email match).
 *
 * Why email and not user_id: the pipeline DB doesn't know about catalog auth
 * users — submissions are written via the anon key with `sales_rep_email`
 * stamped from the rep's session at submit time. So email is the only link
 * back to the current user.
 *
 * Returns BOTH quotes (is_quote=true, phase='sales') AND direct-submit deals
 * (is_quote=false, phase='leasing' or beyond). The workspace UI is responsible
 * for filtering / grouping them visually.
 *
 * Projection is the columns the workspace actually displays — keeping this
 * narrow avoids dragging the full deal record (which has tons of internal-only
 * fields) over the wire on every workspace load.
 */
export async function fetchMyDeals(email) {
  if (!dealPipeline) {
    return { data: [], error: { message: 'Deal pipeline not configured.' } };
  }
  if (!email) {
    // No email = no scope. Empty result is safer than dumping all deals.
    return { data: [], error: null };
  }

  const { data, error } = await dealPipeline
    .from('deals')
    .select(`
      id,
      is_quote, quote_number, quote_token, quote_valid_until,
      quote_first_sent_at, quote_last_sent_at,
      quote_first_viewed_at, quote_last_viewed_at,
      customer_decision, customer_decision_at,
      current_step, phase, deal_status,
      first_name, last_name, contact_name, contact_email,
      store_name, city, state,
      deal_type, total_eq_cost,
      sales_rep, sales_rep_email,
      created_at, updated_at
    `)
    .eq('sales_rep_email', email)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

/**
 * Log an activity row for a freshly-inserted deal. Best-effort — if it fails,
 * we don't block the deal submission (the deal exists in the pipeline either way).
 */
export async function logDealActivity(dealId, action, detail, actor) {
  if (!dealPipeline) return;
  try {
    await dealPipeline
      .from('deal_activity')
      .insert({
        deal_id: dealId,
        action,
        detail,
        actor,
      });
  } catch (err) {
    // Best-effort logging — don't fail the deal because activity log failed
    console.warn('Could not log deal activity:', err);
  }
}
