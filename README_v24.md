# v24 — Director on Deals

When a rep submits a deal, the system now auto-stamps three new columns on
the pipeline `deals` table:

- `director_user_id` — the rep's director's UUID (catalog `user_profiles.user_id`)
- `director_name` — the director's display name at submit time
- `director_email` — the director's email at submit time

The Deal Builder also surfaces a small read-only "Director: <name>" row on
the form so the rep knows who'll see the deal. If they have no director
assigned, an amber warning shows instead.

## What's in this bundle

```
supabase/migrations/
  20260523_get_my_director_catalog.sql            # catalog: RPC for the form
  20260523_director_on_deals_pipeline.sql         # pipeline: 3 new columns
  backfill_query_catalog_side.sql                 # one-off backfill generator

src/lib/useAuth.js                                 # modified: include director_id
src/lib/useDirector.js                             # new
src/components/DealBuilder.jsx                     # modified: stamp + display
```

## Ship checklist — 4 steps

### Step 1 — Catalog DB: add the RPC

Open the catalog project SQL editor and paste the contents of
`supabase/migrations/20260523_get_my_director_catalog.sql`. Run.

This creates `get_my_director()` — a SECURITY DEFINER function any
authenticated user can call to fetch their own director's info. The
Deal Builder calls this on mount.

### Step 2 — Pipeline DB: add the three columns

Open the pipeline project SQL editor (hvmlmequwjxvrmgpltec) and paste the
contents of `supabase/migrations/20260523_director_on_deals_pipeline.sql`.
Run.

This adds the three columns + a small index. Existing rows get null in the
new columns until step 3 fills them in.

### Step 3 — Backfill the 16 existing deals

This is the only fiddly part. The backfill needs data that lives in *both*
projects (the catalog has the rep→director mapping, the pipeline has the
deals to update). We do it in two halves:

**3a.** In the **catalog** SQL editor, run the entire contents of
`backfill_query_catalog_side.sql`. It will output one row per rep that
has a director, formatted as a complete UPDATE statement.

Example output:

```
UPDATE public.deals SET director_user_id = '...', director_name = 'George Hicker',
  director_email = 'georgehicker@ronnoco.com'
  WHERE sales_rep_email = 'rep@ronnoco.com' AND director_user_id IS NULL;
```

**3b.** Copy all the rows from that result, paste into the **pipeline**
SQL editor, and run them.

**3c.** Verify the backfill:

```sql
select count(*) filter (where director_user_id is not null) as with_director,
       count(*) filter (where director_user_id is null)     as without_director
  from public.deals;
```

(If `without_director` is non-zero, those are deals submitted by reps who
don't have a director assigned in their profile. That's fine — they'll
get filled in when an admin assigns them a director and they submit their
next deal.)

### Step 4 — Drop the three React files

Extract the ZIP at the repo root of `github.com/Clovorn/ronnocoequipment`
on top of v23. Three files change, one new:

```
src/lib/useAuth.js                    # modified (added director_id to select)
src/lib/useDirector.js                # new
src/components/DealBuilder.jsx        # modified (~50 added lines)
```

Commit, push, Netlify rebuilds in ~2 minutes. No env-var changes needed.

---

## After deployment — what changes for users

**For sales reps:** A new "Director: <name>" row appears just below the
sales rep fields on the New Deal form. If they have no director assigned,
they see an amber warning telling them to ask an admin. The director field
is read-only — they can't pick a different one. Director info is
auto-included on every submitted deal.

**For directors:** Nothing visible yet — the Pipeline dashboard hasn't been
updated to filter by director (that's the next session). But every new
deal submitted by their team will carry their `director_user_id`, ready
to filter on.

**For admins:** All existing functionality plus the backfilled history.
Admins should make sure every active sales rep has a director assigned
in `/admin/users`.

---

## Next session — Pipeline dashboard

With director columns flowing into the pipeline, the dashboard can now
show a "My Team" view. The work for that:

1. Read the signed-in user's role + user_id from the catalog DB.
2. Filter deals where `director_user_id = current user's id` (for directors)
   or show everything (for admins).
3. Add a tab/toggle to switch between "My Team" and "All Deals" for admins.

That dashboard work lives in the separate `ronnoco-deal-dashboard` repo —
not this bundle.
