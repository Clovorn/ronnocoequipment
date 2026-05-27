/**
 * leadsPortal.js — Supabase client for the Distributor Leads portal.
 *
 * Project: opnpyunbccifkdnbljsz (distributor-leads)
 *
 * The anon key is embedded here intentionally — it is the same key already
 * shipped in the leads portal's own index.html and received by every browser
 * that visits distributorleads.netlify.app. Embedding it here introduces no
 * new exposure. When RLS is hardened, both apps rotate together and policies
 * do the actual enforcement.
 *
 * The Deal Builder reads assigned leads from this project and writes back:
 *   - deal_id        (UUID of the newly-created deal)
 *   - status = 'won' (marks the lead as converted)
 */
import { createClient } from '@supabase/supabase-js';

const LEADS_URL = 'https://opnpyunbccifkdnbljsz.supabase.co';
const LEADS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wbnB5dW5iY2NpZmtkbmJsanN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTAzODMsImV4cCI6MjA5MzMyNjM4M30.UPu8TcE7PoVV4SqzUVlTQIsy_sgszylY988iZlOfBlk';

export const leadsPortal = createClient(LEADS_URL, LEADS_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Always configured — key is embedded.
export const isLeadsPortalConfigured = true;

/**
 * Fetch unconverted active leads assigned to the given rep by display name.
 *
 * Returns all columns needed for cards + conversion, ordered by
 * last_activity_at DESC (stalled-first within each bucket).
 */
export async function fetchMyLeads(repName) {
  if (!repName) return { data: [], error: null };

  const { data, error } = await leadsPortal
    .from('leads')
    .select(`
      id, assigned_sales_rep, dba_name, legal_business_name,
      customer_full_name, customer_first_name, customer_last_name,
      contact_email, phone, contact_number, store_address,
      customer_interest, current_step, status,
      last_activity_at, created_at, program_source, tradeshow_lead,
      deal_id, jotform_submission_id, beverage_needs, notes,
      which_program, distributor, distributor_warehouse,
      distributor_sales_rep, customer_distributor_number,
      num_locations, assigned_director_id
    `)
    .eq('assigned_sales_rep', repName)
    .eq('status', 'active')
    .is('deal_id', null)
    .order('last_activity_at', { ascending: false, nullsFirst: false });

  return { data: data ?? [], error };
}

/**
 * Stamp a converted lead: set deal_id + status='won'.
 *
 * Called by DealBuilder's submit success path (v33.5). Pre-v33.5 this was
 * called at convert time, but that marked leads as won before the deal was
 * actually in the pipeline. Now the rep flow is:
 *
 *   1. Convert lead   → markLeadInProgress(lead, draft.id)    status='in_progress'
 *   2. Submit deal    → stampLeadConverted(lead, deals.id)    status='won'
 *   3. Delete draft   → revertLeadToActive(lead)              status='active'  (undoes step 1)
 */
export async function stampLeadConverted(leadId, dealId) {
  const { error } = await leadsPortal
    .from('leads')
    .update({ deal_id: dealId, status: 'won' })
    .eq('id', leadId);
  return { error };
}

/**
 * v33.5: Mark a lead as "claimed by a rep, in progress." Sets the lead's
 * status to 'in_progress' so it disappears from the rep's active leads
 * queue (the workspace filters by status='active') without yet committing
 * to "won." Stores the Deal Builder draft id in lead.deal_id as a soft
 * placeholder — gets overwritten by the real pipeline deals.id when the
 * draft is eventually submitted (see stampLeadConverted above).
 *
 * Safe to call repeatedly — idempotent for the same (lead, draft) pair.
 */
export async function markLeadInProgress(leadId, draftId) {
  const { error } = await leadsPortal
    .from('leads')
    .update({ deal_id: draftId, status: 'in_progress' })
    .eq('id', leadId);
  return { error };
}

/**
 * v33.5: Revert a lead back to the active queue. Called when a rep deletes
 * the Deal Builder draft that was created from a converted lead — the rep
 * is effectively cancelling the conversion, so the lead should reappear in
 * their leads list so they can either re-convert later or mark it lost.
 *
 * Clears deal_id (the draft id was a placeholder) and resets status='active'.
 * The leads portal will continue to filter by assigned_sales_rep so it'll
 * show up on the same rep's screen.
 */
export async function revertLeadToActive(leadId) {
  const { error } = await leadsPortal
    .from('leads')
    .update({ deal_id: null, status: 'active' })
    .eq('id', leadId);
  return { error };
}

/**
 * Log an activity entry to the leads portal's activity_log table.
 */
export async function logLeadActivity(leadId, actorRole, action, fromStep, toStep, note) {
  try {
    await leadsPortal.from('activity_log').insert({
      lead_id: leadId,
      actor_role: actorRole,
      action,
      from_step: fromStep || null,
      to_step: toStep || null,
      note: note || null,
    });
  } catch (err) {
    console.warn('Could not log lead activity:', err);
  }
}

/**
 * Log a rep contact attempt and optionally advance the lead's step.
 *
 * Mirrors the leads portal's confirmFollowup() logic exactly:
 * - reached=true + rep_assigned/etc  → customer_contacted
 * - reached=true + customer_contacted → follow_up
 * - reached=false                     → no step change, just log
 *
 * Returns { toStep, error } where toStep is the new step (or unchanged).
 */
export async function logRepContact({ leadId, currentStep, method, reached, note }) {
  const METHOD_LABELS = { call: 'Call', email: 'Email', text: 'Text', visit: 'In-person' };
  const methodLabel = METHOD_LABELS[method] || method;

  let toStep = currentStep;
  if (reached) {
    if (['rep_assigned', 'lead_received', 'awaiting_director', 'awaiting_rep'].includes(currentStep)) {
      toStep = 'customer_contacted';
    } else if (currentStep === 'customer_contacted') {
      toStep = 'follow_up';
    }
  }

  const stepped = toStep !== currentStep;
  const action = stepped
    ? `${methodLabel} — reached customer: ${LEAD_STEP_LABELS[toStep] || toStep}`
    : `${methodLabel} — ${reached ? 'reached customer' : 'attempted contact'}`;

  // Update the lead row
  const updatePayload = { updated_at: new Date().toISOString() };
  if (stepped) updatePayload.current_step = toStep;

  const { error: updateError } = await leadsPortal
    .from('leads')
    .update(updatePayload)
    .eq('id', leadId);

  if (updateError) return { toStep: currentStep, error: updateError };

  // Log activity
  await leadsPortal.from('activity_log').insert({
    lead_id: leadId,
    actor_role: 'ronnoco_rep',
    action,
    from_step: currentStep,
    to_step: stepped ? toStep : null,
    note: note || null,
  });

  return { toStep, error: null };
}

/**
 * Mark a lead as lost.
 */
export async function markLeadLost(leadId, currentStep, reason) {
  const { error } = await leadsPortal
    .from('leads')
    .update({ status: 'lost', updated_at: new Date().toISOString() })
    .eq('id', leadId);
  if (error) return { error };

  await leadsPortal.from('activity_log').insert({
    lead_id: leadId,
    actor_role: 'ronnoco_rep',
    action: 'Marked as lost',
    from_step: currentStep || null,
    note: reason || null,
  });

  return { error: null };
}

/**
 * Fetch recent activity log entries for a single lead.
 */
export async function fetchLeadActivity(leadId) {
  const { data, error } = await leadsPortal
    .from('activity_log')
    .select('id, action, actor_role, from_step, to_step, note, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(30);
  return { data: data ?? [], error };
}

/** Human-readable labels for leads portal step values. */
export const LEAD_STEP_LABELS = {
  lead_received:      'Lead received',
  awaiting_director:  'Awaiting director',
  awaiting_rep:       'Awaiting rep',
  rep_assigned:       'Rep assigned',
  customer_contacted: 'Contacted',
  follow_up:          'Follow-up',
};

export function leadStepLabel(step) {
  return LEAD_STEP_LABELS[step] || step || 'Unknown';
}

/** Bucket a flat leads array into the two action groups. */
export function bucketLeads(leads) {
  const needContact = leads.filter((l) => l.current_step === 'rep_assigned');
  const inFollowUp  = leads.filter((l) =>
    l.current_step === 'customer_contacted' || l.current_step === 'follow_up'
  );
  const other = leads.filter((l) =>
    l.current_step !== 'rep_assigned' &&
    l.current_step !== 'customer_contacted' &&
    l.current_step !== 'follow_up'
  );
  return { needContact, inFollowUp, other };
}

/** Map program_source → parent_distributor for deal creation. */
export const PROGRAM_SOURCE_TO_DISTRIBUTOR = {
  'Java Select': 'HT Hackney',
  'Sledd':       'Team Sledd',
  'CoreMark':    'CoreMark',
};

/**
 * Build a `deal_drafts.draft_state` object from a lead row.
 *
 * v33.4: Lead conversion no longer creates a deals row directly. Instead it
 * creates a deal_drafts entry that the rep opens in Deal Builder, completes
 * (equipment, terms, install dates, etc.), and submits like any other deal.
 * The new deal lands in the pipeline ONLY when the rep clicks Submit — keeping
 * unfinished deals out of the Pipeline Dashboard and out of the director's
 * approval queue.
 *
 * What this returns:
 *   - Just the customer-facing fields a lead actually carries. The rest of
 *     the form (deal type, equipment, install dates, terms) gets filled out
 *     by the rep in Deal Builder.
 *   - `deal_type` IS included so the rep doesn't have to re-pick it. The
 *     convert modal asked for it; we carry that through into the draft.
 *   - `_fromLeadId` is stashed so DealBuilder can stamp the lead with the
 *     deal_id once Submit finally creates a deals row.
 *
 * What this deliberately does NOT include:
 *   - phase / current_step / is_quote / deal_status: those are pipeline-row
 *     concepts that only exist after Submit. Drafts don't have a phase.
 *   - sales_rep_email / rep_director_email: the rep's session stamps these
 *     at submit time via DealBuilder's existing payload builder. Putting them
 *     in draft_state would be redundant and risk drift if the rep changes.
 *
 * Field mapping (lead column → draft_state field):
 *   dba_name              → store_name
 *   legal_business_name   → legal_business_name
 *   customer_first/last   → contact_first_name / contact_last_name
 *   contact_email         → contact_email
 *   phone | contact_number→ contact_cell
 *   store_address         → address
 *   program_source        → parent_distributor (mapped via PROGRAM_SOURCE_TO_DISTRIBUTOR)
 *   distributor_warehouse → distributor_warehouse
 *   distributor_sales_rep → distributor_rep_name
 *   customer_distributor_number → distributor_customer_num
 *   beverage_needs + notes → notes (joined with blank lines)
 */
export function leadToDraftState(lead, dealType = '') {
  const firstName = lead.customer_first_name
    || (lead.customer_full_name || '').split(/\s+/)[0]
    || '';
  const lastName = lead.customer_last_name
    || (lead.customer_full_name || '').split(/\s+/).slice(1).join(' ')
    || '';

  const notesParts = [lead.beverage_needs, lead.notes].filter(Boolean);

  return {
    // Store / business
    store_name:               lead.dba_name || '',
    legal_business_name:      lead.legal_business_name || '',
    address:                  lead.store_address || '',
    // Primary contact
    contact_first_name:       firstName,
    contact_last_name:        lastName,
    contact_cell:             lead.phone || lead.contact_number || '',
    contact_email:            lead.contact_email || '',
    // Distributor info
    parent_distributor:       PROGRAM_SOURCE_TO_DISTRIBUTOR[lead.program_source]
                                || lead.program_source || '',
    distributor_warehouse:    lead.distributor_warehouse || '',
    distributor_customer_num: lead.customer_distributor_number || '',
    distributor_rep_name:     lead.distributor_sales_rep || '',
    // Deal type chosen in the convert modal
    deal_type:                dealType || '',
    // Carry the rep's notes from the leads portal
    notes:                    notesParts.join('\n\n'),
    // v33.4: lead linkage. DealBuilder consumes this on submit to stamp
    // the lead's deal_id with the newly-created pipeline deals row id.
    _fromLeadId:              lead.id || null,
    // Display only — store the jotform id so we know which lead this draft
    // came from even if _fromLeadId becomes inconsistent.
    _fromJotformSubmissionId: lead.jotform_submission_id || null,
  };
}
