# v26 — Distributor Bundle Foundation (Increment A)

This is **Increment A** of the bundle redesign. It lays down all the catalog
and data foundations *without* touching the deal-flow yet. After this ships,
admins can:

- Flag equipment items as **available for distributor bundles** from the catalog
- Configure each bundle's **soft-cost percentage, service reserve, term, and lease rate**
- See a **live pricing preview** in the bundles admin showing exactly what
  the customer's monthly will be for the current equipment list
- Review whether each bundle qualifies for lease ($5K basis floor)

Reps will not see any change yet. Their workflow is unaffected.

**Increment B (next session)** wires this into the Deal Builder, the
EquipmentPicker, the customer quote view, and the FAQ.

---

## What's in this bundle

```
supabase/migrations/
  20260523_bundles_foundation_catalog.sql      # catalog: equipment.bundle_eligible + bundles math cols
  20260523_bundles_foundation_pipeline.sql     # pipeline: deal_bundles snapshot table
  20260523_bundle_eligible_sku_seed.sql        # one-off: flag the 12 SKUs

src/lib/bundleMath.js                          # NEW — math helper (used in admin, later in deal builder)
src/components/ItemDetailDrawer.jsx            # MODIFIED — one new field added to PUBLIC_FIELDS
src/components/admin/BundlesAdmin.jsx          # MODIFIED — new pricing section + live preview
```

---

## Ship checklist — 5 steps

### Step 1 — Catalog DB migration

Paste `supabase/migrations/20260523_bundles_foundation_catalog.sql` into the
SQL editor at the **catalog** project (`hthpngozynonzokhbpej`) and Run.

What it does:
- Adds `equipment.bundle_eligible` (boolean, default false) with an index
- Adds 5 new columns to `bundles`: `target_monthly_fee`, `soft_cost_pct`,
  `service_reserve`, `term_months`, `lease_rate` — with CHECK constraints
  on each
- **Migrates** any existing `bundle_items.item_type = 'optional'` rows:
  flips `bundle_eligible = true` on the underlying equipment, then deletes
  those rows
- Creates `v_bundle_eligible_equipment` view for Increment B
- Rebuilds `v_equipment_detail` if it doesn't already use `SELECT *`
- Reloads PostgREST schema cache

Idempotent. Safe to re-run.

### Step 2 — Pipeline DB migration

Paste `supabase/migrations/20260523_bundles_foundation_pipeline.sql` into
the **pipeline** project (`hvmlmequwjxvrmgpltec`) and Run.

What it does:
- Creates `deal_bundles` table (junction-table shape, currently with a
  unique index enforcing single-bundle-per-deal)
- Adds `deals.total_monthly_charged` rollup column
- Adds permissive RLS policies matching the rest of the pipeline tables

No code reads or writes this table yet — Increment B will populate it on
deal submit.

### Step 3 — Seed the 12 bundle-eligible SKUs

Paste `supabase/migrations/20260523_bundle_eligible_sku_seed.sql` into the
**catalog** project SQL editor.

**Run the preview SELECT first** (top of the file). Expected: 12 rows where
every `status` column reads `OK`. If any row shows `NO MATCH — check SKU`,
fix the SKU in the catalog (or correct the seed list) before applying.

⚠ **One SKU is uncertain:** the user's original list included
"PCNG5 Primo Cappuccino 5 Spout" but didn't provide a separate vendor
item number. I assumed `0751107025E` as a likely sibling SKU to
PCNG3's `0751107023E`. **Verify this matches your actual PCNG5 SKU
before running the UPDATE.**

After the preview shows all 12 OK, run the UPDATE block (also in the file)
to flip the flags. Re-running is harmless.

The verify SELECT at the bottom should report `bundle_eligible_count >= 12`
(could be more if the optional-rows migration in step 1 also flagged some).

### Step 4 — Drop the three React files

Extract this ZIP at the repo root of `github.com/Clovorn/ronnocoequipment`
on top of v25. Two files modified, one new:

```
src/components/ItemDetailDrawer.jsx    # modified — adds bundle_eligible toggle
src/components/admin/BundlesAdmin.jsx  # modified — new pricing section + preview
src/lib/bundleMath.js                  # new — math helper
```

Commit, push, Netlify rebuilds in ~2 minutes. No env-var changes needed.

### Step 5 — Verify in the app

1. Sign in as an admin (George or Tim).
2. Open **Catalog**, click any of the 12 seeded items. In the detail drawer,
   you should now see an "Available for distributor bundles" toggle showing
   as checked (true).
3. Go to **Admin → Bundles**, open any existing bundle. You should see
   a new "Distributor Bundle Pricing" section with the math fields and a
   live preview at the bottom showing the computed monthly.
4. Edit the soft cost or service reserve — the preview should update live
   and show whether the bundle qualifies for lease.
5. The legacy pricing fields (list price, manual monthly, lease term) are
   now hidden behind an "Advanced — Legacy pricing fields" disclosure for
   bundles that still need them.

---

## How the math works (rep's mental model — for documentation)

For any equipment list inside a bundle:

```
hardware       = sum(equipment.list_price × quantity)
soft_cost      = hardware × bundle.soft_cost_pct        (20–25%, default 25%)
reserve        = bundle.service_reserve                  (default $1,080)
lease_basis    = hardware + soft_cost + reserve
monthly_raw    = lease_basis × bundle.lease_rate         (default 0.0395)
monthly_charged = round(monthly_raw)                     (whole dollar, half-up)
```

Lease eligibility:
```
eligible = lease_basis ≥ $5,000
```

The customer pays `monthly_charged` per month for `term_months` months.
The customer does not see the soft cost, the service reserve, or the
breakdown — only the final monthly and the term.

The `target_monthly_fee` field is the marketed "Starts at $199" number —
displayed on bundle cards for browsing, but not used in any actual deal
math. The real monthly is always computed.

---

## What's NOT in this release (saved for Increment B)

- **"Start deal from bundle" flow** — the bundle browse + detail views
  don't yet have CTAs to start a deal
- **Deal Builder bundle mode** — the deal sheet hasn't been rewired yet
- **EquipmentPicker bundle-mode filter** — picker still shows all items
- **Customer quote view bundle rendering** — quotes don't display bundle
  info yet
- **Pipeline `deal_bundles` table is created but unused** — no code reads
  or writes it yet
- **FAQ Section 5 updates** — current FAQ describes the old model
- **`monthly_lease_price` removal** — the column still exists and is still
  shown in BundlesBrowser cards (just from view data). It's flagged as
  "legacy" in the admin but not yet purged. Removing it from the browser
  comes with Increment B (which replaces the browser CTA flow anyway).

---

## Known follow-ups

1. **`v_bundles_with_totals` view** — if it enumerates columns explicitly
   (rather than `SELECT *`), the new `target_monthly_fee` won't reach the
   bundle cards in BundlesBrowser. Check by running:
   ```sql
   select definition from pg_views where viewname = 'v_bundles_with_totals';
   ```
   If the new columns aren't listed, add them or rebuild the view to
   include them. Increment B's BundlesBrowser changes will need this.

2. **PCNG5 SKU verification** — confirm `0751107025E` is the correct SKU
   for the Primo Cappuccino 5 Spout. If it's different, edit the seed file
   before running the UPDATE block.

3. **Pipeline RLS** — `deal_bundles` ships with permissive anon policies
   matching the rest of the pipeline tables. Will be tightened in the same
   sweep as the rest of the pipeline DB.
