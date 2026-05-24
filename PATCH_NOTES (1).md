# Companion patch — `src/lib/dealPipeline.js`

The new expandable detail view in `MyTeamPage.jsx` reads several additional
columns from the deal row. The `fetchTeamDeals()` function's SELECT projection
needs to be widened so those columns reach the page.

## What to change

Find this block in `src/lib/dealPipeline.js` inside `fetchTeamDeals(...)`:

```js
  const columns = `
    id,
    is_quote, quote_number,
    customer_decision, customer_decision_at, customer_decision_notes,
    director_decision, director_decision_at, director_decision_by, director_decision_notes,
    rep_director_email, resubmission_count,
    current_step, phase, deal_status,
    first_name, last_name, contact_name, contact_email,
    store_name, city, state,
    deal_type, total_eq_cost, total_monthly_charged,
    sales_rep, sales_rep_email,
    raw_csv, equipment_selection,
    created_at, updated_at
  `;
```

Replace it with this (additions are the last six logical lines — contact,
distributor, coffee, economics, notes, chain):

```js
  const columns = `
    id,
    is_quote, quote_number,
    customer_decision, customer_decision_at, customer_decision_notes,
    director_decision, director_decision_at, director_decision_by, director_decision_notes,
    rep_director_email, resubmission_count,
    current_step, phase, deal_status,
    first_name, last_name, contact_name, contact_email,
    store_name, city, state,
    deal_type, total_eq_cost, total_monthly_charged,
    sales_rep, sales_rep_email,
    raw_csv, equipment_selection,
    email, phone, address, chain_store,
    coffee_program, current_coffee_supplier,
    parent_distributor, parent_distributor_num, sub_group,
    distributor_warehouse, distributor_rep_name, distributor_rep_email,
    distributor_rep_phone, distributor_customer_num,
    coffee_spend_3mo, expected_monthly_sales,
    notes,
    created_at, updated_at
  `;
```

## Why

The detail block reads these columns:

- **Equipment list** — `raw_csv` (already present) with `equipment_selection`
  text fallback (also already present). No change needed for equipment itself.
- **Contact info** — `email`, `phone`, `address`, `chain_store` (`city`,
  `state` already present)
- **Coffee & Distributor** — `coffee_program`, `current_coffee_supplier`,
  `parent_distributor`, `parent_distributor_num`, `sub_group`,
  `distributor_warehouse`, `distributor_rep_name`, `distributor_rep_email`,
  `distributor_rep_phone`, `distributor_customer_num`
- **Sales rep notes** — `notes`
- **Customer decision notes** — `customer_decision_notes` (already present)
- **Sales economics** — `coffee_spend_3mo`, `expected_monthly_sales`
  (`total_eq_cost`, `total_monthly_charged` already present)

All columns exist on the pipeline `deals` table — verified against the live
schema at `hvmlmequwjxvrmgpltec`. No DB migration needed.

## Sanity check after patching

After redeploying the catalog app, open Loren's My Team page in DevTools and
verify the network request to `/rest/v1/deals?select=...` includes the new
column names in the URL. The response should now have the populated fields
on each pending-queue row.
