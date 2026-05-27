# Ronnoco Deal Builder — COMPLETE deploy package

This ZIP is a **drop-in replacement for the entire repo** at
github.com/Clovorn/ronnocoequipment. It contains:

  1. v33.5 "lead conversion creates a DRAFT" fix — applied to the
     correct `src/` paths (the paths Vite actually builds from)
  2. Cleanup of orphan duplicate folders at the repo root
     (`/components/`, `/lib/`, `/help/`, `/App.jsx`) — these were
     never built by Vite but were intercepting every "deploy v33.5"
     attempt
  3. Removal of stale delivery ZIPs from the repo root
  4. Everything else from your current production repo, unchanged

Built locally with `npm install && npm run build` — clean, 126
modules, no warnings.

## What was broken and why every prior deploy failed

The live app loads `/src/main.jsx` (per `index.html`), so Vite
builds from `src/`. But the repo also had `/components/`,
`/lib/`, `/help/`, and `/App.jsx` sitting at the **root** —
leftover orphans from an older project structure, never imported by
anything. Every prior v33.5 deploy attempt extracted the patch ZIP
to the repo root, which created `/components/MyDealsPage.jsx` (in
the orphan folder) instead of overwriting `/src/components/MyDealsPage.jsx`
(the real one). The live bundle kept building the pre-v33.5 code.

This ZIP fixes that for good by deleting the orphan folders entirely.

## What v33.5 actually changes

Old convert flow (pre-v33.5, still live as of this writing):

  Convert → writes a row to the pipeline `deals` table → stamps
  the lead as `won`. Deal appears on the Pipeline Dashboard
  immediately. If anyone deletes it from the dashboard, it's gone
  forever AND the lead is frozen in `won` status, invisible to both
  the leads queue and the rep.

New convert flow (v33.5):

  Convert → creates a row in `deal_drafts` (catalog Supabase) →
  marks the lead as `in_progress` → opens Deal Builder with the
  draft loaded. The deal is NOT written to the pipeline yet.

  Submit (in Deal Builder) → NOW writes to the pipeline `deals`
  table → flips the lead from `in_progress` to `won`.

  Delete draft → reverts the lead back to `active` so it reappears
  in the rep's queue.

## Deploy instructions

### Option A — replace the whole repo via GitHub web UI (recommended)

1. Extract this ZIP locally. You'll get a folder of files.
2. Open github.com/Clovorn/ronnocoequipment in your browser.
3. Delete the following from the repo root (use the trash icon on
   each, or do it locally):
     - `components/` folder
     - `lib/` folder
     - `help/` folder
     - `App.jsx`
     - all `ronnoco-*.zip` files
     - `v33_5-extract-to-repo-root.zip`
4. Upload the contents of this ZIP via "Add file → Upload files".
   Drag the whole extracted folder in; let it overwrite existing
   files when prompted.
5. Write a commit message ("v33.5 deploy + repo cleanup") and commit
   directly to `main`.
6. Netlify auto-rebuilds in ~2 min.

### Option B — local git push

If you have a local clone of the repo:

```bash
cd ronnocoequipment
git pull origin main
git rm -r components/ lib/ help/
git rm App.jsx
git rm ronnoco-*.zip v33_5-extract-to-repo-root.zip
# Now copy contents of this ZIP on top of your repo
cp -r <extracted-zip-folder>/* .
git add -A
git commit -m "v33.5 deploy: lead convert creates draft + remove orphan folders"
git push origin main
```

## Verification after Netlify rebuild

1. Open the live app, hard-refresh (Cmd-Shift-R / Ctrl-Shift-R).
2. View source — bundle filename should change. The clean build
   I ran locally produced `index-CbRAyeVE.js`; Netlify should
   produce the same hash if it built from this exact source.
3. Convert a test lead (or Island Oasis #4, which is back in
   `status='active'`):
     - You land in **Deal Builder**, NOT the Pipeline Dashboard
     - The Pipeline Dashboard does NOT show the deal yet
     - In My Deals → Drafts, the new draft appears
4. Submit the draft from Deal Builder:
     - The deal now appears on the Pipeline Dashboard
     - The lead flips from `in_progress` to `won`
     - `lead.deal_id` updates from the draft id to the real
       pipeline UUID
5. Test the revert path on another test lead:
     - Convert it → draft created
     - Delete the draft from My Deals → confirm dialog warns the
       lead will return to active
     - Lead reappears in the rep's Distributor Leads queue

## State of the world right now (before this deploy)

- **Island Oasis #4** — `status='active'`, in Will Simms's queue.
  DO NOT click Convert on this until the new build is live, or the
  buggy pre-v33.5 code will run one more time.
- **The Dam Store** — `status='active'`, in Will's queue. Same
  warning.
- Activity log on the leads portal has audit rows for both reverts.

## Known followups (not blocking)

1. **Soft-delete on pipeline `deals`** — root cause of why a stray
   delete in the dashboard was permanent. Add `deleted_at` column +
   filter in dashboard queries.
2. **Tighten pipeline Supabase RLS** — anon role still has full
   CRUD on `deals`; should restrict.
3. **README hygiene** — 16 `README_vXX.md` files at the repo root
   are getting unwieldy. Consider moving to `docs/`.

## Database migration status

The migration adding `'in_progress'` to the leads `status` CHECK
constraint was already applied to project `opnpyunbccifkdnbljsz`
when v33.5 was originally prepared. No additional migrations are
needed for this deploy.
