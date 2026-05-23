import { useEffect, useState } from 'react';
import { listMyDrafts, deleteDraft, renameDraft } from '../lib/draftStorage.js';
import {
  fetchMyDeals,
  fetchDealById,
  recordCustomerDecision,
  isDealPipelineConfigured,
} from '../lib/dealPipeline.js';
import { DECISIONS, getStepStatuses, isTerminalDenial, PHASE_LABELS, STEP_LABELS } from '../lib/pipelineSteps.js';

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
    return () => { cancelled = true; };
  }, [session?.user?.email]);

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
      />
    </div>
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

function SubmissionsSection({ rows, totalCount, loading, error, filter, onFilterChange, configured, expandedId, onToggleExpand, onEditQuote, onDecision }) {
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

function SubmissionRow({ row, expanded, onToggle, onEditQuote, onDecision }) {
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
function SubmissionDetail({ row, isQuote, onEditQuote, onDecision }) {
  const customerName =
    row.contact_name ||
    [row.first_name, row.last_name].filter(Boolean).join(' ') ||
    '(no name)';
  const fullAddress = [row.address, row.city, row.state, row.zip_code].filter(Boolean).join(', ');
  // equipment_items lives in raw_csv per the submit-time snapshot
  const equipmentItems = Array.isArray(row.raw_csv?.equipment_items)
    ? row.raw_csv.equipment_items
    : [];

  return (
    <div className="p-4 md:p-5 space-y-5">
      {/* Phase stepper — only render when phase is in {leasing, ops}. Sales-
          phase quotes don't need a stepper (there's only one step). */}
      {(row.phase === 'leasing' || row.phase === 'ops') && (
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

      {/* Customer + store grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard title="Customer">
          <DetailField label="Name" value={customerName} />
          {row.contact_email && <DetailField label="Email" value={row.contact_email} mono />}
          {(row.contact_cell || row.phone) && <DetailField label="Phone" value={row.contact_cell || row.phone} mono />}
        </DetailCard>
        <DetailCard title="Store">
          <DetailField label="Name" value={row.store_name || '—'} />
          {fullAddress && <DetailField label="Address" value={fullAddress} />}
          {row.deal_type && <DetailField label="Deal type" value={row.deal_type} />}
        </DetailCard>
      </div>

      {/* Equipment */}
      <div>
        <SectionLabel>
          Equipment
          {equipmentItems.length > 0 && (
            <span className="ml-1 text-slate-400 font-normal text-[10px]">
              · {equipmentItems.length} item{equipmentItems.length === 1 ? '' : 's'}
            </span>
          )}
          {row.total_eq_cost && (
            <span className="ml-2 text-slate-500 font-mono text-[11px]">
              {row.total_eq_cost}
            </span>
          )}
        </SectionLabel>
        {equipmentItems.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {equipmentItems.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between gap-2 bg-page-50 px-3 py-1.5 rounded border border-page-200">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-slate-700">{item.quantity}×</span>{' '}
                  <span className="text-slate-700">{item.description}</span>
                  {item.model && <span className="text-slate-400"> ({item.model})</span>}
                </span>
                <span className="text-slate-500 font-mono whitespace-nowrap">
                  ${((item.list_price || 0) * (item.quantity || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </li>
            ))}
          </ul>
        ) : row.equipment_selection ? (
          <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-page-50 border border-page-200 rounded p-3 font-mono">
            {row.equipment_selection}
          </pre>
        ) : (
          <div className="text-xs text-slate-500 italic">No equipment recorded.</div>
        )}
      </div>

      {/* Actions — different for quotes vs deals */}
      {isQuote ? (
        <QuoteActions row={row} onEditQuote={onEditQuote} onDecision={onDecision} />
      ) : (
        <DealActions row={row} />
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

function DealActions({ row }) {
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

function DetailCard({ title, children }) {
  return (
    <div className="bg-page-50 border border-page-200 rounded p-3">
      <SectionLabel>{title}</SectionLabel>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailField({ label, value, mono }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-slate-500 min-w-[4rem]">{label}:</span>
      <span className={`text-slate-900 min-w-0 flex-1 break-words ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

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
  // Pipeline phases: sales → leasing → ops. Sales shouldn't appear here for
  // direct-submit deals but we cover it for safety.
  const label = {
    sales:   'Sales',
    leasing: 'Leasing',
    ops:     'Operations',
  }[phase] || phase;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium
                     bg-slate-100 text-slate-700">
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
