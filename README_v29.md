# v29 — Back-solved bundle reserve + Program Bundle badge

Two related changes:

1. **Service reserve auto-calibrates to hit `target_monthly_fee`** at the
   bundle's default equipment load. This fixes the "Small Coffee-Airpot
   Brewer" case where a $2,500 bundle was failing the $5K lease floor and
   not landing at the marketed $199/mo. The reserve absorbs whatever's
   needed; it's floored at $1,080 (policy minimum) but can go much higher
   for small bundles.

2. **"Program Bundle" badge** added to every distributor bundle card,
   alongside (not replacing) the existing "Featured" badge. Featured stays
   as an admin-toggleable highlight for specific bundles; Program Bundle
   is the always-on identifier.

Both pieces are pure additions to v27/v28. No DB migrations.

---

## How the math works now

### Old (v27/v28)
```
lease_basis = hardware + (hardware × 25%) + 1080 (fixed reserve)
monthly = lease_basis × 0.0395
```
For a small bundle with $2,500 hardware:
- lease_basis = $2,500 + $625 + $1,080 = $4,205
- monthly = $166.10  ← below $199 target, AND below $5K floor → ineligible

### New (v29) — when target_monthly_fee is set
At the bundle's default load, the reserve is back-solved:
```
target_lease_basis = target_monthly_fee / lease_rate    (e.g., 199 / 0.0395 = $5,037.97)
reserve = target_lease_basis - default_hardware × (1 + soft_cost_pct)
reserve = max(reserve, 1080)
```
For the $2,500/$199 case:
- target_lease_basis = $5,037.97
- reserve = $5,037.97 - $2,500 - $625 = $1,912.97
- lease_basis = $2,500 + $625 + $1,912.97 = $5,037.97
- monthly = $199 ✓

### Substitution math (unchanged)
When the rep swaps a $1,000 brewer for a $1,500 brewer, the reserve stays
locked at $1,912.97 (the value back-solved at the default). The math runs
forward:
- hardware = $3,000 (up $500)
- soft_cost = $750 (up $125)
- reserve = $1,912.97 (unchanged)
- lease_basis = $5,662.97 (up $625)
- monthly = $224 (up $25)

Customer pays $224. The price moved because the equipment moved — exactly
what a lease should do.

### What if the bundle is mispriced?
If the bundle's default hardware is too expensive for the target (rare),
the back-solve produces a negative reserve. We floor at $1,080 and the
admin sees a red warning: *"Bundle target is too low for this equipment —
raise target or remove equipment."* The customer monthly will be higher
than the target until the admin fixes the bundle.

---

## What's in this bundle

```
src/lib/bundleMath.js                       # new calibrateBundleReserve helper, extended calculateBundlePricing
src/components/admin/BundlesAdmin.jsx       # pricing preview shows calibration, reserve becomes read-only when target set
src/components/BundlesBrowser.jsx           # Program Bundle badge + drop "starts at"
src/components/BundleDetailView.jsx         # drop "starts at" + update copy for new model
src/components/DealBuilder.jsx              # stores bundleDefaultItems and passes to math helper
```

No DB migrations. No env-var changes.

---

## Ship checklist

1. **Drop the files** at the repo root, on top of v28. Five files modified.
   Commit, push, Netlify rebuilds in ~2 minutes.

2. **Verify the admin side first:**
   - Open BundlesAdmin → edit any bundle that has `target_monthly_fee` set
     (e.g., a $199 bundle).
   - The "Service & media reserve" field should now show as **read-only**
     ("Computed from target") instead of a number input.
   - The pricing preview below should label the reserve as **"Service &
     media reserve (calibrated)"** and the breakdown should land exactly
     on the target monthly.
   - If you remove the `target_monthly_fee` value and tab away, the reserve
     field should turn back into an editable number input.

3. **Verify the customer-facing card:**
   - Bundles page → every card has a navy **"Program Bundle"** tag at top.
   - Bundles with `featured = true` also have the **"Featured"** tag (orange).
   - The card's monthly should read just "$199/mo" (no "starts at" prefix).

4. **Verify the deal flow:**
   - Click "Start deal from this bundle" on a small bundle that previously
     was failing $5K. It should now load with **"✓ Qualifies for lease"** and
     a customer monthly = the bundle's target.
   - Substitute equipment. Watch the customer monthly move — both UP for
     bigger equipment and DOWN if the rep removes items. The reserve in
     the breakdown stays locked at the calibrated value.
   - Submit as Quote. Check the resulting deal_bundles snapshot: the
     `bundle_service_reserve` column should hold the calibrated value
     (e.g., $1,912.97 for a $199 bundle with $2,500 hardware), not the
     old $1,080 default.

---

## Edge cases handled

- **Bundle has no target_monthly_fee** — falls back to the stored
  `service_reserve` field (still editable). Math runs as v27. Reserve is
  whatever the admin set manually.
- **Bundle target is too low for its equipment** (negative reserve
  back-solve) — reserve floors at $1,080. Admin gets a red warning in the
  preview. Customer monthly will be ABOVE the target until the bundle is
  fixed.
- **Calibrated reserve is between $1,080 and $1,500** — no warning, just
  works.
- **Calibrated reserve is above $1,500** — informational note appears in
  admin preview explaining the reserve is high relative to hardware.
  Not an error, just transparency.

---

## What's NOT in this release

- **FAQ Section 5 rewrite** — still pending. The bundles FAQ entry
  describes the old v25-era model. Will rewrite in a separate session
  now that the math model is stable.
- **Pipeline dashboard** — still doesn't surface bundle_name or
  monthly_charged. Separate session in the dashboard repo.
- **Multi-bundle per deal** — still single-bundle. Junction schema makes
  the upgrade clean when needed.
