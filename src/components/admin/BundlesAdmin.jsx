import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import EquipmentPicker from '../EquipmentPicker.jsx';

const PRICING_OPTIONS = [
  { value: 'both',           label: 'Both (lease and purchase)' },
  { value: 'purchase_only',  label: 'Purchase only' },
  { value: 'lease_only',     label: 'Lease only' },
];

export default function BundlesAdmin({ onBack, userId }) {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

  async function reload() {
    setLoading(true);
    const { data, error } = await supabase
      .from('bundles')
      .select('*')
      .order('featured', { ascending: false })
      .order('sort_order')
      .order('name');
    if (error) setError(error.message);
    else setBundles(data || []);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6">
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <button onClick={onBack}
                className="text-sm text-navy-700 hover:text-navy-900 font-medium flex items-center gap-1">
          ← Admin
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 md:mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">Admin</p>
          <h1 className="text-2xl md:text-3xl font-light text-slate-900">
            Bundles
            <span className="ml-2 md:ml-3 text-sm md:text-base text-slate-500 font-normal">{bundles.length}</span>
          </h1>
        </div>
        <button onClick={() => setEditing({ _new: true })}
                className="px-4 py-2 bg-navy-900 text-chalk-50 text-sm font-medium rounded
                           hover:bg-navy-800 transition-colors">
          + New bundle
        </button>
      </div>

      {loading && <div className="py-20 text-center text-slate-500">Loading…</div>}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && bundles.length === 0 && (
        <div className="bg-white border border-page-200 rounded-lg py-16 text-center">
          <p className="text-slate-500 text-sm mb-3">No bundles yet.</p>
          <button onClick={() => setEditing({ _new: true })}
                  className="text-sm text-navy-700 hover:text-navy-900 font-medium">
            Create your first one →
          </button>
        </div>
      )}

      {!loading && !error && bundles.length > 0 && (
        <div className="space-y-2">
          {bundles.map((b) => (
            <article key={b.id} onClick={() => setEditing(b)}
                     className="bg-white border border-page-200 rounded-lg p-3 md:p-4 cursor-pointer
                                hover:border-navy-300 hover:shadow-card transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm md:text-base font-medium text-slate-900">{b.name}</h3>
                    {b.featured && (
                      <span className="text-[10px] uppercase tracking-wider font-bold
                                       text-accent-700 bg-accent-500/10 px-1.5 py-0.5 rounded">
                        Featured
                      </span>
                    )}
                  </div>
                  {b.description && (
                    <p className="text-xs md:text-sm text-slate-600 line-clamp-1">{b.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 uppercase tracking-wider">
                    <span className={b.active ? 'text-ok' : 'text-slate-400'}>
                      {b.active ? '● Active' : '○ Inactive'}
                    </span>
                    {b.category && <span>{b.category}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {b.monthly_lease_price && (
                    <div className="font-mono tabular-nums text-sm text-slate-900">
                      ${b.monthly_lease_price.toLocaleString(undefined, { minimumFractionDigits: 0 })}/mo
                    </div>
                  )}
                  {b.list_price && (
                    <div className="font-mono tabular-nums text-xs text-slate-500">
                      ${b.list_price.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <BundleEditor
          bundle={editing}
          userId={userId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
          onDeleted={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function BundleEditor({ bundle, userId, onClose, onSaved, onDeleted }) {
  const isNew = bundle._new;
  const [draft, setDraft] = useState(
    isNew
      ? {
          name: '', description: '', long_description: '', image_url: '',
          pricing_type: 'both',
          list_price: '', monthly_lease_price: '', lease_term_months: 60,
          category: '', sort_order: 10, active: true, featured: false,
        }
      : { ...bundle, list_price: bundle.list_price ?? '', monthly_lease_price: bundle.monthly_lease_price ?? '' }
  );
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Image upload state
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const update = (k, v) => setDraft((p) => ({ ...p, [k]: v }));

  // Upload a new bundle image to the bundle-images bucket and set image_url in the draft.
  // Filename is timestamped so a re-upload never collides; old images stay in the
  // bucket as orphans (intentional — admins may want to roll back).
  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `bundle-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('bundle-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (upErr) {
      setUploading(false);
      setError(`Upload failed: ${upErr.message}`);
      return;
    }

    const { data } = supabase.storage.from('bundle-images').getPublicUrl(path);
    update('image_url', data.publicUrl);
    setUploading(false);
  }

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    supabase
      .from('bundle_items')
      .select(`id, equipment_id, quantity, item_type, override_price, sort_order, notes,
               equipment:equipment_id ( id, sku, description, model, list_price )`)
      .eq('bundle_id', bundle.id)
      .order('item_type')
      .order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setItems(data || []);
        setLoadingItems(false);
      });
    return () => { cancelled = true; };
  }, [bundle.id, isNew]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !pickerOpen) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pickerOpen]);

  async function save() {
    setSaving(true); setError(null);

    // Coerce numeric/empty fields
    const payload = { ...draft };
    ['list_price', 'monthly_lease_price'].forEach((k) => {
      payload[k] = payload[k] === '' || payload[k] == null ? null : parseFloat(payload[k]);
    });
    payload.lease_term_months = payload.lease_term_months ? parseInt(payload.lease_term_months, 10) : null;
    delete payload._new;
    ['created_at', 'updated_at', 'created_by'].forEach((k) => delete payload[k]);

    let bundleId = bundle.id;
    if (isNew) {
      payload.created_by = userId;
      const { data, error } = await supabase.from('bundles').insert(payload).select().single();
      if (error) { setSaving(false); setError(error.message); return; }
      bundleId = data.id;
    } else {
      delete payload.id;
      const { error } = await supabase.from('bundles').update(payload).eq('id', bundle.id);
      if (error) { setSaving(false); setError(error.message); return; }
    }

    // Sync bundle_items.
    // Strategy: delete all then re-insert. Small N, simpler than diff-based updates.
    if (!isNew) {
      const { error: delError } = await supabase.from('bundle_items').delete().eq('bundle_id', bundleId);
      if (delError) { setSaving(false); setError(delError.message); return; }
    }
    if (items.length > 0) {
      const itemPayload = items.map((it, idx) => ({
        bundle_id: bundleId,
        equipment_id: it.equipment_id,
        quantity: it.quantity || 1,
        item_type: it.item_type || 'included',
        override_price: it.override_price === '' || it.override_price == null
          ? null
          : parseFloat(it.override_price),
        sort_order: it.sort_order ?? idx * 10,
        notes: it.notes || null,
      }));
      const { error: insError } = await supabase.from('bundle_items').insert(itemPayload);
      if (insError) { setSaving(false); setError(insError.message); return; }
    }

    setSaving(false);
    onSaved();
  }

  async function remove() {
    if (!confirm(`Delete bundle "${bundle.name}"? This cannot be undone.`)) return;
    setSaving(true);
    const { error } = await supabase.from('bundles').delete().eq('id', bundle.id);
    setSaving(false);
    if (error) setError(error.message);
    else onDeleted();
  }

  function addItem(equipment) {
    setItems((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}-${Math.random()}`,
        equipment_id: equipment.id,
        equipment,
        quantity: 1,
        item_type: 'included',
        override_price: null,
        sort_order: prev.length * 10,
        notes: '',
      },
    ]);
    setPickerOpen(false);
  }

  function updateItem(idx, key, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-navy-950/50 backdrop-blur-[2px] z-40" />
      <aside className="fixed bg-white shadow-elevated z-50 overflow-y-auto border-page-200
                        inset-x-0 bottom-0 top-8 rounded-t-2xl border-t
                        md:inset-y-0 md:right-0 md:left-auto md:top-0 md:max-w-3xl md:w-full
                        md:rounded-t-none md:border-l md:border-t-0">

        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-page-300" />
        </div>

        <div className="sticky top-0 bg-navy-900 text-chalk-50 px-4 md:px-6 py-3 md:py-4 z-10
                        flex items-center justify-between border-b border-navy-800">
          <h2 className="text-base md:text-lg font-medium text-chalk-50 truncate">
            {isNew ? 'New bundle' : `Edit: ${bundle.name}`}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded transition-colors ml-2" aria-label="Close">
            <svg className="w-5 h-5 text-chalk-100" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-5 pb-32">
          {/* Basics */}
          <section className="space-y-3">
            <Input label="Name" value={draft.name} onChange={(v) => update('name', v)} required />
            <Input label="Category" hint="e.g. Coffee Program, Cold Beverage"
                   value={draft.category || ''} onChange={(v) => update('category', v)} />
            <Textarea label="Short description" hint="Shown on bundle cards." rows={2}
                      value={draft.description || ''} onChange={(v) => update('description', v)} />
            <Textarea label="Long description" rows={4}
                      value={draft.long_description || ''} onChange={(v) => update('long_description', v)} />

            {/* Bundle image — uploader with thumbnail preview, Replace + Remove actions */}
            <div>
              <span className="block text-xs uppercase tracking-wider text-slate-600 mb-1.5 font-medium">
                Bundle image
              </span>
              <div className="flex items-start gap-4">
                <div className="w-32 h-24 flex-shrink-0 flex items-center justify-center
                                bg-page-50 border border-page-200 rounded overflow-hidden">
                  {draft.image_url ? (
                    <img src={draft.image_url} alt="Bundle preview" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">No image</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-2 text-sm border border-page-200 bg-white rounded
                               hover:bg-page-50 disabled:opacity-40 transition-colors">
                    {uploading ? 'Uploading…' : draft.image_url ? 'Replace image' : 'Upload image'}
                  </button>
                  {draft.image_url && (
                    <button
                      type="button"
                      onClick={() => update('image_url', '')}
                      className="text-xs text-bad hover:underline self-start">
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                PNG, JPG, or WebP. Max 10 MB. Landscape orientation works best (shown as a banner on the bundle detail page).
              </p>
            </div>
          </section>

          {/* Pricing */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium">Pricing</h3>
            <Select label="Pricing type" value={draft.pricing_type}
                    onChange={(v) => update('pricing_type', v)} options={PRICING_OPTIONS} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="List price ($)" type="number"
                     value={draft.list_price ?? ''} onChange={(v) => update('list_price', v)} />
              <Input label="Monthly lease ($)" type="number"
                     value={draft.monthly_lease_price ?? ''} onChange={(v) => update('monthly_lease_price', v)} />
            </div>
            <Input label="Lease term (months)" type="number"
                   value={draft.lease_term_months ?? ''} onChange={(v) => update('lease_term_months', v)} />
          </section>

          {/* Display */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium">Display</h3>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Sort order" type="number"
                     value={draft.sort_order} onChange={(v) => update('sort_order', parseInt(v, 10) || 0)} />
              <Checkbox label="Active" checked={!!draft.active} onChange={(v) => update('active', v)} />
              <Checkbox label="Featured" checked={!!draft.featured} onChange={(v) => update('featured', v)} />
            </div>
          </section>

          {/* Items */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium">
                Items ({items.length})
              </h3>
              <button onClick={() => setPickerOpen(true)}
                      className="text-sm text-navy-700 hover:text-navy-900 font-medium">
                + Add item
              </button>
            </div>

            {loadingItems && <p className="text-sm text-slate-500">Loading items…</p>}

            {!loadingItems && items.length === 0 && (
              <p className="text-sm text-slate-500 italic">
                No items yet. Click "Add item" to pick equipment.
              </p>
            )}

            <div className="space-y-2">
              {items.map((it, idx) => (
                <BundleItemEditor
                  key={it.id}
                  item={it}
                  onChange={(key, val) => updateItem(idx, key, val)}
                  onRemove={() => removeItem(idx)}
                />
              ))}
            </div>
          </section>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-page-200 px-4 md:px-6 py-3 md:py-4
                        flex items-center justify-between">
          {!isNew ? (
            <button onClick={remove} disabled={saving}
                    className="px-3 md:px-4 py-2 text-sm text-bad hover:bg-red-50 rounded
                               disabled:opacity-40 transition-colors">
              Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose}
                    className="px-3 md:px-4 py-2 text-sm border border-page-200 bg-white rounded
                               hover:bg-page-50 transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={saving || !draft.name?.trim()}
                    className="px-3 md:px-4 py-2 text-sm bg-navy-900 text-chalk-50 rounded
                               hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed
                               transition-colors font-medium">
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </aside>

      {pickerOpen && (
        <EquipmentPicker
          onPick={addItem}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

function BundleItemEditor({ item, onChange, onRemove }) {
  const eq = item.equipment || {};
  return (
    <div className="bg-page-50 border border-page-200 rounded p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] text-slate-500">{eq.sku}</div>
          <div className="text-sm font-medium text-slate-900">{eq.description}</div>
        </div>
        <button onClick={onRemove} className="text-slate-400 hover:text-bad p-1" aria-label="Remove">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-medium">Qty</span>
          <input type="number" min="1" value={item.quantity}
                 onChange={(e) => onChange('quantity', parseInt(e.target.value, 10) || 1)}
                 className="w-full px-2 py-1.5 bg-white border border-page-200 rounded text-sm" />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-medium">Type</span>
          <select value={item.item_type}
                  onChange={(e) => onChange('item_type', e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-page-200 rounded text-sm">
            <option value="included">Included</option>
            <option value="optional">Optional</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-medium">
            Override $
          </span>
          <input type="number" step="0.01" placeholder={eq.list_price ?? '—'}
                 value={item.override_price ?? ''}
                 onChange={(e) => onChange('override_price', e.target.value)}
                 className="w-full px-2 py-1.5 bg-white border border-page-200 rounded text-sm font-mono" />
        </label>
      </div>
    </div>
  );
}


// Small form primitives — duplicated from AnnouncementsAdmin for self-containment
function Input({ label, hint, type = 'text', value, onChange, required }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-slate-600 mb-1.5 font-medium">
        {label}{required && <span className="text-bad ml-0.5">*</span>}
      </span>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required}
             className="w-full px-3 py-2.5 md:py-2 bg-white border border-page-200 rounded text-sm
                        focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:outline-none transition-colors" />
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}
function Textarea({ label, hint, value, onChange, rows = 3 }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-slate-600 mb-1.5 font-medium">{label}</span>
      <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={rows}
                className="w-full px-3 py-2.5 md:py-2 bg-white border border-page-200 rounded text-sm
                           focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:outline-none transition-colors resize-y" />
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-slate-600 mb-1.5 font-medium">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
              className="w-full px-3 py-2.5 md:py-2 bg-white border border-page-200 rounded text-sm
                         focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:outline-none transition-colors">
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  );
}
function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none pt-6">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
             className="accent-navy-600 w-4 h-4" />
      <span className="text-sm text-slate-800">{label}</span>
    </label>
  );
}
