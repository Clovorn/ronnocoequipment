export default function BundlesGuidePage({ bundles = [], navigate }) {
  const featuredBundles = bundles.filter((b) => b.image_url).slice(0, 6);

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-accent-700 text-chalk-50 p-6 md:p-8 shadow-card mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-chalk-300 mb-2 font-medium">
          Simple Bundles Guide
        </p>
        <h1 className="text-3xl md:text-4xl font-light leading-tight mb-3">
          Distributor Bundle Deal = choose a Distributor Program in the deal sheet
        </h1>
        <p className="text-sm md:text-base text-chalk-100/90 leading-relaxed max-w-4xl">
          Keep this simple. If the rep selects a <strong>Distributor Program</strong> in the deal sheet, the rep is building a <strong>Distributor Bundle Deal</strong>. If no Distributor Program is selected, it is a general deal.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => navigate?.('bundles')}
            className="px-4 py-2 rounded bg-white text-navy-900 text-sm font-medium hover:bg-chalk-50 transition-colors"
          >
            Back to Bundles
          </button>
        </div>
      </div>

      <section className="mb-6 bg-amber-50 border border-amber-200 rounded-3xl p-5 md:p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-amber-800 mb-2 font-semibold">
          The one big rule
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SimpleRuleCard
            emoji="📦"
            title="Distributor Program selected"
            subtitle="This is a Distributor Bundle Deal"
            bullets={[
              'Rep picked a Distributor Program in the deal sheet.',
              'The deal follows the bundle structure.',
              'The rep is selling the full program, not just loose equipment.',
            ]}
            tone="amber"
          />
          <SimpleRuleCard
            emoji="🧾"
            title="No Distributor Program selected"
            subtitle="This is a general deal"
            bullets={[
              'Rep is building a custom sale, finance, lease, or other standard deal.',
              'The deal is not tied to a program bundle.',
              'The rep is selling the equipment and terms directly.',
            ]}
            tone="slate"
          />
        </div>
      </section>

      <section className="mb-6 bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
          See it fast
        </p>
        <h2 className="text-2xl font-light text-slate-900 mb-4">
          Think of it like this
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FlowStep emoji="1️⃣" title="Open deal sheet" text="Start the deal normally." />
          <FlowStep emoji="2️⃣" title="Select Distributor Program" text="The moment the rep chooses the program, the deal becomes a Distributor Bundle Deal." />
          <FlowStep emoji="3️⃣" title="Build and submit" text="Now the rep finishes the bundle deal and sends it through the system." />
        </div>
      </section>

      {featuredBundles.length > 0 && (
        <section className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
            Bundle examples
          </p>
          <h2 className="text-2xl font-light text-slate-900 mb-4">
            These are bundle deals when used as Distributor Programs
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {featuredBundles.map((bundle) => (
              <div key={bundle.id} className="bg-white border border-page-200 rounded-2xl p-3 shadow-sm">
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-page-100 mb-3 flex items-center justify-center">
                  <img src={bundle.image_url} alt={bundle.name} className="w-full h-full object-contain" />
                </div>
                <div className="text-sm font-medium text-slate-900 leading-snug">{bundle.name}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SimpleCompareCard
          emoji="📦"
          title="Distributor Bundle Deal"
          subtitle="Program selected"
          bullets={[
            'Built from the Distributor Program choice in the deal sheet.',
            'Uses the bundle structure.',
            'Best for reps who need a simple, repeatable path.',
            'Sell the program story: easier, cleaner, more complete.',
          ]}
          tone="emerald"
        />
        <SimpleCompareCard
          emoji="🧩"
          title="General Deal"
          subtitle="No program selected"
          bullets={[
            'Built without a Distributor Program.',
            'Used for custom needs.',
            'Best when the account does not fit a bundle.',
            'Sell the custom equipment and terms story.',
          ]}
          tone="navy"
        />
      </section>

      <section className="mb-6 bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
          How to explain pricing
        </p>
        <h2 className="text-2xl font-light text-slate-900 mb-4">
          Keep the pricing explanation short
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VisualNote
            emoji="📦"
            title="Bundle deal"
            text="The program helps define the deal. The rep is not just building a random equipment quote. The bundle setup drives the deal structure."
          />
          <VisualNote
            emoji="🧾"
            title="General deal"
            text="The rep is building the deal from the equipment and terms directly, without using a Distributor Program as the starting point."
          />
        </div>
      </section>

      <section className="mb-6 bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
          After submission
        </p>
        <h2 className="text-2xl font-light text-slate-900 mb-4">
          What happens next
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <FlowStep emoji="📝" title="Rep submits deal" text="The rep finishes the deal sheet and sends it forward." />
          <FlowStep emoji="📤" title="Deal moves into system" text="The deal leaves the sales screen and enters workflow." />
          <FlowStep emoji="🔄" title="Team processes it" text="Leasing, finance, or operations takes the next steps." />
          <FlowStep emoji="✅" title="Customer gets fulfilled" text="The deal moves toward approval, setup, and install." />
        </div>
      </section>

      <section className="bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
          Rep responsibilities
        </p>
        <h2 className="text-2xl font-light text-slate-900 mb-4">
          What the rep needs to do
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChecklistCard
            emoji="🎯"
            title="Pick the right path"
            bullets={[
              'If the rep selects a Distributor Program, it is a bundle deal.',
              'If the account is not a fit, do not force a bundle.',
            ]}
          />
          <ChecklistCard
            emoji="✍️"
            title="Fill it out clearly"
            bullets={[
              'Make sure the deal sheet is complete.',
              'Use clean notes and correct details.',
            ]}
          />
          <ChecklistCard
            emoji="🤝"
            title="Stay with the account"
            bullets={[
              'Help move the customer forward after submission.',
              'Answer questions and clear blockers fast.',
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function SimpleRuleCard({ emoji, title, subtitle, bullets, tone = 'slate' }) {
  const tones = {
    amber: 'bg-white border-amber-200',
    slate: 'bg-white border-slate-200',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <div className="text-3xl mb-2">{emoji}</div>
      <h3 className="text-lg font-medium text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mb-3">{subtitle}</p>
      <ul className="space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="text-sm text-slate-700 leading-relaxed flex gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SimpleCompareCard({ emoji, title, subtitle, bullets, tone = 'emerald' }) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50/70',
    navy: 'border-navy-200 bg-navy-50/70',
  };

  return (
    <div className={`rounded-3xl border p-5 md:p-6 ${tones[tone] || 'border-page-200 bg-white'}`}>
      <div className="text-3xl mb-3">{emoji}</div>
      <h2 className="text-2xl font-light text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mb-4">{subtitle}</p>
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

function FlowStep({ emoji, title, text }) {
  return (
    <div className="rounded-2xl border border-page-200 bg-page-50 p-4">
      <div className="text-3xl mb-3">{emoji}</div>
      <h3 className="text-base font-medium text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

function VisualNote({ emoji, title, text }) {
  return (
    <div className="rounded-2xl border border-page-200 p-4 bg-page-50">
      <div className="text-3xl mb-3">{emoji}</div>
      <h3 className="text-base font-medium text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

function ChecklistCard({ emoji, title, bullets }) {
  return (
    <div className="rounded-2xl border border-page-200 p-4 bg-white">
      <div className="text-3xl mb-3">{emoji}</div>
      <h3 className="text-base font-medium text-slate-900 mb-3">{title}</h3>
      <ul className="space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="text-sm text-slate-600 leading-relaxed flex gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
