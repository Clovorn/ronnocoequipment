-- ============================================================================
--  v26 — Bundle-eligible SKU seed
--
--  Run against the CATALOG project (hthpngozynonzokhbpej) AFTER running
--  the bundles foundation migration.
--
--  Flags 12 equipment items as bundle_eligible based on the SKUs the user
--  provided. The first SELECT is a preview — run it first to confirm
--  every SKU matches an equipment row. Then run the UPDATE.
--
--  If any SKU doesn't match, the preview will return fewer than 12 rows.
--  Fix mismatches in the catalog first, then re-run the UPDATE.
-- ============================================================================

-- ─── Preview: show what each SKU resolves to ────────────────────────────────
-- Expected output: 12 rows. Anything less means a SKU isn't matching.
with seed_skus(sku) as (
  values
    ('0750407036E'),   -- Dr. Coffee F2
    ('0750407025E'),   -- G3 ALPHA — Bottle Brewer
    ('0750947503E'),   -- G3 ALPHA — Airpot Brewer
    ('0750907074E'),   -- G4 Combo Tea & Coffee with adj. shelf
    ('0750107019E'),   -- G4 Twin 1.5 Gal Direct Heat Brewer (2 servers)
    ('0750107008G'),   -- GEMINI Satellite Server Single 1.5 Gal
    ('0750947504E'),   -- Gem-5 Stand
    ('0759001007E'),   -- G4 Tea Brewer — Rotating Basket
    ('0751299513E'),   -- 3 Bowl Bubbler S+S Sides
    ('0751107021E'),   -- Elmeco FC 2 Hd Green LED Frozen
    ('0751107023E'),   -- PCNG3 Primo Cappuccino 3 Spout
    ('0751107025E')    -- PCNG5 Primo Cappuccino 5 Spout  (assumed SKU; user listed but didn't provide vendor #)
)
select s.sku                         as seed_sku,
       e.id                          as equipment_id,
       e.description,
       e.model,
       e.list_price,
       e.bundle_eligible             as currently_flagged,
       case when e.id is null then 'NO MATCH — check SKU' else 'OK' end as status
  from seed_skus s
  left join public.equipment e on e.sku = s.sku
 order by s.sku;


-- ─── Apply: flip bundle_eligible=true on the matching rows ─────────────────
-- Only run this after the preview shows all 12 SKUs resolving correctly.
-- Re-running is harmless (idempotent — sets true on already-true rows).
update public.equipment
   set bundle_eligible = true
 where sku in (
   '0750407036E',
   '0750407025E',
   '0750947503E',
   '0750907074E',
   '0750107019E',
   '0750107008G',
   '0750947504E',
   '0759001007E',
   '0751299513E',
   '0751107021E',
   '0751107023E',
   '0751107025E'
 );


-- ─── Verify: confirm the count after applying ──────────────────────────────
select count(*) as bundle_eligible_count
  from public.equipment
 where bundle_eligible = true;
-- Expected: 12 (or more if 'optional' bundle_items migration also flagged some).
