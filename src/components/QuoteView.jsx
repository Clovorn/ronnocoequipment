import { useEffect, useState } from 'react';
import { fetchQuoteForCustomer, recordQuoteView, fetchDealBundle } from '../lib/dealPipeline.js';
import RonnocoLogo from './RonnocoLogo.jsx';

/**
 * QuoteView — public, customer-facing page for a single quote.
 *
 * Route: #/quote/{quote_number}?t={token}
 *
 * No authentication required. Access control is the token: the page only
 * displays a quote if the URL's token matches the one stored on the deal row.
 * Tokens are 192-bit random strings — practically unguessable.
 *
 * What the customer sees:
 *   - Their store name + customer name
 *   - Cover note from the rep
 *   - Equipment list with quantities and list prices
 *   - Deal type and totals (monthly lease estimate for lease deals)
 *   - Rep's name and email (so they can reply)
 *   - "Valid until" date
 *
 * What the customer does NOT see:
 *   - Cost (internal margin)
 *   - ROM, distributor info, internal notes
 *   - Other internal fields
 */
export default function QuoteView({ quoteNumber, token }) {
  const [state, setState] = useState({ loading: true, quote: null, dealBundle: null, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!quoteNumber || !token) {
        setState({ loading: false, quote: null, dealBundle: null, error: 'This quote link is missing required information.' });
        return;
      }
      const { data, error } = await fetchQuoteForCustomer(quoteNumber, token);
      if (cancelled) return;

      if (error) {
        setState({ loading: false, quote: null, dealBundle: null, error: 'We had trouble loading this quote. Please contact your Ronnoco sales rep.' });
        return;
      }
      if (!data) {
        setState({ loading: false, quote: null, dealBundle: null, error: 'This quote link isn\'t valid. It may have expired or the link is incorrect — please check the email or contact your Ronnoco sales rep.' });
        return;
      }

      // v27: if this deal has a deal_bundles row, fetch it so we can render
      // the bundle program section + Supply/Service/Marketing inclusion.
      // Best-effort: a missing bundle row is treated as a non-bundle deal,
      // which is the correct fallback for legacy quotes.
      const { bundle: dealBundle } = await fetchDealBundle(data.id);
      if (cancelled) return;

      setState({ loading: false, quote: data, dealBundle, error: null });

      // Best-effort: record that the customer viewed the quote.
      recordQuoteView(quoteNumber, token);
    })();
    return () => { cancelled = true; };
  }, [quoteNumber, token]);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-50">
        <div className="text-slate-500 text-sm">Loading your quote…</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-page-50">
        <div className="max-w-md bg-white border border-page-200 rounded-lg shadow-card p-8 text-center">
          <RonnocoLogo variant="on-light" className="mb-6 mx-auto" />
          <h1 className="text-xl font-medium text-slate-900 mb-2">Quote not available</h1>
          <p className="text-sm text-slate-600 leading-relaxed">{state.error}</p>
        </div>
      </div>
    );
  }

  return <QuoteDocument quote={state.quote} dealBundle={state.dealBundle} />;
}

// ────────────────────────────────────────────────────────────────────────
// Quote document — the actual customer-facing layout

function QuoteDocument({ quote, dealBundle }) {
  // Pull equipment items from raw_csv (preserved snapshot from submission)
  const equipmentItems = quote.raw_csv?.equipment_items || [];
  const totalNumeric  = quote.raw_csv?.total_eq_cost_numeric ?? 0;
  const monthlyLease  = quote.raw_csv?.monthly_lease_estimate ?? null;
  const qualifiesLease = !!quote.raw_csv?.qualifies_for_finance;

  // v27: bundle deals carry deal_bundles row with the true (rounded) monthly
  // and the bundle's program name. When present, the quote renders as a
  // program quote with the customer-monthly = monthly_charged.
  const isBundleDeal = !!dealBundle;
  const bundleMonthly = dealBundle?.monthly_charged ?? null;
  const bundleTerm    = dealBundle?.bundle_term_months ?? 36;

  const customerName = quote.contact_name
    || [quote.first_name, quote.last_name].filter(Boolean).join(' ')
    || null;
  const validUntilStr = quote.quote_valid_until
    ? new Date(quote.quote_valid_until + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const sentDateStr = quote.quote_first_sent_at
    ? new Date(quote.quote_first_sent_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  // Lease vs purchase vs finance vs loan: customer-friendly labels.
  // Bundle deals override with the program name + a "Distributor Program"
  // eyebrow so the customer sees the program identity, not just "Equipment Lease".
  const dealTypeLabel = isBundleDeal
    ? (dealBundle.bundle_name || 'Distributor Program')
    : (({
        'Lease Equipment':      'Equipment Lease',
        'Finance Equipment':    'Equipment Financing',
        'Purchase From Ronnoco':'Equipment Purchase',
        'Loan Equipment':       'Equipment Placement (Loan Program)',
      })[quote.deal_type] || quote.deal_type || 'Equipment Quote');

  const isLeaseDealType = quote.deal_type === 'Lease Equipment';

  return (
    <div className="min-h-screen bg-page-50">
      {/* Top banner — keeps Ronnoco branding visible */}
      <header className="bg-navy-900 text-chalk-50 py-5 px-4 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <RonnocoLogo variant="on-dark" />
          <button
            onClick={() => window.print()}
            className="text-xs uppercase tracking-wider text-chalk-200 hover:text-chalk-50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save as PDF
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Quote header card */}
        <div className="bg-white border border-page-200 rounded-lg shadow-card overflow-hidden">
          <div className="px-6 md:px-10 py-6 md:py-8 border-b border-page-200">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
                  {isBundleDeal ? 'Distributor Program Quote' : 'Equipment Quote'}
                </p>
                <h1 className="text-2xl md:text-3xl font-light text-slate-900">
                  {dealTypeLabel}
                </h1>
                {quote.store_name && (
                  <p className="text-sm text-slate-600 mt-2">
                    Prepared for <span className="font-medium text-slate-900">{quote.store_name}</span>
                    {customerName && <> · Attn: <span className="font-medium text-slate-900">{customerName}</span></>}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">Quote Number</p>
                <p className="font-mono text-lg text-slate-900">{quote.quote_number}</p>
                {sentDateStr && <p className="text-xs text-slate-500 mt-1">Sent {sentDateStr}</p>}
              </div>
            </div>
          </div>

          {/* Cover note */}
          {quote.quote_cover_note && (
            <div className="px-6 md:px-10 py-5 bg-accent-500/5 border-b border-page-200">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {quote.quote_cover_note}
              </p>
            </div>
          )}

          {/* Customer info */}
          {(quote.address || quote.city || quote.state) && (
            <div className="px-6 md:px-10 py-5 border-b border-page-200">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1 font-semibold">Customer Location</p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {quote.store_name && <>{quote.store_name}<br /></>}
                {quote.address && <>{quote.address}<br /></>}
                {[quote.city, quote.state, quote.zip_code].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {/* Equipment list */}
          <div className="px-6 md:px-10 py-6 border-b border-page-200">
            <h2 className="text-[11px] uppercase tracking-wider text-slate-500 mb-3 font-semibold">
              {isBundleDeal ? 'Equipment Included in this Program' : 'Equipment'}
            </h2>
            {equipmentItems.length === 0 ? (
              <p className="text-sm text-slate-500 italic">{quote.equipment_selection || 'No equipment listed.'}</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                      <th className="px-2 py-2 w-12">Qty</th>
                      <th className="px-2 py-2">Item</th>
                      {!isBundleDeal && <th className="px-2 py-2 text-right">List Price</th>}
                      {!isBundleDeal && <th className="px-2 py-2 text-right">Extended</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-page-100">
                    {equipmentItems.map((it, i) => {
                      const listPrice = it.list_price ?? 0;
                      const extended  = listPrice * (it.quantity || 1);
                      return (
                        <tr key={i} className="text-slate-700">
                          <td className="px-2 py-3 align-top font-mono text-slate-600">{it.quantity}</td>
                          <td className="px-2 py-3 align-top">
                            <div className="font-medium text-slate-900">{it.description}</div>
                            {(it.vendor || it.model || it.sku) && (
                              <div className="text-xs text-slate-500 mt-0.5">{[it.vendor, it.model, it.sku].filter(Boolean).join(' · ')}</div>
                            )}
                          </td>
                          {!isBundleDeal && <td className="px-2 py-3 align-top text-right tabular-nums">{formatUSD(listPrice)}</td>}
                          {!isBundleDeal && <td className="px-2 py-3 align-top text-right tabular-nums font-medium text-slate-900">{formatUSD(extended)}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Customer-facing bundle program sheet inside the quote */}
          {isBundleDeal && (
            <>
              <div className="px-6 md:px-10 py-6 border-b border-page-200 bg-accent-500/5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <ProgramInfoCard
                    title="What is included"
                    body="Your program bundles equipment, digital media delivery, marketing support, and service into one structured lease program."
                  />
                  <ProgramInfoCard
                    title="How service works"
                    body="Equipment service is included while the customer remains in compliance with the Supply, Service & Marketing Agreement with Ronnoco."
                  />
                  <ProgramInfoCard
                    title="How marketing works"
                    body="Ronnoco digital media and marketing support can include delivery to customer-installed screens as part of the program."
                  />
                </div>
              </div>

              <div className="px-6 md:px-10 py-6 border-b border-page-200 bg-white">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">Why customers choose this program</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-3">
                      This program is built to give the customer more than equipment alone. It combines support, service, and digital marketing into one monthly program structure.
                    </p>
                    <ul className="space-y-2">
                      <li className="text-sm text-slate-700 flex gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" /><span>One monthly payment for the program</span></li>
                      <li className="text-sm text-slate-700 flex gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" /><span>Equipment, service, and marketing work together</span></li>
                      <li className="text-sm text-slate-700 flex gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" /><span>Best value for customers in compliance and producing $500 or more per month in coffee sales</span></li>
                    </ul>
                  </div>
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <h3 className="text-[11px] uppercase tracking-wider text-amber-800 mb-2 font-semibold">Program note</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Service and media are included when the customer is in compliance with the service agreement. For customers outside Distributor Programs who want media services, monthly digital media delivery typically ranges from $30 to $70 per player and must be passed through to the customer.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Pricing summary */}
          <div className="px-6 md:px-10 py-6">
            {isBundleDeal ? (
              /* v27 bundle deal: customer sees ONLY the rounded monthly + term.
                 No equipment total, no per-item math, no $5K fallback. The bundle
                 lease basis and soft cost are internal numbers. */
              <div className="flex flex-col gap-2 items-end">
                <div className="flex gap-12 text-base">
                  <span className="text-slate-700 font-medium">Monthly Payment</span>
                  <span className="font-mono tabular-nums text-2xl font-medium text-navy-900 min-w-[140px] text-right">
                    {bundleMonthly != null
                      ? `$${bundleMonthly.toLocaleString()}`
                      : '—'}
                    <span className="text-slate-500 text-sm font-sans font-normal ml-0.5">/mo</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-md text-right">
                  {bundleTerm}-month Program lease. Final terms are subject to credit approval.
                </p>
              </div>
            ) : (
              /* Non-bundle deal: original equipment total + lease estimate. */
              <div className="flex flex-col gap-2 items-end">
                <div className="flex gap-12 text-sm">
                  <span className="text-slate-600">Equipment Total</span>
                  <span className="font-mono tabular-nums text-slate-900 min-w-[120px] text-right">{formatUSD(totalNumeric)}</span>
                </div>

                {isLeaseDealType && qualifiesLease && monthlyLease != null && (
                  <>
                    <div className="flex gap-12 text-sm">
                      <span className="text-slate-600">Estimated Monthly Lease</span>
                      <span className="font-mono tabular-nums text-slate-900 min-w-[120px] text-right">{formatUSD(monthlyLease)} <span className="text-slate-500 text-xs font-sans">/mo</span></span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 max-w-md text-right">
                      Monthly estimate uses Ronnoco's standard lease factor and assumes a typical lease term.
                      Final terms are subject to credit approval and may vary based on lease length and program.
                    </p>
                  </>
                )}

                {isLeaseDealType && !qualifiesLease && (
                  <p className="text-xs text-slate-500 mt-2 max-w-md text-right">
                    This package is below Ronnoco's $5,000 lease minimum and would be processed as a direct purchase.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Rep contact */}
        {(quote.sales_rep || quote.sales_rep_email) && (
          <div className="mt-6 bg-white border border-page-200 rounded-lg p-5 md:p-6">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">Your Ronnoco Representative</p>
            <p className="text-sm text-slate-700">
              {quote.sales_rep && <span className="font-medium text-slate-900">{quote.sales_rep}</span>}
              {quote.sales_rep_email && (
                <>
                  {quote.sales_rep && <> · </>}
                  <a href={`mailto:${quote.sales_rep_email}`} className="text-navy-700 hover:text-navy-900 underline decoration-navy-300">
                    {quote.sales_rep_email}
                  </a>
                </>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              Questions about this quote, want to change something, or ready to move forward? Reply to the email this quote came in,
              or contact your rep directly.
            </p>
          </div>
        )}

        {/* Validity & disclaimers */}
        <div className="mt-6 text-xs text-slate-500 leading-relaxed space-y-2 px-1">
          {validUntilStr && (
            <p>This quote is valid through <span className="font-medium text-slate-700">{validUntilStr}</span>.</p>
          )}
          <p>
            Pricing reflects current list prices and is subject to change. Lease and finance terms are estimates subject
            to credit approval. Final pricing, terms, and equipment availability will be confirmed by the leasing team
            before any agreement is executed.
          </p>
        </div>
      </main>
    </div>
  );
}

function formatUSD(n) {
  return `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


function ProgramInfoCard({ title, body }) {
  return (
    <div className="rounded-2xl border border-page-200 bg-white p-4">
      <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
    </div>
  );
}
