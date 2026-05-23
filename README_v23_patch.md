# v23 patch — "v_users_overview not found" fix

If you saw this error in the Users admin page:

> Could not find the table 'public.v_users_overview' in the schema cache

…it means PostgREST didn't expose the view that joins `user_profiles` to
`auth.users`. Views that cross the `auth` schema boundary are sometimes
finicky to expose. This patch replaces the view with a SECURITY DEFINER
function (more reliably exposed) and updates the component to call it.

## Ship checklist

### Step 1 — Run the patch migration

In the catalog Supabase SQL editor:

Paste `supabase/migrations/20260523_user_management_v23_patch.sql` and Run.

It drops the view, creates an `admin_list_users()` RPC function, and
fires a `notify pgrst, 'reload schema'` to refresh the cache immediately.

### Step 2 — Replace the one file

Replace `src/components/admin/UsersAdmin.jsx` in your repo with the version
in this patch. One function changed (`load()`). Commit, push, Netlify rebuilds.

That's it.

## What changed in the code

`UsersAdmin.jsx → load()` now does:

```js
const { data, error } = await supabase.rpc('admin_list_users');
```

instead of `.from('v_users_overview').select('*')`. Same shape of result;
admin gating moved server-side into the function.

## If the error persists after the patch

Run this in SQL editor to confirm the function is there:

```sql
select proname, prosecdef
  from pg_proc
 where proname = 'admin_list_users';
```

You should see one row with `prosecdef = true`. If you do and the app still
errors, hard-refresh the browser (Cmd+Shift+R / Ctrl+Shift+R) to defeat
Netlify's bundle cache.
