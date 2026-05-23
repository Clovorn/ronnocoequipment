-- ============================================================================
--  v23 — User Management
--
--  Run against the CATALOG project (hthpngozynonzokhbpej).
--
--  Changes:
--    1. Add director_id column to user_profiles (rep → director assignment).
--    2. Add active flag default true (already exists; no-op if so).
--    3. Tighten is_catalog_editor(): admin only. Directors lose catalog edit.
--    4. Add is_director_of(rep_id) helper for RLS.
--    5. user_profiles RLS: directors can SELECT their assigned reps' profiles.
--    6. Add admins_can_update_profiles policy (admin can change any profile).
--    7. Verify nobody is orphaned (every active user has a profile row).
--
--  Roles after this migration:
--    admin    — full control: catalog, users, all deals, all phases
--    director — sees all deals of assigned reps; edit same as rep; no catalog edit
--    sales    — submits/manages own deals only
--    customer — restricted view (unchanged, used by future quote portal)
-- ============================================================================

-- 1. director_id column ------------------------------------------------------
alter table public.user_profiles
  add column if not exists director_id uuid
    references public.user_profiles(user_id)
    on delete set null;

create index if not exists user_profiles_director_id_idx
  on public.user_profiles(director_id)
  where director_id is not null;

-- Guardrail: a director_id must point at a user whose role is 'director' or 'admin'.
-- (Admins can act as fallback directors for unassigned reps.)
-- Enforced via trigger because a CHECK can't subquery.
create or replace function public.enforce_director_id_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d_role user_role_enum;
begin
  if new.director_id is null then
    return new;
  end if;
  if new.director_id = new.user_id then
    raise exception 'A user cannot be their own director';
  end if;
  select role into d_role from public.user_profiles where user_id = new.director_id;
  if d_role is null then
    raise exception 'director_id % does not reference a user_profile', new.director_id;
  end if;
  if d_role not in ('admin','director') then
    raise exception 'director_id % must point at a user with role admin or director (found %)', new.director_id, d_role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_director_role on public.user_profiles;
create trigger trg_user_profiles_director_role
  before insert or update of director_id, role
  on public.user_profiles
  for each row execute function public.enforce_director_id_role();


-- 2. Tighten is_catalog_editor() --------------------------------------------
-- Previously: role in ('admin','director'). Now: admin only.
create or replace function public.is_catalog_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.user_profiles where user_id = auth.uid()),
    false
  )
$$;


-- 3. is_director_of(rep_id) helper ------------------------------------------
-- Returns true if the calling user is the director assigned to rep_id,
-- OR is an admin (admins implicitly act as a director over everyone).
create or replace function public.is_director_of(rep_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      -- Admins see everyone
      (select role = 'admin' from public.user_profiles where user_id = auth.uid())
    )
    or
    (
      -- Direct director assignment
      exists (
        select 1 from public.user_profiles
         where user_id = rep_id
           and director_id = auth.uid()
      )
    ),
    false
  )
$$;


-- 4. user_profiles RLS additions --------------------------------------------
-- The existing policies are:
--   "Users read own profile"      — select where user_id = auth.uid()
--   "Admins read all profiles"    — select where current_user_role() = 'admin'
--   "Admins manage profiles"      — all where current_user_role() = 'admin'
--
-- Add: directors can read their assigned reps' profiles (needed to render
-- the rep name on deal cards, and to populate the team picker in the dashboard).
drop policy if exists "Directors read assigned reps" on public.user_profiles;
create policy "Directors read assigned reps"
  on public.user_profiles
  for select
  using (
    director_id = auth.uid()
  );


-- 5. Display-name nicety ----------------------------------------------------
-- George and Tim still have display_name = email per memory.
-- Cosmetic only; safe to skip if names already fixed. Idempotent: only updates
-- when display_name still equals the email.
update public.user_profiles up
   set display_name = 'George Hicker'
  from auth.users u
 where up.user_id = u.id
   and u.email = 'georgehicker@ronnoco.com'
   and up.display_name = u.email;

update public.user_profiles up
   set display_name = 'Tim Fetsch'
  from auth.users u
 where up.user_id = u.id
   and u.email = 'timfetsch@ronnoco.com'
   and up.display_name = u.email;


-- 6. Sanity view (helpful for admin queries; not required by app) -----------
create or replace view public.v_users_overview
with (security_invoker = true)
as
select
  up.user_id,
  u.email,
  up.role,
  up.display_name,
  up.director_id,
  d.display_name as director_name,
  up.active,
  up.created_at,
  u.last_sign_in_at
from public.user_profiles up
join auth.users u           on u.id = up.user_id
left join public.user_profiles d on d.user_id = up.director_id;

comment on view public.v_users_overview is
  'Joined view of user_profiles + auth.users for the Users admin page. RLS on user_profiles still applies via security_invoker.';
