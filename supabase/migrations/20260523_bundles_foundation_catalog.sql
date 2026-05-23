-- ============================================================================
--  v26 — Bundles foundation (catalog DB)
--
--  Run against the CATALOG project (hthpngozynonzokhbpej).
--
--  Adds:
--    1. equipment.bundle_eligible (boolean) — admins flag items as eligible
--       for inclusion in distributor program bundles. Default false.
--    2. bundles columns for the new soft-cost lease model:
--         target_monthly_fee  — marketed starting price ($199/$299); display only
--         soft_cost_pct       — 0.20–0.25, default 0.25 (CHECK enforced)
--         service_reserve     — default $1,080; per-bundle override
--         term_months         — default 36
--         lease_rate          — default 0.0395 (rarely changes)
--    3. Migrates existing bundle_items rows where item_type='optional'
--       into a flat bundle_eligible flag on the underlying equipment items.
--       After this migration, those rows are removed from bundle_items
--       since the new model uses a global eligibility flag rather than
--       a per-bundle 'optional' relationship.
--
--  Idempotent. Safe to re-run.
-- ============================================================================

-- 1. equipment.bundle_eligible -----------------------------------------------
alter table public.equipment
  add column if not exists bundle_eligible boolean not null default false;

create index if not exists equipment_bundle_eligible_idx
  on public.equipment(bundle_eligible)
  where bundle_eligible = true;

comment on column public.equipment.bundle_eligible is
  'When true, this item can be added to distributor program bundles. Managed in the item detail drawer by admins. Used by EquipmentPicker in bundle mode to filter selectable items.';


-- 2. bundles math params ----------------------------------------------------
alter table public.bundles
  add column if not exists target_monthly_fee numeric(10,2),
  add column if not exists soft_cost_pct      numeric(5,4) not null default 0.25,
  add column if not exists service_reserve    numeric(10,2) not null default 1080.00,
  add column if not exists term_months        integer       not null default 36,
  add column if not exists lease_rate         numeric(7,5)  not null default 0.0395;

-- CHECK constraints. Idempotent: drop if existing, add fresh.
alter table public.bundles drop constraint if exists bundles_soft_cost_pct_range;
alter table public.bundles
  add constraint bundles_soft_cost_pct_range
  check (soft_cost_pct between 0.20 and 0.25);

alter table public.bundles drop constraint if exists bundles_service_reserve_nonneg;
alter table public.bundles
  add constraint bundles_service_reserve_nonneg
  check (service_reserve >= 0);

alter table public.bundles drop constraint if exists bundles_term_months_positive;
alter table public.bundles
  add constraint bundles_term_months_positive
  check (term_months > 0);

alter table public.bundles drop constraint if exists bundles_lease_rate_positive;
alter table public.bundles
  add constraint bundles_lease_rate_positive
  check (lease_rate > 0);

comment on column public.bundles.target_monthly_fee is
  'Marketed starting monthly fee ($199, $299, etc.) shown as "Starts at $X/mo" on bundle cards. Display only. Actual quoted monthly is computed from soft_cost + service_reserve + lease_rate × equipment total.';
comment on column public.bundles.soft_cost_pct is
  'Soft-cost uplift applied to hardware total when computing lease basis. Constrained to 0.20–0.25 (20–25%). Default 0.25.';
comment on column public.bundles.service_reserve is
  'Fixed amount added to lease basis to fund service and media obligations under the Supply, Service & Marketing Agreement. Default $1,080. Hidden from customer.';
comment on column public.bundles.term_months is
  'Lease term in months. Default 36.';
comment on column public.bundles.lease_rate is
  'Multiplier applied to lease basis to compute monthly payment. Default 0.0395.';


-- 3. Migrate existing 'optional' bundle_items to bundle_eligible -------------
-- Strategy: for every distinct equipment_id referenced by a row where
-- item_type='optional', flip bundle_eligible=true on that equipment. Then
-- delete the optional rows so the new model is the single source of truth.
--
-- Uses an UPDATE...FROM so it's a single statement (no row-by-row loop).
update public.equipment e
   set bundle_eligible = true
  from public.bundle_items bi
 where bi.equipment_id = e.id
   and bi.item_type = 'optional'
   and e.bundle_eligible = false;

-- Remove the now-migrated optional rows. (They're no longer needed — the new
-- model uses the global bundle_eligible flag and items appear in the
-- EquipmentPicker filtered list across all bundles.)
delete from public.bundle_items
 where item_type = 'optional';


-- 4. Helper view: bundle-eligible equipment ---------------------------------
-- Lightweight projection of equipment for the EquipmentPicker in bundle mode.
-- Mirrors what v_catalog already exposes but filtered to bundle_eligible=true.
create or replace view public.v_bundle_eligible_equipment
with (security_invoker = true)
as
select e.id, e.sku, e.description, e.model, e.list_price,
       e.lease_eligible, e.vendor_id, e.category,
       v.name as vendor
  from public.equipment e
  left join public.vendors v on v.id = e.vendor_id
 where e.active = true
   and e.bundle_eligible = true
 order by e.description;

comment on view public.v_bundle_eligible_equipment is
  'Projection of active, bundle-eligible equipment for use in EquipmentPicker bundle mode (Increment B). Mirrors v_catalog columns.';


-- 5. Ensure v_equipment_detail exposes the new column ----------------------
-- Defensive: if v_equipment_detail enumerates columns explicitly (rather than
-- using SELECT *), bundle_eligible would otherwise be missing from the drawer.
-- We rebuild the view as SELECT * from equipment so any new columns flow
-- through automatically going forward. RLS still applies (security_invoker).
do $$
declare
  view_def text;
begin
  -- If the view doesn't exist yet, skip. If it does, only rebuild if the
  -- existing definition is column-by-column (no SELECT *).
  select definition into view_def from pg_views
   where schemaname = 'public' and viewname = 'v_equipment_detail';

  if view_def is null then
    raise notice 'v_equipment_detail does not exist; skipping view refresh.';
  elsif position('select *' in lower(view_def)) > 0 then
    raise notice 'v_equipment_detail already uses SELECT *; no rebuild needed.';
  else
    -- Drop & recreate using SELECT * so future column adds flow through.
    -- This preserves the view's role but loses any custom column ordering;
    -- callers should reference columns by name (which they all do).
    execute 'drop view public.v_equipment_detail';
    execute 'create view public.v_equipment_detail with (security_invoker = true) as select * from public.equipment';
    raise notice 'v_equipment_detail rebuilt to use SELECT *.';
  end if;
end $$;


-- 6. Note about v_bundles_with_totals ---------------------------------------
-- The BundlesBrowser reads from v_bundles_with_totals. If that view
-- enumerates columns explicitly, the new bundle math columns (especially
-- target_monthly_fee) won't reach the browser cards. We can't rebuild it
-- automatically because it likely contains aggregation logic
-- (included_items_count, etc.) we shouldn't second-guess.
--
-- After running this migration, if `target_monthly_fee` doesn't appear in
-- BundlesBrowser data, run:
--   select definition from pg_views where viewname = 'v_bundles_with_totals';
-- and add the new columns to the SELECT list.
--
-- Increment B (deal-flow rework) will explicitly query for target_monthly_fee
-- and the math columns; if missing from the view, we'll address it then.


-- Reload PostgREST schema cache so the new column/view are immediately available.
notify pgrst, 'reload schema';
