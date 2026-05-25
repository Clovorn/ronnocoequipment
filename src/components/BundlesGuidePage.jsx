import { BUNDLES_GUIDE_SECTIONS } from '../help/bundlesGuideContent.js';

export default function BundlesGuidePage({ bundles = [], navigate }) {
  const featuredBundles = bundles.filter((b) => b.image_url).slice(0, 6);

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-accent-700 text-chalk-50 p-6 md:p-8 shadow-card mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-chalk-300 mb-2 font-medium">
          Bundles Guide
        </p>
        <h1 className="text-3xl md:text-4xl font-light leading-tight mb-3">
          How to position Distributor Branded bundles
        </h1>
        <p className="text-sm md:text-base text-chalk-100/90 leading-relaxed max-w-4xl">
          This guide helps reps explain the difference between Distributor Branded program bundles and general sale, finance, or lease deals. It uses the actual bundle records already in Deal Builder and keeps the story simple, visual, and easy to use in live selling.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => navigate?.('bundles')}
            className="px-4 py-2 rounded bg-white text-navy-900 text-sm font-medium hover:bg-chalk-50 transition-colors"
          >
            Back to Bundles
          </button>
          <button
            onClick={() => navigate?.('faq', { anchor: 'bundles-guide' })}
            className="px-4 py-2 rounded border border-white/30 text-chalk-50 text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Open help article
          </button>
        </div>
      </div>

      {featuredBundles.length > 0 && (
        <section className="mb-8">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
                Bundle visuals
              </p>
              <h2 className="text-xl md:text-2xl font-light text-slate-900">
                Live bundle images from the uploaded records
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {featuredBundles.map((bundle) => (
              <div key={bundle.id} className="bg-white border border-page-200 rounded-2xl p-3 shadow-sm">
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-page-100 mb-3 flex items-center justify-center">
                  <img src={bundle.image_url} alt={bundle.name} className="w-full h-full object-contain" />
                </div>
                <div className="text-sm font-medium text-slate-900 leading-snug">{bundle.name}</div>
                {bundle.target_monthly_fee != null && (
                  <div className="mt-1 text-xs text-slate-500">
                    Starts at <span className="font-mono text-navy-900">${bundle.target_monthly_fee.toLocaleString()}/mo</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CompareCard
          tone="green"
          eyebrow="Distributor Branded bundle"
          title="Use when the customer fits a defined program"
          bullets={[
            'Sell the full beverage program, not just a machine.',
            'Best for accounts that match one of the defined bundle paths in the app.',
            'Easier distributor alignment, cleaner rollout, clearer expectations.',
            'The value story is program outcome, consistency, and support.',
          ]}
        />
        <CompareCard
          tone="navy"
          eyebrow="General sale, finance, or lease"
          title="Use when the customer needs flexibility"
          bullets={[
            'Best for custom equipment mixes or nonstandard structures.',
            'Better when the account should not be forced into a standardized bundle.',
            'The value story is exact equipment fit and payment structure.',
            'Use this when a custom answer is better than a packaged program.',
          ]}
        />
      </section>

      <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {BUNDLES_GUIDE_SECTIONS.filter((section) => ['calculation', 'why-different', 'how-to-sell'].includes(section.id)).map((section) => (
          <InfoCard key={section.id} section={section} />
        ))}
      </section>

      <section className="mb-8 bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
            Process after submission
          </p>
          <h2 className="text-2xl font-light text-slate-900">
            How the deal moves through the system
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {BUNDLES_GUIDE_SECTIONS.find((section) => section.id === 'process-after-submit')?.steps?.map((step, idx) => (
            <div key={step.title} className="rounded-2xl border border-page-200 bg-page-50 p-4">
              <div className="w-8 h-8 rounded-full bg-navy-900 text-chalk-50 text-sm font-semibold flex items-center justify-center mb-3">
                {idx + 1}
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{step.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
            Rep responsibilities
          </p>
          <h2 className="text-2xl font-light text-slate-900">
            What the sales rep owns in the process
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {BUNDLES_GUIDE_SECTIONS.find((section) => section.id === 'rep-responsibilities')?.cards?.map((card) => (
            <div key={card.eyebrow} className="rounded-2xl border border-page-200 p-4 bg-white">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">{card.eyebrow}</div>
              <h3 className="text-base font-medium text-slate-900 mb-3">{card.title}</h3>
              <ul className="space-y-2">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="text-sm text-slate-600 leading-relaxed flex gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CompareCard({ tone, eyebrow, title, bullets }) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50/70',
    navy: 'border-navy-200 bg-navy-50/70',
  };

  return (
    <div className={`rounded-3xl border p-5 md:p-6 ${tones[tone] || 'border-page-200 bg-white'}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">{eyebrow}</div>
      <h2 className="text-2xl font-light text-slate-900 mb-4">{title}</h2>
      <ul className="space-y-2.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="text-sm text-slate-700 leading-relaxed flex gap-2.5">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoCard({ section }) {
  return (
    <div className="bg-white border border-page-200 rounded-3xl p-5 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">
        {section.title}
      </div>
      <p className="text-sm text-slate-600 leading-relaxed mb-4">{section.intro}</p>
      <ul className="space-y-2.5">
        {section.bullets?.map((bullet) => (
          <li key={bullet} className="text-sm text-slate-700 leading-relaxed flex gap-2.5">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-navy-700 flex-shrink-0" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      {section.note && (
        <div className="mt-4 rounded-2xl bg-accent-50 border border-accent-200 p-3 text-sm text-accent-900 leading-relaxed">
          {section.note}
        </div>
      )}
    </div>
  );
}
