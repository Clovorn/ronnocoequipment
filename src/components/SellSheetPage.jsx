import RonnocoLogo from './RonnocoLogo.jsx';

export default function SellSheetPage({ navigate, profile, session }) {
  const repName = profile?.display_name || session?.user?.email || 'Your Ronnoco Representative';
  const repTitle = profile?.title || 'Sales Representative';
  const repEmail = session?.user?.email || '';
  const repPhone = profile?.phone || '';

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6 print:px-0 print:py-0">
      <div className="max-w-6xl mx-auto bg-white print:max-w-none">
        <div className="rounded-3xl overflow-hidden border border-page-200 shadow-card print:shadow-none print:border-0 print:rounded-none">
          <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-accent-700 text-chalk-50 p-6 md:p-7 print:p-5">
            <div className="flex items-start justify-between gap-6">
              <div className="max-w-4xl">
                <p className="text-xs uppercase tracking-[0.18em] text-chalk-300 mb-2 font-medium">
                  Customer Sell Sheet
                </p>
                <h1 className="text-3xl md:text-4xl print:text-3xl font-light leading-tight mb-3">
                  A complete beverage program designed to support your business
                </h1>
                <p className="text-sm md:text-base print:text-sm text-chalk-100/90 leading-relaxed max-w-3xl">
                  Ronnoco programs combine equipment, service, and digital marketing support into one complete solution built to help create a stronger beverage experience for your customers.
                </p>
              </div>
              <div className="flex-shrink-0 hidden sm:block print:block">
                <RonnocoLogo variant="on-dark" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3 print:hidden">
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

          <div className="p-5 md:p-6 print:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 print:gap-4">
              <div className="space-y-5 print:space-y-4">
                <section className="bg-white border border-page-200 rounded-3xl p-5 print:p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                    Program overview
                  </p>
                  <h2 className="text-2xl print:text-xl font-light text-slate-900 mb-3">
                    What the program offers
                  </h2>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed mb-4">
                    This program is for customers who want more than equipment alone. It brings together beverage equipment, service, and marketing support in one coordinated solution.
                  </p>

                  <div className="space-y-3">
                    <MiniCard
                      title="Equipment"
                      text="Selected to support the customer’s beverage offering and day-to-day operation."
                    />
                    <MiniCard
                      title="Service"
                      text="Included when the customer remains in compliance with the service agreement."
                    />
                    <MiniCard
                      title="Marketing"
                      text="Digital marketing support can help strengthen product visibility and customer engagement."
                    />
                  </div>
                </section>

                <section className="bg-accent-500/5 border border-accent-500/20 rounded-3xl p-5 print:p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent-700 mb-2 font-semibold">
                    Service and support
                  </p>
                  <h2 className="text-2xl print:text-xl font-light text-slate-900 mb-3">
                    How the program works
                  </h2>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                    Customers in the program receive equipment service and ongoing marketing support throughout the lease term when they remain in compliance with the Supply, Service & Marketing Agreement.
                  </p>
                </section>
              </div>

              <div className="space-y-5 print:space-y-4">
                <section className="bg-page-50 border border-page-200 rounded-3xl p-5 print:p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                    Why customers choose it
                  </p>
                  <h2 className="text-2xl print:text-xl font-light text-slate-900 mb-3">
                    A stronger overall solution
                  </h2>
                  <ul className="space-y-2.5">
                    <Bullet text="A more complete beverage program, not just a piece of equipment" />
                    <Bullet text="One coordinated approach to equipment, service, and marketing" />
                    <Bullet text="A stronger experience for both operators and end customers" />
                    <Bullet text="Well suited for customers focused on growing beverage sales" />
                  </ul>
                </section>

                <section className="bg-white border border-page-200 rounded-3xl p-5 print:p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                    Best fit
                  </p>
                  <h2 className="text-2xl print:text-xl font-light text-slate-900 mb-3">
                    Who this program is for
                  </h2>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                    This solution is ideal for customers who want a more complete beverage program and are looking for a structured way to support equipment performance, customer experience, and beverage growth.
                  </p>
                </section>

                <section className="bg-white border border-page-200 rounded-3xl p-5 print:p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                    Next step
                  </p>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                    Your Ronnoco sales representative can provide a quote tailored to your program, equipment needs, and business goals.
                  </p>
                </section>
              </div>
            </div>

            <section className="mt-5 print:mt-4 border-t border-page-200 pt-4 bg-navy-50/70 rounded-3xl px-5 pb-5 print:px-4 print:pb-4">
              <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-4 items-start">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                    Note from your sales representative
                  </p>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                    Thank you for the opportunity to share this program with you. We would be glad to review your goals, recommend the right equipment package, and prepare a quote tailored to your location and business needs.
                  </p>
                </div>

                <div className="bg-white border border-page-200 rounded-2xl p-4 print:p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1.5 font-medium">
                    Your Ronnoco Representative
                  </p>
                  <div className="text-base print:text-sm font-medium text-slate-900">{repName}</div>
                  <div className="text-sm print:text-[12px] text-slate-600">{repTitle}</div>
                  {repEmail && <div className="text-sm print:text-[12px] text-slate-700 mt-2">{repEmail}</div>}
                  {repPhone && <div className="text-sm print:text-[12px] text-slate-700">{repPhone}</div>}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ title, text }) {
  return (
    <div className="rounded-2xl border border-page-200 bg-page-50 p-4 print:p-3">
      <h3 className="text-base print:text-sm font-medium text-slate-900 mb-1.5">{title}</h3>
      <p className="text-sm print:text-[12px] text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

function Bullet({ text }) {
  return (
    <li className="text-sm print:text-[12px] text-slate-700 leading-relaxed flex gap-2.5">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" />
      <span>{text}</span>
    </li>
  );
}
