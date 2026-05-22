import { useMemo, useState } from 'react';
import { submitDealToPipeline, logDealActivity, isDealPipelineConfigured } from '../lib/dealPipeline.js';
import { LEASE_MIN_PRICE, LEASE_RATE } from '../lib/leasing.js';
import EquipmentPicker from './EquipmentPicker.jsx';

const ROM_OPTIONS = ['Central', 'Northeast', 'Southeast', 'Midwest', 'Southwest', 'West', 'Northwest'];
const COFFEE_PROGRAM_OPTIONS = ['Full Coffee', 'Bean to Cup', 'Pour Over', 'Espresso', 'Cold Brew', 'Other'];
const DEAL_TYPE_OPTIONS = ['Equipment Lease', 'Finance Equipment', 'Purchase From Ronnoco', 'Loan Equipment'];
const GRAPHICS_OPTIONS = ['Standard Wrap', 'Custom Graphics', 'No Graphics', 'TBD'];

const formatUSD = (n) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Compose the equipment_selection text for the deal pipeline (legacy text field)
 * and compute the total cost from the structured items.
 */
function summarizeEquipment(items) {
  if (!items.length) return { text: '', total: 0 };
  const lines = items.map((it) => {
    const price = it.list_price ?? 0;
    const modelStr = it.model ? ` (${it.model})` : '';
    return `${it.quantity}× ${it.description}${modelStr} — ${formatUSD(price)} ea`;
  });
  const total = items.reduce((sum, it) => sum + (it.list_price ?? 0) * it.quantity, 0);
  return { text: lines.join('\n'), total };
}

export default function DealBuilder({ profile, session, navigate }) {
  const [draft, setDraft] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    is_new_customer: false,
    store_name: '', legal_business_name: '', address: '',
    store_phone: '', customer_account: '', chain_store: 'No',
    sales_rep: profile?.display_name || '',
    sales_rep_email: session.user.email || '',
    rom: '',
    coffee_program: '',
    deal_type: '',
    target_install_date: '',
    emergency_install: 'No',
    parent_distributor: '',
    sub_group: '',
    distributor_rep_email: '',
    graphics_package: '',
    notes: '',
  });
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  const update = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const eqSummary = useMemo(() => summarizeEquipment(equipmentItems), [equipmentItems]);
  const dealTotal = eqSummary.total;
  const qualifiesForFinance = dealTotal >= LEASE_MIN_PRICE;
  const monthlyEstimate = qualifiesForFinance ? dealTotal * LEASE_RATE : null;

  function validate() {
    const required = [
      ['first_name', 'First name'],
      ['last_name', 'Last name'],
      ['email', 'Email'],
      ['store_name', 'Store name'],
      ['address', 'Store address'],
      ['sales_rep', 'Sales rep name'],
      ['sales_rep_email', 'Sales rep email'],
      ['rom', 'ROM / Region'],
      ['deal_type', 'Deal type'],
      ['target_install_date', 'Target install date'],
      ['parent_distributor', 'Parent distributor'],
      ['distributor_rep_email', 'Distributor rep email'],
    ];
    for (const [key, label] of required) {
      if (!String(draft[key] || '').trim()) {
        return `Missing required field: ${label}`;
      }
    }
    if (equipmentItems.length === 0) {
      return 'Please select at least one piece of equipment.';
    }
    // Block lease/finance deal types when total is below the minimum
    if (!qualifiesForFinance && (draft.deal_type === 'Equipment Lease' || draft.deal_type === 'Finance Equipment')) {
      return `Deals under ${formatUSD(LEASE_MIN_PRICE)} cannot be leased or financed. Choose "Purchase From Ronnoco" instead, or add more equipment to bring the total above ${formatUSD(LEASE_MIN_PRICE)}.`;
    }
    return null;
  }

  async function submitDeal() {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isDealPipelineConfigured) {
      setError('Deal pipeline is not configured. An admin needs to set VITE_DEAL_PIPELINE_URL and VITE_DEAL_PIPELINE_ANON_KEY in Netlify env vars.');
      return;
    }

    setSubmitting(true);

    // Build the deal-pipeline payload — matches the existing `deals` table
    // schema in the deal-pipeline project (compatible with Jotform-imported rows).
    const pipelinePayload = {
      first_name:            draft.first_name.trim(),
      last_name:             draft.last_name.trim(),
      email:                 draft.email.trim(),
      phone:                 draft.phone.trim(),
      is_new_customer:       !!draft.is_new_customer,
      store_name:            draft.store_name.trim(),
      legal_business_name:   draft.legal_business_name.trim(),
      address:               draft.address.trim(),
      store_phone:           draft.store_phone.trim(),
      customer_account:      draft.customer_account.trim(),
      chain_store:           draft.chain_store,
      sales_rep:             draft.sales_rep.trim(),
      sales_rep_email:       draft.sales_rep_email.trim(),
      rom:                   draft.rom,
      coffee_program:        draft.coffee_program,
      deal_type:             draft.deal_type,
      equipment_selection:   eqSummary.text,
      total_eq_cost:         formatUSD(dealTotal),
      target_install_date:   draft.target_install_date,
      emergency_install:     draft.emergency_install,
      parent_distributor:    draft.parent_distributor.trim(),
      sub_group:             draft.sub_group.trim(),
      distributor_rep_email: draft.distributor_rep_email.trim(),
      graphics_package:      draft.graphics_package,
      notes:                 draft.notes.trim(),
      current_step:          'submitted',
      phase:                 'leasing',
      deal_status:           'active',
      // Structured equipment data preserved for downstream tooling.
      // Stored alongside the legacy text fields so the deal-pipeline
      // dashboard's existing views keep working unchanged.
      raw_csv: {
        source: 'ronnoco-catalog-dashboard',
        equipment_items: equipmentItems,
        total_eq_cost_numeric: dealTotal,
        monthly_lease_estimate: monthlyEstimate,
        qualifies_for_finance: qualifiesForFinance,
      },
    };

    const { data: deal, error: pipelineError } = await submitDealToPipeline(pipelinePayload);

    if (pipelineError) {
      setError(`Submission failed: ${pipelineError.message}`);
      setSubmitting(false);
      return;
    }

    // Log the activity in the pipeline (best-effort — doesn't block on failure)
    await logDealActivity(
      deal.id,
      'Deal created',
      `Submitted via Ronnoco Catalog (${equipmentItems.length} item${equipmentItems.length === 1 ? '' : 's'}, ${formatUSD(dealTotal)})`,
      draft.sales_rep
    );

    setSuccessInfo({
      dealId: deal.id,
      customerName: `${draft.first_name} ${draft.last_name}`.trim(),
      storeName: draft.store_name,
    });
    setSubmitting(false);
  }

  function startNewDeal() {
    setDraft({
      first_name: '', last_name: '', email: '', phone: '',
      is_new_customer: false,
      store_name: '', legal_business_name: '', address: '',
      store_phone: '', customer_account: '', chain_store: 'No',
      sales_rep: profile?.display_name || '',
      sales_rep_email: session.user.email || '',
      rom: '', coffee_program: '', deal_type: '',
      target_install_date: '', emergency_install: 'No',
      parent_distributor: '', sub_group: '', distributor_rep_email: '',
      graphics_package: '', notes: '',
    });
    setEquipmentItems([]);
    setSuccessInfo(null);
    setError(null);
    window.scrollTo(0, 0);
  }

  // Success screen
  if (successInfo) {
    return (
      <div className="px-4 md:px-6 lg:px-10 py-10 max-w-3xl">
        <div className="bg-white border border-page-200 rounded-lg shadow-card p-8 md:p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-ok/10 text-ok flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-light text-slate-900 mb-2">Deal submitted</h1>
          <p className="text-slate-600 leading-relaxed mb-6 max-w-md mx-auto">
            <span className="font-medium text-slate-900">{successInfo.customerName}</span>'s deal for{' '}
            <span className="font-medium text-slate-900">{successInfo.storeName}</span>{' '}
            has been created in the pipeline. The leasing team can edit it from the Deal Pipeline dashboard.
          </p>
          <div className="text-xs font-mono text-slate-500 mb-8">Deal ID: {successInfo.dealId}</div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={startNewDeal}
                    className="px-5 py-2.5 bg-navy-900 text-chalk-50 rounded font-medium hover:bg-navy-800 transition-colors">
              Submit another deal
            </button>
            <button onClick={() => navigate('home')}
                    className="px-5 py-2.5 border border-page-200 bg-white rounded text-slate-700 hover:bg-page-50 transition-colors">
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-5 md:mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">New deal</p>
        <h1 className="text-2xl md:text-3xl font-light text-slate-900">Deal Sheet</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
          Complete the form and submit to create a new deal in the pipeline. After submission, the leasing team can edit the deal in the Deal Pipeline dashboard.
        </p>
      </div>

      {!isDealPipelineConfigured && (
        <div className="mb-4 p-4 bg-warn/5 border border-warn/30 rounded-lg">
          <p className="text-sm text-warn font-medium mb-1">Deal pipeline not configured</p>
          <p className="text-xs text-slate-600">
            Submission is disabled until an admin sets{' '}
            <code className="bg-page-100 px-1 py-0.5 rounded font-mono">VITE_DEAL_PIPELINE_URL</code> and{' '}
            <code className="bg-page-100 px-1 py-0.5 rounded font-mono">VITE_DEAL_PIPELINE_ANON_KEY</code>{' '}
            in Netlify environment variables.
          </p>
        </div>
      )}

      {/* Section 1: Customer Information */}
      <Section number="1" title="Customer Information">
        <FieldGrid cols={2}>
          <TextField label="First name" required value={draft.first_name} onChange={(v) => update('first_name', v)} placeholder="First name" />
          <TextField label="Last name" required value={draft.last_name} onChange={(v) => update('last_name', v)} placeholder="Last name" />
          <TextField label="Email" required type="email" value={draft.email} onChange={(v) => update('email', v)} placeholder="customer@email.com" />
          <TextField label="Phone" type="tel" value={draft.phone} onChange={(v) => update('phone', v)} placeholder="(555) 000-0000" />
        </FieldGrid>
        <Toggle label="New Customer" hint="Check if this customer is not yet in the CRM"
                checked={draft.is_new_customer} onChange={(v) => update('is_new_customer', v)} />
      </Section>

      {/* Section 2: Store Information */}
      <Section number="2" title="Store Information">
        <FieldGrid cols={2}>
          <TextField span={2} label="Store / Business Name (DBA)" required value={draft.store_name} onChange={(v) => update('store_name', v)} placeholder="Store or business name" />
          <TextField span={2} label="Legal Business Name" value={draft.legal_business_name} onChange={(v) => update('legal_business_name', v)} placeholder="Legal entity name if different" />
          <TextField span={2} label="Store Address" required value={draft.address} onChange={(v) => update('address', v)} placeholder="Street address, city, state, ZIP" />
          <TextField label="Store Phone" type="tel" value={draft.store_phone} onChange={(v) => update('store_phone', v)} placeholder="Store phone number" />
          <TextField label="Customer Account #" value={draft.customer_account} onChange={(v) => update('customer_account', v)} placeholder="Account number if existing" />
        </FieldGrid>
        <Toggle label="Chain Store" hint="This location is part of a chain or franchise"
                checked={draft.chain_store === 'Yes'}
                onChange={(v) => update('chain_store', v ? 'Yes' : 'No')} />
      </Section>

      {/* Section 3: Sales Information */}
      <Section number="3" title="Sales Information">
        <FieldGrid cols={2}>
          <TextField label="Sales Rep Name" required value={draft.sales_rep} onChange={(v) => update('sales_rep', v)} placeholder="Your full name" />
          <TextField label="Sales Rep Email" required type="email" value={draft.sales_rep_email} onChange={(v) => update('sales_rep_email', v)} placeholder="rep@ronnoco.com" />
          <SelectField label="ROM / Region" required value={draft.rom} onChange={(v) => update('rom', v)} options={ROM_OPTIONS} placeholder="Select region…" />
          <SelectField label="Coffee Program" value={draft.coffee_program} onChange={(v) => update('coffee_program', v)} options={COFFEE_PROGRAM_OPTIONS} placeholder="Select program…" />
        </FieldGrid>
      </Section>

      {/* Section 4: Deal Information */}
      <Section number="4" title="Deal Information">
        <div className="mb-4">
          <Label required>Deal Type</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {DEAL_TYPE_OPTIONS.map((opt) => {
              const isFinanceType = opt === 'Equipment Lease' || opt === 'Finance Equipment';
              const disabled = isFinanceType && equipmentItems.length > 0 && !qualifiesForFinance;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => !disabled && update('deal_type', opt)}
                  disabled={disabled}
                  title={disabled ? `Total must be at least ${formatUSD(LEASE_MIN_PRICE)} for ${opt}` : undefined}
                  className={`px-3 py-1.5 rounded-full border text-xs md:text-sm transition-colors
                    ${draft.deal_type === opt
                      ? 'bg-navy-900 border-navy-900 text-chalk-50'
                      : disabled
                        ? 'bg-page-50 border-page-200 text-slate-400 cursor-not-allowed'
                        : 'bg-white border-page-200 text-slate-700 hover:border-navy-300'}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {equipmentItems.length > 0 && !qualifiesForFinance && (
            <p className="mt-2 text-xs text-slate-500">
              Lease and finance options become available when the deal total is at least {formatUSD(LEASE_MIN_PRICE)}.
            </p>
          )}
        </div>

        {/* Equipment Selection */}
        <div className="mb-4">
          <Label required>Equipment Selection</Label>
          <div className="border border-page-200 rounded-lg bg-page-50 p-3 md:p-4">
            {equipmentItems.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-3">No equipment selected yet.</p>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="px-4 py-2 bg-navy-900 text-chalk-50 text-sm font-medium rounded hover:bg-navy-800 transition-colors"
                >
                  + Add equipment
                </button>
              </div>
            ) : (
              <>
                <ul className="space-y-2 mb-3">
                  {equipmentItems.map((item, idx) => (
                    <EquipmentRow
                      key={item.equipment_id || idx}
                      item={item}
                      onQuantityChange={(q) => setEquipmentItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: q } : it))}
                      onRemove={() => setEquipmentItems((prev) => prev.filter((_, i) => i !== idx))}
                    />
                  ))}
                </ul>
                <div className="flex items-center justify-between pt-3 border-t border-page-200">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="text-sm text-navy-700 hover:text-navy-900 font-medium"
                  >
                    + Add another item
                  </button>
                  <div className="text-sm">
                    <span className="text-slate-600">Total:</span>{' '}
                    <span className="font-mono tabular-nums font-medium text-slate-900">
                      {formatUSD(dealTotal)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <FieldGrid cols={2}>
          <TextField label="Target Install Date" required type="date" value={draft.target_install_date} onChange={(v) => update('target_install_date', v)} />
        </FieldGrid>

        <Toggle label="Emergency Install" hint="This deal requires priority installation scheduling"
                checked={draft.emergency_install === 'Yes'}
                onChange={(v) => update('emergency_install', v ? 'Yes' : 'No')} />
      </Section>

      {/* Section 5: Distribution */}
      <Section number="5" title="Distribution">
        <FieldGrid cols={2}>
          <TextField label="Parent Distributor" required value={draft.parent_distributor} onChange={(v) => update('parent_distributor', v)} placeholder="Distributor name" />
          <TextField label="Sub Group" value={draft.sub_group} onChange={(v) => update('sub_group', v)} placeholder="Sub group if applicable" />
          <TextField label="Distributor Rep Email" required type="email" value={draft.distributor_rep_email} onChange={(v) => update('distributor_rep_email', v)} placeholder="rep@distributor.com" hint="Used for installation scheduled notifications" />
          <SelectField label="Graphics Package" value={draft.graphics_package} onChange={(v) => update('graphics_package', v)} options={GRAPHICS_OPTIONS} placeholder="Select package…" />
        </FieldGrid>
      </Section>

      {/* Section 6: Notes */}
      <Section number="6" title="Additional Notes">
        <label className="block">
          <Label>Notes</Label>
          <textarea
            value={draft.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={4}
            placeholder="Any additional information, special requirements, or context for this deal…"
            className="w-full px-3 py-2 bg-page-50 border border-page-200 rounded text-sm
                       focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:bg-white
                       focus:outline-none transition-colors resize-y"
          />
        </label>
      </Section>

      {/* Deal Summary — shows cost / lease estimate / cash-sale notice */}
      {equipmentItems.length > 0 && (
        <DealSummary
          total={dealTotal}
          monthlyEstimate={monthlyEstimate}
          qualifies={qualifiesForFinance}
          dealType={draft.deal_type}
        />
      )}

      {/* Submit */}
      <div className="bg-white border border-page-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-sm text-slate-600 max-w-md">
          <div className="font-medium text-slate-900 mb-0.5">Ready to submit?</div>
          This deal will be created in the pipeline at the Submitted stage and the leasing team will be notified.
        </div>
        <button
          onClick={submitDeal}
          disabled={submitting || !isDealPipelineConfigured}
          className="px-6 py-3 bg-navy-900 text-chalk-50 font-medium rounded
                     hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors whitespace-nowrap"
        >
          {submitting ? 'Submitting…' : 'Submit Deal →'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {pickerOpen && (
        <EquipmentPicker
          onPick={(eq) => {
            // Don't allow duplicates — bump quantity instead if already added
            setEquipmentItems((prev) => {
              const existing = prev.findIndex((it) => it.equipment_id === eq.id);
              if (existing !== -1) {
                return prev.map((it, i) => i === existing ? { ...it, quantity: it.quantity + 1 } : it);
              }
              return [...prev, {
                equipment_id: eq.id,
                sku: eq.sku,
                description: eq.description,
                model: eq.model,
                vendor: eq.vendor || null,
                list_price: eq.list_price,
                quantity: 1,
              }];
            });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* ─── Deal Summary card ─── */

function DealSummary({ total, monthlyEstimate, qualifies, dealType }) {
  return (
    <section className="bg-white border border-page-200 rounded-lg overflow-hidden mb-4">
      <header className="bg-navy-900 text-chalk-50 px-4 md:px-5 py-3">
        <h2 className="text-sm md:text-base font-medium">Deal Summary</h2>
      </header>
      <div className="p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Equipment cost — always shown */}
          <div className="bg-page-50 border border-page-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1 font-medium">
              Equipment Cost
            </div>
            <div className="font-mono tabular-nums text-2xl font-medium text-slate-900">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Total list price of all selected equipment
            </div>
          </div>

          {/* Lease estimate or cash-sale notice */}
          {qualifies ? (
            <div className="bg-accent-500/5 border border-accent-500/30 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-accent-700 mb-1 font-medium">
                Monthly Lease Estimate
              </div>
              <div className="font-mono tabular-nums text-2xl font-medium text-navy-900">
                ${Math.round(monthlyEstimate).toLocaleString()}
                <span className="text-sm text-slate-500 font-sans font-normal">/mo</span>
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} × {LEASE_RATE} ={' '}
                <span className="font-mono">${monthlyEstimate.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-slate-600 mb-1 font-medium">
                Cash Sale Only
              </div>
              <div className="text-sm text-slate-800 font-medium leading-snug">
                Deal total under ${LEASE_MIN_PRICE.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Equipment lease and finance options require a minimum deal value of ${LEASE_MIN_PRICE.toLocaleString()}.
                This deal can only be sold as a purchase.
              </div>
            </div>
          )}
        </div>

        {dealType && (
          <div className="mt-4 pt-3 border-t border-page-200 flex items-center justify-between text-sm">
            <span className="text-slate-600">Deal type</span>
            <span className="font-medium text-slate-900">{dealType}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Form primitives ─── */

function Section({ number, title, children }) {
  return (
    <section className="bg-white border border-page-200 rounded-lg overflow-hidden mb-4">
      <header className="bg-navy-900 text-chalk-50 px-4 md:px-5 py-3 flex items-center gap-3">
        <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">{number}</span>
        <h2 className="text-sm md:text-base font-medium">{title}</h2>
      </header>
      <div className="p-4 md:p-5 space-y-3">{children}</div>
    </section>
  );
}

function FieldGrid({ cols, children }) {
  const colClass = cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
  return <div className={`grid grid-cols-1 ${colClass} gap-3 md:gap-4`}>{children}</div>;
}

function Label({ children, required }) {
  return (
    <span className="block text-[11px] uppercase tracking-wider text-slate-600 mb-1 font-semibold">
      {children}{required && <span className="text-bad ml-0.5">*</span>}
    </span>
  );
}

function TextField({ label, required, type = 'text', value, onChange, placeholder, hint, span, disabled }) {
  return (
    <label className={`block ${span === 2 ? 'md:col-span-2' : ''}`}>
      <Label required={required}>{label}</Label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 bg-page-50 border border-page-200 rounded text-sm
                   focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:bg-white
                   focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      />
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

function SelectField({ label, required, value, onChange, options, placeholder }) {
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-page-50 border border-page-200 rounded text-sm
                   focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:bg-white
                   focus:outline-none transition-colors"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center gap-3 mt-3 cursor-pointer select-none"
         onClick={() => onChange(!checked)}>
      <div className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0
                       ${checked ? 'bg-navy-700 justify-end' : 'bg-page-300 justify-start'}`}>
        <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
      </div>
      <div className="text-sm">
        <span className="font-medium text-navy-900">{label}</span>
        {hint && <span className="text-slate-600"> — {hint}</span>}
      </div>
    </div>
  );
}

function EquipmentRow({ item, onQuantityChange, onRemove }) {
  return (
    <li className="flex items-start gap-3 bg-white border border-page-200 rounded p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-[10px] text-slate-500">{item.sku}</span>
          {item.vendor && <span className="text-[10px] text-slate-400">· {item.vendor}</span>}
        </div>
        <div className="text-sm font-medium text-slate-900">{item.description}</div>
        {item.model && <div className="text-xs text-slate-500">{item.model}</div>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => onQuantityChange(parseInt(e.target.value, 10) || 1)}
          className="w-14 px-2 py-1 bg-white border border-page-200 rounded text-sm text-center"
        />
        <div className="text-right">
          <div className="font-mono tabular-nums text-sm text-slate-900">
            ${((item.list_price ?? 0) * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {item.quantity > 1 && (
            <div className="text-[10px] text-slate-400">
              ${(item.list_price ?? 0).toLocaleString()} ea
            </div>
          )}
        </div>
        <button onClick={onRemove} type="button"
                className="text-slate-400 hover:text-bad p-1" aria-label="Remove">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </li>
  );
}
