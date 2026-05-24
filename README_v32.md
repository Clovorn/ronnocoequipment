# v32 — Rep Visibility + Notifications + PWA

**Shipped:** May 24, 2026
**Bundle size:** ~751 kB (+82 kB vs v31, due to workbox runtime + new components)
**DB migrations:** Applied to pipeline (`hvmlmequwjxvrmgpltec`)

This release does three big things and quietly fixes two long-standing bugs.

---

## What's new

### 1. Rep detail view on My Deals

Sales reps now see the same rich, six-section detail view on their own
submissions that directors see on My Team. The Customer/Store/Equipment
trio that used to render in the expanded panel has been replaced with the
shared `DealDetailView` component covering:

1. **Equipment** — parsed table from `raw_csv` with per-item subtotals, or
   the text fallback for legacy Jotform deals.
2. **Contact info** — email, phone, address, chain.
3. **Coffee program & distributor** — supplier, 3-month coffee spend,
   expected monthly sales, distributor identity (name, warehouse, rep, #).
4. **Sales rep notes** — your own free-text from submit time.
5. **Customer decision notes** — when present (after a quote was accepted).
6. **Director decision** *(new for rep view)* — when the director has
   approved or rejected, with their notes inline. Color-coded amber for
   rejected, emerald for approved.
7. **Equipment costs** — total cost + monthly charged.

The detail-view component is now shared (`src/components/DealDetailView.jsx`).
Both `MyTeamPage` and `MyDealsPage` import the same single source of truth —
edits in one place show up in both.

### 2. In-app notifications

A new `notifications` table on the pipeline DB, written automatically by
a Postgres `AFTER UPDATE` trigger on `deals`. Reps see a bell icon in the
header with an unread badge. Click → dropdown with the latest 25 items,
newest first.

**What fires a notification:**
- Director approves or rejects the rep's deal
- Customer makes a decision on a quote (lease / finance / purchase / loan / declined)
- Deal moves between phases (sales → pending_director → leasing → ops → complete)
- Deal status changes away from active (dead, lost, won)

Plus ad-hoc notes from ops via the dashboard's "Send note to rep" button
*(dashboard patch in a separate ZIP — pending push to dashboard repo)*.

**Email delivery** is preserved by default and toggleable per rep on the
Profile page. Mirrors into pipeline `team_members.email_notifications_enabled`
so the dashboard's email sender can check locally without crossing into the
catalog DB. In-app notifications always fire — only email is opt-out.

**Polling:** the bell polls the unread count every 60 seconds. Full list
refetches on dropdown open. Cheap — count query uses a partial index on
`(recipient_email) WHERE is_read = false`.

### 3. Progressive Web App (PWA)

The Deal Builder is now installable. Reps can add it as a desktop icon
(Chrome / Edge / Brave) or to their phone home screen (iOS Safari, Android
Chrome). Launches in standalone mode without browser chrome.

**What's wired up:**
- `vite-plugin-pwa` with `registerType: 'autoUpdate'` — service worker
  pulls new builds quietly when the rep returns to the app.
- `public/` directory with brand icons (192px, 512px, maskable 512px,
  apple-touch 180px) plus a refreshed SVG favicon. Mark is a coffee bean
  cradled by an R-arc, on navy-900 with the warm accent stripe.
- Web manifest auto-generated as `/manifest.webmanifest`.
- iOS PWA meta in `index.html` (apple-mobile-web-app-capable etc.) so
  installs from Safari Add-to-Home-Screen launch full-screen.
- An "Install Deal Builder" card on Profile page with a one-click button
  on browsers that support `beforeinstallprompt`, plus manual instructions
  for iOS Safari and others that don't.
- Supabase requests stay on `NetworkOnly` — no stale data risk; only
  the shell HTML/JS/CSS is cached for offline.

---

## Bug fixes (open items closed)

- **Direct-deal routing bug (state-of-union open item #1).** Purchase and
  Loan deals submitted directly (not through a quote) were hardcoded to
  `phase='leasing'`. They now route to `phase='pending_director'` so
  they hit the director's queue. 100% of direct-submit Loans were
  affected pre-v32; manual SQL backfill required for each. Fixed in
  `DealBuilder.submitDeal()`.

- **`total_monthly_charged` write path (open item #4).** The column
  existed (added in the v27 migration that ran 2026-05-24) but
  `persistBundleSnapshot()` only wrote it AFTER a successful `deal_bundles`
  insert — and `deal_bundles` didn't exist. Two fixes: (a) the table now
  exists, and (b) the rollup column writes first so even if the snapshot
  insert fails, the dashboard's customer-monthly column is correct.

- **`deal_bundles` snapshot table (open item #3).** Code has been calling
  `insertDealBundle()` / `fetchDealBundle()` against this table since v27;
  it never existed. Created with the right shape, FK, unique index, and
  RLS policies.

---

## DB migrations applied this release

All against pipeline DB (`hvmlmequwjxvrmgpltec`). Canonical SQL is checked
in at `supabase/migrations/20260524_v32_rep_visibility_notifications.sql`.

1. **`notifications` table** + 2 indexes + 3 RLS policies.
2. **`team_members.email_notifications_enabled`** column, DEFAULT true.
3. **`notify_rep_on_deal_change`** trigger function + AFTER UPDATE trigger
   on `deals`.
4. **`deal_bundles`** snapshot table + 2 indexes + 3 RLS policies.

---

## Files changed

**New:**
- `src/components/DealDetailView.jsx` — shared detail panel
- `src/components/NotificationBell.jsx` — header bell + dropdown
- `src/lib/notifications.js` — notifications + email-preference client
- `public/favicon.svg`, `public/icon-192.png`, `public/icon-512.png`,
  `public/icon-maskable.png`, `public/icon-maskable.svg`,
  `public/apple-touch-icon.png` — PWA artwork
- `supabase/migrations/20260524_v32_rep_visibility_notifications.sql`

**Modified:**
- `src/components/MyTeamPage.jsx` — drops local `PendingDealDetails`
  + helpers, imports the shared component (-233 lines)
- `src/components/MyDealsPage.jsx` — `SubmissionDetail` rewritten to
  embed the shared detail view; orphan `DetailCard`/`DetailField`
  helpers removed
- `src/components/DealBuilder.jsx` — routing branch for Purchase/Loan;
  `persistBundleSnapshot` reorder (rollup first)
- `src/components/Shell.jsx` — adds NotificationBell between nav + UserMenu
- `src/components/ProfilePage.jsx` — adds NotificationsCard
  (email-toggle) and InstallAppCard (PWA install)
- `src/main.jsx` — captures beforeinstallprompt + registers SW
- `index.html` — PWA meta tags + manifest link + iOS-specific tags
- `vite.config.js` — adds VitePWA plugin with manifest + workbox config
- `package.json` — bumped to 0.32.0, adds `vite-plugin-pwa@^0.20.5`

---

## Deploying

1. Extract this ZIP to repo root of `Clovorn/ronnocoequipment` (replaces
   existing files at root level).
2. Commit and push to `main` — Netlify auto-deploys in ~2 minutes.
3. Required Netlify env vars (unchanged from v31): `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_DEAL_PIPELINE_URL`,
   `VITE_DEAL_PIPELINE_ANON_KEY`, `NODE_VERSION=20`.
4. **First load after deploy:** existing reps will need to refresh once;
   the new service worker takes over from the second load onward, and
   `autoUpdate` handles all future deploys quietly.
5. DB migrations are already applied — nothing else to do on Supabase.

---

## Smoke-test checklist for go-live

- [ ] Login as William Simms (sales). Bell appears in header. No badge
      if no notifications yet.
- [ ] Open My Deals → expand any submission. Detail view shows all six
      sections (with empty sections gracefully hidden).
- [ ] Login as Loren Lemons (director). My Team queue still works. Open
      Will's pending Loan deal → expand → detail view renders.
- [ ] Approve or reject Will's deal as Loren → switch back to Will → bell
      shows badge → click → notification listed → click notification →
      navigates to My Deals.
- [ ] Profile page (any rep) → Notifications card toggles. On/off saves
      and persists across reload.
- [ ] Profile page → Install Deal Builder card. On Chrome desktop the
      "Install app" button should appear within a few seconds of page
      load (browser captures beforeinstallprompt asynchronously).
- [ ] Submit a Loan deal from Will → check pipeline DB → should be
      `phase='pending_director'`, `current_step='awaiting_review'`,
      `rep_director_email='lorenlemons@ronnoco.com'`.
- [ ] Submit a bundle deal from Will → check pipeline DB →
      `total_monthly_charged` is populated, `deal_bundles` row exists.

---

## Pending follow-ups

1. **Dashboard v31 patch** (separate repo) still pending push — Director
   Review tab + Awaiting Director metric. Unchanged from v31.
2. **Dashboard v32 patch** — needs a "Send note to rep" button on each
   deal detail panel that INSERTs into `notifications` with `kind='note'`.
   Small change to `index.html` in `ronnoco-deal-dashboard`. Not blocking;
   trigger-based auto-notifications cover decisions and phase changes.
3. **Display names equal emails** — George, Tim, Will, Loren, plus pwalker
   (a 5th case the state-of-union doc missed). Two-minute fix in `#/admin/users`.
4. **Top-level orphan dirs** `components/`, `help/`, `lib/` at repo root
   are vestigial pre-Vite-restructure copies. Vite ignores them but they
   bloat the repo. Worth deleting in a small cleanup PR.
5. **RLS hardening on pipeline DB** still pending (open item from v23).
   `deal_revisions`, `quote_number_counters`, and now `notifications`
   all have permissive policies. Tightening to email/token-bound policies
   is a future session.
