# v25 — Distributor Program Bundles heading

Single-file change. Renames the **Bundles page heading** (not the nav tab)
to "Distributor Program Bundles" and adds a short descriptive paragraph
beneath it explaining what these bundles are.

## What changed

- `src/components/BundlesBrowser.jsx` — page heading + description added.
  Nav tab in `Shell.jsx` still reads "Bundles" (intentional — short label
  fits the nav better; the explanatory copy lives on the page).

## How to ship

Drop the one file at the repo root on top of v24. Commit, push, Netlify
rebuilds in ~2 min.

No DB changes, no env-var changes.
