# v31 — Session 2: MyTeamPage Component

This ZIP is **cumulative** — it contains Session 1's foundation files plus
the new `MyTeamPage.jsx` from this session. The contents on top of plain main
should be enough for the next session to start from (Session 3 will pull
fresh main and re-apply this cumulative state).

**Still not a complete v31 release** — Sessions 3, 4, and 5 add the nav
wiring, the DealBuilder/MyDealsPage updates, and the final packaging.
Don't deploy this on its own.

## What's new in Session 2

```
src/components/MyTeamPage.jsx   (785 lines)
```

## What's carried forward from Session 1

```
supabase/migrations/20260523_v31_director_approval_pipeline.sql
src/lib/pipelineSteps.js
src/lib/useRouter.js
src/lib/dealPipeline.js
```

Unchanged from Session 1's ZIP. Re-verified parse-clean as part of this
session's checks.

## MyTeamPage anatomy

A single React component file. The default export is `MyTeamPage`, used
by App.jsx (Session 3 wiring). Helper components and utilities all live
inside the file — no new shared utilities introduced.

**Render structure:**

1. **Header bar** — page title, role-aware sub-label ("Director Workspace" or "Admin Workspace"), and (admins only) a scope toggle that switches between "My direct reports" (`scope='mine'`) and "All teams" (`scope='all'`).
2. **Pending approval queue** (top section) — bright dark-navy header with a count badge. Each row shows the rep, store, customer, deal type, monetary total, customer decision (Purchase / Loan / etc.), the quote number if any, and a resubmission badge if `resubmission_count > 0`. Two action buttons: Reject (white/border) and Approve (filled navy). Empty state: "All caught up — no deals waiting on your approval right now."
3. **Team activity** (lower section) — read-only history. Deals are grouped by `sales_rep_email`. Each group collapses to a one-line summary with counts (approved, rejected, other) and expands to a small table showing each deal with customer-decision and director-decision badges plus an "Updated" timestamp.
4. **Decision modal** — fixed overlay opened when the director clicks Approve or Reject. Captures notes (required on reject, optional on approve), validates client-side, and calls the appropriate `dealPipeline` helper. Escape key closes it. Refetches the team list on success.

**Why a single big file:** matches the pattern in `MyDealsPage.jsx`, which keeps all its sub-components and formatters inline. Splitting into separate files would invite premature abstraction — the badges and modal aren't used anywhere else.

## Data shapes & dependencies

The page consumes from `dealPipeline.js` (Session 1):

| Function | Used for |
| --- | --- |
| `fetchTeamDeals(email, { scope })` | Initial fetch + refetch after every decision. Scope is wired to the role/toggle. |
| `approveDeal({ dealId, notes, actor, currentRevision })` | Invoked by modal on approve. |
| `rejectDeal({ dealId, notes, actor, currentRevision })` | Invoked by modal on reject (notes required client-side). |
| `isDealPipelineConfigured` | Pre-check; if env vars aren't set, surface a configuration error in place of loading. |

And from `pipelineSteps.js`:

| Symbol | Used for |
| --- | --- |
| `DIRECTOR_DECISIONS` | The modal looks up the `requiresNotes` flag for the action kind. |
| `PHASE_LABELS`, `STEP_LABELS` | Imported but unused in v31's first cut. Kept as `void`-references so the dependency is documented for the eventual full stepper render. |

The component itself takes `{ profile, session, navigate }` props — same shape as MyDealsPage. The `role` derives from `profile?.role` (default 'sales'). `myEmail` is `session?.user?.email`. The `navigate` prop is held but unused in v31; it'll be needed in a later increment if we add "go to deal" deep links.

## Refresh & state model

Mount → `fetchTeamDeals`. Scope toggle → refetch. Any successful approve/reject decision → close modal + refetch.

No optimistic updates: a click on Approve/Reject keeps the modal open with a disabled submit button until the pipeline write returns. On success, the modal closes itself and the parent issues a fresh `fetchTeamDeals`. This adds ~one round-trip of latency but avoids any chance of the UI showing stale state if the write fails partway through.

## Styling notes

- Uses the existing design tokens: `navy-900`, `accent-500`, `ok`, `bad`, `warn`, `page-50/100/200/300`, `chalk-50/200/300`, `shadow-card`, `shadow-elevated`, `animate-fadein`.
- All sourced from inspecting `MyDealsPage.jsx`, `DealBuilder.jsx`, and `Shell.jsx` in the existing tree — no new tokens introduced.
- Mobile-first responsive: action buttons stack on small screens, the activity table scrolls horizontally on overflow.

## Sanity checks performed

- `esbuild --bundle=false` (transform-only) — clean.
- `esbuild --bundle --format=esm` (with `react` and `@supabase/supabase-js` marked external) — clean bundle, 31.6kb. This confirms all imports resolve through the lib files.
- Confirmed all imported symbols exist as exports in the v31 lib files: `fetchTeamDeals`, `approveDeal`, `rejectDeal`, `isDealPipelineConfigured`, `DIRECTOR_DECISIONS`, `PHASE_LABELS`, `STEP_LABELS`. All present.
- No new shared utilities introduced; `formatRelativeTime` duplicated inline (same pattern as MyDealsPage). If a third caller appears, extract to a util.

## Known limitations / things to watch in later sessions

- **`navigate` prop unused:** the page accepts it but doesn't currently link out to anything. A future increment could add "Open deal sheet" or "Open quote page" deep links from queue rows.
- **No equipment detail in rows yet:** v31's first cut shows totals but not line items. The data is there in `raw_csv` — adding a detail expansion à la MyDealsPage would be straightforward in a follow-up.
- **No realtime:** if two admins look at the queue simultaneously and one approves a deal, the other will only see the change after their next refetch. Polling or Supabase realtime is out of scope for v31.
- **Notes column shows `customer_decision_notes` on resubmits:** v31's first cut surfaces the most recent rep note via the existing `customer_decision_notes` column. Once we have a clean per-action notes path through `deal_revisions`, swap this to read from there.

## Next session

Session 3 wires `MyTeamPage` into the app:
- `src/App.jsx` — render `MyTeamPage` for `route.name === 'my-team'`, gated to managers/admins
- `src/components/Shell.jsx` — add "My Team" to desktop nav for managers
- `src/components/UserMenu.jsx` — add "My team" entry for managers

Start the next session with:

> Continuing v31 build, Session 3. Reference Session 2's ZIP (cumulative). Pull fresh source, re-apply Session 1+2 files, then wire MyTeamPage into the nav: App.jsx route handler, Shell.jsx desktop tab, UserMenu.jsx mobile/menu entry. Gate visibility to role === 'director' || role === 'admin'.
