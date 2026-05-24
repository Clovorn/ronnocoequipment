# Ronnoco Deal Builder — v31 (Director Approval Pipeline)

**Target date:** May 23, 2026
**Repo:** github.com/Clovorn/ronnocoequipment (catalog app, deploys to ronnocoequipment.netlify.app)
**Companion repo:** github.com/Clovorn/ronnoco-deal-dashboard (Pipeline dashboard — see "Known follow-ups")

v31 introduces a **director-approval phase** in the deal pipeline. Purchase
and Loan deals (whether direct-submit or accepted by the customer from a
quote) now route to a new `pending_director` phase where the rep's
assigned director must approve before the deal advances to Operations.
Rejected deals come back to the rep with a reason and a "Revise and resubmit"
flow.

## What changed for users

### Sales reps

- **Quote-from-Loan blocked.** Loan Equipment can no longer be sent as a
  customer-facing quote. The Quote mode toggle is visually disabled when
  deal_type is Loan, and a validation error catches the slip-past case if
  the rep changes deal_type after entering Quote mode.
- **Purchase / Loan deals queue for director approval.** When a rep submits
  a Purchase or Loan deal directly (or a customer accepts a quote as
  Purchase or Loan), the deal lands at `phase=pending_director` until the
  director decides.
- **My Deals shows the director state.** Rejected, pending, and approved
  decisions all surface as pills on the row. Rejected rows include the
  director's reason and a "Revise and resubmit" CTA. Pending rows show a
  waiting notice; approved rows show a confirmation.
- **`rep_director_email` is stamped at submit.** The rep doesn't see this
  directly — it's the column the director's queue filters on.

### Directors (and admins)

- **My Team page** (new). Shows two sections:
  - **Pending approval queue** — deals waiting on this director, with
    Approve / Reject buttons inline on each row.
  - **Team activity** — read-only history grouped by rep, collapsible.
- **Approve / Reject modal.** Approve takes an optional note; Reject requires
  a reason. Both write a structured audit row (deal_revisions) and a
  human-readable activity row (deal_activity).
- **Scope toggle (admins only).** Admins default to the cross-director "All
  teams" view but can flip to "My direct reports" if they're also assigned
  as someone's director.

### Customers

No changes. Quote views are unchanged; loan customers were never quoted in
the first place. The director-approval workflow is entirely internal.

## Deployment checklist

### 1. Run the SQL migration

Target: **pipeline Supabase project** (`hvmlmequwjxvrmgpltec`).
File: `supabase/migrations/20260523_v31_director_approval_pipeline.sql`

The migration is wrapped in `BEGIN`/`COMMIT` (all-or-nothing) and purely
additive — no data loss risk. It:

- Adds 6 columns to `deals`:
  `director_decision`, `director_decision_at`, `director_decision_by`,
  `director_decision_notes`, `rep_director_email`, `resubmission_count`
- Widens the `phase` CHECK to accept `pending_director`
- Widens the `deal_status` CHECK to accept `rejected`
- Adds two indexes for the director queue and reporting

**No backfill** for pre-v31 deals. Existing leases/finance keep working;
existing Purchase/Loan deals (if any pre-dated v31) stay invisible to
director queues.

The migration was shipped on `main` ahead of the JS code, so this step may
already be done when you read this.

### 2. Verify Netlify env vars

No new env vars introduced. The existing ones used by the catalog app:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (catalog project)
- `VITE_DEAL_PIPELINE_URL`, `VITE_DEAL_PIPELINE_ANON_KEY` (pipeline project)
- `NODE_VERSION=20`

### 3. Ship the build

Push to `main` (or extract this ZIP at repo root). Netlify auto-deploys
from `main` in ~2 minutes.

## What's in this ZIP

```
SESSION_4_NOTES.md                                          (retroactive notes)
README_v31.md                                               (this file)
src/components/DealBuilder.jsx                              (5 v31 edits)
src/components/MyDealsPage.jsx                              (8 v31 edits)
```

Everything else needed for v31 — the SQL migration, lib/pipelineSteps.js,
lib/dealPipeline.js, lib/useRouter.js, components/MyTeamPage.jsx, plus the
nav wiring in App.jsx + Shell.jsx + UserMenu.jsx — was already merged on
`main` from Sessions 1, 2, and 3. This ZIP is the final Session 4 layer
that completes the rep-side workflow.

If you're applying this to a tree that doesn't yet have Sessions 1–3,
pull from `main` first — those changes are merged there with their own
SESSION_*_NOTES.md files at the repo root.

## File-by-file detail

### `src/components/DealBuilder.jsx`

Five edits, +60 net lines:

1. Import `isQuoteable` from `pipelineSteps.js`
2. `validate('quote')` now rejects non-quoteable deal types (Loan Equipment)
3. Quote mode toggle button visually disabled when deal_type is Loan
4. `buildBasePayload()` stamps `rep_director_email` alongside the existing
   `director_email`
5. Hydration-error messages for stale `?edit=<id>` URLs now branch by
   `phase` + `director_decision` to give the rep a phase-aware explanation
   of where the deal lives now

### `src/components/MyDealsPage.jsx`

Eight edits, +468 net lines (most of which is the new `ResubmitModal`):

1. Import `resubmitDeal` from `dealPipeline.js`
2. `PhasePill` recognizes `pending_director` with accent styling
3. New `DirectorDecisionPill` component (pending / rejected / approved with
   retry count)
4. Pill surfaced in `SubmissionRow` header for non-quote rows
5. Resubmit state (`resubmitTarget`, `resubmitSubmitting`, `resubmitError`)
   added to main component
6. `openResubmitModal` + `submitResubmit` handlers added
7. `onResubmit` threaded through `SubmissionsSection → SubmissionRow →
   SubmissionDetail → DealActions`
8. `DealActions` rewritten with four branches (rejected / pending /
   approved / default) plus new `ResubmitModal` component appended at file
   end

## Verification performed

- esbuild parse-only on both files: clean
- **Full layered bundle test**: overlaid v31 changes onto a fresh `main`
  pull, ran `esbuild --bundle App.jsx` with React + Supabase marked
  external. Result: clean 669kb bundle. All v31 import wiring resolves
  end-to-end.
- Bundle content audit: every new symbol (`isQuoteable`, `resubmitDeal`,
  `DirectorDecisionPill`, `ResubmitModal`, `rep_director_email`, the
  per-phase hydration-error strings) appears the expected number of times
  in the bundled output.

## Rollback

Both modified files are isolated edits to upstream that can be reverted by
re-pulling the previous `main` revisions. The SQL migration is purely
additive, so leaving it in place after a JS rollback is safe — the new
columns just stop being written/read. If you want a full SQL rollback, the
reverse migration is:

```sql
BEGIN;
ALTER TABLE public.deals DROP COLUMN IF EXISTS director_decision;
ALTER TABLE public.deals DROP COLUMN IF EXISTS director_decision_at;
ALTER TABLE public.deals DROP COLUMN IF EXISTS director_decision_by;
ALTER TABLE public.deals DROP COLUMN IF EXISTS director_decision_notes;
ALTER TABLE public.deals DROP COLUMN IF EXISTS rep_director_email;
ALTER TABLE public.deals DROP COLUMN IF EXISTS resubmission_count;
-- (CHECK constraint reversion left as exercise; only needed if you want the
--  narrower domain enforced again)
COMMIT;
```

## Known follow-ups (post-v31)

1. **Pipeline dashboard parity** — the separate `ronnoco-deal-dashboard`
   repo (two HTML files plus 6 Netlify functions) doesn't yet recognize
   `pending_director` or render the director-decision pills. Deals in that
   phase will display with their underlying status but without the
   approval-flow UI. Tracking as a separate dashboard session.
2. **Resubmit → Deal Builder hydration** — today, "Revise and resubmit"
   flips the deal back into the director's queue but doesn't open Deal
   Builder for the rep to edit. If we later want a "load this rejected
   deal back as a draft" flow, that's a new hydration path.
3. **Pipeline DB RLS tightening** — carried forward from v23. The pipeline
   `deals`, `deal_revisions`, and `quote_number_counters` tables still
   have permissive anon policies. v31 doesn't widen the attack surface
   (no new tables), but the existing RLS gap remains.
4. **Display names for directors** — George and Tim still have email as
   display_name. Can update from the Users admin UI introduced in v23.
