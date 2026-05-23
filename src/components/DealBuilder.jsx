import { useEffect, useMemo, useState } from 'react';
import { submitDealToPipeline, logDealActivity, isDealPipelineConfigured, generateQuoteNumber } from '../lib/dealPipeline.js';
import { LEASE_MIN_PRICE, LEASE_RATE } from '../lib/leasing.js';
import { useLookupList } from '../lib/useLookupList.js';
import { US_STATES } from '../lib/usStates.js';
import EquipmentPicker from './EquipmentPicker.jsx';

const formatUSD = (n) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ───────────────────────── Equipment summary ───────────────────────── */

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

/* ───────────────────────── Initial draft state ───────────────────────── */

function makeBlankDraft(profile, session) {
  return {
    // Submission metadata
    route_number: '',
    sales_rep_first_name: (profile?.display_name || '').split(' ')[0] || '',
    sales_rep_last_name:  (profile?.display_name || '').split(' ').slice(1).join(' ') || '',
    sales_rep_email:      session?.user?.email || '',

    // Customer identity
    is_new_customer: false,                      // toggle: "Is this a current Ronnoco Customer?" — INVERTED label
    customer_account: '',
    customer_type: '',                           // C-Store / Food Service
    sub_group: '',
    henderson_account: false,
    change_of_ownership: false,
    prior_account_num: '',
    change_details: '',

    // Chain & location
    chain_store: false,
    chain_group_num: '',
    number_of_locations: '',
    store_name: '',
    legal_business_name: '',
    address: '',                                  // Street address
    city: '',
    state: '',
    zip_code: '',
    store_phone: '',

    // Primary contact
    contact_first_name: '',
    contact_last_name: '',
    contact_cell: '',
    contact_email: '',

    // Coffee program & delivery
    coffee_program: '',
    distribution_method: 'Indirect (Distributor)', // Most deals are Indirect; rep can switch to DSD
    delivery_method: '',
    delivery_recurrence: '',
    current_coffee_supplier: '',
    parts_service_option: '',

    // Distributor info
    parent_distributor: '',
    parent_distributor_num: '',
    core_mark_div_num: '',
    distributor_warehouse: '',
    distributor_customer_num: '',
    distributor_rep_name: '',
    distributor_rep_email: '',
    distributor_rep_phone: '',

    // ROM & region
    rom_person: '',
    rom_email: '',
    rom_region: '',

    // Equipment & financials
    deal_type: '',
    coffee_spend_3mo: '',
    expected_monthly_sales: '',

    // Install
    target_install_date: '',
    need_by_date: '',
    emergency_install: false,
    emergency_install_details: '',

    // Graphics
    graphics_package: '',
    ship_graphics_with_equip: false,
    has_custom_graphics: false,

    // Notes
    notes: '',

    // Quote-specific (only used when submitting as Quote rather than Deal).
    // Cover note appears at the top of the customer-facing quote page; valid_until
    // is the expiration date shown to the customer. Defaults populated when the rep
    // toggles to quote mode (see submitAsQuote()).
    quote_cover_note: '',
    quote_valid_until: '',   // YYYY-MM-DD format for <input type=date>
  };
}

/* ───────────────────────── Main component ───────────────────────── */

export default function DealBuilder({ profile, session, navigate }) {
  const [draft, setDraft] = useState(() => makeBlankDraft(profile, session));
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  // Lookup lists
  const distributorList     = useLookupList('parent_distributor');
  const coffeeProgramList   = useLookupList('coffee_program');
  const customerTypeList    = useLookupList('customer_type');
  const distributionList    = useLookupList('distribution_method');
  const dealTypeList        = useLookupList('deal_type');
  const graphicsList        = useLookupList('graphics_package');
  const romPersonList       = useLookupList('rom_person');
  const romRegionList       = useLookupList('rom_region');

  // Auto-populate ROM email when a ROM person is selected (if email is on file)
  useEffect(() => {
    if (!draft.rom_person) {
      if (draft.rom_email) setDraft((p) => ({ ...p, rom_email: '' }));
      return;
    }
    const rom = romPersonList.options.find((o) => o.value === draft.rom_person);
    const newEmail = rom?.email || '';
    if (newEmail !== draft.rom_email) {
      setDraft((p) => ({ ...p, rom_email: newEmail }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.rom_person, romPersonList.options]);

  const update = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const eqSummary = useMemo(() => summarizeEquipment(equipmentItems), [equipmentItems]);
  const dealTotal = eqSummary.total;
  const qualifiesForFinance = dealTotal >= LEASE_MIN_PRICE;
  const monthlyEstimate = qualifiesForFinance ? dealTotal * LEASE_RATE : null;

  const isIndirect       = draft.distribution_method === 'Indirect (Distributor)';
  const isDSD            = draft.distribution_method === 'DSD';
  const isCoreMark       = draft.parent_distributor === 'Core-Mark';

  function validate() {
    const required = [
      ['contact_first_name',   'Contact first name'],
      ['contact_last_name',    'Contact last name'],
      ['contact_email',        'Contact email'],
      ['store_name',           'Store name'],
      ['address',              'Street address'],
      ['city',                 'City'],
      ['state',                'State'],
      ['zip_code',             'Zip code'],
      ['customer_type',        'Customer type (C-Store / Food Service)'],
      ['distribution_method',  'Distribution method (DSD / Indirect)'],
      ['deal_type',            'Deal type'],
      ['rom_person',           'ROM person'],
      ['target_install_date',  'Target install date'],
    ];
    for (const [key, label] of required) {
      if (!String(draft[key] || '').trim()) {
        return `Missing required field: ${label}`;
      }
    }
    if (isIndirect && !draft.parent_distributor) {
      return 'Parent distributor is required when distribution method is Indirect.';
    }
    if (equipmentItems.length === 0) {
      return 'Please select at least one piece of equipment.';
    }
    if (!qualifiesForFinance && (draft.deal_type === 'Lease Equipment' || draft.deal_type === 'Finance Equipment')) {
      return `Deals under ${formatUSD(LEASE_MIN_PRICE)} cannot be leased or financed. Choose "Purchase From Ronnoco" instead, or add more equipment to bring the total above ${formatUSD(LEASE_MIN_PRICE)}.`;
    }
    return null;
  }

  /**
   * Build the pipeline payload shared by both submitDeal and submitAsQuote.
   * The two paths set different phase/step/quote fields on top of this base.
   */
  function buildBasePayload() {
    const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
    const trimOrNull = (v) => {
      const t = String(v || '').trim();
      return t || null;
    };
    return {
      // Customer contact (the "customer" name comes from the primary contact)
      first_name:            trimOrNull(draft.contact_first_name),
      last_name:             trimOrNull(draft.contact_last_name),
      email:                 trimOrNull(draft.contact_email),
      phone:                 trimOrNull(draft.contact_cell),  // legacy `phone` column = contact cell
      is_new_customer:       !!draft.is_new_customer,

      // Store
      store_name:            trimOrNull(draft.store_name),
      legal_business_name:   trimOrNull(draft.legal_business_name),
      address:               trimOrNull(draft.address),       // street address only now
      city:                  trimOrNull(draft.city),
      state:                 trimOrNull(draft.state),
      zip_code:              trimOrNull(draft.zip_code),
      store_phone:           trimOrNull(draft.store_phone),
      customer_account:      trimOrNull(draft.customer_account),
      customer_type:         trimOrNull(draft.customer_type),
      sub_group:             trimOrNull(draft.sub_group),
      henderson_account:     !!draft.henderson_account,
      change_of_ownership:   !!draft.change_of_ownership,
      prior_account_num:     trimOrNull(draft.prior_account_num),
      change_details:        trimOrNull(draft.change_details),
      chain_store:           draft.chain_store ? 'Yes' : 'No',
      chain_group_num:       trimOrNull(draft.chain_group_num),
      number_of_locations:   numOrNull(draft.number_of_locations),

      // Primary contact extras
      contact_name:          trimOrNull([draft.contact_first_name, draft.contact_last_name].filter(Boolean).join(' ')),
      contact_cell:          trimOrNull(draft.contact_cell),
      contact_email:         trimOrNull(draft.contact_email),

      // Sales rep
      sales_rep:             trimOrNull([draft.sales_rep_first_name, draft.sales_rep_last_name].filter(Boolean).join(' ')),
      sales_rep_email:       trimOrNull(draft.sales_rep_email),
      route_number:          trimOrNull(draft.route_number),

      // Coffee program & delivery
      coffee_program:        trimOrNull(draft.coffee_program),
      distribution_method:   trimOrNull(draft.distribution_method),
      delivery_method:       trimOrNull(draft.delivery_method),
      delivery_recurrence:   trimOrNull(draft.delivery_recurrence),
      current_coffee_supplier: trimOrNull(draft.current_coffee_supplier),
      parts_service_option:  trimOrNull(draft.parts_service_option),

      // Distributor
      parent_distributor:    trimOrNull(draft.parent_distributor),
      parent_distributor_num: trimOrNull(draft.parent_distributor_num),
      core_mark_div_num:     trimOrNull(draft.core_mark_div_num),
      distributor_warehouse: trimOrNull(draft.distributor_warehouse),
      distributor_customer_num: trimOrNull(draft.distributor_customer_num),
      distributor_rep_name:  trimOrNull(draft.distributor_rep_name),
      distributor_rep_email: trimOrNull(draft.distributor_rep_email),
      distributor_rep_phone: trimOrNull(draft.distributor_rep_phone),

      // ROM
      rom_person:            trimOrNull(draft.rom_person),
      rom_email:             trimOrNull(draft.rom_email),
      rom:                   trimOrNull(draft.rom_region),

      // Equipment & financials
      deal_type:             trimOrNull(draft.deal_type),
      equipment_selection:   eqSummary.text,
      total_eq_cost:         formatUSD(dealTotal),
      coffee_spend_3mo:      numOrNull(draft.coffee_spend_3mo),
      expected_monthly_sales: numOrNull(draft.expected_monthly_sales),

      // Install
      target_install_date:   trimOrNull(draft.target_install_date),
      need_by_date:          trimOrNull(draft.need_by_date),
      emergency_install:     draft.emergency_install ? 'Yes' : 'No',
      emergency_install_details: trimOrNull(draft.emergency_install_details),

      // Graphics
      graphics_package:      trimOrNull(draft.graphics_package),
      ship_graphics_with_equip: !!draft.ship_graphics_with_equip,
      has_custom_graphics:   !!draft.has_custom_graphics,

      notes:                 trimOrNull(draft.notes),

      // Structured snapshot (preserves equipment + computed totals + raw form state)
      raw_csv: {
        source: 'ronnoco-deal-builder',
        equipment_items: equipmentItems,
        total_eq_cost_numeric: dealTotal,
        monthly_lease_estimate: monthlyEstimate,
        qualifies_for_finance: qualifiesForFinance,
      },
    };
  }

  /**
   * Generate a random URL-safe token for the quote's public link. 24 bytes
   * gives 192 bits of entropy — practically unguessable. We use the browser's
   * Web Crypto API which is available in every modern browser.
   */
  function generateQuoteToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    // Convert to URL-safe base64 (no +, /, or = chars)
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /** Build the absolute URL the customer will click in their email. */
  function buildQuoteUrl(quoteNumber, token) {
    const base = window.location.origin;
    return `${base}/#/quote/${quoteNumber}?t=${token}`;
  }

  /** Build the mailto: link with subject + body pre-filled. */
  function buildMailto(customerEmail, customerName, quoteNumber, quoteUrl, validUntil, coverNote) {
    const repName = [draft.sales_rep_first_name, draft.sales_rep_last_name].filter(Boolean).join(' ').trim() || 'Your Ronnoco rep';
    const subject = `Your Ronnoco Quote — ${quoteNumber}`;
    const greeting = customerName ? `Hi ${customerName.split(' ')[0]},` : 'Hi,';
    const noteBlock = coverNote ? `\n\n${coverNote}\n` : '';
    const validBlock = validUntil ? `\n\nThis quote is valid through ${validUntil}.` : '';
    const body =
`${greeting}
${noteBlock}
You can view the full equipment list, deal type, and pricing at the link below:

${quoteUrl}
${validBlock}

If you have any questions or want to make changes, just reply to this email and I'll get back to you.

Best,
${repName}`;
    return `mailto:${encodeURIComponent(customerEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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

    const pipelinePayload = {
      ...buildBasePayload(),
      // Direct-deal lifecycle: skips the sales/quote phase entirely.
      is_quote:              false,
      current_step:          'submitted',
      phase:                 'leasing',
      deal_status:           'active',
      customer_decision:     'pending',
    };

    const { data: deal, error: pipelineError } = await submitDealToPipeline(pipelinePayload);
    if (pipelineError) {
      setError(`Submission failed: ${pipelineError.message}`);
      setSubmitting(false);
      return;
    }
    await logDealActivity(
      deal.id,
      'Deal created',
      `Submitted via Ronnoco Deal Builder (${equipmentItems.length} item${equipmentItems.length === 1 ? '' : 's'}, ${formatUSD(dealTotal)})`,
      pipelinePayload.sales_rep
    );

    setSuccessInfo({
      kind: 'deal',
      dealId: deal.id,
      customerName: [draft.contact_first_name, draft.contact_last_name].filter(Boolean).join(' '),
      storeName: draft.store_name,
    });
    setSubmitting(false);
  }

  /**
   * Submit-as-quote: same data, different lifecycle (phase=sales, step=quoted).
   * On success, opens the rep's email client via mailto: with the customer's
   * email pre-filled and a link to the hosted quote page in the body.
   */
  async function submitAsQuote() {
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
    if (!draft.contact_email) {
      setError('Customer email is required to send a quote (so we can open your email client with it pre-filled).');
      return;
    }

    setSubmitting(true);

    // 1) Get the next quote number from the DB (atomic)
    const { data: quoteNumber, error: numberError } = await generateQuoteNumber();
    if (numberError || !quoteNumber) {
      setError(`Could not generate quote number: ${numberError?.message || 'unknown error'}`);
      setSubmitting(false);
      return;
    }

    // 2) Generate a random token for the public URL
    const quoteToken = generateQuoteToken();

    // 3) Determine valid-until: rep's pick or +30 days from today
    const validUntil = draft.quote_valid_until || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);  // YYYY-MM-DD
    })();

    const now = new Date().toISOString();
    const pipelinePayload = {
      ...buildBasePayload(),
      // Quote-specific lifecycle: starts in phase=sales, step=quoted
      is_quote:                true,
      current_step:            'quoted',
      phase:                   'sales',
      deal_status:             'active',
      customer_decision:       'pending',
      quote_number:            quoteNumber,
      quote_token:             quoteToken,
      quote_cover_note:        draft.quote_cover_note?.trim() || null,
      quote_valid_until:       validUntil,
      quote_first_sent_at:     now,
      quote_last_sent_at:      now,
      quote_revision:          1,
    };

    const { data: deal, error: pipelineError } = await submitDealToPipeline(pipelinePayload);
    if (pipelineError) {
      setError(`Submission failed: ${pipelineError.message}`);
      setSubmitting(false);
      return;
    }
    await logDealActivity(
      deal.id,
      'Quote created',
      `${quoteNumber} sent to ${draft.contact_email} (${equipmentItems.length} item${equipmentItems.length === 1 ? '' : 's'}, ${formatUSD(dealTotal)})`,
      pipelinePayload.sales_rep
    );

    const quoteUrl = buildQuoteUrl(quoteNumber, quoteToken);
    const customerName = [draft.contact_first_name, draft.contact_last_name].filter(Boolean).join(' ');
    const mailtoUrl = buildMailto(
      draft.contact_email,
      customerName,
      quoteNumber,
      quoteUrl,
      validUntil,
      draft.quote_cover_note?.trim()
    );

    setSuccessInfo({
      kind: 'quote',
      dealId: deal.id,
      quoteNumber,
      quoteUrl,
      mailtoUrl,
      customerName,
      customerEmail: draft.contact_email,
      storeName: draft.store_name,
      validUntil,
    });
    setSubmitting(false);

    // Auto-open the rep's email client. They can also click the button on the
    // success screen if their browser blocked the auto-open.
    window.location.href = mailtoUrl;
  }

  function startNewDeal() {
    setDraft(makeBlankDraft(profile, session));
    setEquipmentItems([]);
    setSuccessInfo(null);
    setError(null);
    window.scrollTo(0, 0);
  }

  /* Success screen — branches based on whether it was a deal or a quote */
  if (successInfo) {
    if (successInfo.kind === 'quote') {
      return (
        <div className="px-4 md:px-6 lg:px-10 py-10 max-w-3xl">
          <div className="bg-white border border-page-200 rounded-lg shadow-card p-8 md:p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-ok/10 text-ok flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl md:text-3xl font-light text-slate-900 mb-2">Quote ready to send</h1>
              <p className="text-slate-600 leading-relaxed mb-2 max-w-md mx-auto">
                Quote <span className="font-mono font-medium text-slate-900">{successInfo.quoteNumber}</span> for{' '}
                <span className="font-medium text-slate-900">{successInfo.storeName}</span>{' '}
                is saved in the pipeline.
              </p>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                Your email client should have opened with a message to{' '}
                <span className="font-medium text-slate-700">{successInfo.customerEmail}</span> ready to send.
                If it didn't, use the buttons below.
              </p>
            </div>

            {/* Customer-facing quote URL — visible so rep can copy it manually if needed */}
            <div className="mb-6 p-4 bg-page-50 border border-page-200 rounded">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                  Customer-facing quote link
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(successInfo.quoteUrl);
                  }}
                  className="text-xs text-navy-700 hover:text-navy-900 font-medium"
                >
                  Copy
                </button>
              </div>
              <a
                href={successInfo.quoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-navy-700 hover:text-navy-900 break-all underline decoration-navy-300"
              >
                {successInfo.quoteUrl}
              </a>
              <p className="text-[11px] text-slate-500 mt-2">
                Valid through {successInfo.validUntil}. The customer can open this any time without signing in.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <a
                href={successInfo.mailtoUrl}
                className="px-5 py-2.5 bg-navy-900 text-chalk-50 rounded font-medium hover:bg-navy-800 transition-colors text-center"
              >
                Open email client again
              </a>
              <a
                href={successInfo.quoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 border border-page-200 bg-white rounded text-slate-700 hover:bg-page-50 transition-colors text-center"
              >
                Preview quote page
              </a>
              <button onClick={startNewDeal}
                      className="px-5 py-2.5 border border-page-200 bg-white rounded text-slate-700 hover:bg-page-50 transition-colors">
                Start another
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Direct-deal success screen (unchanged from before)
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

      {/* ─── Section 1: Sales Rep & Submission ─── */}
      <Section number="1" title="Sales Rep & Submission">
        <FieldGrid cols={2}>
          <TextField label="Sales Rep First Name" required value={draft.sales_rep_first_name} onChange={(v) => update('sales_rep_first_name', v)} placeholder="From your profile" />
          <TextField label="Sales Rep Last Name"  required value={draft.sales_rep_last_name}  onChange={(v) => update('sales_rep_last_name', v)}  placeholder="From your profile" />
          <TextField label="Sales Rep Email"      required type="email" value={draft.sales_rep_email} onChange={(v) => update('sales_rep_email', v)} placeholder="rep@ronnoco.com" />
          <TextField label="Route Number (RTE #)" value={draft.route_number} onChange={(v) => update('route_number', v)} placeholder="Route #" />
        </FieldGrid>
      </Section>

      {/* ─── Section 2: Customer Identity ─── */}
      <Section number="2" title="Customer Identity">
        <Toggle label="Current Ronnoco Customer" hint="Toggle off if this is a new (not yet in CRM) customer"
                checked={!draft.is_new_customer} onChange={(v) => update('is_new_customer', !v)} />
        <FieldGrid cols={2}>
          <TextField label="Customer Account #" value={draft.customer_account} onChange={(v) => update('customer_account', v)} placeholder="If existing customer" />
          <LookupSelect label="C-Store or Food Service?" required listState={customerTypeList} value={draft.customer_type} onChange={(v) => update('customer_type', v)} placeholder="Select…" />
          <TextField label="Sub Group" value={draft.sub_group} onChange={(v) => update('sub_group', v)} placeholder="Sub group if applicable" />
        </FieldGrid>
        <Toggle label="Henderson Account" hint="Henderson is a Ronnoco brand"
                checked={draft.henderson_account} onChange={(v) => update('henderson_account', v)} />
        <Toggle label="Change of Ownership" hint="Existing account changing hands"
                checked={draft.change_of_ownership} onChange={(v) => update('change_of_ownership', v)} />
        {draft.change_of_ownership && (
          <div className="space-y-3 pl-4 ml-1 border-l-2 border-accent-500/50">
            <TextField label="Verify Prior Account #" value={draft.prior_account_num} onChange={(v) => update('prior_account_num', v)} placeholder="Previous account number" />
            <TextareaField label="Change of Ownership Details" rows={3} value={draft.change_details} onChange={(v) => update('change_details', v)} placeholder="Describe the change…" />
          </div>
        )}
      </Section>

      {/* ─── Section 3: Chain & Location ─── */}
      <Section number="3" title="Chain & Location">
        <Toggle label="Chain Store" hint="This location is part of a chain or franchise"
                checked={draft.chain_store} onChange={(v) => update('chain_store', v)} />
        {draft.chain_store && (
          <FieldGrid cols={2}>
            <TextField label="Existing Chain Ronnoco Group #" value={draft.chain_group_num} onChange={(v) => update('chain_group_num', v)} placeholder="Group #" />
            <TextField label="Number of Locations" type="number" value={draft.number_of_locations} onChange={(v) => update('number_of_locations', v)} placeholder="Total store count" />
          </FieldGrid>
        )}
        <FieldGrid cols={2}>
          <TextField span={2} label="Store / Business Name (DBA)" required value={draft.store_name} onChange={(v) => update('store_name', v)} placeholder="Store or business name" />
          <TextField span={2} label="Legal Business Name" value={draft.legal_business_name} onChange={(v) => update('legal_business_name', v)} placeholder="Legal entity name if different" />
          <TextField span={2} label="Street Address" required value={draft.address} onChange={(v) => update('address', v)} placeholder="Street address" />
          <TextField label="City" required value={draft.city} onChange={(v) => update('city', v)} placeholder="City" />
          <SelectField label="State" required value={draft.state} onChange={(v) => update('state', v)} options={US_STATES.map(([code, name]) => ({ value: code, label: `${code} — ${name}` }))} placeholder="Select state…" />
          <TextField label="Zip Code" required value={draft.zip_code} onChange={(v) => update('zip_code', v)} placeholder="Zip" />
          <TextField label="Store Phone" type="tel" value={draft.store_phone} onChange={(v) => update('store_phone', v)} placeholder="Store phone" />
        </FieldGrid>
      </Section>

      {/* ─── Section 4: Primary Contact ─── */}
      <Section number="4" title="Primary Contact">
        <FieldGrid cols={2}>
          <TextField label="Contact First Name" required value={draft.contact_first_name} onChange={(v) => update('contact_first_name', v)} placeholder="First name" />
          <TextField label="Contact Last Name"  required value={draft.contact_last_name}  onChange={(v) => update('contact_last_name', v)}  placeholder="Last name" />
          <TextField label="Contact Cell Phone" type="tel" value={draft.contact_cell} onChange={(v) => update('contact_cell', v)} placeholder="(555) 000-0000" />
          <TextField label="Contact Email" required type="email" value={draft.contact_email} onChange={(v) => update('contact_email', v)} placeholder="customer@email.com" />
        </FieldGrid>
      </Section>

      {/* ─── Section 5: Coffee Program & Delivery ─── */}
      <Section number="5" title="Coffee Program & Delivery">
        <FieldGrid cols={2}>
          <LookupSelect label="Coffee Program" listState={coffeeProgramList} value={draft.coffee_program} onChange={(v) => update('coffee_program', v)} placeholder="Select program…" />
          <LookupSelect
            label="Distribution Method"
            required
            listState={distributionList}
            value={draft.distribution_method}
            onChange={(v) => {
              // When switching to Indirect, the distributor handles delivery —
              // clear any DSD-only values so stale data isn't submitted.
              if (v === 'Indirect (Distributor)') {
                setDraft((p) => ({ ...p, distribution_method: v, delivery_method: '', delivery_recurrence: '' }));
              } else {
                update('distribution_method', v);
              }
            }}
            placeholder="DSD or Indirect…"
          />
          <TextField label="Current Coffee Supplier" value={draft.current_coffee_supplier} onChange={(v) => update('current_coffee_supplier', v)} placeholder="Existing supplier name" />
          <TextField
            label="Service included with Sales and Marketing Agreement"
            value={draft.parts_service_option}
            onChange={(v) => update('parts_service_option', v)}
            placeholder="Service terms / notes"
            hint="Customer will need to sign the Sales and Marketing Agreement"
          />
        </FieldGrid>

        {/* DSD-only: Ronnoco is delivering, so the leasing team needs to know how & how often.
            For Indirect deals these are handled by the distributor and aren't asked here. */}
        {isDSD && (
          <FieldGrid cols={2}>
            <TextField label="How will it be delivered?" value={draft.delivery_method} onChange={(v) => update('delivery_method', v)} placeholder="e.g. truck, courier" />
            <TextField label="Final Delivery Recurrence" value={draft.delivery_recurrence} onChange={(v) => update('delivery_recurrence', v)} placeholder="e.g. weekly, bi-weekly" />
          </FieldGrid>
        )}
      </Section>

      {/* ─── Section 6: Distributor — only if Indirect ─── */}
      {isIndirect && (
        <Section number="6" title="Distributor Information">
          <FieldGrid cols={2}>
            <LookupSelect label="Parent Distributor" required listState={distributorList} value={draft.parent_distributor} onChange={(v) => update('parent_distributor', v)} placeholder="Select distributor…" />
            <TextField label="Parent Distributor #" value={draft.parent_distributor_num} onChange={(v) => update('parent_distributor_num', v)} placeholder="Distributor #" />
            {isCoreMark && (
              <TextField label="Core-Mark Specific Div #" value={draft.core_mark_div_num} onChange={(v) => update('core_mark_div_num', v)} placeholder="Division #" span={2} />
            )}
            <TextField label="Distributor Warehouse" value={draft.distributor_warehouse} onChange={(v) => update('distributor_warehouse', v)} placeholder="Warehouse" />
            <TextField label="Distributor's Customer #" value={draft.distributor_customer_num} onChange={(v) => update('distributor_customer_num', v)} placeholder="Customer #" />
            <TextField label="Distributor Rep Name" value={draft.distributor_rep_name} onChange={(v) => update('distributor_rep_name', v)} placeholder="Rep name" />
            <TextField label="Distributor Rep Email" type="email" value={draft.distributor_rep_email} onChange={(v) => update('distributor_rep_email', v)} placeholder="rep@distributor.com" hint="Used for installation scheduling notifications" />
            <TextField label="Distributor Rep Contact Number" type="tel" value={draft.distributor_rep_phone} onChange={(v) => update('distributor_rep_phone', v)} placeholder="Phone" />
          </FieldGrid>
        </Section>
      )}

      {/* ─── Section 7: ROM ─── */}
      <Section number={isIndirect ? '7' : '6'} title="Ronnoco Region (ROM)">
        <FieldGrid cols={2}>
          <LookupSelect label="Select the ROM" required listState={romPersonList} value={draft.rom_person} onChange={(v) => update('rom_person', v)} placeholder="Select ROM…" />
          <TextField
            label="ROM Email"
            value={draft.rom_email}
            onChange={(v) => update('rom_email', v)}
            placeholder="Auto-filled from ROM selection"
            hint={draft.rom_person && !draft.rom_email ? 'Not yet on file — admin can add via Dropdown Lists' : null}
          />
          <LookupSelect label="ROM Region" listState={romRegionList} value={draft.rom_region} onChange={(v) => update('rom_region', v)} placeholder="Select region…" span={2} />
        </FieldGrid>
      </Section>

      {/* ─── Section 8: Equipment & Deal Info ─── */}
      <Section number={isIndirect ? '8' : '7'} title="Equipment & Deal Information">
        <div className="mb-4">
          <Label required>Deal Type</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {dealTypeList.options.map((opt) => {
              const isFinanceType = opt.value === 'Lease Equipment' || opt.value === 'Finance Equipment';
              const disabled = isFinanceType && equipmentItems.length > 0 && !qualifiesForFinance;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => !disabled && update('deal_type', opt.value)}
                  disabled={disabled}
                  title={disabled ? `Total must be at least ${formatUSD(LEASE_MIN_PRICE)} for ${opt.value}` : undefined}
                  className={`px-3 py-1.5 rounded-full border text-xs md:text-sm transition-colors
                    ${draft.deal_type === opt.value
                      ? 'bg-navy-900 border-navy-900 text-chalk-50'
                      : disabled
                        ? 'bg-page-50 border-page-200 text-slate-400 cursor-not-allowed'
                        : 'bg-white border-page-200 text-slate-700 hover:border-navy-300'}`}
                >
                  {opt.value}
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

        {/* Equipment picker */}
        <div className="mb-4">
          <Label required>Equipment Selection</Label>
          <div className="border border-page-200 rounded-lg bg-page-50 p-3 md:p-4">
            {equipmentItems.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-3">No equipment selected yet.</p>
                <button type="button" onClick={() => setPickerOpen(true)}
                        className="px-4 py-2 bg-navy-900 text-chalk-50 text-sm font-medium rounded hover:bg-navy-800 transition-colors">
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
                  <button type="button" onClick={() => setPickerOpen(true)}
                          className="text-sm text-navy-700 hover:text-navy-900 font-medium">
                    + Add another item
                  </button>
                  <div className="text-sm">
                    <span className="text-slate-600">Total:</span>{' '}
                    <span className="font-mono tabular-nums font-medium text-slate-900">{formatUSD(dealTotal)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <FieldGrid cols={2}>
          <TextField label="Coffee Spend (Last 3 Months)" type="number" value={draft.coffee_spend_3mo} onChange={(v) => update('coffee_spend_3mo', v)} placeholder="$0" hint="Customer's coffee-related spend, last 3 months" />
          <TextField label="Expected Monthly Sales" type="number" value={draft.expected_monthly_sales} onChange={(v) => update('expected_monthly_sales', v)} placeholder="$0" hint="Customer's projected monthly sales" />
        </FieldGrid>
      </Section>

      {/* ─── Section 9: Installation ─── */}
      <Section number={isIndirect ? '9' : '8'} title="Installation">
        <FieldGrid cols={2}>
          <TextField label="Target Install Date" required type="date" value={draft.target_install_date} onChange={(v) => update('target_install_date', v)} />
          <TextField label="Need By Date" type="date" value={draft.need_by_date} onChange={(v) => update('need_by_date', v)} hint="Hard deadline if different from target" />
        </FieldGrid>
        <Toggle label="Emergency Install" hint="This deal requires priority installation scheduling"
                checked={draft.emergency_install} onChange={(v) => update('emergency_install', v)} />
        {draft.emergency_install && (
          <div className="pl-4 ml-1 border-l-2 border-accent-500/50">
            <TextareaField label="Emergency Install Details" rows={3} value={draft.emergency_install_details} onChange={(v) => update('emergency_install_details', v)} placeholder="Why is this urgent?" />
          </div>
        )}
      </Section>

      {/* ─── Section 10: Graphics ─── */}
      <Section number={isIndirect ? '10' : '9'} title="Graphics">
        <FieldGrid cols={2}>
          <LookupSelect span={2} label="Graphics Package" listState={graphicsList} value={draft.graphics_package} onChange={(v) => update('graphics_package', v)} placeholder="Select package…" />
        </FieldGrid>
        <Toggle label="Ship Graphics with Equipment" checked={draft.ship_graphics_with_equip} onChange={(v) => update('ship_graphics_with_equip', v)} />
        <Toggle label="Existing Custom Graphics" hint="Customer already has custom graphics on file"
                checked={draft.has_custom_graphics} onChange={(v) => update('has_custom_graphics', v)} />
      </Section>

      {/* ─── Section 11: Notes ─── */}
      <Section number={isIndirect ? '11' : '10'} title="Additional Notes">
        <TextareaField label="Notes" rows={4} value={draft.notes} onChange={(v) => update('notes', v)} placeholder="Any additional information, special requirements, or context for this deal…" />
      </Section>

      {/* ─── Deal Summary ─── */}
      {equipmentItems.length > 0 && (
        <DealSummary
          total={dealTotal}
          monthlyEstimate={monthlyEstimate}
          qualifies={qualifiesForFinance}
          dealType={draft.deal_type}
        />
      )}

      {/* ─── Quote-prep panel ─── */}
      {/* Optional inputs that only matter if the rep is submitting as a quote.
          We always show them (collapsed by default) so the rep can fill in a
          cover note or change the valid-until date before clicking Submit as Quote. */}
      <details className="bg-white border border-page-200 rounded-lg overflow-hidden">
        <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-slate-700 hover:bg-page-50 transition-colors flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Quote options
          <span className="text-xs text-slate-500 font-normal ml-1">— only matters if you submit as a quote</span>
        </summary>
        <div className="px-5 pb-5 pt-2 border-t border-page-100">
          <p className="text-xs text-slate-600 mb-3 leading-relaxed max-w-2xl">
            A quote is the same deal in the "sales" phase, waiting on the customer's decision.
            After you click <span className="font-medium text-slate-800">Submit as Quote</span> below,
            your email client opens with a message to the customer ready to send, including a link
            to view the quote online.
          </p>
          <FieldGrid cols={2}>
            <TextareaField
              span={2}
              label="Cover note to customer (optional)"
              rows={3}
              value={draft.quote_cover_note}
              onChange={(v) => update('quote_cover_note', v)}
              placeholder="e.g. Following up on our conversation Tuesday — here's the formal quote for the program we discussed."
            />
            <TextField
              label="Quote valid until"
              type="date"
              value={draft.quote_valid_until}
              onChange={(v) => update('quote_valid_until', v)}
              placeholder=""
              hint="Defaults to 30 days from today if left blank."
            />
          </FieldGrid>
        </div>
      </details>

      {/* ─── Submit ─── */}
      <div className="bg-white border border-page-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-sm text-slate-600 max-w-md">
          <div className="font-medium text-slate-900 mb-0.5">Ready to send?</div>
          <span className="text-slate-700">Submit as Quote</span> emails the customer for review.{' '}
          <span className="text-slate-700">Submit Deal</span> sends it straight to the leasing team.
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <button onClick={submitAsQuote} disabled={submitting || !isDealPipelineConfigured}
                  className="px-5 py-3 border-2 border-navy-900 text-navy-900 font-medium rounded
                             hover:bg-navy-50 disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors whitespace-nowrap">
            {submitting ? '…' : 'Submit as Quote'}
          </button>
          <button onClick={submitDeal} disabled={submitting || !isDealPipelineConfigured}
                  className="px-6 py-3 bg-navy-900 text-chalk-50 font-medium rounded
                             hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors whitespace-nowrap">
            {submitting ? 'Submitting…' : 'Submit Deal →'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {pickerOpen && (
        <EquipmentPicker
          onPick={(eq) => {
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

/* ───────────────────────── Deal Summary ───────────────────────── */

function DealSummary({ total, monthlyEstimate, qualifies, dealType }) {
  return (
    <section className="bg-white border border-page-200 rounded-lg overflow-hidden mb-4">
      <header className="bg-navy-900 text-chalk-50 px-4 md:px-5 py-3">
        <h2 className="text-sm md:text-base font-medium">Deal Summary</h2>
      </header>
      <div className="p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-page-50 border border-page-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1 font-medium">Equipment Cost</div>
            <div className="font-mono tabular-nums text-2xl font-medium text-slate-900">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Total list price of all selected equipment</div>
          </div>
          {qualifies ? (
            <div className="bg-accent-500/5 border border-accent-500/30 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-accent-700 mb-1 font-medium">Monthly Lease Estimate</div>
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
              <div className="text-xs uppercase tracking-wider text-slate-600 mb-1 font-medium">Cash Sale Only</div>
              <div className="text-sm text-slate-800 font-medium leading-snug">
                Deal total under ${LEASE_MIN_PRICE.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Equipment lease and finance options require a minimum deal value of ${LEASE_MIN_PRICE.toLocaleString()}. This deal can only be sold as a purchase.
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

/* ───────────────────────── Form primitives ───────────────────────── */

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
function TextareaField({ label, value, onChange, placeholder, rows = 3, span = 2 }) {
  return (
    <label className={`block ${span === 2 ? 'md:col-span-2' : ''}`}>
      <Label>{label}</Label>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-page-50 border border-page-200 rounded text-sm
                   focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:bg-white
                   focus:outline-none transition-colors resize-y"
      />
    </label>
  );
}
function SelectField({ label, required, value, onChange, options, placeholder, span }) {
  return (
    <label className={`block ${span === 2 ? 'md:col-span-2' : ''}`}>
      <Label required={required}>{label}</Label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-page-50 border border-page-200 rounded text-sm
                   focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:bg-white
                   focus:outline-none transition-colors"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  );
}
/** LookupSelect — like SelectField but pulls options from a useLookupList result */
function LookupSelect({ label, required, listState, value, onChange, placeholder, span }) {
  const { options, loading, error } = listState;
  return (
    <label className={`block ${span === 2 ? 'md:col-span-2' : ''}`}>
      <Label required={required}>{label}</Label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full px-3 py-2 bg-page-50 border border-page-200 rounded text-sm
                   focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:bg-white
                   focus:outline-none transition-colors disabled:opacity-60"
      >
        <option value="">{loading ? 'Loading…' : placeholder}</option>
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.value}</option>)}
      </select>
      {error && <span className="block text-[11px] text-bad mt-1">Couldn't load list: {error}</span>}
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
        <input type="number" min="1" value={item.quantity}
               onChange={(e) => onQuantityChange(parseInt(e.target.value, 10) || 1)}
               className="w-14 px-2 py-1 bg-white border border-page-200 rounded text-sm text-center" />
        <div className="text-right">
          <div className="font-mono tabular-nums text-sm text-slate-900">
            ${((item.list_price ?? 0) * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {item.quantity > 1 && (
            <div className="text-[10px] text-slate-400">${(item.list_price ?? 0).toLocaleString()} ea</div>
          )}
        </div>
        <button onClick={onRemove} type="button" className="text-slate-400 hover:text-bad p-1" aria-label="Remove">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </li>
  );
}
