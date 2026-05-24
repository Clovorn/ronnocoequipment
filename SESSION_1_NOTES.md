# v31 — Session 1: Foundation Files

This ZIP contains the four foundation files for v31 (Director Approval Pipeline).
**This is not a complete v31 release** — sessions 2–5 add the UI components and
nav wiring. Don't deploy this on its own. Hold these files in a working branch
until Session 5 packages the complete v31.

## Files in this ZIP

```
supabase/migrations/20260523_v31_director_approval_pipeline.sql
src/lib/pipelineSteps.js
src/lib/useRouter.js
src/lib/dealPipeline.js
```

## What each file does

### `20260523_v31_director_approval_pipeline.sql`

Run this against the pipeline Supabase project (**hvmlmequwjxvrmgpltec**).
Wrapped in BEGIN/COMMIT so it's all-or-nothing.

It adds to `public.deals`:

| Column | Type | Purpose |
| --- | --- | --- |
| `director_decision` | text | `pending` \| `approved` \| `rejected` \| NULL |
| `director_decision_at` | timestamptz | When director decided |
| `director_decision_by` | text | Director's display name / email |
| `director_decision_notes` | text | Director's reason (required on reject) |
| `rep_director_email` | text | Stamped at submit time so the queue knows who the rep's director is |
| `resubmission_count` | integer (default 0) | Bumped on every resubmit |

Widens two CHECK constraints:
- `phase` now accepts `pending_director` (in addition to `sales`, `leasing`, `ops`)
- `deal_status` now accepts `rejected` (in addition to `active`, `closed`, `complete`)

Adds two indexes:
- `deals_director_queue_idx` — partial index on `(rep_director_email, phase)` filtered to `pending_director` rows. This is the hot path: a director loading their queue.
- `deals_director_decision_idx` — full index on `(director_decision, phase)` for admin/cross-director queries and reporting.

**Backfill decision:** the migration does NOT backfill `rep_director_email` on pre-v31 deals. Those deals stay invisible to director queues. This was deliberate — guessing assignments retroactively would create incorrect queue entries. Existing deals continue to work; they just don't surface in My Team.

### `src/lib/pipelineSteps.js`

Drops in as a replacement. Adds:
- `PHASE_STEPS.pending_director = ['awaiting_review']`
- `STEP_LABELS.awaiting_review = 'Awaiting Director Review'`
- `PHASE_LABELS.pending_director = 'Director Review'`
- `DECISIONS` rerouted — `purchase` and `loan` now go to `pending_director` / `awaiting_review` instead of `ops` / `customer_setup`. **This is the central behavior change.** Once this file is deployed, every new customer Purchase/Loan decision will land in the director queue.
- `DIRECTOR_DECISIONS` constant — the approve/reject options with their phase transitions and a `requiresNotes` flag
- `requiresDirectorApproval(customerDecision)` helper
- `isQuoteable(dealType)` helper — returns `false` for `Loan Equipment`. Used in Session 4 to disable the "Submit as Quote" button when deal_type is Loan.

### `src/lib/useRouter.js`

Adds the `my-team` route to `parseRoute` and `routeToHash`. Hash format: `#/my-team`. No params (the page reads the current user's email from useAuth).

Sessions 3 and 5 wire this up to the actual `MyTeamPage` component and add nav entries.

### `src/lib/dealPipeline.js`

Original 435 lines preserved unchanged. Appends ~268 lines:

- `fetchTeamDeals(directorEmail, { scope })` — fetches deals for the director's queue. `scope='mine'` filters by `rep_director_email`; `scope='all'` returns every deal that has touched the director phase (for admins).
- `approveDeal({ dealId, notes, actor, currentRevision })` — sets `director_decision='approved'`, advances phase to `ops` / `customer_setup`, writes audit + activity rows.
- `rejectDeal({ dealId, notes, actor, currentRevision })` — sets `director_decision='rejected'`, **leaves phase at `pending_director`** (so the rep's stepper still shows context), flips `deal_status='rejected'`, writes audit + activity rows. Notes are validated as required by the UI; logs a warning if invoked without them.
- `resubmitDeal({ dealId, notes, actor, currentRevision, currentResubmissionCount })` — clears `director_decision` back to NULL, flips `deal_status` back to `active`, leaves phase at `pending_director`, increments `resubmission_count`. Returns the deal to the director's queue.
- `_directorDecision` — internal helper that wraps the canonical pattern (UPDATE deal + INSERT deal_revisions + INSERT deal_activity) so the three above stay declarative.

## Sanity checks performed

- `node --check` passes on all three JS files.
- No new imports added that aren't already in the existing tree.
- No circular import: `dealPipeline.js` doesn't import from `pipelineSteps.js` (the small set of director-decision constants it needs is inlined as `DIRECTOR_DECISIONS_FOR_RUNTIME`).

## Open questions answered (session 0)

1. **Backfill `rep_director_email`:** No. Pre-v31 deals stay invisible to director queues.
2. **Resubmit semantics:** Bump count, clear `director_decision` to NULL, flip status `rejected → active`, leave phase at `pending_director`, log revision. Implemented in `resubmitDeal`.
3. **Admin scope:** Admins see the cross-director view (`scope='all'`). Implemented in `fetchTeamDeals`.

## Open issues / questions for later sessions

- **`useDirector()` integration in DealBuilder (Session 4):** when building the pipeline payload in `submitDeal` and `submitAsQuote`, we need to add `rep_director_email: director?.director_email || null`. Without this stamp, a director-approval-bound deal won't surface in any queue.
- **Pipeline-dashboard parity:** the pipeline dashboard (separate repo, two HTML files) has its own inline phase constants that mirror `PHASE_STEPS`. After v31 ships, that dashboard will not recognize `pending_director` and may display the deals oddly. Tracking this for a future dashboard session.
- **Quote-from-loan validation (Session 4):** `isQuoteable()` is now available but unused. Session 4 wires it into the Submit as Quote button's disabled state.

## Next session

Session 2 ships `src/components/MyTeamPage.jsx` (~470 lines): pending-approval queue, rep-grouped collapsible tables, approve/reject modal with required-reason-on-reject.

Start the next session with:

> Continuing v31 build, Session 2. Reference Session 1's ZIP (already cumulative in the working branch). Pull fresh source, then create src/components/MyTeamPage.jsx using the v31 lib helpers from Session 1.
