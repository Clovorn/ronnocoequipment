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
 */
export async function stampLeadConverted(leadId, dealId) {
  const { error } = await leadsPortal
    .from('leads')
    .update({ deal_id: dealId, status: 'won' })
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
 * Build a deals-table insert payload from a lead row.
 * Matches the field mapping from the spec + the column names in dealPipeline.js.
 */
export function leadToDealPayload(lead) {
  const firstName = lead.customer_first_name
    || (lead.customer_full_name || '').split(/\s+/)[0]
    || '';
  const lastName = lead.customer_last_name
    || (lead.customer_full_name || '').split(/\s+/).slice(1).join(' ')
    || '';

  const notesParts = [lead.beverage_needs, lead.notes].filter(Boolean);

  return {
    sales_rep:                lead.assigned_sales_rep || '',
    first_name:               firstName,
    last_name:                lastName,
    email:                    lead.contact_email || '',
    phone:                    lead.phone || lead.contact_number || '',
    store_name:               lead.dba_name || '',
    legal_business_name:      lead.legal_business_name || '',
    address:                  lead.store_address || '',
    jotform_submission_id:    lead.jotform_submission_id || null,
    parent_distributor:       PROGRAM_SOURCE_TO_DISTRIBUTOR[lead.program_source]
                                || lead.program_source || '',
    notes:                    notesParts.join('\n\n'),
    is_new_customer:          true,
    current_step:             'submitted',
    phase:                    'leasing',
    distributor_warehouse:    lead.distributor_warehouse || '',
    distributor_customer_num: lead.customer_distributor_number || '',
    distributor_rep_name:     lead.distributor_sales_rep || '',
  };
}
