# v27 — Distributor Bundle Deal Flow (Increment B / Phase B1)

This is the rep-side deal flow + customer-side quote rendering for
distributor program bundles. It builds on v26's catalog foundation
(equipment.bundle_eligible flag, bundles math columns, the deal_bundles
table) and turns it into a complete workflow.

After this ships:

- Reps can click **"Start deal from this bundle"** on the bundles browse
  page or detail view
- The Deal Builder enters **bundle mode** with the program pre-loaded, a
  live math breakdown, and `deal_type` locked to Lease Equipment
- The EquipmentPicker is filtered to bundle-eligible items (plus anything
  already on the deal — "lenient" mode)
- Submit is disabled until the bundle clears the $5,000 lease floor
- On submit, a `deal_bundles` snapshot row is written with the computed
  hardware total, soft cost %, service reserve, lease basis, monthly raw,
  and customer-visible monthly_charged
- The customer-facing quote at `#/quote/{number}?t={token}` renders bundle
  deals as a **Distributor Program Quote** with the program name, equipment
  list (no per-item prices), a Supply/Service/Marketing inclusion paragraph,
  and the single monthly payment

---

## What's in this bundle

### Modified files
```
src/App.jsx                                # passes bundleId to DealBuilder
src/lib/useRouter.js                       # parses ?bundle=<uuid>
src/lib/dealPipeline.js                    # new helpers (insertDealBundle, etc.)
src/components/EquipmentPicker.jsx         # accepts allowedEquipmentIds + scopeLabel
src/components/BundlesBrowser.jsx          # "Start deal" CTAs on cards, starts-at pricing
src/components/BundleDetailView.jsx        # rebuilt: starts-at + inclusion block + CTA
src/components/DealBuilder.jsx             # bundle mode, breakdown, lock, gate, snapshot
src/components/QuoteView.jsx               # bundle program rendering on customer quote
```

### New files
```
src/lib/useBundles.js                      # fetchBundleById + useBundleEligibleEquipment
```

No DB migrations — all schema landed in v26.

---

## Ship checklist

### Step 1 — Drop the files

Extract the ZIP at the repo root of `github.com/Clovorn/ronnocoequipment`
on top of v26. Eight files modified, one new under `src/lib/`. Commit, push,
Netlify rebuilds in ~2 minutes. No env-var changes, no DB changes.

### Step 2 — Verify in the app

1. Sign in. Open **Distributor Program Bundles**. Each card now shows
   "starts at $X/mo" (sourced from `target_monthly_fee` — make sure you set
   this in BundlesAdmin for the bundles you want to test) and a
   "Start deal from this bundle" button.
2. Click the button. You should land on the Deal Builder with:
   - A blue "Distributor Program Bundle: <name>" banner near the top
   - A "Bundle Pricing — <name>" section showing the math breakdown
   - The Deal Type chip locked to "Lease Equipment · Locked by bundle"
   - The bundle's default equipment pre-loaded in the equipment list
3. Click "+ Add equipment" — the picker should show a navy info bar saying
   "Showing equipment eligible for the <name> bundle and any item already
   on the deal" and the item list should be filtered.
4. Substitute equipment. Watch the breakdown update live — hardware total,
   soft cost line, lease basis, monthly raw, and customer monthly all
   recompute.
5. If you substitute down so far that lease basis falls below $5,000, the
   "Qualifies for lease" chip flips red and the Submit button disables.
   Hover the button to see the reason in the tooltip.
6. Submit as Quote. Open the resulting quote URL and verify:
   - Header reads "Distributor Program Quote" and the program name
   - The equipment list has NO per-item prices
   - An "Included with your <name>" callout with the SUPPLY, SERVICE &
     MARKETING AGREEMENT language is present
   - The pricing summary shows ONLY "Monthly Payment $X/mo" + term
     (no equipment total, no estimate disclaimer)

---

## How bundle mode flows

```
1. Rep opens /bundles, clicks "Start deal from this bundle"
   → navigate('deal', { bundleId: <uuid> })
   → URL becomes #/deal?bundle=<uuid>

2. DealBuilder mounts, sees bundleId prop
   → fetchBundleById() loads the bundle config + included items
   → bundleConfig state set, equipmentItems pre-loaded
   → deal_type forced to "Lease Equipment"
   → useBundleEligibleEquipment() loads the bundle-eligible ID pool

3. Bundle pricing computed live via calculateBundlePricing()
   → updates every time equipmentItems changes
   → drives the breakdown UI, the eligibility chip, and submit gate

4. Rep adjusts equipment via filtered picker, fills in customer info

5. Rep clicks Submit
   → submitDealToPipeline() inserts the deal as usual
   → persistBundleSnapshot() writes the deal_bundles row + updates
     deals.total_monthly_charged
   → Activity log entry, draft cleanup, success screen

6. Customer clicks the emailed link → QuoteView
   → fetchQuoteForCustomer() loads the deal as before
   → fetchDealBundle() loads the deal_bundles row
   → renders bundle-aware UI: program name, no per-item prices,
     inclusion paragraph, single monthly
```

---

## Design choices captured in this release

- **One bundle per deal.** Enforced by the unique index on `deal_bundles(deal_id)`.
  Pipeline schema is junction-shaped so we can drop the index later for multi.
- **Lenient picker filter.** Equipment in the picker = bundle_eligible items
  ∪ items already on this deal. Reps can re-add a core item they accidentally
  removed without abandoning the draft.
- **No escape from bundle mode mid-deal.** No "exit bundle" button — if the
  rep wants a non-bundle deal, they navigate away. Bundle context is shaped
  around the bundle's math; switching mid-flow would leave too much state to
  reconcile.
- **Submit gate is hard.** When `lease_basis < $5,000`, both Quote and Deal
  submit buttons disable with an explanatory tooltip. The rep adds equipment
  to qualify, period.
- **Customer sees the equipment list line-by-line, no per-item prices.**
  Quantity + item description + (vendor · model · SKU) — but no list price
  or extended column. The customer pays the bundle monthly, not by item.
- **deal_type stamped as "Lease Equipment"** for analytics consistency. The
  bundle's program name lives on `deal_bundles.bundle_name` for filtering
  in the (future) pipeline dashboard.

---

## Things NOT in this release

- **FAQ Section 5 updates.** The bundles section in the FAQ still references
  the old model (monthly_lease_price as a fixed number). Will update in a
  small follow-up so it's not bundled with code changes.
- **Pipeline dashboard updates.** The HTML dashboard hasn't been touched —
  it still shows bundle deals as regular leases. Wiring `bundle_name` and
  `monthly_charged` columns into the dashboard is a separate session in
  the `ronnoco-deal-dashboard` repo.
- **Multi-bundle per deal.** Single-bundle today. Junction-shaped schema
  makes the upgrade clean when needed.
- **Loan deals.** Loans skip bundles entirely (per the spec). The bundle
  CTAs only appear on the bundles browser; loan deals continue to use
  `+ New Deal` from the nav.
- **Cash sales.** Same as today — `+ New Deal` for non-bundle deals.

---

## Known follow-ups

1. **FAQ Section 5 update** (small).
2. **`v_bundles_with_totals` view** — if it doesn't expose
   `target_monthly_fee` after running the v26 migration, BundlesBrowser
   cards will fall back to legacy `monthly_lease_price`. Run:
   ```sql
   select definition from pg_views where viewname = 'v_bundles_with_totals';
   ```
   If `target_monthly_fee` isn't in the SELECT list, the cards will use the
   legacy field (acceptable for now since the BundlesBrowser code falls
   back). Adding to the view will be done as part of the next cleanup pass.
3. **Pipeline dashboard role-filtering** — still outstanding from v23/v24.
   This release doesn't change anything there.
4. **Customer quote PDF generation** — quotes are HTML-only with a
   print-to-PDF button. Future: server-side PDF generation for emailing.
