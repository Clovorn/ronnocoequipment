-- ============================================================================
--  v23 PATCH — fallback RPC for users overview
--
--  Symptom: "Could not find the table 'public.v_users_overview' in the schema
--  cache" after running 20260523_user_management_v23.sql.
--
--  Causes (in likely order):
--    1. PostgREST schema cache hadn't reloaded. Fix: run
--         notify pgrst, 'reload schema';
--    2. The view was created but PostgREST still won't expose it because
--       it joins auth.users (which lives in another schema and is owned
--       by supabase_auth_admin, not postgres).
--
--  Solution: replace the view with a SECURITY DEFINER function that does
--  the join server-side and returns rows to the caller — only if the
--  caller is an admin. Functions are more reliably exposed via PostgREST
--  than views over schema boundaries.
--
--  Safe to run after the main v23 migration. Idempotent.
-- ============================================================================

-- Drop the view (it can stay if it works, but we're replacing the data path).
drop view if exists public.v_users_overview;

-- The function. Returns the same shape the UsersAdmin component already expects.
create or replace function public.admin_list_users()
returns table (
  user_id        uuid,
  email          text,
  role           user_role_enum,
  display_name   text,
  director_id    uuid,
  director_name  text,
  active         boolean,
  created_at     timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Only admins can list all users. Directors can read their own reps via
  -- the user_profiles RLS policy; this function is specifically for the
  -- Users admin page.
  if not exists (
    select 1 from public.user_profiles
     where user_profiles.user_id = auth.uid()
       and role = 'admin'
       and active = true
  ) then
    raise exception 'forbidden — admin role required'
      using errcode = '42501';
  end if;

  return query
    select
      up.user_id,
      u.email::text,
      up.role,
      up.display_name,
      up.director_id,
      d.display_name as director_name,
      up.active,
      up.created_at,
      u.last_sign_in_at
    from public.user_profiles up
    join auth.users u           on u.id = up.user_id
    left join public.user_profiles d on d.user_id = up.director_id
    order by up.active desc, up.role, up.display_name;
end;
$$;

-- PostgREST exposes functions as RPC. Grant execute to authenticated users;
-- the function itself gates on admin role.
revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- Force schema cache reload so the new function is callable immediately.
notify pgrst, 'reload schema';
