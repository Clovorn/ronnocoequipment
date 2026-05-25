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
                  A complete beverage program through your distributor
                </h1>
                <p className="text-sm md:text-base print:text-sm text-chalk-100/90 leading-relaxed max-w-3xl">
                  The Distributor Program gives your business access to new beverage equipment, ongoing service support, and digital media delivery through a professionally supported program, without forcing you to manage every piece separately.
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
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-5 print:gap-4">
              <div className="space-y-5 print:space-y-4">
                <section className="bg-white border border-page-200 rounded-3xl p-5 print:p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                    Why this program is a great option
                  </p>
                  <h2 className="text-2xl print:text-xl font-light text-slate-900 mb-3">
                    A simpler way to build a better beverage business
                  </h2>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed mb-3">
                    Instead of making a large upfront equipment investment or trying to coordinate multiple vendors, customers can build a stronger beverage program through the distributor relationship they already use.
                  </p>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                    The program is designed to help locations look better, operate more consistently, and sell more beverage products through a complete, professionally supported solution.
                  </p>
                </section>

                <section className="bg-accent-500/5 border border-accent-500/20 rounded-3xl p-5 print:p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent-700 mb-2 font-semibold">
                    How the program works
                  </p>
                  <h2 className="text-2xl print:text-xl font-light text-slate-900 mb-3">
                    A complete program, not separate pieces
                  </h2>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                    New equipment helps improve reliability and presentation. Digital media helps promote beverage offerings directly at the point of sale. Service support helps keep the program running properly. Together, these pieces create a stronger customer experience and a more professional in-store beverage destination.
                  </p>
                </section>
              </div>

              <div className="space-y-5 print:space-y-4">
                <section className="bg-page-50 border border-page-200 rounded-3xl p-5 print:p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                    What customers receive
                  </p>
                  <h2 className="text-2xl print:text-xl font-light text-slate-900 mb-3">
                    Program benefits
                  </h2>
                  <ul className="space-y-2.5">
                    <Bullet text="New beverage equipment" />
                    <Bullet text="Digital beverage media delivery" />
                    <Bullet text="Service support while in compliance" />
                    <Bullet text="A simple ordering path through the distributor" />
                    <Bullet text="A more professional in-store beverage presentation" />
                    <Bullet text="A scalable program for single or multi-location operators" />
                    <Bullet text="A better way to grow beverage sales without overcomplicating the process" />
                  </ul>
                </section>

                <section className="bg-white border border-page-200 rounded-3xl p-5 print:p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                    Program compliance
                  </p>
                  <h2 className="text-2xl print:text-xl font-light text-slate-900 mb-3">
                    Ongoing support stays connected to the program
                  </h2>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                    As long as the location remains in compliance with the program agreement, including purchasing approved beverage products through the required distributor or program channel, the included benefits continue. Equipment, service, and media support are all tied to supporting the beverage program.
                  </p>
                </section>
              </div>
            </div>

            <section className="mt-5 print:mt-4 border-t border-page-200 pt-4 bg-navy-50/70 rounded-3xl px-5 pb-5 print:px-4 print:pb-4">
              <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] print:grid-cols-2 gap-4 items-start">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                    Note from your sales representative
                  </p>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                    Our goal is not just to place equipment in your location. Our goal is to help you build a beverage program that looks better, runs smoother, and sells more product. I would be glad to review your goals, recommend the right equipment package, and prepare a quote tailored to your business.
                  </p>
                </div>

                <div className="bg-white border border-page-200 rounded-2xl p-4 print:p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1.5 font-medium">
                    Your Ronnoco Representative
                  </p>
                  <div className="text-base print:text-sm font-medium text-slate-900">{repName}</div>
                  <div className="text-sm print:text-[12px] text-slate-600">{repTitle}</div>
                  <div className="text-sm print:text-[12px] text-slate-700 mt-2 leading-relaxed">
                    Contact me to review program options, discuss the right beverage setup for your location, and receive a quote tailored to your business goals.
                  </div>
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

function Bullet({ text }) {
  return (
    <li className="text-sm print:text-[12px] text-slate-700 leading-relaxed flex gap-2.5">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-600 flex-shrink-0" />
      <span>{text}</span>
    </li>
  );
}
