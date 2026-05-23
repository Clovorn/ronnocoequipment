import { useEffect, useState } from 'react';
import { listMyDrafts, deleteDraft, renameDraft } from '../lib/draftStorage.js';
import { fetchMyDeals, isDealPipelineConfigured } from '../lib/dealPipeline.js';

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
 *      quotes and direct-submit deals. Actions: Open quote (public URL),
 *      Copy quote link, or for direct deals, "View in Pipeline".
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

  /* ─── Action handlers ─── */

  function handleResume(draftId) {
    navigate('deal', { draftId });
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

function SubmissionsSection({ rows, totalCount, loading, error, filter, onFilterChange, configured }) {
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
              <SubmissionRow key={row.id} row={row} />
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

function SubmissionRow({ row }) {
  const isQuote = row.is_quote === true;
  const createdRelative = formatRelativeTime(row.created_at);
  const customerName =
    row.contact_name ||
    [row.first_name, row.last_name].filter(Boolean).join(' ') ||
    '(no name)';
  const location = [row.city, row.state].filter(Boolean).join(', ');
  const totalDisplay = row.total_eq_cost || '';

  return (
    <li className="bg-page-50 border border-page-200 rounded p-3 md:p-4 hover:border-navy-300 transition-colors">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <TypePill isQuote={isQuote} />
            {isQuote && row.quote_number && (
              <span className="text-[11px] font-mono font-medium text-slate-700">
                {row.quote_number}
              </span>
            )}
            {isQuote && <QuoteDecisionPill decision={row.customer_decision} />}
            {!isQuote && row.phase && <PhasePill phase={row.phase} />}
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {isQuote && row.quote_number && row.quote_token && (
            <SubmissionActions row={row} />
          )}
          {!isQuote && (
            <span className="text-[11px] text-slate-500 italic max-w-[10rem] text-right">
              View in Pipeline dashboard
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function SubmissionActions({ row }) {
  const url = buildQuoteUrl(row.quote_number, row.quote_token);
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      <button
        onClick={copyLink}
        className="px-3 py-1.5 text-xs text-slate-600 hover:text-navy-900
                   hover:bg-page-100 rounded border border-page-200 transition-colors whitespace-nowrap"
        title="Copy customer-facing quote link"
      >
        {copied ? '✓ Copied' : 'Copy link'}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 bg-navy-900 text-chalk-50 text-xs font-medium rounded
                   hover:bg-navy-800 transition-colors whitespace-nowrap"
      >
        Open quote
      </a>
    </>
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
