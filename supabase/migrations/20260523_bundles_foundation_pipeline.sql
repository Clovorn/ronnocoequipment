-- ============================================================================
--  v26 — Bundles foundation (pipeline DB)
--
--  Run against the PIPELINE project (hvmlmequwjxvrmgpltec).
--
--  Adds the deal_bundles table that will hold per-deal snapshots of bundle
--  pricing in Increment B (the deal-builder rework). No code reads or writes
--  this table yet — it's prepared infrastructure so the data model is settled
--  before the UI changes land.
--
--  Single-row-per-deal for now (unique index on deal_id). Drop that index
--  when we expand to multi-bundle later — the table itself is junction-shaped.
--
--  Idempotent. Safe to re-run.
-- ============================================================================

create table if not exists public.deal_bundles (
  id                       uuid primary key default gen_random_uuid(),
  deal_id                  uuid not null references public.deals(id) on delete cascade,
  position                 integer not null default 1,

  -- Catalog reference. Can dangle if the bundle is later soft-deleted in the
  -- catalog; the snapshot columns below preserve everything needed to render
  -- the deal historically.
  bundle_id                uuid,

  -- Snapshot of the bundle config at submit time. These are the values that
  -- generated the math, frozen so future admin changes don't retroactively
  -- alter past deals.
  bundle_name              text not null,
  bundle_soft_cost_pct     numeric(5,4) not null,
  bundle_service_reserve   numeric(10,2) not null,
  bundle_term_months       integer not null,
  bundle_lease_rate        numeric(7,5) not null,

  -- Computed totals at submit time.
  hardware_total           numeric(12,2) not null,
  lease_basis              numeric(12,2) not null,
  monthly_raw              numeric(12,2) not null,
  monthly_charged          integer not null,

  -- Equipment list for this bundle on this deal — array of objects matching
  -- the same shape used in deals.raw_csv. Each entry is roughly:
  --   { equipment_id, sku, description, model, list_price, quantity }
  equipment                jsonb not null default '[]'::jsonb,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists deal_bundles_deal_id_idx       on public.deal_bundles(deal_id);
create index if not exists deal_bundles_bundle_id_idx     on public.deal_bundles(bundle_id);

-- Enforce single-bundle-per-deal for now. Drop this index when expanding
-- to multi-bundle in a future migration.
create unique index if not exists deal_bundles_one_per_deal_idx
  on public.deal_bundles(deal_id);

comment on table public.deal_bundles is
  'Per-deal snapshot of bundle pricing. Single row per deal under the current single-bundle-per-deal constraint. Read by Pipeline dashboard and customer quote view. Increment A creates the table; Increment B populates it on deal submit.';
comment on column public.deal_bundles.bundle_id is
  'Reference to catalog bundles.id. Can dangle if bundle is soft-deleted; snapshot columns carry everything needed for rendering.';
comment on column public.deal_bundles.equipment is
  'Array of equipment line items scoped to this bundle on this deal. Snapshot-shaped objects with id, sku, description, model, list_price, quantity.';
comment on column public.deal_bundles.monthly_charged is
  'Whole-dollar customer-visible monthly payment (rounded half-up from monthly_raw).';


-- Total monthly across all bundles on a deal. Single-bundle today, so this
-- equals deal_bundles.monthly_charged for the matching row. Added now so
-- dashboard queries don't need to join + sum every time.
alter table public.deals
  add column if not exists total_monthly_charged integer;

comment on column public.deals.total_monthly_charged is
  'Sum of monthly_charged across all deal_bundles rows for this deal. Populated on submit.';


-- Permissive policy for now matching the rest of the pipeline tables.
-- The pipeline DB RLS tightening (flagged in memory follow-ups) will
-- come in a separate migration along with the dashboard role-filter work.
alter table public.deal_bundles enable row level security;

drop policy if exists "anon read deal_bundles"   on public.deal_bundles;
drop policy if exists "anon insert deal_bundles" on public.deal_bundles;
drop policy if exists "anon update deal_bundles" on public.deal_bundles;
drop policy if exists "anon delete deal_bundles" on public.deal_bundles;

create policy "anon read deal_bundles"   on public.deal_bundles for select using (true);
create policy "anon insert deal_bundles" on public.deal_bundles for insert with check (true);
create policy "anon update deal_bundles" on public.deal_bundles for update using (true) with check (true);
create policy "anon delete deal_bundles" on public.deal_bundles for delete using (true);

notify pgrst, 'reload schema';
