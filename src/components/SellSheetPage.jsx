import RonnocoLogo from './RonnocoLogo.jsx';

export default function SellSheetPage({ navigate }) {
  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-accent-700 text-chalk-50 p-6 md:p-8 shadow-card mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.18em] text-chalk-300 mb-2 font-medium">
              Customer Sell Sheet
            </p>
            <h1 className="text-3xl md:text-4xl font-light leading-tight mb-3">
              A complete beverage program, not just equipment
            </h1>
            <p className="text-sm md:text-base text-chalk-100/90 leading-relaxed">
              Ronnoco programs combine equipment, service, and digital marketing support into one customer-ready program structure. This sheet gives sales reps a simple overview they can send before or alongside a quote.
            </p>
          </div>
          <div className="flex-shrink-0">
            <RonnocoLogo variant="on-dark" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => navigate?.('home')}
            className="px-4 py-2 rounded bg-white text-navy-900 text-sm font-medium hover:bg-chalk-50 transition-colors"
          >
            Back to Home
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded border border-white/20 bg-white/10 text-chalk-50 text-sm font-medium hover:bg-white/15 transition-colors"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 mb-6">
        <div className="bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
            Program overview
          </p>
          <h2 className="text-2xl font-light text-slate-900 mb-4">
            What the program gives the customer
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed mb-5">
            This is designed for customers who want more than equipment alone. The program brings together beverage equipment, ongoing service, and digital marketing support in one structured monthly solution.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoCard
              title="Equipment"
              text="Program equipment is selected to support the customer’s beverage offering and business goals."
            />
            <InfoCard
              title="Service"
              text="Service is included when the customer is in compliance with the service agreement."
            />
            <InfoCard
              title="Digital marketing"
              text="Ronnoco digital media and marketing can include delivery to customer-installed screens."
            />
          </div>
        </div>

        <div className="bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
            Why customers choose it
          </p>
          <h2 className="text-2xl font-light text-slate-900 mb-4">
            Simple value story
          </h2>
          <ul className="space-y-3">
            <Bullet text="One monthly program structure instead of disconnected pieces" />
            <Bullet text="Equipment, service, and marketing work together" />
            <Bullet text="A stronger customer experience than equipment-only selling" />
            <Bullet text="Best fit for customers in compliance and producing $500 or more per month in coffee sales" />
          </ul>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-accent-500/5 border border-accent-500/20 rounded-3xl p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-accent-700 mb-2 font-semibold">
            Service and marketing
          </p>
          <h2 className="text-2xl font-light text-slate-900 mb-4">
            How it works
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed mb-3">
            Customers in the program receive equipment service, digital media delivery, and marketing support during the lease term when they remain in compliance with the Supply, Service & Marketing Agreement.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            This allows the customer to benefit from a more complete beverage program, not just a piece of equipment on site.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-800 mb-2 font-semibold">
            Important note
          </p>
          <h2 className="text-2xl font-light text-slate-900 mb-4">
            Media outside Distributor Programs
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed mb-3">
            For DSD customers or individual customers wanting media services outside Distributor Programs, the customer must be a Ronnoco customer with enough volume to cover monthly media delivery.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            Monthly digital media delivery typically ranges from <strong>$30 to $70 per player</strong>. That cost is billed to Ronnoco and must be passed through to the customer.
          </p>
        </div>
      </section>

      <section className="bg-white border border-page-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
          Rep guidance
        </p>
        <h2 className="text-2xl font-light text-slate-900 mb-4">
          How sales reps should use this sheet
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <InfoCard
            title="Use early"
            text="Send this when a customer needs a simple explanation of the overall program before pricing details."
          />
          <InfoCard
            title="Use with quotes"
            text="This works well alongside a bundle quote or general quote when the customer needs more context."
          />
          <InfoCard
            title="Keep quotes specific"
            text="The actual quote should still contain customer-specific pricing, equipment, and next-step details."
          />
        </div>
      </section>
    </div>
  );
}

function InfoCard({ title, text }) {
  return (
    <div className="rounded-2xl border border-page-200 bg-page-50 p-4">
      <h3 className="text-base font-medium text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

function Bullet({ text }) {
  return (
    <li className="text-sm text-slate-700 leading-relaxed flex gap-2.5">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" />
      <span>{text}</span>
    </li>
  );
}
