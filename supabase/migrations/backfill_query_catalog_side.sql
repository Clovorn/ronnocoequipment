-- ============================================================================
--  v24 BACKFILL HELPER — run on the CATALOG project (hthpngozynonzokhbpej)
--
--  This produces one UPDATE statement per sales rep, ready to paste into the
--  PIPELINE project SQL editor. The output looks like:
--
--    UPDATE public.deals SET
--       director_user_id = '...uuid...',
--       director_name    = 'George Hicker',
--       director_email   = 'georgehicker@ronnoco.com'
--     WHERE sales_rep_email = 'rep@ronnoco.com'
--       AND director_user_id IS NULL;
--
--  Reps with no director assigned are skipped (no UPDATE produced for them).
--  After running these UPDATEs in the pipeline editor, deals submitted by
--  reps without a director will still have null director columns — that's
--  intentional and shows up as "needs director assignment" in admin views.
-- ============================================================================

select
  'UPDATE public.deals SET ' ||
  'director_user_id = ''' || d.user_id::text || ''', ' ||
  'director_name    = ' || quote_literal(coalesce(d.display_name, u.email)) || ', ' ||
  'director_email   = ' || quote_literal(u.email) ||
  ' WHERE sales_rep_email = ' || quote_literal(ru.email) ||
  ' AND director_user_id IS NULL;' as update_sql
from public.user_profiles rep
join auth.users ru        on ru.id = rep.user_id
join public.user_profiles d on d.user_id = rep.director_id
join auth.users u         on u.id = d.user_id
where rep.director_id is not null
order by ru.email;
