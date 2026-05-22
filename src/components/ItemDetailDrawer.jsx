import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const EDITABLE_FIELDS = [
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'long_description', label: 'Long Description', type: 'textarea' },
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'subcategory', label: 'Subcategory', type: 'text' },
  { key: 'list_price', label: 'List Price', type: 'currency' },
  { key: 'cost', label: 'Cost', type: 'currency' },
  { key: 'price_10_49', label: 'Price 10–49 units', type: 'currency' },
  { key: 'price_50_plus', label: 'Price 50+ units', type: 'currency' },
  { key: 'lease_monthly_price', label: 'Lease Monthly', type: 'currency' },
  { key: 'finance_eligible', label: 'Finance eligible', type: 'boolean' },
  { key: 'lease_eligible', label: 'Lease eligible', type: 'boolean' },
  { key: 'loan_eligible', label: 'Loan eligible', type: 'boolean' },
  { key: 'active', label: 'Active', type: 'boolean' },
  { key: 'manufacturer_url', label: 'Manufacturer URL (manual override)', type: 'url' },
  { key: 'spec_sheet_url', label: 'Spec sheet URL (manual override)', type: 'url' },
  { key: 'primary_image_url', label: 'Primary image URL (manual override)', type: 'url' },
  { key: 'drawing_url', label: 'Drawing URL (manual override)', type: 'url' },
  { key: 'cad_url', label: 'CAD URL (manual override)', type: 'url' },
  { key: 'notes', label: 'Internal notes', type: 'textarea' },
];

export default function ItemDetailDrawer({ item, canEdit, onClose, onUpdated }) {
  // Load the full equipment row (the view doesn't expose every editable field)
  const [fullRow, setFullRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('equipment')
      .select('*')
      .eq('id', item.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          setFullRow(data);
          setDraft({});
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const value = (key) => (key in draft ? draft[key] : fullRow?.[key]);
  const isDirty = Object.keys(draft).length > 0;

  function update(key, val) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from('equipment')
      .update(draft)
      .eq('id', item.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setFullRow(data);
    setDraft({});
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    // Tell the parent so the table row reflects the change
    onUpdated?.(data);
  }

  function discard() {
    setDraft({});
    setError(null);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40
                   animate-in fade-in duration-200"
      />

      {/* Drawer */}
      <aside
        className="fixed inset-y-0 right-0 w-full max-w-2xl bg-cream-50
                   shadow-elevated z-50 overflow-y-auto
                   border-l border-cream-300"
      >
        <div className="sticky top-0 bg-cream-50 border-b border-cream-200 px-6 py-4 z-10
                        flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500 mb-0.5">
              {item.vendor || 'Item'}
            </p>
            <h2 className="font-serif text-xl text-ink-900 truncate">
              {item.description}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-cream-100 rounded-sm transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-ink-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="p-8 text-center text-ink-500">Loading…</div>
        )}

        {!loading && fullRow && (
          <div className="p-6 space-y-8">
            {/* Read-only summary */}
            <section>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="SKU" mono>{fullRow.sku}</Field>
                <Field label="Item Type" mono>{fullRow.item_type}</Field>
                <Field label="Vendor Item #" mono>{fullRow.vendor_item_num || '—'}</Field>
                <Field label="Model" mono>{fullRow.model || '—'}</Field>
                <Field label="Category">{item.category || '—'}</Field>
                <Field label="Subcategory">{fullRow.subcategory || '—'}</Field>
              </div>
            </section>

            {/* Resolved vendor links — clickable */}
            {(item.manufacturer_url || item.spec_sheet_url || item.primary_image_url || item.drawing_url || item.cad_url) && (
              <section>
                <h3 className="text-xs uppercase tracking-[0.2em] text-ink-500 mb-3">
                  Vendor links
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.manufacturer_url && (
                    <LinkPill href={item.manufacturer_url}>Product page ↗</LinkPill>
                  )}
                  {item.spec_sheet_url && (
                    <LinkPill href={item.spec_sheet_url}>Spec sheet ↗</LinkPill>
                  )}
                  {item.primary_image_url && (
                    <LinkPill href={item.primary_image_url}>Image ↗</LinkPill>
                  )}
                  {item.drawing_url && (
                    <LinkPill href={item.drawing_url}>Drawing ↗</LinkPill>
                  )}
                  {item.cad_url && (
                    <LinkPill href={item.cad_url}>CAD ↗</LinkPill>
                  )}
                </div>
              </section>
            )}

            {/* Editable fields */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs uppercase tracking-[0.2em] text-ink-500">
                  {canEdit ? 'Edit fields' : 'Details (read-only)'}
                </h3>
              </div>

              <div className="space-y-4">
                {EDITABLE_FIELDS.map((field) => (
                  <EditableField
                    key={field.key}
                    field={field}
                    value={value(field.key)}
                    onChange={(v) => update(field.key, v)}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {error && (
          <div className="sticky bottom-[68px] mx-6 mb-2 p-3 bg-copper-500/10 border border-copper-500/30 rounded-sm">
            <p className="text-sm text-copper-700">{error}</p>
          </div>
        )}

        {/* Save bar */}
        {canEdit && fullRow && (
          <div className={`sticky bottom-0 bg-cream-50 border-t border-cream-200 px-6 py-4
                           flex items-center justify-between transition-all
                           ${isDirty ? 'shadow-[0_-8px_16px_-8px_rgba(31,22,14,0.1)]' : ''}`}>
            <div className="text-sm text-ink-600">
              {savedToast && (
                <span className="text-copper-700 font-medium">✓ Saved</span>
              )}
              {!savedToast && isDirty && (
                <span>{Object.keys(draft).length} unsaved change{Object.keys(draft).length === 1 ? '' : 's'}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={discard}
                disabled={!isDirty || saving}
                className="px-4 py-2 text-sm border border-cream-300 rounded-sm
                           hover:bg-cream-100 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors"
              >
                Discard
              </button>
              <button
                onClick={save}
                disabled={!isDirty || saving}
                className="px-4 py-2 text-sm bg-ink-900 text-cream-50 rounded-sm
                           hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function Field({ label, children, mono = false }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-500 mb-1">{label}</div>
      <div className={mono ? 'font-mono text-ink-900' : 'text-ink-900'}>{children}</div>
    </div>
  );
}

function LinkPill({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center px-3 py-1.5 text-xs font-medium
                 bg-ink-900 text-cream-50 rounded-sm
                 hover:bg-ink-800 transition-colors"
    >
      {children}
    </a>
  );
}

function EditableField({ field, value, onChange, disabled }) {
  const baseInputClass =
    'w-full px-3 py-2 bg-cream-50 border border-cream-300 rounded-sm text-sm ' +
    'focus:bg-white focus:border-ink-600 focus:outline-none transition-colors ' +
    'disabled:opacity-60 disabled:cursor-not-allowed';

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="accent-copper-600 w-4 h-4"
        />
        <span className="text-sm text-ink-800">{field.label}</span>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-ink-600 mb-1.5">
          {field.label}
        </span>
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          rows={3}
          className={baseInputClass + ' font-sans resize-y'}
        />
      </label>
    );
  }

  if (field.type === 'currency') {
    return (
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-ink-600 mb-1.5">
          {field.label}
        </span>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm">$</span>
          <input
            type="number"
            step="0.01"
            value={value ?? ''}
            onChange={(e) =>
              onChange(e.target.value === '' ? null : parseFloat(e.target.value))
            }
            disabled={disabled}
            className={baseInputClass + ' pl-7 font-mono tabular-nums'}
          />
        </div>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-ink-600 mb-1.5">
        {field.label}
      </span>
      <input
        type={field.type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className={baseInputClass}
      />
    </label>
  );
}
