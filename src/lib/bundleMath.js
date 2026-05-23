/**
 * bundleMath.js — single source of truth for distributor-bundle pricing math.
 *
 * Used (or will be used in Increment B) by:
 *   - BundlesAdmin live preview (this session)
 *   - DealBuilder rep-side live preview (next session)
 *   - Deal submit payload (next session)
 *   - QuoteView customer-facing rendering (next session)
 *
 * The math is:
 *   hardware    = sum(equipment.list_price × quantity)
 *   soft_cost   = hardware × bundle.soft_cost_pct
 *   reserve     = bundle.service_reserve
 *   leaseBasis  = hardware + soft_cost + reserve
 *   monthlyRaw  = leaseBasis × bundle.lease_rate
 *   monthlyCharged = roundHalfUp(monthlyRaw)   ← whole dollar; customer-visible
 *
 * Eligibility:
 *   eligible = leaseBasis >= LEASE_MIN_PRICE   (default $5,000)
 *
 * Output: a frozen object with all intermediate and final numbers, so callers
 * can render any level of detail (rep sees everything; customer sees only
 * monthlyCharged and the term).
 */

import { LEASE_MIN_PRICE } from './leasing.js';

/**
 * Round half-up to the nearest integer. Different from Math.round() in
 * JavaScript — Math.round(2.5) = 3 but Math.round(-2.5) = -2. For currency
 * we always want .5 to go up regardless of sign, but bundle monthlies are
 * always positive so Math.round() actually does the right thing here.
 * Kept as a named helper anyway to make the intent explicit and to give us
 * one place to swap rounding behavior if business rules change.
 */
function roundHalfUp(n) {
  return Math.round(n);
}

/**
 * Compute everything from a bundle config + list of equipment items.
 *
 * @param {Object} bundle - { soft_cost_pct, service_reserve, lease_rate, term_months }
 * @param {Array}  equipment - [{ list_price, quantity }, ...]
 * @returns {Object} frozen pricing breakdown
 *
 * Any missing/null bundle field falls back to a sensible default so this
 * function never throws on partial input. The returned `valid` field tells
 * callers whether the inputs were complete enough to trust the math.
 */
export function calculateBundlePricing({ bundle, equipment }) {
  const softCostPct    = numberOr(bundle?.soft_cost_pct,    0.25);
  const serviceReserve = numberOr(bundle?.service_reserve,  1080.00);
  const leaseRate      = numberOr(bundle?.lease_rate,       0.0395);
  const termMonths     = intOr   (bundle?.term_months,      36);

  const items = Array.isArray(equipment) ? equipment : [];

  // Hardware total: sum of (list_price × quantity) across all items.
  const hardware = items.reduce((sum, it) => {
    const price = numberOr(it?.list_price, 0);
    const qty   = intOr(it?.quantity, 1);
    return sum + price * qty;
  }, 0);

  const softCost    = hardware * softCostPct;
  const reserve     = serviceReserve;
  const leaseBasis  = hardware + softCost + reserve;
  const monthlyRaw  = leaseBasis * leaseRate;
  const monthlyCharged = roundHalfUp(monthlyRaw);

  const eligible = leaseBasis >= LEASE_MIN_PRICE;
  const eligibilityShortfall = eligible ? 0 : (LEASE_MIN_PRICE - leaseBasis);

  // Inputs are valid if bundle config is present. We don't require equipment
  // to be non-empty — an empty bundle is a valid (uneligible) starting state.
  const valid = bundle != null
    && Number.isFinite(softCostPct)
    && Number.isFinite(serviceReserve)
    && Number.isFinite(leaseRate)
    && termMonths > 0;

  return Object.freeze({
    valid,
    eligible,
    eligibilityShortfall,
    softCostPct,
    serviceReserve,
    leaseRate,
    termMonths,
    hardware,
    softCost,
    reserve,
    leaseBasis,
    monthlyRaw,
    monthlyCharged,
  });
}

/**
 * Convenience formatter for currency values consistent across the app.
 * Two-decimal USD. Used by admin preview and (later) the deal builder.
 */
export function formatCurrency(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Whole-dollar formatter for the customer-visible monthly fee.
 * No cents — matches the rounding rule above.
 */
export function formatMonthly(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * Format a soft-cost percentage as "25%" for display.
 */
export function formatSoftCost(pct) {
  if (pct == null || !Number.isFinite(pct)) return '—';
  return `${(pct * 100).toFixed(0)}%`;
}

// ───────────────────────────── internal helpers ───────────────────────────

function numberOr(v, fallback) {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function intOr(v, fallback) {
  if (v == null) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
