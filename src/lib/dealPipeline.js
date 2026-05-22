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
