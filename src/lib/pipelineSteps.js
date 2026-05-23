/**
 * Pipeline phase & step constants — single source of truth for what stage a
 * deal is in, and what the next/previous step should look like.
 *
 * IMPORTANT: these constants are DUPLICATED in the Pipeline Dashboard's
 * inline script (Clovorn/ronnoco-deal-dashboard repo, index.html). When the
 * dashboard team renames or reorders a step there, this file has to follow.
 * Keep the two in lockstep. The values used in the `current_step` column of
 * the pipeline `deals` table are the snake_case keys below; the dashboard
 * UI labels and the Deal Builder UI labels both render from STEP_LABELS so
 * a rename only needs to happen in one place per app.
 *
 * Phase transitions (per v22c business rules):
 *   Sales (quoted) ─┬─ customer decision: lease/finance ─► Leasing (submitted)
 *                   ├─ customer decision: purchase/loan  ─► Ops (customer_setup)
 *                   └─ customer decision: declined       ─► closed (deal_status='closed')
 *   Leasing (funded) ─► Ops (customer_setup)                  [auto, last leasing step]
 *   Ops (installation) ─► Complete                            [deal_status='complete'? — TBD]
 *
 * The auto-transitions (Leasing→Ops on funded, decision→phase) are
 * implemented in MyDealsPage.jsx's recordCustomerDecision handler. The
 * Leasing→Ops transition isn't triggered from Deal Builder — the leasing
 * team advances it in the Pipeline Dashboard.
 */

/* ─────────────── Phase sequences ─────────────── */

/**
 * Ordered list of `current_step` values for each phase, earliest → latest.
 * The stepper renders this sequence with the deal's actual `current_step`
 * highlighted.
 *
 * `credit_denied` is NOT in the leasing sequence — it's a *terminal branch*
 * off `credit_received`. The stepper renders it as a side-branch when it's
 * the deal's current step. See `isTerminalDenial()` below.
 */
export const PHASE_STEPS = {
  sales: ['quoted'],
  leasing: [
    'submitted',
    'notify_lender',
    'credit_sent',
    'credit_received',
    'credit_approved',
    'paperwork_sent',
    'paperwork_received',
    'funded',
  ],
  ops: [
    'customer_setup',
    'equip_ordered',
    'equip_received',
    'install_scheduled',
    'dist_notified',
    'installation',
  ],
};

/* ─────────────── Display labels ─────────────── */

/**
 * Human-readable labels for every `current_step` value, including off-path
 * states (`credit_denied`, `complete`). Used by the stepper and any place
 * that needs to render a step name.
 */
export const STEP_LABELS = {
  // Sales
  quoted: 'Quoted',
  // Leasing
  submitted: 'Submitted',
  notify_lender: 'Notify Lender',
  credit_sent: 'Credit App Sent',
  credit_received: 'Credit App Received',
  credit_approved: 'Credit Approved',
  credit_denied: 'Credit Denied',
  paperwork_sent: 'Paperwork Sent',
  paperwork_received: 'Paperwork Received',
  funded: 'Funded',
  // Ops
  customer_setup: 'Customer Setup',
  equip_ordered: 'Equip Ordered',
  equip_received: 'Equip Received',
  install_scheduled: 'Install Scheduled',
  dist_notified: 'Dist. Notified',
  installation: 'Installation',
  // Terminal / closed
  complete: 'Complete',
};

/**
 * Phase labels — the human-readable name for `phase` values.
 */
export const PHASE_LABELS = {
  sales: 'Sales',
  leasing: 'Financing',  // dashboard tab says "In Financing"; we call it Financing
  ops: 'Operations',
};

/* ─────────────── Customer decision constants ─────────────── */

/**
 * Customer decisions that move a quote forward. The phase a decision lands
 * the deal in is encoded here so the recordCustomerDecision handler stays
 * declarative — adding a new decision type only requires adding a row.
 *
 * 'pending' is the default before the customer responds and isn't in this
 * map (it's not a "decision" yet, just absence of one).
 */
export const DECISIONS = [
  { value: 'lease',    label: 'Accepted — Lease',    nextPhase: 'leasing', nextStep: 'submitted' },
  { value: 'finance',  label: 'Accepted — Finance',  nextPhase: 'leasing', nextStep: 'submitted' },
  { value: 'purchase', label: 'Accepted — Purchase', nextPhase: 'ops',     nextStep: 'customer_setup' },
  { value: 'loan',     label: 'Accepted — Loan',     nextPhase: 'ops',     nextStep: 'customer_setup' },
  { value: 'declined', label: 'Declined',            nextPhase: null,      nextStep: null, closed: true },
];

/* ─────────────── Stepper helpers ─────────────── */

/**
 * For a given (phase, currentStep), return the step status for every step in
 * the phase's sequence: 'past' | 'current' | 'future'.
 *
 * If currentStep is not in the phase's sequence (e.g. credit_denied in a
 * leasing deal), all steps are returned with status 'past' UP TO the point
 * the off-path step would've branched from, and the rest are 'future'. The
 * stepper component handles drawing the off-path marker separately.
 *
 * Edge cases:
 *   - phase not in PHASE_STEPS (e.g. null phase on a brand-new quote in sales)
 *     → returns empty array. Caller should hide the stepper.
 *   - currentStep is null → entire phase shown as 'future'. The deal is
 *     in the phase but no specific step has been recorded.
 *   - currentStep is past the last step in the phase (e.g. 'complete' in ops)
 *     → all steps marked 'past'. Caller can show a terminal badge.
 */
export function getStepStatuses(phase, currentStep) {
  const sequence = PHASE_STEPS[phase];
  if (!sequence) return [];

  const idx = sequence.indexOf(currentStep);

  // currentStep is null OR an off-sequence value (credit_denied, complete, etc.)
  if (idx === -1) {
    // For credit_denied specifically, mark everything through credit_received as past
    if (currentStep === 'credit_denied' && phase === 'leasing') {
      const branchIdx = sequence.indexOf('credit_received');
      return sequence.map((step, i) => ({
        key: step,
        label: STEP_LABELS[step] || step,
        status: i <= branchIdx ? 'past' : 'future',
      }));
    }
    // For 'complete' on an ops deal, mark all ops steps past
    if (currentStep === 'complete' && phase === 'ops') {
      return sequence.map((step) => ({
        key: step,
        label: STEP_LABELS[step] || step,
        status: 'past',
      }));
    }
    // Otherwise (null, unknown), show everything as future
    return sequence.map((step) => ({
      key: step,
      label: STEP_LABELS[step] || step,
      status: 'future',
    }));
  }

  // Normal case: currentStep is in the sequence
  return sequence.map((step, i) => ({
    key: step,
    label: STEP_LABELS[step] || step,
    status: i < idx ? 'past' : i === idx ? 'current' : 'future',
  }));
}

/** True when the given current_step represents a terminal denial/decline. */
export function isTerminalDenial(currentStep) {
  return currentStep === 'credit_denied';
}

/** True when the deal has rolled past the end of its phase (i.e. 'complete'). */
export function isPhaseComplete(phase, currentStep) {
  if (currentStep === 'complete') return true;
  const sequence = PHASE_STEPS[phase];
  if (!sequence || !currentStep) return false;
  // funded is the last leasing step but it triggers a phase move; treating it
  // as "complete" for the leasing stepper makes the UI feel right ("they're
  // done with financing").
  if (phase === 'leasing' && currentStep === 'funded') return true;
  if (phase === 'ops'     && currentStep === 'installation') return false; // last step but not "done" until ops complete
  return false;
}
