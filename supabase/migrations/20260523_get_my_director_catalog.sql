-- ============================================================================
--  v24 — get_my_director() RPC (catalog project)
--
--  Run against the CATALOG project (hthpngozynonzokhbpej).
--
--  Allows the currently-signed-in user (any role) to fetch their own
--  director's display_name and email. Used by the Deal Builder to:
--    - show "Director: <name>" on the deal sheet (read-only)
--    - stamp director_name/email on the submitted deal payload
--
--  Returns null/empty result if the user has no director assigned.
-- ============================================================================

create or replace function public.get_my_director()
returns table (
  director_user_id uuid,
  director_name    text,
  director_email   text
)
language plpgsql
security definer
set search_path = public, auth
as $func$
begin
  return query
    select
      d.user_id            as director_user_id,
      d.display_name       as director_name,
      u.email::text        as director_email
    from public.user_profiles me
    join public.user_profiles d on d.user_id = me.director_id
    join auth.users u           on u.id = d.user_id
    where me.user_id = auth.uid()
      and me.director_id is not null;
end;
$func$;

revoke all on function public.get_my_director() from public;
grant execute on function public.get_my_director() to authenticated;

notify pgrst, 'reload schema';
