import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

/**
 * Cached fetch for the entire field_requirements table. The table is small
 * (one row per top-level deal form field, ~50 rows total) and rarely changes,
 * so a single in-memory promise covers every consumer in the page session.
 *
 * Cache is invalidated by the admin screen after a successful save so that a
 * rep who opens a new deal moments later sees the updated rules.
 */
let CACHE = null;       // Promise<rows> | null
let LAST_FETCH_AT = 0;  // ms epoch
const TTL_MS = 5 * 60 * 1000; // 5 minutes — soft staleness for safety

function fetchRequirements() {
  if (CACHE && Date.now() - LAST_FETCH_AT < TTL_MS) {
    return CACHE;
  }
  CACHE = supabase
    .from('field_requirements')
    .select('field_key, field_label, section, applies_to, conditional_on_field, conditional_on_value, system_required, display_order')
    .order('display_order')
    .then(({ data, error }) => {
      if (error) {
        // Bust the cache so a retry can succeed if it was transient
        CACHE = null;
        throw error;
      }
      LAST_FETCH_AT = Date.now();
      return data || [];
    });
  return CACHE;
}

/** Forget the cached version — call after an admin edit so reps see the change immediately. */
export function invalidateFieldRequirements() {
  CACHE = null;
  LAST_FETCH_AT = 0;
}

/**
 * useFieldRequirements — returns { rules, loading, error }.
 *
 * `rules` is a Map keyed by field_key, value = the row, so consumers can do
 * O(1) lookups in their validation loop without scanning the array.
 *
 * Empty Map on initial load — the validate() function in DealBuilder.jsx
 * skips field-config checks when the Map is empty, falling back to the
 * built-in business rules (equipment ≥ 1 item, ≥ $5K for lease/finance).
 * This means a rep can submit even if the DB is unreachable, which is the
 * right behavior — we don't want a flaky network call to block legitimate
 * deal submissions.
 */
export function useFieldRequirements() {
  const [state, setState] = useState({ rules: new Map(), loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchRequirements()
      .then((rows) => {
        if (cancelled) return;
        const rules = new Map();
        for (const row of rows) rules.set(row.field_key, row);
        setState({ rules, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ rules: new Map(), loading: false, error: err.message });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}

/**
 * Pure validation function — separate from the hook so it's testable and can
 * be reused outside React (e.g. in a future "Submit as Deal" flow that
 * converts a quote into a deal).
 *
 * @param {Object} params
 * @param {Map} params.rules        — field_key → requirement row, from useFieldRequirements
 * @param {Object} params.draft     — the form state from DealBuilder
 * @param {'quote' | 'deal'} params.mode — which submission flow we're validating for
 *
 * Returns { errors: string[] } — empty array means the form passes the
 * field-config layer. The caller still has to enforce business rules
 * (equipment count, $5K floor, etc.) on top.
 */
export function validateAgainstRequirements({ rules, draft, mode }) {
  const errors = [];
  if (!rules || rules.size === 0) return { errors };

  // Conditional visibility — fields the schema intentionally omits because
  // their requirement is "if their parent toggle is on, they're required;
  // otherwise they don't matter." Kept in code, not data, because the parent
  // relationship is tightly coupled to the JSX structure.
  //
  // Each entry: child field_key → predicate(draft) returning true when the
  // field is currently visible AND therefore should be enforced as required.
  const CONDITIONAL_VISIBILITY = {
    prior_account_num:         (d) => !!d.change_of_ownership,
    change_details:            (d) => !!d.change_of_ownership,
    delivery_method:           (d) => d.distribution_method === 'DSD',
    delivery_recurrence:       (d) => d.distribution_method === 'DSD',
    emergency_install_details: (d) => !!d.emergency_install,
    core_mark_div_num:         (d) => d.parent_distributor === 'Core-Mark',
  };

  for (const [fieldKey, rule] of rules) {
    // applies_to filter
    const appliesNow =
      rule.applies_to === 'both' ||
      (mode === 'quote' && rule.applies_to === 'quote') ||
      (mode === 'deal'  && rule.applies_to === 'deal');
    if (!appliesNow) continue;

    // Schema-driven conditional gate (currently unused — all rows have
    // conditional_on_field=null — but future-proof).
    if (rule.conditional_on_field) {
      const parentVal = draft[rule.conditional_on_field];
      const expected  = rule.conditional_on_value;
      if (expected != null && String(parentVal) !== String(expected)) continue;
      if (expected == null && !parentVal) continue;
    }

    // Code-driven conditional visibility — only enforce visible fields
    if (CONDITIONAL_VISIBILITY[fieldKey] && !CONDITIONAL_VISIBILITY[fieldKey](draft)) {
      continue;
    }

    // Empty check. Boolean fields (toggles) are never "empty" in the validation
    // sense — false IS a valid answer. The form's existing UI already nudges
    // reps to pick the right value via the toggle UI, so we only flag empty
    // strings / null / undefined.
    const value = draft[fieldKey];
    const isEmpty =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '');
    if (isEmpty && typeof value !== 'boolean') {
      errors.push(rule.field_label || fieldKey);
    }
  }

  return { errors };
}
