export default function BundlesGuidePage({ bundles = [], navigate }) {
  const featuredBundles = bundles.filter((b) => b.image_url).slice(0, 6);

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-accent-700 text-chalk-50 p-6 md:p-8 shadow-card mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-chalk-300 mb-2 font-medium">
          Simple Bundles Guide
        </p>
        <h1 className="text-3xl md:text-4xl font-light leading-tight mb-3">
          Most deals go through distributors, but not every distributor deal is a program bundle
        </h1>
        <p className="text-sm md:text-base text-chalk-100/90 leading-relaxed max-w-4xl">
          Keep this simple. A customer can buy through a distributor <strong>without</strong> being in a Distributor Program. The big difference is this: <strong>Distributor Program bundle deals include media and service</strong>. General deals do not.
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

      <section className="mb-6 bg-emerald-50 border border-emerald-200 rounded-3xl p-5 md:p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-800 mb-2 font-semibold">
          The simple rule
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SimpleRuleCard
            emoji="📦"
            title="Distributor Program or Ronnoco Branded bundle program"
            subtitle="This is a bundle program deal"
            bullets={[
              'Customer is being sold into a real bundle program.',
              'Program includes digital media delivery, marketing, and service.',
              'This is the stronger sell when the customer is a fit.',
            ]}
            tone="emerald"
          />
          <SimpleRuleCard
            emoji="🧾"
            title="Regular distributor deal"
            subtitle="This is a general deal in the normal deal sheet"
            bullets={[
              'Customer may still buy through a distributor.',
              'But they are not in the Distributor Program or bundle program.',
              'No included digital media delivery, marketing, or bundled service from the program structure.',
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
          <FlowStep emoji="🤝" title="Selling through a distributor" text="This is normal. Most business works this way." />
          <FlowStep emoji="❓" title="Ask one question" text="Is this customer going into a bundle program, or is this just a regular deal through the distributor?" />
          <FlowStep emoji="➡️" title="Choose the path" text="Bundle program = program sell. No program = normal deal sheet." />
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SimpleCompareCard
          emoji="📣"
          title="Bundle Program Deal"
          subtitle="Distributor Program or Ronnoco Branded bundle program"
          bullets={[
            'Customer is put into a real program.',
            'Digital media delivery and marketing are included.',
            'Service is included when the customer stays in compliance with the service agreement.',
            'That is the selling point.',
            'Best when you want a cleaner, more complete program story.',
          ]}
          tone="emerald"
        />
        <SimpleCompareCard
          emoji="🛠️"
          title="General Deal"
          subtitle="Still may go through a distributor, but not in the program"
          bullets={[
            'Customer can still buy equipment through a distributor.',
            'Built in the normal deal sheet.',
            'No bundled program digital media or marketing.',
            'No bundled program service.',
            'Best when the customer wants equipment, but not the full program.',
          ]}
          tone="navy"
        />
      </section>

      <section className="mb-6 bg-amber-50 border border-amber-200 rounded-3xl p-5 md:p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-amber-800 mb-2 font-semibold">
          Main selling point
        </p>
        <h2 className="text-2xl font-light text-slate-900 mb-4">
          Why move a customer into the bundle program?
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <VisualNote
            emoji="📺"
            title="Digital media included"
            text="Distributor Programs include Ronnoco digital media delivery and marketing, including delivery to customer-installed screens. A general deal does not."
          />
          <VisualNote
            emoji="🧰"
            title="Service included"
            text="Service is included when the customer is in compliance with the service agreement. A general deal does not include this bundled service structure."
          />
          <VisualNote
            emoji="💡"
            title="Why push the program"
            text="You are not just selling equipment. You are selling a supported lease program with digital media, marketing, and service built in."
          />
        </div>
      </section>

      {featuredBundles.length > 0 && (
        <section className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
            Bundle examples
          </p>
          <h2 className="text-2xl font-light text-slate-900 mb-4">
            These can be sold as bundle program deals
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

      <section className="mb-6 bg-blue-50 border border-blue-200 rounded-3xl p-5 md:p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-blue-800 mb-2 font-semibold">
          Important extra rule
        </p>
        <h2 className="text-2xl font-light text-slate-900 mb-4">
          Media outside Distributor Programs
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VisualNote
            emoji="🚚"
            title="DSD customers"
            text="For DSD customers or individual customers wanting media services, the customer must be a Ronnoco customer with enough volume to cover monthly media delivery."
          />
          <VisualNote
            emoji="💵"
            title="Monthly media cost"
            text="Monthly digital media delivery typically costs about $30 to $70 per player, depending on setup."
          />
        </div>
      </section>

      <section className="mb-6 bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
          Which screen should the rep use?
        </p>
        <h2 className="text-2xl font-light text-slate-900 mb-4">
          Simple screen rule
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VisualNote
            emoji="📦"
            title="If selling the program"
            text="Use the bundle program path and sell the included media and service value."
          />
          <VisualNote
            emoji="📝"
            title="If not selling the program"
            text="Use the normal deal sheet, even if the customer is still buying through a distributor."
          />
        </div>
      </section>

      <section className="bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
          Rep reminder
        </p>
        <h2 className="text-2xl font-light text-slate-900 mb-4">
          What the rep should remember
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChecklistCard
            emoji="1️⃣"
            title="Distributor does not automatically mean program"
            bullets={[
              'A distributor deal can still be a normal general deal.',
              'Do not confuse distributor business with a program bundle sell.',
            ]}
          />
          <ChecklistCard
            emoji="2️⃣"
            title="Program is the upgrade"
            bullets={[
              'The bundle program is stronger because it includes media and service.',
              'That is the core selling point.',
            ]}
          />
          <ChecklistCard
            emoji="3️⃣"
            title="Use the right path"
            bullets={[
              'Program customer = bundle program deal.',
              'Non-program customer = normal deal sheet.',
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function SimpleRuleCard({ emoji, title, subtitle, bullets, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-white border-emerald-200',
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
