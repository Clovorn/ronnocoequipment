-- ============================================================================
-- v32 migrations — Rep Visibility + Notifications + PWA
-- Applied to: hvmlmequwjxvrmgpltec (pipeline) on 2026-05-24
--
-- This file is the canonical record of what shipped with v32. The
-- migrations are already live on the pipeline database; this file is
-- here so the repo's `supabase/migrations/` directory reflects state.
--
-- Three migrations:
--   1. notifications table + index + RLS policies
--   2. notify_rep_on_deal_change trigger (AFTER UPDATE on deals)
--   3. deal_bundles snapshot table (was referenced by code since v27 but
--      never actually created)
--
-- Also adds team_members.email_notifications_enabled column.
-- ============================================================================

-- ─── 1. Notifications table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  deal_id         uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('decision', 'phase_change', 'note', 'system')),
  title           text NOT NULL,
  body            text,
  link_path       text,
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz,
  created_by      text NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications (recipient_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_email)
  WHERE is_read = false;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_notifications"
  ON public.notifications FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_notifications"
  ON public.notifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_notifications"
  ON public.notifications FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ─── 2. Auto-notification trigger ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_rep_on_deal_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rep_email text := NEW.sales_rep_email;
  store_label text := COALESCE(NULLIF(NEW.store_name, ''), NULLIF(CONCAT_WS(' ', NEW.first_name, NEW.last_name), ''), 'a deal');
  link text := '#/deals/' || NEW.id::text;
  old_phase_label text;
  new_phase_label text;
BEGIN
  IF rep_email IS NULL OR rep_email = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.director_decision IS DISTINCT FROM OLD.director_decision
     AND NEW.director_decision IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_email, deal_id, kind, title, body, link_path, created_by)
    VALUES (
      rep_email, NEW.id, 'decision',
      CASE
        WHEN NEW.director_decision = 'approved' THEN 'Your deal for ' || store_label || ' was approved'
        WHEN NEW.director_decision = 'rejected' THEN 'Your deal for ' || store_label || ' was sent back for revision'
        ELSE 'Director decision: ' || NEW.director_decision
      END,
      NULLIF(NEW.director_decision_notes, ''),
      link,
      COALESCE(NEW.director_decision_by, 'a director')
    );
  END IF;

  IF NEW.customer_decision IS DISTINCT FROM OLD.customer_decision
     AND NEW.customer_decision IS NOT NULL
     AND NEW.customer_decision <> 'pending' THEN
    INSERT INTO public.notifications (recipient_email, deal_id, kind, title, body, link_path, created_by)
    VALUES (
      rep_email, NEW.id, 'decision',
      CASE
        WHEN NEW.customer_decision = 'declined' THEN 'Customer declined the quote for ' || store_label
        ELSE 'Customer chose ' || NEW.customer_decision || ' for ' || store_label
      END,
      NULLIF(NEW.customer_decision_notes, ''),
      link,
      'customer'
    );
  END IF;

  IF NEW.phase IS DISTINCT FROM OLD.phase THEN
    old_phase_label := CASE OLD.phase
      WHEN 'sales' THEN 'sales'
      WHEN 'pending_director' THEN 'director review'
      WHEN 'leasing' THEN 'leasing'
      WHEN 'ops' THEN 'operations'
      WHEN 'complete' THEN 'complete'
      ELSE OLD.phase
    END;
    new_phase_label := CASE NEW.phase
      WHEN 'sales' THEN 'sales'
      WHEN 'pending_director' THEN 'director review'
      WHEN 'leasing' THEN 'leasing'
      WHEN 'ops' THEN 'operations'
      WHEN 'complete' THEN 'complete'
      ELSE NEW.phase
    END;

    INSERT INTO public.notifications (recipient_email, deal_id, kind, title, body, link_path, created_by)
    VALUES (
      rep_email, NEW.id, 'phase_change',
      'Deal for ' || store_label || ' moved to ' || new_phase_label,
      'Previously in ' || old_phase_label || '.',
      link, 'system'
    );
  END IF;

  IF NEW.deal_status IS DISTINCT FROM OLD.deal_status
     AND NEW.deal_status IS NOT NULL
     AND OLD.deal_status = 'active' THEN
    INSERT INTO public.notifications (recipient_email, deal_id, kind, title, body, link_path, created_by)
    VALUES (
      rep_email, NEW.id, 'phase_change',
      'Deal for ' || store_label || ' marked ' || NEW.deal_status,
      NULL, link, 'system'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_rep_on_deal_change ON public.deals;
CREATE TRIGGER trg_notify_rep_on_deal_change
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_rep_on_deal_change();

-- ─── 3. deal_bundles snapshot table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deal_bundles (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                  uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  position                 integer NOT NULL DEFAULT 1,
  bundle_id                uuid,
  bundle_name              text NOT NULL,
  bundle_soft_cost_pct     numeric,
  bundle_service_reserve   numeric,
  bundle_term_months       integer,
  bundle_lease_rate        numeric,
  hardware_total           numeric,
  lease_basis              numeric,
  monthly_raw              numeric,
  monthly_charged          numeric,
  equipment                jsonb DEFAULT '[]'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_bundles_one_per_deal
  ON public.deal_bundles (deal_id)
  WHERE position = 1;

CREATE INDEX IF NOT EXISTS idx_deal_bundles_deal_id
  ON public.deal_bundles (deal_id);

ALTER TABLE public.deal_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_deal_bundles"
  ON public.deal_bundles FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_insert_deal_bundles"
  ON public.deal_bundles FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "anon_update_deal_bundles"
  ON public.deal_bundles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
