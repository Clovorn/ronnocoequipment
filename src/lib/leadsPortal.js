/**
 * leadsPortal.js — Read-only Supabase client for the Distributor Leads portal.
 *
 * Project: opnpyunbccifkdnbljsz (distributor-leads)
 * The Deal Builder reads assigned leads from this project and can write back
 * deal_id + status='converted' when a lead is converted to a deal.
 *
 * Configure via env vars:
 *   VITE_LEADS_PORTAL_URL      - https://opnpyunbccifkdnbljsz.supabase.co
 *   VITE_LEADS_PORTAL_ANON_KEY - the anon JWT for the leads project
 */
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_LEADS_PORTAL_URL;
const KEY = import.meta.env.VITE_LEADS_PORTAL_ANON_KEY;

export const isLeadsPortalConfigured = Boolean(URL && KEY);

export const leadsPortal = isLeadsPortalConfigured
  ? createClient(URL, KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

/**
 * Fetch unconverted leads assigned to a specific rep by display name.
 * Returns leads where:
 *   - assigned_sales_rep = repName  (exact match, case-sensitive — names were
 *     cleaned up in the leads portal roster to match Deal Builder display_name)
 *   - status = 'active'
 *   - deal_id IS NULL               (not yet converted)
 *
 * Ordered by last_activity_at DESC so freshest leads appear first.
 */
export async function fetchMyLeads(repName) {
  if (!leadsPortal || !repName) return { data: [], error: null };

  const { data, error } = await leadsPortal
    .from('leads')
    .select([
      'id',
      'dba_name',
      'customer_full_name',
      'contact_email',
      'phone',
      'store_address',
      'customer_interest',
      'current_step',
      'status',
      'last_activity_at',
      'created_at',
      'program_source',
      'tradeshow_lead',
      'deal_id',
      'jotform_submission_id',
    ].join(', '))
    .eq('assigned_sales_rep', repName)
    .eq('status', 'active')
    .is('deal_id', null)
    .order('last_activity_at', { ascending: false });

  return { data: data ?? [], error };
}

/**
 * Stamp a converted lead with the new deal_id and flip status to 'converted'.
 * Called after the deal is successfully submitted to the pipeline.
 */
export async function markLeadConverted(leadId, dealId) {
  if (!leadsPortal) return { error: new Error('Leads portal not configured') };

  const { error } = await leadsPortal
    .from('leads')
    .update({ deal_id: dealId, status: 'converted' })
    .eq('id', leadId);

  return { error };
}

/** Human-readable label for the current_step values used in the leads portal. */
export const LEAD_STEP_LABELS = {
  lead_received:       'Lead received',
  awaiting_director:   'Awaiting director',
  awaiting_rep:        'Awaiting rep',
  rep_assigned:        'Rep assigned',
  customer_contacted:  'Contacted',
  follow_up:           'Follow-up',
};

export function leadStepLabel(step) {
  return LEAD_STEP_LABELS[step] || step || 'Unknown';
}
