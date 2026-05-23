# v22a-prep — Field Requirements admin page

This bundle adds the **Field Requirements** admin screen to the Ronnoco Deal
Builder. It's the first half of v22a; the validation refactor in
`DealBuilder.jsx` that consumes this config is the **next** session.

## What's done

- **Database** (catalog Supabase, project `hthpngozynonzokhbpej`):
  - `public.field_requirements` table created
  - RLS enabled, same shape as `lookup_lists`: anon read, write requires
    `is_catalog_editor()`
  - Seeded with 50 fields from `DealBuilder.jsx`, grouped into 12 sections
  - 7 fields locked as `system_required = true` (first/last/email for sales rep
    and contact, plus store name)

- **Code** in this ZIP:
  - `src/components/admin/FieldRequirementsAdmin.jsx` — new component (~210 lines)
  - `src/components/admin/AdminHome.jsx` — adds the sixth tile + a new icon
  - `src/App.jsx` — imports the new component, adds the `field-requirements`
    section to the admin route switch

## How to ship

Extract this ZIP at the **repo root** of `github.com/Clovorn/ronnocoequipment`
on top of v21. Three files change, one new. Commit, push to `main`, Netlify
rebuilds in ~2 minutes:

```
src/App.jsx                                       # modified
src/components/admin/AdminHome.jsx                # modified
src/components/admin/FieldRequirementsAdmin.jsx   # new
```

After deploy, navigate to `#/admin/field-requirements` (or click the new tile
from `#/admin`) to use the screen. Edits save immediately on dropdown change.

## What this does NOT do yet

- **No validation enforcement.** The deal form still submits with the existing
  hardcoded `required` props in JSX. The next session reads these rows at form
  load and produces a "missing required fields" list at submit time, branching
  on whether the rep clicked "Submit as Quote" or "Submit as Deal."
- **No edit history.** Last `updated_at`/`updated_by` is captured on each save,
  but full revision history isn't kept. If needed later, the same pattern used
  by `deal_revisions` in the pipeline DB would fit.

## Open items / decisions still to make

- Conditional fields (e.g. `change_details`, `core_mark_div_num`,
  `delivery_method`, `delivery_recurrence`, `emergency_install_details`,
  `prior_account_num`) are intentionally **not** in this table — their
  visibility is JSX-controlled and they only matter when their parent is set.
  If you later want to require, say, `change_details` whenever
  `change_of_ownership = true`, the `conditional_on_field` /
  `conditional_on_value` columns are already present in the schema for that.

- Equipment selection and the $5K lease threshold remain handled in
  `DealBuilder.jsx` business logic — not exposed here.
