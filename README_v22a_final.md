# v22a-final — Field Requirements validation refactor

This bundle completes v22a. It plugs the admin-managed `field_requirements`
configuration (shipped in v22a-prep) into the actual New Deal form so that
submitting as **Quote** vs **Deal** now enforces different required-field
lists based on what admins have configured.

## What's in this ZIP

```
src/lib/useFieldRequirements.js                    # new
src/components/DealBuilder.jsx                     # modified
src/components/admin/FieldRequirementsAdmin.jsx    # modified (cache invalidation only)
```

## How to ship

Extract this ZIP at the **repo root** of `github.com/Clovorn/ronnocoequipment`
on top of v22a-prep. Three files change, one new. Commit, push to `main`,
Netlify rebuilds in ~2 minutes.

## What changed

### `src/lib/useFieldRequirements.js` (new)

A hook that fetches and caches the `field_requirements` table from the
catalog Supabase project. Matches the `useLookupList` pattern — single
in-memory Promise per page session, soft TTL of 5 minutes, manual
invalidation when an admin edits a row.

Exports three things:

- `useFieldRequirements()` — React hook returning `{ rules, loading, error }`
  where `rules` is a `Map<field_key, requirement_row>` for O(1) lookups.
- `invalidateFieldRequirements()` — busts the cache so the next mount
  refetches. Called by the admin screen after every save.
- `validateAgainstRequirements({ rules, draft, mode })` — pure function
  that takes the rules, current draft, and submission mode (`'quote'` or
  `'deal'`) and returns `{ errors: string[] }`. Tested against representative
  scenarios; correctly handles conditional visibility (e.g. `change_details`
  only flagged when `change_of_ownership=true`).

### `src/components/DealBuilder.jsx`

The hardcoded `validate()` function — previously a flat list of 13 required
field keys with one inline business rule — is replaced by a two-layer
validator:

1. **Field-config layer** — reads `field_requirements` via the hook and
   flags every missing field whose `applies_to` matches the submission mode.
   Conditional fields (`prior_account_num`, `change_details`,
   `delivery_method`, `delivery_recurrence`, `emergency_install_details`,
   `core_mark_div_num`) are only enforced when their parent toggle is on.
2. **Business-rule layer** — equipment count ≥ 1, lease/finance ≥ $5K,
   customer email required for quote (so mailto: works). These remain
   hardcoded because they're not admin-configurable.

The validator now collects ALL errors in one pass rather than failing on
the first one, and the error display preserves newlines (`whitespace-pre-line`)
so the rep sees the full list at submit time.

`submitDeal()` calls `validate('deal')`; `submitAsQuote()` calls
`validate('quote')`. The redundant inline customer-email check in
`submitAsQuote()` was removed since the new validator handles it.

### `src/components/admin/FieldRequirementsAdmin.jsx`

One small change: after each successful row save, call
`invalidateFieldRequirements()`. This ensures a rep who opens the New Deal
form right after an admin edit sees the updated rules immediately, rather
than waiting up to 5 minutes for the TTL to expire.

## Degraded-mode behavior

If the `field_requirements` fetch fails (network blip, DB down), the
hook returns an empty Map. The validator treats an empty Map as "no
config to enforce" and only runs the business-rule layer. This means a
flaky network call won't block legitimate deal submissions — reps can
still submit, the form just doesn't enforce per-field requirements until
the config is reachable again.

## Testing checklist

After deploying, verify:

1. **Quote mode** — start a new deal, leave `target_install_date` blank,
   add equipment, click "Submit as Quote." Should succeed (target install
   is `applies_to=deal`, not `both`).
2. **Deal mode** — same form, click "Submit as Deal." Should now show a
   "Missing required fields" list including Target Install Date and any
   distributor/ROM fields you skipped.
3. **System-required protection** — try blanking `store_name` in the admin
   Field Requirements page; the dropdown should be disabled (lock icon).
4. **Live config update** — change a field from "Apply to Deal" to
   "Apply to Both" in the admin page, then open the New Deal form in a
   new tab. The newly-flipped field should be enforced on quote submission
   without needing a hard refresh.
5. **Conditional visibility** — open the New Deal form, turn on "Change
   of Ownership," then try to submit without filling `change_details`.
   It should be flagged. Turn the toggle off and submit again — it should
   NOT be flagged.

## What's NOT in v22a

v22a closes the loop on the per-field admin config and the submit-time
validation it drives. It does NOT include:

- **My Deals workspace** (`#/my-deals`) — rep-facing list of their own
  deals/quotes, with edit-quote and Submit-as-Deal flows. Coming in v22b.
- **Lazy quote expiration** — visual + DB-flip when `valid_until` passes.
  Coming in v22b.
- **Admin "View as user"** — admins picking which rep's deals to view in
  My Deals. Coming in v22b.
- **FAQ section for Field Requirements** — minor doc work, will be folded
  into the v22b FAQ updates.
