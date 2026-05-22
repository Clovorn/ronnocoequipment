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
  { key: 'manufacturer_url', label: 'Manufacturer URL (override)', type: 'url' },
  { key: 'spec_sheet_url', label: 'Spec sheet URL (override)', type: 'url' },
  { key: 'primary_image_url', label: 'Primary image URL (override)', type: 'url' },
  { key: 'drawing_url', label: 'Drawing URL (override)', type: 'url' },
  { key: 'cad_url', label: 'CAD URL (override)', type: 'url' },
  { key: 'notes', label: 'Internal notes', type: 'textarea' },
];

export default function ItemDetailDrawer({ item, canEdit, isFavorited, onToggleFavorite, onClose, onUpdated }) {
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
        if (error) setError(error.message);
        else { setFullRow(data); setDraft({}); }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [item.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const value = (key) => (key in draft ? draft[key] : fullRow?.[key]);
  const isDirty = Object.keys(draft).length > 0;
  const update = (key, val) => setDraft((prev) => ({ ...prev, [key]: val }));

  async function save() {
    setSaving(true); setError(null);
    const { data, error } = await supabase.from('equipment').update(draft).eq('id', item.id).select().single();
    setSaving(false);
    if (error) { setError(error.message); return; }
    setFullRow(data); setDraft({});
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    onUpdated?.(data);
  }

  function discard() { setDraft({}); setError(null); }

  return (
    <>
      <div onClick={onClose}
           className="fixed inset-0 bg-navy-950/50 backdrop-blur-[2px] z-40" />

      {/* Drawer: right-rail on desktop, bottom-sheet on mobile */}
      <aside className="fixed bg-white shadow-elevated z-50 overflow-y-auto border-page-200
                        inset-x-0 bottom-0 top-12 rounded-t-2xl border-t
                        md:inset-y-0 md:right-0 md:left-auto md:top-0 md:max-w-2xl md:w-full
                        md:rounded-t-none md:border-l md:border-t-0">

        {/* Mobile grabber */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-page-300" />
        </div>

        <div className="sticky top-0 bg-navy-900 text-chalk-50 px-4 md:px-6 py-3 md:py-4 z-10
                        flex items-center justify-between border-b border-navy-800">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-chalk-300 mb-0.5 font-medium">
              {item.vendor || 'Item'}
            </p>
            <h2 className="text-base md:text-lg font-medium text-chalk-50 truncate">
              {item.description}
            </h2>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {onToggleFavorite && (
              <button
                onClick={onToggleFavorite}
                className="p-2 hover:bg-white/10 rounded transition-colors"
                aria-label={isFavorited ? 'Unfavorite' : 'Favorite'}
              >
                <svg className={`w-5 h-5 ${isFavorited ? 'text-accent-500' : 'text-chalk-100'}`}
                     fill={isFavorited ? 'currentColor' : 'none'}
                     stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            )}
            <button onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded transition-colors"
                    aria-label="Close">
              <svg className="w-5 h-5 text-chalk-100" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading && <div className="p-8 text-center text-slate-500">Loading…</div>}

        {!loading && fullRow && (
          <div className="p-4 md:p-6 space-y-6 md:space-y-8 pb-32 md:pb-6">
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

            {(item.manufacturer_url || item.spec_sheet_url || item.primary_image_url || item.drawing_url || item.cad_url) && (
              <section>
                <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3 font-medium">Vendor links</h3>
                <div className="flex flex-wrap gap-2">
                  {item.manufacturer_url && <LinkPill href={item.manufacturer_url}>Product page ↗</LinkPill>}
                  {item.spec_sheet_url && <LinkPill href={item.spec_sheet_url}>Spec sheet ↗</LinkPill>}
                  {item.primary_image_url && <LinkPill href={item.primary_image_url}>Image ↗</LinkPill>}
                  {item.drawing_url && <LinkPill href={item.drawing_url}>Drawing ↗</LinkPill>}
                  {item.cad_url && <LinkPill href={item.cad_url}>CAD ↗</LinkPill>}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium">
                  {canEdit ? 'Edit fields' : 'Details (read-only)'}
                </h3>
              </div>
              <div className="space-y-4">
                {EDITABLE_FIELDS.map((field) => (
                  <EditableField key={field.key} field={field} value={value(field.key)}
                                 onChange={(v) => update(field.key, v)} disabled={!canEdit} />
                ))}
              </div>
            </section>
          </div>
        )}

        {error && (
          <div className="sticky bottom-[68px] mx-4 md:mx-6 mb-2 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {canEdit && fullRow && (
          <div className={`sticky bottom-0 bg-white border-t border-page-200 px-4 md:px-6 py-3 md:py-4
                           flex items-center justify-between transition-all
                           ${isDirty ? 'shadow-[0_-8px_16px_-8px_rgba(10,31,61,0.12)]' : ''}`}>
            <div className="text-sm text-slate-600">
              {savedToast && <span className="text-ok font-medium">✓ Saved</span>}
              {!savedToast && isDirty && (
                <span className="text-xs md:text-sm">
                  {Object.keys(draft).length} unsaved change{Object.keys(draft).length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={discard} disabled={!isDirty || saving}
                      className="px-3 md:px-4 py-2 text-sm border border-page-200 bg-white rounded
                                 hover:bg-page-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Discard
              </button>
              <button onClick={save} disabled={!isDirty || saving}
                      className="px-3 md:px-4 py-2 text-sm bg-navy-900 text-chalk-50 rounded
                                 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium">
                {saving ? 'Saving…' : 'Save'}
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
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1 font-medium">{label}</div>
      <div className={mono ? 'font-mono text-slate-900' : 'text-slate-900'}>{children}</div>
    </div>
  );
}

function LinkPill({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener"
       className="inline-flex items-center px-3 py-2 md:py-1.5 text-xs font-medium
                  bg-navy-900 text-chalk-50 rounded hover:bg-navy-800 transition-colors">
      {children}
    </a>
  );
}

function EditableField({ field, value, onChange, disabled }) {
  const baseInputClass =
    'w-full px-3 py-2.5 md:py-2 bg-white border border-page-200 rounded text-sm ' +
    'focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:outline-none ' +
    'transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-page-50';

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)}
               disabled={disabled} className="accent-navy-600 w-4 h-4" />
        <span className="text-sm text-slate-800">{field.label}</span>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-slate-600 mb-1.5 font-medium">{field.label}</span>
        <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
                  disabled={disabled} rows={3} className={baseInputClass + ' resize-y'} />
      </label>
    );
  }

  if (field.type === 'currency') {
    return (
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-slate-600 mb-1.5 font-medium">{field.label}</span>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          <input type="number" step="0.01" value={value ?? ''}
                 onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                 disabled={disabled} className={baseInputClass + ' pl-7 font-mono tabular-nums'} />
        </div>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-slate-600 mb-1.5 font-medium">{field.label}</span>
      <input type={field.type} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
             disabled={disabled} className={baseInputClass} />
    </label>
  );
}
