import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import RonnocoLogo from './RonnocoLogo.jsx';

const DEFAULT_TEMPLATE = {
  heroTitle: 'Build more beverage sales with a complete Ronnoco program',
  heroSubtitle:
    'This program combines equipment, service, and digital marketing into one monthly lease designed to support stronger coffee sales and a simpler customer experience.',
  monthlyCostNote:
    'Monthly payment is based on the selected program bundle and any approved equipment changes.',
  serviceMarketingTitle: 'What is included in the program',
  serviceMarketingBody:
    'Customers in compliance with the Supply, Service & Marketing Agreement receive equipment service, Ronnoco digital media delivery, and program marketing support throughout the lease.',
  roiTitle: 'Why customers choose the program',
  roiBody:
    'Customers who stay in compliance and produce $500 or more in monthly coffee sales are positioned to get the most value from the full program.',
  roiBullets: [
    '$500+ per month in coffee sales creates stronger program value',
    'Service and marketing stay bundled into the monthly program structure',
    'Digital media can support product visibility on customer-installed screens',
  ],
  monthlyCostBody:
    'Monthly pricing is presented as one bundled lease payment, rather than separate equipment, service, and marketing bills.',
  footerNote:
    'Pricing, equipment, and program support are subject to final approval and may be updated as program details change.',
};

export default function BundleSellSheetPage({ bundleId, navigate, profile, session }) {
  const [bundle, setBundle] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [{ data: bundleRow, error: bundleError }, { data: itemRows, error: itemError }] = await Promise.all([
        supabase.from('bundles').select('*').eq('id', bundleId).single(),
        supabase
          .from('bundle_items')
          .select(`
            id, quantity, item_type, override_price, sort_order, notes,
            equipment:equipment_id (
              id, sku, description, model, list_price,
              vendors:vendor_id ( name )
            )
          `)
          .eq('bundle_id', bundleId)
          .order('item_type')
          .order('sort_order'),
      ]);

      if (cancelled) return;
      if (bundleError) {
        setError(bundleError.message);
        setLoading(false);
        return;
      }
      if (itemError) {
        setError(itemError.message);
        setLoading(false);
        return;
      }

      setBundle(bundleRow);
      setItems(itemRows || []);

      const merged = {
        ...DEFAULT_TEMPLATE,
        ...(bundleRow?.sell_sheet_template || {}),
      };
      if (!Array.isArray(merged.roiBullets)) merged.roiBullets = DEFAULT_TEMPLATE.roiBullets;
      setTemplate(merged);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [bundleId]);

  const includedItems = useMemo(
    () => items.filter((it) => it.item_type === 'included' && it.equipment),
    [items]
  );

  const repName = profile?.display_name || session?.user?.email || 'Your Ronnoco Representative';
  const repEmail = session?.user?.email || '';
  const repPhone = profile?.phone || profile?.mobile_phone || profile?.cell_phone || profile?.contact_phone || '';
  const monthly = bundle?.target_monthly_fee ?? bundle?.monthly_lease_price ?? null;
  const termMonths = bundle?.term_months ?? bundle?.lease_term_months ?? 36;

  async function saveTemplate() {
    if (!bundle) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('bundles')
      .update({ sell_sheet_template: template })
      .eq('id', bundle.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
  }

  function updateField(key, value) {
    setTemplate((prev) => ({ ...prev, [key]: value }));
  }

  function updateBullet(index, value) {
    setTemplate((prev) => ({
      ...prev,
      roiBullets: prev.roiBullets.map((item, i) => (i === index ? value : item)),
    }));
  }

  if (loading) {
    return <div className="px-4 md:px-6 lg:px-10 py-10 text-slate-500">Loading sell sheet…</div>;
  }

  if (error && !bundle) {
    return (
      <div className="px-4 md:px-6 lg:px-10 py-10">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Couldn't load sell sheet: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
            Distributor Program Bundles
          </p>
          <h1 className="text-2xl md:text-3xl font-light text-slate-900">Customer sell sheet</h1>
          <p className="text-sm text-slate-600 mt-2 max-w-3xl">
            This is the customer-facing page a rep can email or print. It stays tied to the live bundle data,
            and the text below is editable so the team can improve the message later.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate?.('bundles')}
            className="px-4 py-2 rounded border border-page-200 bg-white text-slate-700 text-sm font-medium hover:bg-page-50 transition-colors"
          >
            Back to Bundles
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded border border-page-200 bg-white text-slate-700 text-sm font-medium hover:bg-page-50 transition-colors"
          >
            Print / Save PDF
          </button>
          <button
            onClick={saveTemplate}
            disabled={saving}
            className="px-4 py-2 rounded bg-navy-900 text-chalk-50 text-sm font-medium hover:bg-navy-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save sell sheet text'}
          </button>
        </div>
      </div>

      {error && bundle && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6 print:block">
        <section className="bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm print:hidden">
          <h2 className="text-sm font-medium text-slate-900 mb-4">Editable sell sheet content</h2>
          <div className="space-y-4">
            <Field label="Hero title" value={template.heroTitle} onChange={(v) => updateField('heroTitle', v)} />
            <TextAreaField label="Hero subtitle" rows={3} value={template.heroSubtitle} onChange={(v) => updateField('heroSubtitle', v)} />
            <Field label="Included section title" value={template.serviceMarketingTitle} onChange={(v) => updateField('serviceMarketingTitle', v)} />
            <TextAreaField label="Included section body" rows={4} value={template.serviceMarketingBody} onChange={(v) => updateField('serviceMarketingBody', v)} />
            <Field label="Monthly cost note" value={template.monthlyCostNote} onChange={(v) => updateField('monthlyCostNote', v)} />
            <TextAreaField label="Monthly cost body" rows={3} value={template.monthlyCostBody} onChange={(v) => updateField('monthlyCostBody', v)} />
            <Field label="ROI title" value={template.roiTitle} onChange={(v) => updateField('roiTitle', v)} />
            <TextAreaField label="ROI body" rows={3} value={template.roiBody} onChange={(v) => updateField('roiBody', v)} />
            <div>
              <span className="block text-xs uppercase tracking-wider text-slate-500 mb-2 font-medium">ROI bullets</span>
              <div className="space-y-2">
                {template.roiBullets.map((bullet, index) => (
                  <input
                    key={index}
                    type="text"
                    value={bullet}
                    onChange={(e) => updateBullet(index, e.target.value)}
                    className="w-full px-3 py-2 bg-page-50 border border-page-200 rounded text-sm focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:outline-none"
                  />
                ))}
              </div>
            </div>
            <TextAreaField label="Footer note" rows={3} value={template.footerNote} onChange={(v) => updateField('footerNote', v)} />
            <p className="text-xs text-slate-500 leading-relaxed">
              Equipment, bundle image, and monthly price stay live from the bundle record. Text here is what your team can keep refining.
            </p>
          </div>
        </section>

        <section className="bg-white border border-page-200 rounded-[2rem] overflow-hidden shadow-card print:shadow-none print:border-none">
          <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-accent-700 text-chalk-50 p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-chalk-300 mb-2 font-medium">Ronnoco Program Overview</p>
                <h2 className="text-3xl md:text-4xl font-light leading-tight mb-3">{template.heroTitle}</h2>
                <p className="text-sm md:text-base text-chalk-100/90 leading-relaxed max-w-3xl">{template.heroSubtitle}</p>
              </div>
              <div className="hidden md:block flex-shrink-0">
                <RonnocoLogo variant="on-dark" />
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_320px] gap-6 items-start">
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">Program bundle</p>
                  <h3 className="text-2xl font-light text-slate-900">{bundle?.name}</h3>
                  {bundle?.description && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{bundle.description}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoCard label="Monthly lease" value={monthly != null ? `$${Number(monthly).toLocaleString()}/mo` : 'Call for pricing'} subtext={`${termMonths}-month term`} />
                  <InfoCard label="Program value" value="Service + marketing included" subtext="With customer compliance" />
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-800 mb-2 font-semibold">Monthly cost</p>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{template.monthlyCostNote}</p>
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">{template.monthlyCostBody}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-page-200 bg-page-50 p-4">
                {bundle?.image_url ? (
                  <img src={bundle.image_url} alt={bundle?.name} className="w-full aspect-[4/3] object-contain rounded-2xl bg-white border border-page-200" />
                ) : (
                  <div className="w-full aspect-[4/3] rounded-2xl bg-white border border-page-200 flex items-center justify-center text-slate-400 text-sm">
                    Bundle image
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-page-200 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">Included equipment</p>
                <div className="space-y-3">
                  {includedItems.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No equipment listed yet.</p>
                  ) : (
                    includedItems.map((item) => (
                      <div key={item.id} className="flex gap-3 items-start rounded-2xl bg-page-50 border border-page-100 px-3 py-3">
                        <div className="w-8 h-8 rounded-xl bg-white border border-page-200 flex items-center justify-center text-xs font-semibold text-navy-700 flex-shrink-0">
                          {item.quantity || 1}x
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 leading-snug">{item.equipment.description}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {[item.equipment.vendors?.name, item.equipment.model, item.equipment.sku].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-page-200 p-5 bg-accent-500/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">{template.serviceMarketingTitle}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{template.serviceMarketingBody}</p>
                </div>

                <div className="rounded-3xl border border-page-200 p-5 bg-amber-50/80">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">{template.roiTitle}</p>
                  <p className="text-sm text-slate-700 leading-relaxed mb-3">{template.roiBody}</p>
                  <ul className="space-y-2">
                    {template.roiBullets.map((bullet) => (
                      <li key={bullet} className="text-sm text-slate-700 flex gap-2 leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-page-200 p-5 bg-navy-50/70">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">Your Ronnoco representative</p>
                  <div className="text-lg font-medium text-slate-900">{repName}</div>
                  {repEmail && (
                    <a href={`mailto:${repEmail}`} className="block text-sm text-navy-700 hover:text-navy-900 underline decoration-navy-300 mt-1">
                      {repEmail}
                    </a>
                  )}
                  {repPhone && <div className="text-sm text-slate-700 mt-1">{repPhone}</div>}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">Program reminder</p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Service and media are included when the customer is in compliance with the service agreement.
                    For media outside Distributor Programs, monthly media delivery costs typically range from $30 to $70 per player
                    and must be passed through to the customer.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 leading-relaxed border-t border-page-100 pt-5">
              {template.footerNote}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-medium">{label}</span>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-page-50 border border-page-200 rounded text-sm focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:outline-none"
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows = 4 }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 font-medium">{label}</span>
      <textarea
        rows={rows}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-page-50 border border-page-200 rounded text-sm focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:outline-none resize-y"
      />
    </label>
  );
}

function InfoCard({ label, value, subtext }) {
  return (
    <div className="rounded-2xl border border-page-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">{label}</p>
      <div className="text-xl font-medium text-slate-900">{value}</div>
      {subtext && <div className="text-sm text-slate-500 mt-1">{subtext}</div>}
    </div>
  );
}
