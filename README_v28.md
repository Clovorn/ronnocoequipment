# v28 — Distributor Bundle inclusion wording

Updates the customer-facing language describing what's included with a
distributor program bundle.

## What changed

The "Included with this Program" / "Included with your <Program>" callouts
in `BundleDetailView` and `QuoteView` now read:

> *Customers receive program-branded marketing, digital media, and
> equipment service for the duration of the lease — when in compliance
> with their Supply, Service & Marketing Agreement with Ronnoco.*

(In the customer-facing quote, "Customers receive" reads as "You'll receive"
to address the customer directly.)

## What's in this bundle

```
src/components/BundleDetailView.jsx   # modified (5 lines)
src/components/QuoteView.jsx          # modified (5 lines)
```

No DB changes, no env-var changes. Drop the files into the repo, push,
Netlify rebuilds in ~2 minutes.

## What's NOT updated yet

**FAQ Section 5** (`src/help/faqContent.js` → `understanding-bundles`)
still describes the old bundle model with manual `monthly_lease_price`,
"no substitutions" rule, and `list_price × 0.0395` for add-ons. That whole
section needs rewriting to cover the new computed-monthly model + the new
inclusion wording. Doing it in a separate session so the rewrite gets
proper attention rather than being squeezed into a wording-only patch.
