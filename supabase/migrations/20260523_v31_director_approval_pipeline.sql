-- =============================================================================
-- v31 — Director Approval Pipeline
-- =============================================================================
-- Target: pipeline Supabase project (hvmlmequwjxvrmgpltec)
-- Purpose: Add the "pending_director" phase to the deal pipeline so that
--          Purchase and Loan customer decisions on a quote land in a queue
--          for the rep's director to approve before the deal moves to Ops.
--
-- What this adds to the `deals` table:
--   - director_decision           pending | approved | rejected (null until decided)
--   - director_decision_at        timestamp of the decision
--   - director_decision_by        director's display name / email (audit)
--   - director_decision_notes     free text from the director (required on reject)
--   - rep_director_email          stamped at submit so the queue knows who
--                                 the deal's director is even if assignments
--                                 change later
--   - resubmission_count          bumped each time the rep resubmits a rejected
--                                 deal — useful to spot "this is the 3rd try"
--
-- Phase + status updates:
--   - The `phase` CHECK constraint is widened to accept 'pending_director'.
--     New phase ordering: sales -> pending_director -> ops, or sales -> leasing.
--   - The `deal_status` CHECK is widened to accept 'rejected' (a rejected
--     deal can still be resubmitted, which clears it back to 'active').
--
-- Two indexes for the queue:
--   - On (rep_director_email, phase) for the per-director queue page
--   - On (director_decision, phase) so admins can see global pending counts
--
-- Reads/writes from the catalog app use the existing anon key (RLS on the
-- pipeline project is currently permissive — see v23 followups). The director
-- queue page reads directly using rep_director_email = current user's email.
--
-- Backfill: this migration does NOT backfill rep_director_email on pre-v31
-- deals. Those deals stay invisible to director queues (cleaner than guessing
-- assignments that may have changed). New submissions and any deal that gets
-- resubmitted will pick up the column going forward.
-- =============================================================================

BEGIN;

-- 1. Add the new columns -----------------------------------------------------

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS director_decision         text,
  ADD COLUMN IF NOT EXISTS director_decision_at      timestamptz,
  ADD COLUMN IF NOT EXISTS director_decision_by      text,
  ADD COLUMN IF NOT EXISTS director_decision_notes   text,
  ADD COLUMN IF NOT EXISTS rep_director_email        text,
  ADD COLUMN IF NOT EXISTS resubmission_count        integer NOT NULL DEFAULT 0;

-- 2. CHECK constraint for director_decision ---------------------------------
-- pending  = the customer chose purchase/loan, queued for director review
-- approved = director approved, deal advances to ops phase
-- rejected = director rejected with a reason, deal_status flips to 'rejected'
-- NULL     = not applicable (didn't go through this phase at all)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_director_decision_check'
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_director_decision_check
      CHECK (director_decision IS NULL
          OR director_decision IN ('pending', 'approved', 'rejected'));
  END IF;
END$$;

-- 3. Widen the phase CHECK to allow pending_director ------------------------
-- The existing constraint (from prior migrations) only allowed
-- 'sales', 'leasing', 'ops'. We drop and re-add to add the new phase.

DO $$
DECLARE
  cons_name text;
BEGIN
  SELECT conname INTO cons_name
    FROM pg_constraint
    WHERE conrelid = 'public.deals'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%phase%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%director%';
  IF cons_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.deals DROP CONSTRAINT %I', cons_name);
  END IF;
END$$;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_phase_check
  CHECK (phase IS NULL
      OR phase IN ('sales', 'leasing', 'pending_director', 'ops'));

-- 4. Widen deal_status to allow 'rejected' ----------------------------------

DO $$
DECLARE
  cons_name text;
BEGIN
  SELECT conname INTO cons_name
    FROM pg_constraint
    WHERE conrelid = 'public.deals'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%deal_status%';
  IF cons_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.deals DROP CONSTRAINT %I', cons_name);
  END IF;
END$$;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_deal_status_check
  CHECK (deal_status IS NULL
      OR deal_status IN ('active', 'closed', 'rejected', 'complete'));

-- 5. Indexes for the director queue -----------------------------------------

CREATE INDEX IF NOT EXISTS deals_director_queue_idx
  ON public.deals (rep_director_email, phase)
  WHERE phase = 'pending_director';

CREATE INDEX IF NOT EXISTS deals_director_decision_idx
  ON public.deals (director_decision, phase);

COMMIT;

-- =============================================================================
-- Notes for future migrations:
-- - The catalog app's pipelineSteps.js mirrors these phase values. Any rename
--   here needs to land in both places.
-- - The pipeline dashboard's inline phase constants need to be updated when
--   pending_director surfaces there. v31 only ships the My Team page in the
--   catalog app; dashboard integration is a follow-up.
-- =============================================================================
