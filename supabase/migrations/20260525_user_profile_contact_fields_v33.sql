-- v33 — add contact fields for rep-facing customer documents
alter table public.user_profiles
  add column if not exists title text,
  add column if not exists phone text;

comment on column public.user_profiles.title is
  'Optional rep title shown on customer-facing documents such as sell sheets and quotes.';
comment on column public.user_profiles.phone is
  'Optional rep phone number shown on customer-facing documents such as sell sheets and quotes.';

notify pgrst, 'reload schema';
