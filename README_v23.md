# v23 — User Management

Adds the **Users** admin screen to the Ronnoco Deal Builder. Three roles are
now formalized:

| Role         | Catalog edit | Admin pages | Deals they see           |
|--------------|--------------|-------------|--------------------------|
| **Admin**    | ✅           | ✅          | All deals, all phases    |
| **Director** | ❌           | ❌          | Deals owned by their assigned reps |
| **Sales**    | ❌           | ❌          | Only their own deals     |

Plus `customer` remains in the schema for the future external quote portal,
but is hidden from the create-user dropdown.

## What's in this bundle

```
supabase/migrations/20260523_user_management_v23.sql       # DB changes
supabase/functions/admin-create-user/index.ts              # Edge Function
src/App.jsx                                                 # modified
src/components/admin/AdminHome.jsx                          # modified (new tile)
src/components/admin/UsersAdmin.jsx                         # new
```

---

## Ship checklist

### Step 1 — Run the migration

In the catalog project SQL editor:
<https://supabase.com/dashboard/project/hthpngozynonzokhbpej/sql/new>

Paste the contents of
`supabase/migrations/20260523_user_management_v23.sql`
and Run. It is idempotent — safe to re-run.

What it changes:

- Adds `director_id` column to `user_profiles`, with a trigger that prevents
  a director from being their own director and prevents pointing at a
  non-staff user.
- **Tightens `is_catalog_editor()` to admin-only.** Directors no longer have
  catalog write access. If George or Tim were relying on directorship for
  catalog edits, they're already admins so nothing changes for them; but
  any future `director` user will not see edit controls in Catalog/Bundles/Vendors.
- Adds `is_director_of(rep_id)` helper for downstream RLS (e.g. tightening
  the pipeline DB later).
- Adds a "Directors read assigned reps" RLS policy on `user_profiles` so
  directors can see their team's profile rows.
- Creates the `v_users_overview` view (joined `user_profiles` + `auth.users`)
  that the admin UI reads from.

### Step 2 — Deploy the Edge Function

The Users admin can read & update `user_profiles` under RLS, but creating
a new `auth.users` row requires the service role key, which can never be
in the browser bundle. We use an Edge Function as the trusted middle layer.

From a machine with the Supabase CLI installed and logged in:

```bash
cd <path-to-this-bundle>
supabase functions deploy admin-create-user --project-ref hthpngozynonzokhbpej
```

The function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the
Supabase environment automatically (they're available in every Edge Function
runtime by default). No extra env config needed.

Verify:

```bash
curl -i https://hthpngozynonzokhbpej.supabase.co/functions/v1/admin-create-user \
  -X OPTIONS
# Expect: HTTP/2 204 with Access-Control-Allow-Methods header
```

### Step 3 — Drop the React files

Extract this ZIP at the repo root of `github.com/Clovorn/ronnocoequipment`
on top of v22a-final. Three files change, one new under `src/components/admin/`.
Commit, push to `main`, Netlify rebuilds in ~2 minutes:

```
src/App.jsx                              # modified
src/components/admin/AdminHome.jsx       # modified (new Users tile)
src/components/admin/UsersAdmin.jsx      # new
```

No new dependencies. No env-var changes needed.

### Step 4 — Try it

1. Sign in as an admin (George or Tim).
2. Open the user menu → **Admin** → **Users**.
3. Click **+ New user**.
4. Fill in email, name, pick role. If Sales, optionally pick a director.
5. Copy the temporary password from the success dialog and give it to the user.
6. The user signs in and changes their password from **My profile**.

---

## How permissions work after this release

### Frontend (`src/App.jsx`)
```js
const canEditCatalog   = role === 'admin';           // was: admin || director
const isAdmin          = role === 'admin';           // was: admin || director
const isManagerOrAdmin = role === 'admin' || role === 'director';  // new
```

`isManagerOrAdmin` isn't consumed by any existing screen yet — it's exported
in spirit so the **Pipeline dashboard** (separate repo) can use the same model.

### Backend (catalog Supabase RLS)

| Function                | Old                      | New                      |
|-------------------------|--------------------------|--------------------------|
| `is_catalog_editor()`   | admin OR director        | **admin only**           |
| `is_director_of(rep)`   | (didn't exist)           | admin OR rep's director  |

The `is_catalog_editor()` change is enforced by every existing
write policy on `equipment`, `vendors`, `bundles`, `lookup_lists`,
`field_requirements`, `announcements`, and `hero_settings`. No policy
files need editing — they already call the helper.

### Pipeline dashboard (separate repo) — follow-up

The pipeline DB's `deals` table currently has `anon` policies allowing all
CRUD (flagged in memory as a known follow-up). With this v23 in place we
now have a clean model to tighten it:

```sql
-- In the PIPELINE project (hvmlmequwjxvrmgpltec):
-- a sales rep sees deals where sales_person_email = their email
-- a director sees deals where sales_person_email IN (their reps' emails)
-- an admin sees everything
```

That's the next session. v23 doesn't touch the pipeline DB.

---

## Things v23 does NOT do

- **Doesn't filter the pipeline dashboard by role yet.** The HTML dashboard
  still shows everyone all deals. That's the next step, and it lives in the
  `ronnoco-deal-dashboard` repo, not this one.
- **Doesn't enforce the sales-rep "own deals only" rule in the Deal Builder
  app.** Today `MyDealsPage` already filters by the signed-in user's email,
  so reps naturally see only their own. The teeth-level enforcement (RLS on
  the pipeline DB) is the follow-up.
- **Doesn't send a welcome email.** Admin copies the temp password from
  the success dialog and shares it manually. Email integration is in the
  Phase C2 backlog (along with quote-send via Resend).

---

## Known follow-ups

1. **Pipeline DB RLS** — replace the permissive anon policies with role-aware
   ones using `is_director_of()`. Mentioned in memory as a known loose end;
   v23 is the foundation for it.
2. **Pipeline dashboard filtering UI** — surface "My team" vs "My deals" vs
   "All" selector for admins and directors.
3. **Welcome email** — once Resend is wired, send the temp password by email
   instead of showing it in a browser dialog.
4. **Audit log** — record role changes / deactivations in an `admin_activity`
   table. Light addition; not blocking.
