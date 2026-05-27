import { useEffect, useState } from 'react';
import { listMyDrafts, deleteDraft, renameDraft } from '../lib/draftStorage.js';
import {
  fetchMyDeals,
  fetchDealById,
  recordCustomerDecision,
  resubmitDeal,
  isDealPipelineConfigured,
} from '../lib/dealPipeline.js';
import { DECISIONS, getStepStatuses, isTerminalDenial, PHASE_LABELS, STEP_LABELS } from '../lib/pipelineSteps.js';
import DealDetailView from './DealDetailView.jsx';
import { fetchMyLeads, isLeadsPortalConfigured, leadStepLabel } from '../lib/leadsPortal.js';

/**
 * MyDealsPage — the rep's personal workspace.
 *
 * Two sections, each independently sourced:
 *
 *   1. **Drafts** — rows from the catalog DB's `deal_drafts` table, scoped
 *      by RLS to the current user. These are in-progress deal sheets the
 *      rep saved but didn't yet submit. Actions: Resume (re-opens the deal
 *      sheet hydrated with the saved state), Rename, Delete.
 *
 *   2. **Submitted** — rows from the pipeline DB's `deals` table, filtered
 *      by `sales_rep_email = session.user.email` (the rep stamps that on
 *      every submission so we can find their work later). Includes both
 *      quotes and direct-submit deals. Each row expands inline to show a
 *      detail panel:
 *        - Customer + store + equipment summary
 *        - Visual phase stepper (read-only) for the current process flow
 *        - For QUOTES (is_quote=true): Edit & re-send button + customer
 *          decision recorder (Lease/Finance/Purchase/Loan/Declined)
 *        - For DEALS (is_quote=false): read-only stepper, link to the
 *          Pipeline dashboard for anything beyond viewing
 *
 * The two sources are queried in parallel on mount. Each section renders
 * independently — a slow/failed pipeline query doesn't block the drafts
 * list (and vice-versa).
 */
export default function MyDealsPage({ profile, session, navigate }) {
  /* ─── Drafts state ─── */
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [draftsError, setDraftsError] = useState(null);

  /* ─── Submissions state ─── */
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [submissionsError, setSubmissionsError] = useState(null);

  /* ─── UI state ─── */
  // Filter for the submissions section: 'all' | 'quote' | 'deal'.
  // Default 'all' so a rep landing here sees everything; they can narrow.
  const [submissionsFilter, setSubmissionsFilter] = useState('all');

  // Which submission row is currently expanded (deal id). Only one open at
  // a time — clicking another row closes the previous one. null = none open.
  const [expandedId, setExpandedId] = useState(null);

  /* ─── My Leads state ─── */
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState(null);
  const [expandedLeadId, setExpandedLeadId] = useState(null);

  /* ─── v31 resubmit modal state ─── */
  // When non-null, the resubmit modal is open and pointing at this deal row.
  // The modal collects optional notes from the rep (e.g. "fixed the address
  // and tightened the equipment list per the director's note") and flips the
  // deal back into the director queue via resubmitDeal().
  const [resubmitTarget, setResubmitTarget] = useState(null);
  const [resubmitSubmitting, setResubmitSubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState(null);

  /**
   * Load both sections on mount and whenever the user changes (rare, but
   * defensive — if the session swaps under us we don't want to keep
   * showing the prior user's data).
   */
  useEffect(() => {
    let cancelled = false;
    // Drafts — RLS handles scoping, we just need to call.
    setDraftsLoading(true);
    listMyDrafts()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setDraftsError(error.message);
        setDrafts(data);
        setDraftsLoading(false);
      });
    // Submissions — explicit email filter.
    setSubmissionsLoading(true);
    fetchMyDeals(session?.user?.email)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setSubmissionsError(error.message);
        setSubmissions(data);
        setSubmissionsLoading(false);
      });

    // Leads from the Distributor Leads portal — matched by rep display name.
    // Only fetched for sales / non-admin roles; admins and directors see the
    // full pipeline via their own views so we don't clutter their workspace.
    const repName = profile?.display_name;
    if (repName && isLeadsPortalConfigured) {
      setLeadsLoading(true);
      fetchMyLeads(repName)
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) setLeadsError(error.message);
          setLeads(data ?? []);
          setLeadsLoading(false);
        });
    } else {
      setLeadsLoading(false);
    }

    return () => { cancelled = true; };
  }, [session?.user?.email, profile?.display_name]);

  /**
   * Refresh a single submission row in place — used after the rep records a
   * customer decision so the row's badges + stepper update without re-fetching
   * the whole list (which would also blow away the expanded state).
   */
  async function refreshSubmission(dealId) {
    const { data, error } = await fetchDealById(dealId);
    if (error || !data) return;
    setSubmissions((prev) => prev.map((row) => (row.id === dealId ? { ...row, ...data } : row)));
  }

  /* ─── Action handlers ─── */

  function handleResume(draftId) {
    navigate('deal', { draftId });
  }

  function handleEditQuote(dealId) {
    navigate('deal', { editQuoteId: dealId });
  }

  function handleToggleExpand(dealId) {
    setExpandedId((prev) => (prev === dealId ? null : dealId));
  }

  /**
   * v31: open the resubmit modal pointing at a rejected deal row.
   *
   * Called from the rejected-deal banner inside DealActions. We snapshot
   * the row at the moment of opening so the modal renders the customer +
   * director-note context even if the underlying list re-orders mid-modal
   * (e.g. from a background refresh).
   */
  function openResubmitModal(row) {
    setResubmitError(null);
    setResubmitTarget(row);
  }

  /**
   * v31: submit the resubmit. Calls resubmitDeal() which:
   *   - clears director_decision back to null
   *   - flips deal_status from 'rejected' back to 'active'
   *   - leaves phase at 'pending_director' (queue stays the same)
   *   - bumps resubmission_count
   *   - writes a deal_revisions audit row with the rep's note
   *   - logs an activity row visible in the Pipeline dashboard
   *
   * On success, closes the modal, refreshes the affected row in place so
   * the pill flips from "Director rejected" to "Pending director · retry N",
   * and keeps the row expanded so the rep sees the updated state directly.
   * On failure, surfaces the error inside the modal (doesn't close).
   */
  async function submitResubmit(row, notes) {
    setResubmitError(null);
    setResubmitSubmitting(true);
    const actor = profile?.display_name || session?.user?.email || 'rep';
    const { error } = await resubmitDeal({
      dealId: row.id,
      notes: notes || null,
      actor,
      currentRevision: row.quote_revision || 1,
      currentResubmissionCount: row.resubmission_count || 0,
    });
    if (error) {
      setResubmitError(error.message || 'Resubmit failed.');
      setResubmitSubmitting(false);
      return;
    }
    setResubmitSubmitting(false);
    setResubmitTarget(null);
    await refreshSubmission(row.id);
    // Keep the row expanded so the rep sees the updated state — no nav change.
    setExpandedId(row.id);
  }

  async function handleDelete(draft) {
    const ok = window.confirm(
      `Delete draft "${draft.draft_name}"? This can't be undone.`
    );
    if (!ok) return;
    const { error } = await deleteDraft(draft.id);
    if (error) {
      window.alert(`Could not delete: ${error.message}`);
      return;
    }
    // Optimistic local removal — re-fetching would be heavier and the row
    // is already gone from the DB.
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
  }

  async function handleRename(draft) {
    const newName = window.prompt(`Rename "${draft.draft_name}" to:`, draft.draft_name);
    if (newName == null) return;                       // cancelled
    const trimmed = newName.trim();
    if (!trimmed || trimmed === draft.draft_name) return;
    const { data, error } = await renameDraft(draft.id, trimmed);
    if (error) {
      window.alert(`Could not rename: ${error.message}`);
      return;
    }
    setDrafts((prev) => prev.map((d) => (d.id === draft.id ? data : d)));
  }

  /**
   * Submit a customer decision for a quote. Wires the DECISIONS spec
   * through recordCustomerDecision (which handles the column updates and
   * audit log) and refreshes the row when done.
   */
  async function handleDecision(row, decisionValue, notes) {
    const decision = DECISIONS.find((d) => d.value === decisionValue);
    if (!decision) {
      window.alert(`Unknown decision: ${decisionValue}`);
      return { error: 'unknown decision' };
    }
    const actor = profile?.display_name || session?.user?.email || 'rep';
    const { data, error } = await recordCustomerDecision({
      dealId: row.id,
      decision,
      notes: notes || null,
      actor,
      currentRevision: row.quote_revision || 1,
    });
    if (error) {
      window.alert(`Could not record decision: ${error.message}`);
      return { error };
    }
    await refreshSubmission(row.id);
    return { data };
  }

  /* ─── Render ─── */

  const filteredSubmissions = submissions.filter((row) => {
    if (submissionsFilter === 'all') return true;
    if (submissionsFilter === 'quote') return row.is_quote === true;
    if (submissionsFilter === 'deal')  return row.is_quote !== true;
    return true;
  });

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6 max-w-5xl">
      <div className="mb-5 md:mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
          Workspace
        </p>
        <h1 className="text-2xl md:text-3xl font-light text-slate-900">My deals</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
          Your in-progress drafts and your submitted quotes and deals — all in one place.
        </p>
      </div>

      {/* ─── My Leads (from Distributor Leads portal) ─── */}
      {isLeadsPortalConfigured && (
        <MyLeadsSection
          leads={leads}
          loading={leadsLoading}
          error={leadsError}
          expandedLeadId={expandedLeadId}
          onToggleExpand={(id) => setExpandedLeadId((prev) => (prev === id ? null : id))}
          onConvert={(lead) => navigate('deal', { leadData: lead })}
        />
      )}

      {/* ─── Drafts ─── */}
      <DraftsSection
        drafts={drafts}
        loading={draftsLoading}
        error={draftsError}
        onResume={handleResume}
        onDelete={handleDelete}
        onRename={handleRename}
        onStartNew={() => navigate('deal')}
      />

      {/* ─── Submissions ─── */}
      <SubmissionsSection
        rows={filteredSubmissions}
        totalCount={submissions.length}
        loading={submissionsLoading}
        error={submissionsError}
        filter={submissionsFilter}
        onFilterChange={setSubmissionsFilter}
        configured={isDealPipelineConfigured}
        expandedId={expandedId}
        onToggleExpand={handleToggleExpand}
        onEditQuote={handleEditQuote}
        onDecision={handleDecision}
        onResubmit={openResubmitModal}
      />

      {/* v31 resubmit modal — rendered at the page level (not inside the row)
          so its fixed-position overlay doesn't get clipped by row scroll. */}
      {resubmitTarget && (
        <ResubmitModal
          row={resubmitTarget}
          submitting={resubmitSubmitting}
          error={resubmitError}
          onCancel={() => { setResubmitTarget(null); setResubmitError(null); }}
          onSubmit={(notes) => submitResubmit(resubmitTarget, notes)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── My Leads section ───────────────────────── */

/**
 * Shows unconverted leads from the Distributor Leads portal that are
 * assigned to the logged-in rep. Each card is clickable to expand a
 * read-only detail view, with a "Convert to Deal" CTA.
 */
function MyLeadsSection({ leads, loading, error, expandedLeadId, onToggleExpand, onConvert }) {
  // Don't render the section at all if there are no leads and we're not loading —
  // it keeps the workspace clean for reps who have no portal leads.
  if (!loading && !error && leads.length === 0) return null;

  return (
    <section className="bg-white border border-page-200 rounded-lg overflow-hidden mb-4">
      <header className="bg-emerald-800 text-white px-4 md:px-5 py-3 flex items-center justify-between gap-3">
        <h2 className="text-sm md:text-base font-medium flex items-center gap-2">
          <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          My Leads
          {!loading && leads.length > 0 && (
            <span className="ml-1 text-xs font-normal text-emerald-200">
              {leads.length} active
            </span>
          )}
        </h2>
        <span className="text-xs text-emerald-200 font-normal">From Distributor Leads portal</span>
      </header>

      <div className="p-4 md:p-5">
        {loading ? (
          <div className="text-sm text-slate-500 py-4 text-center">Loading leads…</div>
        ) : error ? (
          <div className="text-sm text-bad p-3 bg-red-50 border border-red-200 rounded">
            Couldn’t load leads: {error}
          </div>
        ) : (
          <ul className="space-y-2">
            {leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                expanded={expandedLeadId === lead.id}
                onToggle={() => onToggleExpand(lead.id)}
                onConvert={() => onConvert(lead)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LeadRow({ lead, expanded, onToggle, onConvert }) {
  const businessName = lead.dba_name || lead.customer_full_name || 'Unknown business';
  const contact = lead.customer_full_name && lead.dba_name
    ? lead.customer_full_name
    : null;
  const step = leadStepLabel(lead.current_step);
  const lastActivity = lead.last_activity_at
    ? formatRelativeTime(lead.last_activity_at)
    : lead.created_at
      ? formatRelativeTime(lead.created_at)
      : null;

  const LEADS_PORTAL_URL = 'https://distributorleads.netlify.app';

  return (
    <li className="bg-page-50 border border-page-200 rounded overflow-hidden hover:border-emerald-300 transition-colors">
      {/* Summary row — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-3 md:px-4 py-3 flex items-start justify-between gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium
                             bg-emerald-100 text-emerald-800">
              {step}
            </span>
            {lead.tradeshow_lead && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium
                               bg-amber-100 text-amber-800">
                Tradeshow
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900 truncate">{businessName}</p>
          {contact && (
            <p className="text-xs text-slate-500 truncate">{contact}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastActivity && (
            <span className="text-xs text-slate-400 hidden md:inline">{lastActivity}</span>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail — read-only */}
      {expanded && (
        <div className="border-t border-page-200 px-3 md:px-4 py-3 bg-white">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
            {lead.contact_email && (
              <>
                <dt className="text-xs text-slate-500 font-medium uppercase tracking-wide">Email</dt>
                <dd className="text-slate-800">
                  <a href={`mailto:${lead.contact_email}`} className="hover:underline text-navy-800">
                    {lead.contact_email}
                  </a>
                </dd>
              </>
            )}
            {lead.phone && (
              <>
                <dt className="text-xs text-slate-500 font-medium uppercase tracking-wide">Phone</dt>
                <dd className="text-slate-800">
                  <a href={`tel:${lead.phone}`} className="hover:underline text-navy-800">
                    {lead.phone}
                  </a>
                </dd>
              </>
            )}
            {lead.store_address && (
              <>
                <dt className="text-xs text-slate-500 font-medium uppercase tracking-wide">Address</dt>
                <dd className="text-slate-800">{lead.store_address}</dd>
              </>
            )}
            {lead.customer_interest && (
              <>
                <dt className="text-xs text-slate-500 font-medium uppercase tracking-wide">Interest</dt>
                <dd className="text-slate-800">{lead.customer_interest}</dd>
              </>
            )}
            {lead.program_source && (
              <>
                <dt className="text-xs text-slate-500 font-medium uppercase tracking-wide">Source</dt>
                <dd className="text-slate-800">{lead.program_source}</dd>
              </>
            )}
            {lastActivity && (
              <>
                <dt className="text-xs text-slate-500 font-medium uppercase tracking-wide">Last activity</dt>
                <dd className="text-slate-800">{lastActivity}</dd>
              </>
            )}
          </dl>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onConvert}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm
                         font-medium rounded transition-colors"
            >
              Convert to Deal
            </button>
            <a
              href={`${LEADS_PORTAL_URL}#/leads/${lead.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm text-slate-600 hover:text-navy-900
                         border border-page-200 hover:border-navy-300 rounded transition-colors"
            >
              Open in Leads Portal ↗
            </a>
          </div>
        </div>
      )}
    </li>
  );
}

/* ───────────────────────── Drafts section ───────────────────────── */

function DraftsSection({ drafts, loading, error, onResume, onDelete, onRename, onStartNew }) {
  return (
    <section className="bg-white border border-page-200 rounded-lg overflow-hidden mb-4">
      <header className="bg-navy-900 text-chalk-50 px-4 md:px-5 py-3 flex items-center justify-between gap-3">
        <h2 className="text-sm md:text-base font-medium">
          Drafts
          {!loading && drafts.length > 0 && (
            <span className="ml-2 text-xs font-normal text-chalk-300">
              {drafts.length} saved
            </span>
          )}
        </h2>
        <button
          onClick={onStartNew}
          className="text-xs uppercase tracking-wider font-medium text-chalk-50/90
                     hover:text-chalk-50 transition-colors border border-chalk-50/30
                     hover:border-chalk-50 px-3 py-1 rounded"
        >
          + Start new
        </button>
      </header>
      <div className="p-4 md:p-5">
        {loading ? (
          <div className="text-sm text-slate-500 py-4 text-center">Loading drafts…</div>
        ) : error ? (
          <div className="text-sm text-bad p-3 bg-red-50 border border-red-200 rounded">
            Couldn't load drafts: {error}
          </div>
        ) : drafts.length === 0 ? (
          <EmptyDraftsState onStartNew={onStartNew} />
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <DraftRow
                key={d.id}
                draft={d}
                onResume={() => onResume(d.id)}
                onDelete={() => onDelete(d)}
                onRename={() => onRename(d)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EmptyDraftsState({ onStartNew }) {
  return (
    <div className="text-center py-6">
      <div className="w-12 h-12 rounded-full bg-page-50 border border-page-200
                      flex items-center justify-center mx-auto mb-3">
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7 7h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v15a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-sm text-slate-600 mb-3 max-w-sm mx-auto">
        No drafts yet. Use <span className="font-medium text-slate-800">Save draft</span> on
        the deal sheet to keep your work in progress for later.
      </p>
      <button
        onClick={onStartNew}
        className="px-4 py-2 bg-navy-900 text-chalk-50 text-sm font-medium rounded
                   hover:bg-navy-800 transition-colors"
      >
        Start a new deal
      </button>
    </div>
  );
}

function DraftRow({ draft, onResume, onDelete, onRename }) {
  const itemCount = Array.isArray(draft.equipment_items) ? draft.equipment_items.length : 0;
  const total = itemCount > 0
    ? draft.equipment_items.reduce((sum, it) => sum + (it.list_price ?? 0) * (it.quantity ?? 1), 0)
    : 0;
  const updatedRelative = formatRelativeTime(draft.updated_at);

  return (
    <li className="bg-page-50 border border-page-200 rounded p-3 md:p-4
                   hover:border-navy-300 transition-colors">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <ModePill mode={draft.submit_mode} />
            <h3 className="text-sm md:text-base font-medium text-slate-900 truncate">
              {draft.draft_name}
            </h3>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
            <span>
              {itemCount === 0
                ? 'No equipment yet'
                : `${itemCount} item${itemCount === 1 ? '' : 's'} · $${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </span>
            <span>·</span>
            <span>Updated {updatedRelative}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onResume}
            className="px-3 py-1.5 bg-navy-900 text-chalk-50 text-xs font-medium rounded
                       hover:bg-navy-800 transition-colors whitespace-nowrap"
          >
            Resume
          </button>
          <button
            onClick={onRename}
            className="px-2 py-1.5 text-xs text-slate-600 hover:text-navy-900
                       hover:bg-page-100 rounded transition-colors"
            title="Rename"
          >
            Rename
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-bad hover:bg-red-50 rounded transition-colors"
            aria-label="Delete draft"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
            </svg>
          </button>
        </div>
      </div>
    </li>
  );
}

/* ───────────────────────── Submissions section ───────────────────────── */

function SubmissionsSection({ rows, totalCount, loading, error, filter, onFilterChange, configured, expandedId, onToggleExpand, onEditQuote, onDecision, onResubmit }) {
  // Counts for the filter pills come from totalCount (unfiltered) so the
  // numbers don't shift as the rep flips between filters.
  return (
    <section className="bg-white border border-page-200 rounded-lg overflow-hidden mb-4">
      <header className="bg-navy-900 text-chalk-50 px-4 md:px-5 py-3 flex items-center justify-between gap-3">
        <h2 className="text-sm md:text-base font-medium">
          Submitted
          {!loading && totalCount > 0 && (
            <span className="ml-2 text-xs font-normal text-chalk-300">
              {totalCount} total
            </span>
          )}
        </h2>
      </header>

      {/* Filter pills — only render if there's anything to filter. */}
      {!loading && totalCount > 0 && (
        <div className="px-4 md:px-5 pt-3 flex gap-2 flex-wrap">
          <FilterPill active={filter === 'all'}   onClick={() => onFilterChange('all')}>All</FilterPill>
          <FilterPill active={filter === 'quote'} onClick={() => onFilterChange('quote')}>Quotes</FilterPill>
          <FilterPill active={filter === 'deal'}  onClick={() => onFilterChange('deal')}>Deals</FilterPill>
        </div>
      )}

      <div className="p-4 md:p-5">
        {!configured ? (
          <div className="text-sm text-slate-600 p-3 bg-warn/5 border border-warn/30 rounded">
            Submitted records are stored in the deal pipeline, which isn't configured.
            An admin needs to set the pipeline environment variables in Netlify before
            this section can load anything.
          </div>
        ) : loading ? (
          <div className="text-sm text-slate-500 py-4 text-center">Loading submissions…</div>
        ) : error ? (
          <div className="text-sm text-bad p-3 bg-red-50 border border-red-200 rounded">
            Couldn't load submissions: {error}
          </div>
        ) : totalCount === 0 ? (
          <EmptySubmissionsState />
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">
            No matching {filter === 'quote' ? 'quotes' : 'deals'} yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <SubmissionRow
                key={row.id}
                row={row}
                expanded={expandedId === row.id}
                onToggle={() => onToggleExpand(row.id)}
                onEditQuote={onEditQuote}
                onDecision={onDecision}
                onResubmit={onResubmit}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EmptySubmissionsState() {
  return (
    <div className="text-center py-6">
      <div className="w-12 h-12 rounded-full bg-page-50 border border-page-200
                      flex items-center justify-center mx-auto mb-3">
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-sm text-slate-600 max-w-sm mx-auto">
        Nothing submitted yet. Once you send a quote or submit a deal, it shows up here.
      </p>
    </div>
  );
}

function SubmissionRow({ row, expanded, onToggle, onEditQuote, onDecision, onResubmit }) {
  const isQuote = row.is_quote === true;
  const createdRelative = formatRelativeTime(row.created_at);
  const customerName =
    row.contact_name ||
    [row.first_name, row.last_name].filter(Boolean).join(' ') ||
    '(no name)';
  const location = [row.city, row.state].filter(Boolean).join(', ');
  const totalDisplay = row.total_eq_cost || '';

  return (
    <li className={`bg-page-50 border rounded transition-colors overflow-hidden
                    ${expanded ? 'border-navy-400 shadow-sm' : 'border-page-200 hover:border-navy-300'}`}>
      {/* Header — clickable to toggle expansion. The whole row is the
          target (not just a chevron) so the touch surface is generous. */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3 md:p-4 cursor-pointer hover:bg-page-100/40 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <TypePill isQuote={isQuote} />
              {isQuote && row.quote_number && (
                <span className="text-[11px] font-mono font-medium text-slate-700">
                  {row.quote_number}
                  {row.quote_revision > 1 && (
                    <span className="text-slate-400 font-normal"> · rev {row.quote_revision}</span>
                  )}
                </span>
              )}
              {isQuote && <QuoteDecisionPill decision={row.customer_decision} />}
              {!isQuote && row.phase && <PhasePill phase={row.phase} />}
              {!isQuote && row.current_step && <StepPill step={row.current_step} />}
              {/* v31: surface the director-approval state on the row. Renders
                  null for deals that never entered director review, so it
                  costs nothing on the common path. */}
              {!isQuote && (
                <DirectorDecisionPill
                  decision={row.director_decision}
                  resubmissionCount={row.resubmission_count || 0}
                />
              )}
              {isQuote && row.quote_first_viewed_at && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-slate-500"
                      title={`First viewed ${new Date(row.quote_first_viewed_at).toLocaleString()}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                  Viewed
                </span>
              )}
            </div>
            <h3 className="text-sm md:text-base font-medium text-slate-900 truncate">
              {row.store_name || customerName}
            </h3>
            <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
              <span>{customerName}</span>
              {location && <><span>·</span><span>{location}</span></>}
              {totalDisplay && <><span>·</span><span className="font-mono">{totalDisplay}</span></>}
              <span>·</span>
              <span>Submitted {createdRelative}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 text-slate-400">
            <span className="text-[10px] uppercase tracking-wider font-medium">
              {expanded ? 'Hide' : 'Details'}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      </button>

      {/* Detail panel — rendered only when expanded. Border-top creates a
          visual seam between the header and the panel. */}
      {expanded && (
        <div className="border-t border-page-200 bg-white">
          <SubmissionDetail
            row={row}
            isQuote={isQuote}
            onEditQuote={onEditQuote}
            onDecision={onDecision}
            onResubmit={onResubmit}
          />
        </div>
      )}
    </li>
  );
}

/* ───────────────────────── Detail panel ───────────────────────── */

/**
 * The inline detail view shown when a submission row is expanded. Renders:
 *   - Customer info card (contact + store + address)
 *   - Equipment summary (from raw_csv.equipment_items if present, else the
 *     equipment_selection text blob)
 *   - Visual stepper for the current phase (read-only)
 *   - For quotes: edit button, copy-link/open-quote actions, customer
 *     decision form
 *   - For deals: a small note pointing reps to the Pipeline dashboard for
 *     any further edits
 */
function SubmissionDetail({ row, isQuote, onEditQuote, onDecision, onResubmit }) {
  return (
    <div className="p-4 md:p-5 space-y-5">
      {/* Phase stepper — only render when phase is in {leasing, ops, pending_director}.
          Sales-phase quotes don't need a stepper (there's only one step). */}
      {(row.phase === 'leasing' || row.phase === 'ops' || row.phase === 'pending_director') && (
        <div>
          <SectionLabel>
            {PHASE_LABELS[row.phase] || row.phase} Progress
            {isTerminalDenial(row.current_step) && (
              <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-bad">
                · Credit Denied
              </span>
            )}
          </SectionLabel>
          <PhaseStepper phase={row.phase} currentStep={row.current_step} />
        </div>
      )}

      {/* Sales phase + quote — show a small notice instead of a stepper */}
      {row.phase === 'sales' && isQuote && (
        <div className="bg-accent-500/5 border border-accent-500/30 rounded p-3 text-xs text-slate-700">
          <div className="font-medium text-slate-900 mb-0.5">Quote sent — awaiting customer decision</div>
          Once the customer responds, record their decision below. That moves the deal forward into Financing or Operations.
        </div>
      )}

      {/* v32: Full deal detail view (same six sections the director sees on
          My Team). Replaces the narrower Customer/Store/Equipment trio that
          lived here previously. Reps can now see everything they submitted
          plus customer + director decision feedback inline, without needing
          access to the Pipeline dashboard. */}
      <div className="bg-white border border-page-200 rounded-lg overflow-hidden">
        <DealDetailView deal={row} />
      </div>

      {/* Actions — different for quotes vs deals */}
      {isQuote ? (
        <QuoteActions row={row} onEditQuote={onEditQuote} onDecision={onDecision} />
      ) : (
        <DealActions row={row} onResubmit={onResubmit} />
      )}
    </div>
  );
}

/* ───────────────────────── Stepper ───────────────────────── */

/**
 * Horizontal stepper showing every step in the phase's sequence, with the
 * current step highlighted. Read-only — the rep can see where the deal is
 * but can't advance it from here (that happens in the Pipeline dashboard).
 *
 * On mobile (< md breakpoint), wraps to multiple lines so labels stay
 * readable. On desktop, all steps fit on one row with connector lines.
 */
function PhaseStepper({ phase, currentStep }) {
  const statuses = getStepStatuses(phase, currentStep);
  if (statuses.length === 0) {
    return <div className="text-xs text-slate-500 italic">No phase steps to show.</div>;
  }

  return (
    <ol className="flex flex-wrap items-stretch gap-x-1 gap-y-3 md:gap-y-0">
      {statuses.map((step, idx) => (
        <li key={step.key} className="flex items-stretch min-w-0">
          <StepperNode label={step.label} status={step.status} />
          {idx < statuses.length - 1 && (
            <div className="hidden md:flex items-center px-1">
              <div className={`h-px w-6
                              ${step.status === 'past' ? 'bg-navy-700' : 'bg-page-300'}`} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function StepperNode({ label, status }) {
  const isPast    = status === 'past';
  const isCurrent = status === 'current';
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap
                    ${isCurrent ? 'bg-navy-900 text-chalk-50 ring-1 ring-navy-900' :
                      isPast    ? 'bg-ok/10 text-ok' :
                                  'bg-white border border-page-200 text-slate-500'}`}>
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px]
                       ${isCurrent ? 'bg-chalk-50/20' : isPast ? 'bg-ok/20' : 'bg-page-100'}`}>
        {isPast ? (
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        ) : isCurrent ? (
          <span className="w-1.5 h-1.5 rounded-full bg-chalk-50" />
        ) : null}
      </span>
      {label}
    </div>
  );
}

/* ───────────────────────── Quote actions + decision form ───────────────────────── */

function QuoteActions({ row, onEditQuote, onDecision }) {
  const url = buildQuoteUrl(row.quote_number, row.quote_token);
  const [copied, setCopied] = useState(false);

  // Only render the decision form when no decision has been recorded yet.
  // Once a decision exists, the deal has moved phases; further changes
  // happen in the Pipeline dashboard, not here.
  const showDecisionForm = !row.customer_decision || row.customer_decision === 'pending';

  function copyLink() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-4">
      {/* Action buttons row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onEditQuote(row.id)}
          className="px-3 py-1.5 bg-navy-900 text-chalk-50 text-xs font-medium rounded
                     hover:bg-navy-800 transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit & re-send
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 border border-page-300 bg-white text-slate-700 text-xs font-medium rounded
                     hover:bg-page-50 hover:border-navy-300 transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open quote page
        </a>
        <button
          onClick={copyLink}
          className="px-3 py-1.5 border border-page-300 bg-white text-slate-700 text-xs font-medium rounded
                     hover:bg-page-50 hover:border-navy-300 transition-colors whitespace-nowrap"
          title="Copy customer-facing quote link"
        >
          {copied ? '✓ Link copied' : 'Copy link'}
        </button>
      </div>

      {/* Cover note (if any) — useful context when deciding what to edit */}
      {row.quote_cover_note && (
        <div className="bg-page-50 border border-page-200 rounded p-3">
          <SectionLabel>Cover note to customer</SectionLabel>
          <p className="text-xs text-slate-700 whitespace-pre-wrap">{row.quote_cover_note}</p>
        </div>
      )}

      {/* Decision form OR decision summary */}
      {showDecisionForm ? (
        <DecisionForm row={row} onDecision={onDecision} />
      ) : (
        <DecisionSummary row={row} />
      )}
    </div>
  );
}

/**
 * Form for recording the customer's reply to the quote. The rep picks one
 * of the standard outcomes; on submit we update the deal and advance the
 * phase per the DECISIONS table's rules.
 *
 * Local state captures the selection so the rep can review before clicking
 * Save — accidentally clicking "Declined" and losing the quote would be
 * a frustrating mistake.
 */
function DecisionForm({ row, onDecision }) {
  const [selected, setSelected] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!selected) return;
    const decision = DECISIONS.find((d) => d.value === selected);
    const confirmMsg = decision.closed
      ? `Mark this quote as Declined? The deal will be closed and can't be reopened from here.`
      : `Record ${decision.label}? The deal will move into ${decision.nextPhase} phase.`;
    if (!window.confirm(confirmMsg)) return;
    setSaving(true);
    const { error } = await onDecision(row, selected, notes.trim() || null);
    setSaving(false);
    if (!error) {
      setSelected('');
      setNotes('');
    }
  }

  return (
    <div className="bg-page-50 border border-page-200 rounded p-3 md:p-4">
      <SectionLabel>Record customer decision</SectionLabel>
      <p className="text-xs text-slate-600 mb-3">
        When the customer replies to your quote, log their response here. The deal will
        automatically advance into the appropriate phase.
      </p>

      <div className="space-y-2 mb-3">
        {DECISIONS.map((d) => (
          <label key={d.value}
                 className={`flex items-start gap-3 p-2 rounded cursor-pointer border transition-colors
                            ${selected === d.value
                              ? 'border-navy-600 bg-white'
                              : 'border-page-200 bg-white hover:border-navy-300'}`}>
            <input
              type="radio"
              name={`decision-${row.id}`}
              value={d.value}
              checked={selected === d.value}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-0.5 accent-navy-700"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-900">{d.label}</div>
              <div className="text-[11px] text-slate-500">
                {d.closed
                  ? 'Deal closed — customer is not moving forward'
                  : `Moves to ${PHASE_LABELS[d.nextPhase] || d.nextPhase} phase (${STEP_LABELS[d.nextStep] || d.nextStep})`}
              </div>
            </div>
          </label>
        ))}
      </div>

      <label className="block mb-3">
        <span className="block text-[11px] uppercase tracking-wider text-slate-600 mb-1 font-semibold">
          Notes <span className="text-slate-400 font-normal normal-case tracking-normal">(optional)</span>
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Customer wants to delay install until next month."
          className="w-full px-3 py-2 bg-white border border-page-200 rounded text-sm
                     focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10
                     focus:outline-none transition-colors resize-y"
        />
      </label>

      <button
        onClick={handleSave}
        disabled={!selected || saving}
        className="px-4 py-2 bg-navy-900 text-chalk-50 text-sm font-medium rounded
                   hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
      >
        {saving ? 'Saving…' : 'Save decision'}
      </button>
    </div>
  );
}

/**
 * Read-only summary shown once a decision has been recorded. The decision
 * itself is in the row's status pill at the top of the row, but the notes
 * and timestamp belong here.
 */
function DecisionSummary({ row }) {
  const decision = DECISIONS.find((d) => d.value === row.customer_decision);
  if (!decision) return null;
  const when = row.customer_decision_at
    ? new Date(row.customer_decision_at).toLocaleString()
    : 'recently';
  return (
    <div className="bg-page-50 border border-page-200 rounded p-3">
      <SectionLabel>Customer decision</SectionLabel>
      <div className="text-sm text-slate-900 font-medium">{decision.label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">Recorded {when}</div>
      {row.customer_decision_notes && (
        <p className="text-xs text-slate-700 mt-2 whitespace-pre-wrap">
          {row.customer_decision_notes}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── Deal actions (read-only) ───────────────────────── */

/**
 * v31: DealActions renders one of four panels at the bottom of the
 * SubmissionDetail for a non-quote (direct-submit) deal, picked by inspecting
 * `director_decision`:
 *
 *   1. **rejected** — the director sent the deal back. Red banner showing
 *      the director's note (`director_decision_notes`) and a prominent
 *      "Revise and resubmit" CTA that opens the resubmit modal. This is
 *      the only branch where the rep has an action to take.
 *
 *   2. **pending_director** (decision === 'pending') — amber waiting notice.
 *      Lets the rep know the deal is sitting in their director's queue and
 *      that there's nothing for them to do here.
 *
 *   3. **approved** — green confirmation showing the director's optional
 *      note. Usually visible only briefly before the deal advances out of
 *      pending_director into ops, but we render it gracefully if the row
 *      hasn't refreshed yet.
 *
 *   4. **default** — the original view-only panel pointing the rep at the
 *      Pipeline dashboard. Used for any deal that never entered the
 *      director-approval flow (leases / finance) or has already moved on.
 */
function DealActions({ row, onResubmit }) {
  const dec = row.director_decision;

  // Branch 1: rejected — surface the rejection reason + resubmit CTA
  if (dec === 'rejected') {
    const reason = row.director_decision_notes;
    const decidedBy = row.director_decision_by;
    const decidedAt = row.director_decision_at;
    const tries = row.resubmission_count || 0;
    return (
      <div className="bg-red-50 border border-bad/40 rounded p-3 md:p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-bad flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-bad mb-1">
              Director rejected this deal
              {tries > 0 && (
                <span className="ml-2 text-[10px] uppercase tracking-wider font-medium text-bad/80 bg-bad/10 rounded-full px-2 py-0.5">
                  {tries === 1 ? '1 prior retry' : `${tries} prior retries`}
                </span>
              )}
            </div>
            {reason ? (
              <div className="text-xs text-slate-700 bg-white border border-bad/20 rounded p-2 mb-2 whitespace-pre-wrap">
                <span className="text-[10px] uppercase tracking-wider font-bold text-bad/70 block mb-0.5">
                  Director's note
                </span>
                {reason}
              </div>
            ) : (
              <div className="text-xs text-slate-600 italic mb-2">
                No reason was provided. Reach out to {decidedBy || 'your director'} for context.
              </div>
            )}
            <div className="text-[11px] text-slate-500 mb-3">
              {decidedBy && <>Decided by {decidedBy}</>}
              {decidedBy && decidedAt && <> · </>}
              {decidedAt && <>{formatRelativeTime(decidedAt)}</>}
            </div>
            <button
              type="button"
              onClick={() => onResubmit && onResubmit(row)}
              disabled={!onResubmit}
              className="inline-flex items-center gap-1.5 bg-navy-900 text-chalk-50 text-xs font-semibold uppercase tracking-wider px-3 py-2 rounded hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Revise and resubmit
            </button>
            {row.id && (
              <div className="mt-2 text-[10px] text-slate-500 font-mono">Deal ID: {row.id}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Branch 2: pending — waiting on director, no action for the rep
  if (dec === 'pending') {
    return (
      <div className="bg-accent-500/10 border border-accent-500/40 rounded p-3 md:p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-accent-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-accent-700 mb-0.5">
              Waiting on director approval
            </div>
            <div className="text-xs text-slate-700">
              This deal is in your director's queue. They'll either approve and advance it to
              operations, or send it back with notes so you can revise. There's nothing for you
              to do here — you'll see the result on this page when they decide.
            </div>
            {(row.resubmission_count || 0) > 0 && (
              <div className="text-[11px] text-accent-700/70 mt-2">
                This is retry {row.resubmission_count}. Hang tight.
              </div>
            )}
            {row.id && (
              <div className="mt-2 text-[10px] text-slate-500 font-mono">Deal ID: {row.id}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Branch 3: approved — green confirmation, optional director's note
  if (dec === 'approved') {
    const note = row.director_decision_notes;
    const decidedBy = row.director_decision_by;
    return (
      <div className="bg-ok/10 border border-ok/40 rounded p-3 md:p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-ok flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ok mb-0.5">
              Director approved this deal
            </div>
            <div className="text-xs text-slate-700">
              {decidedBy ? `${decidedBy} approved this deal — it's been advanced to operations.` :
                "Approved — this deal has been advanced to operations."}
            </div>
            {note && (
              <div className="text-xs text-slate-700 bg-white border border-ok/20 rounded p-2 mt-2 whitespace-pre-wrap">
                <span className="text-[10px] uppercase tracking-wider font-bold text-ok/70 block mb-0.5">
                  Director's note
                </span>
                {note}
              </div>
            )}
            {row.id && (
              <div className="mt-2 text-[10px] text-slate-500 font-mono">Deal ID: {row.id}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Branch 4: default — the original view-only panel for non-approval-flow deals
  return (
    <div className="bg-page-50 border border-page-200 rounded p-3 text-xs text-slate-600">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <div className="font-medium text-slate-900 mb-0.5">View-only here</div>
          This deal is now in the leasing/operations team's hands. To update phase, advance steps,
          edit equipment, or close out the deal, use the Deal Pipeline dashboard — your admin can
          give you access if you don't have it yet.
          {row.id && (
            <div className="mt-2 text-[11px] text-slate-500 font-mono">Deal ID: {row.id}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Small primitives ───────────────────────── */

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-bold">
      {children}
    </div>
  );
}

// DetailCard / DetailField removed in v32 — the rich SubmissionDetail
// now embeds DealDetailView (shared with MyTeamPage) rather than building
// its own narrower customer/store grid.

function StepPill({ step }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium
                     bg-slate-100 text-slate-700">
      {STEP_LABELS[step] || step}
    </span>
  );
}

/* ───────────────────────── Pills & primitives ───────────────────────── */

function ModePill({ mode }) {
  const isQuote = mode === 'quote';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold
                     ${isQuote
                       ? 'bg-accent-500/15 text-accent-700'
                       : 'bg-navy-900/10 text-navy-800'}`}>
      {isQuote ? 'Quote' : 'Deal'}
    </span>
  );
}

function TypePill({ isQuote }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold
                     ${isQuote
                       ? 'bg-accent-500/15 text-accent-700'
                       : 'bg-navy-900 text-chalk-50'}`}>
      {isQuote ? 'Quote' : 'Deal'}
    </span>
  );
}

function PhasePill({ phase }) {
  // Pipeline phases: sales → leasing → ops, plus v31's pending_director.
  // Sales shouldn't appear here for direct-submit deals but we cover it for safety.
  const label = {
    sales:            'Sales',
    pending_director: 'Director Review',
    leasing:          'Leasing',
    ops:              'Operations',
  }[phase] || phase;
  // v31: pending_director gets accent styling so it visually separates from
  // the neutral slate pills used for the standard phases. This makes the
  // "needs attention" deals pop on a long list.
  const cls = phase === 'pending_director'
    ? 'bg-accent-500/15 text-accent-700'
    : 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium ${cls}`}>
      {label}
    </span>
  );
}

function QuoteDecisionPill({ decision }) {
  // customer_decision values: pending, lease, finance, purchase, loan, declined
  if (!decision || decision === 'pending') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium
                       bg-page-100 text-slate-600">
        Awaiting reply
      </span>
    );
  }
  if (decision === 'declined') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium
                       bg-red-50 text-bad">
        Declined
      </span>
    );
  }
  // Any positive decision (lease, finance, purchase, loan) = accepted.
  const label = {
    lease:    'Accepted (Lease)',
    finance:  'Accepted (Finance)',
    purchase: 'Accepted (Purchase)',
    loan:     'Accepted (Loan)',
  }[decision] || `Accepted (${decision})`;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium
                     bg-ok/10 text-ok">
      {label}
    </span>
  );
}

/**
 * v31: DirectorDecisionPill — the director-approval status for a deal that
 * has been routed through the pending_director phase (Purchase or Loan).
 *
 * Renders only when there's something meaningful to show. Returns null for
 * deals that never entered the director-approval flow (e.g. leases, finance,
 * customer-declined quotes). The three states it surfaces are:
 *
 *   - 'pending'  — waiting on the director. Amber/neutral tone; gentle "in
 *                  progress" affordance so the rep knows it's normal.
 *   - 'rejected' — the director sent it back. Red tone to draw the eye; the
 *                  resubmission badge (rev N) appears alongside if the rep
 *                  has tried more than once.
 *   - 'approved' — green check; cleared for ops. Usually visible briefly
 *                  before the deal phase advances to ops, but we still show
 *                  it if the row hasn't refreshed yet.
 *
 * Resubmission count is surfaced as "(retry N)" appended to the pill text so
 * it stays compact in the row header. We start showing it at count >= 1
 * because count 0 just means "first submission" — not useful information.
 */
function DirectorDecisionPill({ decision, resubmissionCount }) {
  if (!decision) return null;

  if (decision === 'pending') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium
                       bg-accent-500/15 text-accent-700"
            title="Waiting on the director's approval">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-500 mr-1.5 animate-pulse" />
        Pending director
        {resubmissionCount > 0 && (
          <span className="ml-1 text-accent-700/70 font-normal normal-case">
            · retry {resubmissionCount}
          </span>
        )}
      </span>
    );
  }

  if (decision === 'rejected') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium
                       bg-red-50 text-bad"
            title="The director rejected this deal. Open the row to see why and resubmit.">
        Director rejected
        {resubmissionCount > 0 && (
          <span className="ml-1 text-bad/70 font-normal normal-case">
            · {resubmissionCount === 1 ? '1 retry' : `${resubmissionCount} retries`}
          </span>
        )}
      </span>
    );
  }

  if (decision === 'approved') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium
                       bg-ok/10 text-ok"
            title="The director approved this deal.">
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Director approved
      </span>
    );
  }

  return null;
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                 ${active
                   ? 'bg-navy-900 text-chalk-50'
                   : 'bg-white border border-page-200 text-slate-700 hover:border-navy-300'}`}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── Utilities ───────────────────────── */

/**
 * "X ago" formatting for short, glanceable timestamps. We deliberately keep
 * the precision coarse — knowing whether a draft was last touched 2 minutes
 * or 5 minutes ago doesn't matter; whether it was today or last week does.
 */
function formatRelativeTime(isoString) {
  if (!isoString) return 'recently';
  const then = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24)   return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7)   return `${diffDay} days ago`;
  // Beyond a week, an absolute short date is clearer than "27 days ago"
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Same shape as DealBuilder's buildQuoteUrl — the customer-facing route.
 * Inlined here to avoid pulling DealBuilder into this page just for one util.
 */
function buildQuoteUrl(quoteNumber, token) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/#/quote/${quoteNumber}?t=${token}`;
}

/* ───────────────────────── v31 Resubmit modal ───────────────────────── */

/**
 * ResubmitModal — opened from the rejected-deal banner in DealActions.
 *
 * Workflow:
 *   1. Rep opens a rejected deal in My Deals
 *   2. Sees the red banner with the director's rejection reason
 *   3. Clicks "Revise and resubmit"
 *   4. THIS MODAL appears, collecting an optional note ("here's what I
 *      changed") that becomes part of the audit trail
 *   5. On Resubmit, the parent calls resubmitDeal() which flips the deal
 *      back into the director's queue
 *
 * The modal is intentionally light on form fields — the rep has presumably
 * already revised the deal elsewhere (or is about to once it lands back in
 * draft mode). This is purely the "send it back for another look" action.
 * If we later want the rep to revise the equipment list/customer info from
 * this exact flow, we'd add a "Open in Deal Builder" branch that hydrates
 * the deal back into a draft — but that's a separate workflow.
 *
 * Accessibility: Escape closes, click-outside closes, the textarea is
 * focused on open so a rep typing the note doesn't need to tab/click first.
 */
function ResubmitModal({ row, submitting, error, onCancel, onSubmit }) {
  const [notes, setNotes] = useState('');

  // Escape key closes the modal (unless we're mid-submit, to avoid losing
  // a request in flight). Mounted once per modal lifetime.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !submitting) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  function handleSubmit() {
    if (submitting) return;
    onSubmit(notes.trim() || null);
  }

  const customerName =
    row.contact_name ||
    [row.first_name, row.last_name].filter(Boolean).join(' ') ||
    '(no name)';
  const rejectionReason = row.director_decision_notes;
  const priorRetries = row.resubmission_count || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resubmit-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-navy-900 text-chalk-50 px-5 py-3 flex items-center justify-between gap-3 flex-shrink-0">
          <div>
            <h2 id="resubmit-modal-title" className="text-base font-semibold">
              Revise and resubmit
            </h2>
            <div className="text-[11px] uppercase tracking-wider text-chalk-50/70 mt-0.5">
              {row.store_name || customerName}
              {priorRetries > 0 && <> · attempt {priorRetries + 1}</>}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-chalk-50/70 hover:text-chalk-50 disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          {/* Surface the director's reason at the top of the modal so the
              rep can refer to it while writing their resubmit note. */}
          {rejectionReason && (
            <div className="bg-red-50 border border-bad/30 rounded p-3 text-xs text-slate-700">
              <div className="text-[10px] uppercase tracking-wider font-bold text-bad/80 mb-1">
                Why it was rejected
              </div>
              <div className="whitespace-pre-wrap">{rejectionReason}</div>
            </div>
          )}

          <div>
            <label htmlFor="resubmit-notes" className="block text-xs uppercase tracking-wider font-bold text-slate-700 mb-1">
              What changed? <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              id="resubmit-notes"
              autoFocus
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              placeholder="e.g. Updated the customer's address and removed the second espresso machine per the note above."
              className="w-full text-sm border border-page-300 rounded px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-navy-300 focus:border-navy-400 disabled:bg-page-50 disabled:text-slate-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Your note will be visible to the director when they review the resubmission.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-bad/40 rounded p-2.5 text-xs text-bad">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-page-50 border-t border-page-200 px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-xs font-semibold uppercase tracking-wider px-3 py-2 rounded border border-page-300 text-slate-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="text-xs font-semibold uppercase tracking-wider px-3 py-2 rounded bg-navy-900 text-chalk-50 hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Resubmitting…' : 'Resubmit for review'}
          </button>
        </div>
      </div>
    </div>
  );
}
