-- ============================================================================
--  v24 — Director on deals (pipeline DB)
--
--  Run against the PIPELINE project (hvmlmequwjxvrmgpltec).
--
--  Adds three new columns to public.deals so every deal carries the director
--  responsible for the rep at submission time:
--    - director_user_id   uuid     (canonical id, drives future RLS filters)
--    - director_name      text     (denormalized for display)
--    - director_email     text     (for notify workflows)
--
--  Also backfills all existing deals by matching sales_rep_email →
--  catalog.user_profiles.user_id → user_profiles.director_id → director's
--  display_name + email from the catalog auth.users table.
--
--  IMPORTANT: backfill requires a one-time read from the catalog project.
--  Two ways to do this:
--    (A) Run the backfill query AGAINST THE CATALOG PROJECT to produce an
--        UPDATE script, then paste the result into the pipeline editor.
--    (B) (Future) Set up a foreign-data-wrapper between the two projects so
--        the pipeline can query the catalog directly.
--
--  This file does (A): the schema change is here; the backfill is a
--  separate query you'll run against the catalog project, then paste the
--  resulting UPDATEs here. Instructions at the bottom.
-- ============================================================================

-- 1. Add columns ------------------------------------------------------------
alter table public.deals
  add column if not exists director_user_id uuid,
  add column if not exists director_name    text,
  add column if not exists director_email   text;

-- Index for future "deals belonging to this director's team" queries.
create index if not exists deals_director_user_id_idx
  on public.deals(director_user_id)
  where director_user_id is not null;

comment on column public.deals.director_user_id is
  'UUID from catalog user_profiles.user_id of the director assigned to the sales rep at submit time. Stable across rep reassignments.';
comment on column public.deals.director_name is
  'Director display_name snapshot at submit time.';
comment on column public.deals.director_email is
  'Director auth.users.email snapshot at submit time. Used for notify workflows.';


-- 2. Backfill instructions --------------------------------------------------
-- Step 1: in the CATALOG project SQL editor (hthpngozynonzokhbpej), run the
-- query in `backfill_query_catalog_side.sql` (included with this bundle).
-- It will output one UPDATE statement per (rep_email, director) pair.
--
-- Step 2: paste the resulting UPDATEs here, in the pipeline project editor,
-- and run them. Each UPDATE targets all deals with a matching sales_rep_email.
--
-- Step 3: verify with:
--   select count(*) filter (where director_user_id is not null) as with_director,
--          count(*) filter (where director_user_id is null)     as without_director
--     from public.deals;
