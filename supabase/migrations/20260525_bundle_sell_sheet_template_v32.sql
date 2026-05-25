-- v32 — bundle sell sheet editable content
alter table public.bundles
  add column if not exists sell_sheet_template jsonb not null default '{}'::jsonb;

comment on column public.bundles.sell_sheet_template is
  'Editable customer-facing sell sheet copy for Distributor Program bundles. Live equipment/image/pricing still come from the bundle record; this JSON stores admin-editable marketing copy.';

notify pgrst, 'reload schema';
