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

/**
 * Fetch the full deal record for the My Deals detail view and the quote
 * editor. Selects every column we might display, including the raw_csv
 * snapshot which holds the structured equipment array.
 *
 * RLS on the pipeline DB is currently permissive (anon can read everything);
 * this function doesn't add a sales_rep_email filter because the row was
 * already retrieved with that filter in fetchMyDeals — the rep is just
 * drilling into a row they already saw. If the pipeline DB ever gets
 * proper RLS, we'd add the filter here too.
 */
export async function fetchDealById(dealId) {
  if (!dealPipeline) {
    return { data: null, error: { message: 'Deal pipeline not configured.' } };
  }
  if (!dealId) {
    return { data: null, error: { message: 'Missing deal id.' } };
  }
  const { data, error } = await dealPipeline
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .maybeSingle();
  return { data, error };
}

/**
 * Update an existing quote in the pipeline and bump its revision counter.
 *
 * This is called by the "Re-send quote" flow in DealBuilder when editing a
 * previously-sent quote. The pipeline `deals` row stays in place — we
 * UPDATE it rather than INSERT a new row — so the customer's saved URL
 * (which embeds quote_number + quote_token) keeps working and now shows
 * the new contents.
 *
 * Returns { data: <updated row>, error }. The caller is responsible for
 * inserting the deal_revisions audit row separately (via logDealRevision)
 * and re-opening mailto: — we keep those side-effects out of this helper
 * so it stays a pure UPDATE.
 */
export async function updateQuote(dealId, patch) {
  if (!dealPipeline) {
    return { data: null, error: { message: 'Deal pipeline not configured.' } };
  }
  const now = new Date().toISOString();
  const { data, error } = await dealPipeline
    .from('deals')
    .update({
      ...patch,
      quote_last_sent_at: now,
      updated_at: now,
    })
    .eq('id', dealId)
    .select()
    .single();
  return { data, error };
}

/**
 * Record an entry in deal_revisions. Used after a quote edit/re-send and
 * after a customer-decision update so there's a complete audit trail of
 * every meaningful change to a deal.
 *
 * `diff` is freeform jsonb — callers can put whatever shape makes sense
 * for the change kind:
 *   - quote_edit: { equipment_changed: bool, cover_note_changed: bool, ... }
 *   - decision:   { from: 'pending', to: 'lease', phase_advanced: 'leasing' }
 *
 * Best-effort: failures are logged but not raised, since the underlying
 * change has already been persisted by the time we call this.
 */
export async function logDealRevision({ dealId, revision, changedBy, changeKind, diff, notes }) {
  if (!dealPipeline) return { error: { message: 'Not configured.' } };
  try {
    const { error } = await dealPipeline
      .from('deal_revisions')
      .insert({
        deal_id: dealId,
        revision,
        changed_by: changedBy,
        change_kind: changeKind,
        diff: diff || {},
        notes: notes || null,
      });
    if (error) console.warn('Could not log deal revision:', error);
    return { error };
  } catch (err) {
    console.warn('logDealRevision threw:', err);
    return { error: { message: err.message } };
  }
}

/**
 * Record the customer's decision on a quote and advance the deal's phase
 * accordingly. Wraps three pipeline writes into one helper so the caller
 * (MyDealsPage) doesn't have to coordinate them:
 *
 *   1. UPDATE deals SET customer_decision, customer_decision_at,
 *      customer_decision_notes, phase, current_step, is_quote=false,
 *      deal_status (closed if declined)
 *   2. INSERT deal_revisions row (change_kind='decision', diff has from/to)
 *   3. INSERT deal_activity row (human-readable for the dashboard's activity feed)
 *
 * The `decision` arg is one of the DECISIONS entries from pipelineSteps.js —
 * its nextPhase/nextStep/closed fields drive the column updates.
 *
 * Note that `is_quote` flips to false here: once the customer has decided,
 * this row is no longer a "quote pending response" — it's a deal moving
 * through the pipeline. The customer-facing quote URL still works (it
 * matches on quote_number + quote_token without checking is_quote), so
 * the customer can still see what they decided on.
 */
export async function recordCustomerDecision({ dealId, decision, notes, actor, currentRevision }) {
  if (!dealPipeline) {
    return { data: null, error: { message: 'Deal pipeline not configured.' } };
  }
  const now = new Date().toISOString();

  // Build the column patch from the decision spec.
  const patch = {
    customer_decision: decision.value,
    customer_decision_at: now,
    customer_decision_notes: notes || null,
    is_quote: false,        // no longer a pending quote
    updated_at: now,
  };
  if (decision.nextPhase) {
    patch.phase = decision.nextPhase;
    patch.current_step = decision.nextStep;
  }
  if (decision.closed) {
    patch.deal_status = 'closed';
  }

  // 1) Update the deal
  const { data: updated, error: updErr } = await dealPipeline
    .from('deals')
    .update(patch)
    .eq('id', dealId)
    .select()
    .single();
  if (updErr) return { data: null, error: updErr };

  // 2) Audit log — separate from activity feed; this is the structured trail
  await logDealRevision({
    dealId,
    revision: (currentRevision || 0) + 1,
    changedBy: actor,
    changeKind: 'decision',
    diff: {
      decision: decision.value,
      next_phase: decision.nextPhase,
      next_step: decision.nextStep,
      closed: !!decision.closed,
    },
    notes,
  });

  // 3) Human-readable activity feed entry — what the dashboard shows
  await logDealActivity(
    dealId,
    `Customer decision: ${decision.label}`,
    decision.nextPhase
      ? `Deal advanced to ${decision.nextPhase} phase (${decision.nextStep})`
      : 'Deal marked closed',
    actor,
  );

  return { data: updated, error: null };
}

/**
 * Insert a deal_bundles snapshot row for a freshly-submitted bundle deal.
 *
 * Called by DealBuilder right after submitDealToPipeline() succeeds, when
 * bundle mode is active. Best-effort but more important than activity logs:
 * if this fails, the deal exists but the dashboard / customer quote won't
 * recognize it as a bundle deal. We return the error so the caller can
 * surface it.
 *
 * The single-bundle-per-deal unique index in the pipeline DB prevents
 * double-inserts on retries.
 */
export async function insertDealBundle(payload) {
  if (!dealPipeline) {
    return { data: null, error: { message: 'Deal pipeline not configured.' } };
  }
  const { data, error } = await dealPipeline
    .from('deal_bundles')
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

/**
 * Update the rollup column deals.total_monthly_charged after a bundle deal
 * is submitted. Kept separate from insertDealBundle so the caller can decide
 * whether to await or fire-and-forget.
 */
export async function setDealTotalMonthly(dealId, totalMonthlyCharged) {
  if (!dealPipeline) {
    return { error: { message: 'Deal pipeline not configured.' } };
  }
  const { error } = await dealPipeline
    .from('deals')
    .update({ total_monthly_charged: totalMonthlyCharged })
    .eq('id', dealId);
  return { error };
}

/**
 * Fetch the deal_bundles snapshot row for a given deal id, if any.
 * Used by QuoteView to render the bundle program section on customer quotes.
 *
 * Returns { bundle: row | null, error }. Bundle is null both for non-bundle
 * deals (legitimate) and for read errors (logged).
 */
export async function fetchDealBundle(dealId) {
  if (!dealPipeline) {
    return { bundle: null, error: { message: 'Deal pipeline not configured.' } };
  }
  if (!dealId) {
    return { bundle: null, error: null };
  }
  const { data, error } = await dealPipeline
    .from('deal_bundles')
    .select('*')
    .eq('deal_id', dealId)
    .maybeSingle();
  if (error) {
    console.warn('Could not fetch deal_bundle:', error);
    return { bundle: null, error };
  }
  return { bundle: data, error: null };
}

/* ───────────────────────── v31: Director Approval ───────────────────────── */

/**
 * Fetch every deal a director has authority over — currently scoped to deals
 * whose `rep_director_email` matches the director's own email. This is the
 * data source for the MyTeamPage approval queue.
 *
 * Why email and not user_id: same reason as fetchMyDeals — the pipeline DB
 * doesn't know about catalog auth users. The rep_director_email column is
 * stamped at deal-submission time from the rep's useDirector() result, so
 * the linkage is by email.
 *
 * Filtering:
 *   - When `scope = 'mine'` (default), returns deals where rep_director_email
 *     matches the caller's email. This is the director's own queue.
 *   - When `scope = 'all'`, returns every deal currently in pending_director
 *     OR with director_decision in (approved, rejected). This is for admins
 *     who need the cross-director view. The email arg is ignored in this mode.
 *
 * The projection mirrors fetchMyDeals plus the director-decision columns so
 * the MyTeamPage can render the queue and the rep-grouped tables without a
 * second round-trip.
 */
export async function fetchTeamDeals(directorEmail, { scope = 'mine' } = {}) {
  if (!dealPipeline) {
    return { data: [], error: { message: 'Deal pipeline not configured.' } };
  }
  if (scope === 'mine' && !directorEmail) {
    // No email and asking for a scoped view = empty result. Safer than dumping
    // every pending-approval deal when the auth state is half-loaded.
    return { data: [], error: null };
  }

  const columns = `
    id,
    is_quote, quote_number,
    customer_decision, customer_decision_at, customer_decision_notes,
    director_decision, director_decision_at, director_decision_by, director_decision_notes,
    rep_director_email, resubmission_count,
    current_step, phase, deal_status,
    first_name, last_name, contact_name, contact_email,
    store_name, city, state,
    deal_type, total_eq_cost, total_monthly_charged,
    sales_rep, sales_rep_email,
    raw_csv, equipment_selection,
    email, phone, address, chain_store,
    coffee_program, current_coffee_supplier,
    parent_distributor, parent_distributor_num, sub_group,
    distributor_warehouse, distributor_rep_name, distributor_rep_email,
    distributor_rep_phone, distributor_customer_num,
    coffee_spend_3mo, expected_monthly_sales,
    notes,
    created_at, updated_at
  `;

  let query = dealPipeline.from('deals').select(columns);

  if (scope === 'all') {
    // Admin view: every deal that has touched the director phase, plus any
    // currently-pending. Using .or() lets us pull historical decisions
    // alongside the live queue in a single fetch.
    query = query.or('phase.eq.pending_director,director_decision.eq.approved,director_decision.eq.rejected');
  } else {
    query = query.eq('rep_director_email', directorEmail);
  }

  const { data, error } = await query.order('customer_decision_at', { ascending: false, nullsFirst: false });
  return { data: data || [], error };
}

/**
 * Shared internal helper for the two director actions (approve/reject) and
 * the rep resubmit action. Wraps the canonical sequence:
 *
 *   1. UPDATE deals SET <patch>, updated_at = now()
 *   2. INSERT deal_revisions (audit trail row)
 *   3. INSERT deal_activity  (human-readable feed for the dashboard)
 *
 * Returns { data: <updated row>, error }. If the UPDATE fails the secondary
 * writes are skipped; if the audit/activity writes fail, they're logged but
 * the primary success still surfaces (matches the pattern of
 * recordCustomerDecision elsewhere in this file).
 */
async function _directorDecision({ dealId, patch, revisionPatch, activityAction, activityDetail, actor, currentRevision }) {
  if (!dealPipeline) {
    return { data: null, error: { message: 'Deal pipeline not configured.' } };
  }
  if (!dealId) {
    return { data: null, error: { message: 'Missing deal id.' } };
  }

  const now = new Date().toISOString();
  const fullPatch = { ...patch, updated_at: now };

  // 1) Primary update
  const { data: updated, error: updErr } = await dealPipeline
    .from('deals')
    .update(fullPatch)
    .eq('id', dealId)
    .select()
    .single();
  if (updErr) return { data: null, error: updErr };

  // 2) Audit log — best-effort. Don't fail the decision on a logging error.
  await logDealRevision({
    dealId,
    revision: (currentRevision || 0) + 1,
    changedBy: actor,
    changeKind: revisionPatch.changeKind,
    diff: revisionPatch.diff || {},
    notes: revisionPatch.notes || null,
  });

  // 3) Human-readable activity feed entry
  await logDealActivity(dealId, activityAction, activityDetail, actor);

  return { data: updated, error: null };
}

/**
 * Director approves a deal sitting in pending_director.
 *
 * Effects:
 *   - phase → ops, current_step → customer_setup (deal moves into ops queue)
 *   - director_decision → 'approved', director_decision_at/by/notes set
 *   - deal_status stays 'active' (approval is a forward move, not a state change)
 *
 * `notes` is optional on approve — the director can add context but isn't
 * required to. `actor` is whatever string the caller wants stamped on the
 * audit row (typically the director's display_name or email).
 *
 * `currentRevision` is the deal's existing quote_revision value (since we
 * reuse that column as a monotonic revision counter across all change kinds).
 * Pass 0 if you don't have it; the audit row just gets revision=1.
 */
export async function approveDeal({ dealId, notes, actor, currentRevision }) {
  const decision = DIRECTOR_DECISIONS_FOR_RUNTIME.approved;
  const now = new Date().toISOString();
  return _directorDecision({
    dealId,
    currentRevision,
    patch: {
      director_decision: 'approved',
      director_decision_at: now,
      director_decision_by: actor || null,
      director_decision_notes: notes?.trim() || null,
      phase: decision.nextPhase,
      current_step: decision.nextStep,
      deal_status: 'active',
    },
    revisionPatch: {
      changeKind: 'director_approval',
      diff: { decision: 'approved', next_phase: decision.nextPhase, next_step: decision.nextStep },
      notes: notes?.trim() || null,
    },
    activityAction: 'Director approved',
    activityDetail: `${actor || 'Director'} approved — deal advanced to ${decision.nextPhase} (${decision.nextStep})`,
    actor,
  });
}

/**
 * Director rejects a deal sitting in pending_director.
 *
 * Effects:
 *   - phase stays 'pending_director', current_step stays 'awaiting_review'
 *     (so the deal still shows up in the rep's My Deals with the right
 *     stepper context — they need to see what happened to fix it)
 *   - director_decision → 'rejected', director_decision_at/by/notes set
 *   - deal_status flips to 'rejected' (this is what tells the rep's
 *     MyDealsPage to render the rejection banner with the Revise CTA)
 *
 * `notes` is REQUIRED here (UI enforced). The caller should validate before
 * invoking this; if notes is empty/whitespace we'll still write the update
 * but the rep won't have a reason to act on — log a warning so the omission
 * is visible during development.
 */
export async function rejectDeal({ dealId, notes, actor, currentRevision }) {
  if (!notes || !notes.trim()) {
    console.warn('rejectDeal called without notes — UI should enforce this');
  }
  const now = new Date().toISOString();
  return _directorDecision({
    dealId,
    currentRevision,
    patch: {
      director_decision: 'rejected',
      director_decision_at: now,
      director_decision_by: actor || null,
      director_decision_notes: notes?.trim() || null,
      // Phase/step stay as pending_director / awaiting_review on purpose —
      // see the comment above. The deal_status flip is what marks it as
      // needing attention.
      deal_status: 'rejected',
    },
    revisionPatch: {
      changeKind: 'director_rejection',
      diff: { decision: 'rejected', reason: notes?.trim() || null },
      notes: notes?.trim() || null,
    },
    activityAction: 'Director rejected',
    activityDetail: `${actor || 'Director'} rejected${notes?.trim() ? `: ${notes.trim()}` : ' (no reason given)'}`,
    actor,
  });
}

/**
 * Rep resubmits a previously-rejected deal. This is the inverse of rejectDeal:
 *
 *   - deal_status flips from 'rejected' back to 'active'
 *   - director_decision clears back to NULL (it's "pending review" again,
 *     and we use NULL rather than 'pending' here so the queue can tell
 *     "fresh submission" from "explicitly pending after a customer decision"
 *     if it ever cares)
 *   - resubmission_count is incremented so the queue can show "this is the
 *     Nth try" and the director can spot patterns
 *   - phase/step stay at pending_director / awaiting_review (the deal
 *     re-enters the director's queue, no other path makes sense)
 *
 * The rep may include `notes` explaining what they changed since the
 * rejection — this is shown to the director in the queue detail view so
 * they don't have to diff manually.
 *
 * Note: this function doesn't accept a deal-edit payload — it only flips
 * the workflow columns. If the rep needs to change equipment/pricing on
 * resubmit, that's a separate edit flow (TODO for a future increment;
 * v31 ships resubmit-as-is and lets the rep add a note).
 */
export async function resubmitDeal({ dealId, notes, actor, currentRevision, currentResubmissionCount }) {
  return _directorDecision({
    dealId,
    currentRevision,
    patch: {
      director_decision: null,
      director_decision_at: null,
      director_decision_by: null,
      director_decision_notes: null,
      deal_status: 'active',
      phase: 'pending_director',
      current_step: 'awaiting_review',
      resubmission_count: (currentResubmissionCount || 0) + 1,
    },
    revisionPatch: {
      changeKind: 'rep_resubmit',
      diff: {
        action: 'resubmit',
        new_resubmission_count: (currentResubmissionCount || 0) + 1,
      },
      notes: notes?.trim() || null,
    },
    activityAction: 'Rep resubmitted for director review',
    activityDetail: notes?.trim()
      ? `Resubmitted (attempt ${(currentResubmissionCount || 0) + 1}): ${notes.trim()}`
      : `Resubmitted (attempt ${(currentResubmissionCount || 0) + 1})`,
    actor,
  });
}

/**
 * Internal map version of DIRECTOR_DECISIONS, indexed by `value` for fast
 * lookup. We can't import from pipelineSteps.js without creating a circular
 * dependency (pipelineSteps doesn't import from dealPipeline, but importing
 * here means dealPipeline also depends on pipelineSteps — that's fine,
 * we already have unidirectional flow there).
 *
 * The reason we keep this local rather than importing DIRECTOR_DECISIONS:
 * dealPipeline.js historically has been free of pipelineSteps imports, and
 * the approve/reject helpers only need two specific entries. Inlining is
 * simpler than introducing the dependency just for this. If we end up
 * needing more pipelineSteps constants here, switch to the import.
 */
const DIRECTOR_DECISIONS_FOR_RUNTIME = {
  approved: { nextPhase: 'ops',              nextStep: 'customer_setup' },
  rejected: { nextPhase: 'pending_director', nextStep: 'awaiting_review' },
};
