# v31 — Session 3: Nav Wiring

This ZIP is **cumulative**. It includes everything from Sessions 1 and 2 plus
the three nav-wiring edits below.

After Session 3, MyTeamPage is reachable from the UI for directors and admins.
Still hold in a working branch — Session 4 adds the DealBuilder + MyDealsPage
changes that complete the rep-side of the workflow.

## What's new in Session 3

```
src/App.jsx                    (route handler added)
src/components/Shell.jsx       (desktop tab + mobile bottom-bar entry)
src/components/UserMenu.jsx    (manager menu entry)
```

All three files are *modifications* to upstream — no new files in this session.

## What's carried forward from Sessions 1 + 2

```
supabase/migrations/20260523_v31_director_approval_pipeline.sql
src/lib/pipelineSteps.js
src/lib/useRouter.js
src/lib/dealPipeline.js
src/components/MyTeamPage.jsx
```

Unchanged. Re-verified parse-clean as part of this session's checks.

## Edit details

### `src/App.jsx`

Two additions:

1. **Import:** `import MyTeamPage from './components/MyTeamPage.jsx';` placed next to MyDealsPage's import.
2. **Route handler:** added after the `my-deals` block. Two branches:
   - `route.name === 'my-team' && isManagerOrAdmin` → renders `<MyTeamPage profile session navigate />`
   - `route.name === 'my-team' && !isManagerOrAdmin` → renders the existing "You don't have access" panel pattern (same shape as the admin gate elsewhere in the file)

The `isManagerOrAdmin` variable already existed in App.jsx (defined as `role === 'admin' || role === 'director'`), so no new gate logic — just wired to the new route.

### `src/components/Shell.jsx`

Four additions, one rename, two `TABS.map → visibleTabs.map` swaps:

1. **TABS entry:** added `{ key: 'my-team', label: 'My Team', routeName: 'my-team', icon: TeamIcon, managerOnly: true }` between Favorites and FAQ. Position chosen so manager-facing work tabs cluster: Bundles, Favorites, **My Team**, FAQ.
2. **Role variables:** added an `isManagerOrAdmin` alias for `isAdmin` (existing variable that's true for both director and admin). The alias is purely for readability — the filter logic reads `!t.managerOnly || isManagerOrAdmin`, which is more obvious than reading the same against `isAdmin`.
3. **visibleTabs filter:** `TABS.filter((t) => !t.managerOnly || isManagerOrAdmin)`. The desktop nav and the mobile bottom bar both render from `visibleTabs` now instead of `TABS`.
4. **Mobile grid column count:** switched from a literal `grid-cols-6` to `visibleTabs.length + 1 >= 7 ? 'grid-cols-7' : 'grid-cols-6'`. The "+1" accounts for the New Deal button which lives outside the visibleTabs map. Literal class strings are required — Tailwind JIT can't see `grid-cols-${n}` interpolations.
5. **TeamIcon component:** new SVG glyph after `StarIcon`. Three figures — one centered, two behind — at the same 24×24 viewBox and stroke weights as the other nav icons.
6. **Doc comment:** updated the JSDoc above the component to include 'my-team' in the list of recognized routeNames.

### `src/components/UserMenu.jsx`

Two additions:

1. **Menu entry:** new `<MenuItem>` placed between "My deals" and "My profile", gated on `isAdmin` (the prop, which is the manager-or-admin truth value as computed in Shell). Label "My team", hint "Approve Purchase and Loan deals from your reps".
2. **TeamGlyph component:** new SVG glyph after `MyDealsGlyph`. Same shape as the Shell's `TeamIcon` but sized for menu entries (`w-4 h-4` instead of `w-5 h-5`).

The Admin menu entry remains separate and unchanged. The two manager-gated entries (My Team + Admin) appear in different positions on purpose — My Team is a workspace and goes with My Deals; Admin is settings and goes at the bottom.

## Mobile bottom-bar tightness

A 7-cell mobile grid is tight on narrow phones. The original v25 memory note flagged that 6 was already getting cramped. v31 makes it 7 for managers, which is the same audience that's most likely to be on desktop anyway — but if it turns out to be a problem, the easiest mitigation is to move Favorites to the user menu (which was already noted as a possible refactor). Punting that until a manager complains.

The grid-cols literal-class approach means only `grid-cols-6` and `grid-cols-7` need to exist in the Tailwind output. Both are present in the default Tailwind classes, so no config change needed.

## Sanity checks performed

- `esbuild --bundle=false` (parse-only) on all three edited files — clean.
- **Layered bundle test:** copied the entire upstream tree to `/tmp/v31-layered`, overlaid all v31 build files, and ran `esbuild --bundle --format=esm` on App.jsx with `react`, `react-dom`, and `@supabase/supabase-js` marked external. Bundle succeeds at 530kb. This confirms the full import graph — App → MyTeamPage → dealPipeline + pipelineSteps + react — resolves end-to-end without unresolved paths.
- **Bundle content audit:** `grep -c 'MyTeamPage|my-team|fetchTeamDeals|approveDeal|rejectDeal'` in the bundle returns 17. The route appears in both `parseRoute` and `routeToHash`, the UserMenu entry's `go('my-team')` is in the bundle, and the component code itself is bundled with all the action helpers it calls.
- **Diff audit:** `diff` against upstream on each of the three files shows only additive changes — no deletions, no behavior changes for non-manager roles. The TABS filter degrades gracefully (`!t.managerOnly` is true for every existing tab), the mobile grid stays at 6 cells for non-managers, and reps hitting `#/my-team` directly land on the no-access panel.

## Known limitations / things to watch

- **`my-team` highlight in vendor/profile sub-pages:** the existing `activeTab` redirect folds 'vendor', 'vendors', and 'profile' into 'home'. My Team has no sub-pages today so this isn't relevant, but if a future MyTeamPage adds something like `#/my-team/<dealId>`, that route would need to be added to the highlight map too.
- **Director with no reps:** a director who has no assigned reps (no rows with their email in `rep_director_email`) will see the My Team tab and land on the empty-queue + empty-activity states. Working as designed; both have helpful empty messaging.
- **Admin role can technically navigate to My Team OR Admin:** these are intentionally separate. My Team is for approving deals; Admin is for managing catalog/users/etc. Both gated to the right roles in App.jsx.

## Next session

Session 4 finishes the rep-side of the workflow:
- `src/components/DealBuilder.jsx` — four edits:
  1. Disable Loan Equipment as a quote option (uses `isQuoteable` from Session 1)
  2. Resubmit flow for rejected deals (load via `?resubmit=<dealId>` similar to edit-mode)
  3. Lock pending/approved deals from editing with a banner
  4. Stamp `rep_director_email` on submit (using `useDirector`) — without this, new deals submitted by reps with assigned directors won't surface in the queue
- `src/components/MyDealsPage.jsx` — rejection banner with "Revise and resubmit" CTA

Start the next session with:

> Continuing v31 build, Session 4. Reference Session 3's ZIP (cumulative). Pull fresh source, re-apply Session 1+2+3 files, then make the DealBuilder + MyDealsPage edits. Stamp rep_director_email on every submit so new deals route to the right director queue.
