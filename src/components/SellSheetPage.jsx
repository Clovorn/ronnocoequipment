import RonnocoLogo from './RonnocoLogo.jsx';
import { DISTRIBUTOR_PROGRAM_BENEFITS, DISTRIBUTOR_PROGRAM_COMPLIANCE } from '../help/distributorProgramMessaging.js';

export default function SellSheetPage({ navigate, profile, session }) {
  const repName = profile?.display_name || session?.user?.email || 'Your Ronnoco Representative';
  const repTitle = profile?.title || 'Sales Representative';
  const repEmail = session?.user?.email || '';
  const repPhone = profile?.phone || '';
  const primaryBenefits = DISTRIBUTOR_PROGRAM_BENEFITS.slice(0, 5);

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6 print:px-0 print:py-0">
      <div className="max-w-5xl mx-auto bg-white print:max-w-none">
        <div className="rounded-3xl overflow-hidden border border-page-200 shadow-card print:shadow-none print:border-0 print:rounded-none">
          <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-accent-700 text-chalk-50 px-6 py-5 md:px-7 md:py-6 print:px-5 print:py-4">
            <div className="flex items-start justify-between gap-6">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.18em] text-chalk-300 mb-2 font-medium">
                  Customer Sell Sheet
                </p>
                <h1 className="text-2xl md:text-3xl print:text-2xl font-light leading-tight mb-2.5">
                  A complete beverage program through your distributor
                </h1>
                <p className="text-sm print:text-[12px] text-chalk-100/90 leading-relaxed max-w-2xl">
                  New equipment, digital media, and ongoing support in one professionally managed beverage program.
                </p>
              </div>
              <div className="flex-shrink-0 hidden sm:block print:block">
                <RonnocoLogo variant="on-dark" />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 print:hidden">
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

          <div className="p-4 md:p-5 print:p-3.5">
            <section className="mb-4 print:mb-3 bg-navy-50/70 border border-page-200 rounded-2xl p-4 print:p-3">
              <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] print:grid-cols-[1.2fr_0.8fr] gap-3 items-start">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1.5 font-medium">
                    Note from your sales representative
                  </p>
                  <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                    This program is designed to help your location improve beverage presentation, simplify equipment support,
                    and create a stronger beverage business through one distributor-supported program.
                  </p>
                </div>

                <div className="bg-white border border-page-200 rounded-2xl p-3 print:p-2.5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
                    Your Ronnoco Representative
                  </p>
                  <div className="text-sm font-semibold text-slate-900">{repName}</div>
                  <div className="text-sm print:text-[12px] text-slate-600">{repTitle}</div>
                  {repEmail && <div className="text-sm print:text-[12px] text-slate-700 mt-1.5 break-all">{repEmail}</div>}
                  {repPhone && <div className="text-sm print:text-[12px] text-slate-700">{repPhone}</div>}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4 print:gap-3">
              <section className="bg-white border border-page-200 rounded-2xl p-4 print:p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                  Why customers choose it
                </p>
                <h2 className="text-xl print:text-lg font-light text-slate-900 mb-2.5">
                  A simpler way to build a better beverage program
                </h2>
                <div className="space-y-2.5 text-sm print:text-[12px] text-slate-700 leading-relaxed">
                  <p>
                    Instead of coordinating separate equipment, service, and merchandising needs, customers can move forward with one supported beverage program.
                  </p>
                  <p>
                    The goal is to help the location look better, run more consistently, and sell more beverage products.
                  </p>
                </div>
              </section>

              <section className="bg-page-50 border border-page-200 rounded-2xl p-4 print:p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                  What the program includes
                </p>
                <ul className="space-y-2">
                  {primaryBenefits.map((item) => (
                    <Bullet key={item} text={item} />
                  ))}
                </ul>
              </section>

              <section className="bg-accent-500/5 border border-accent-500/20 rounded-2xl p-4 print:p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-accent-700 mb-2 font-semibold">
                  How it works
                </p>
                <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                  This is more than equipment alone. It combines beverage equipment, digital media support, and service support into one complete distributor-backed program.
                </p>
              </section>

              <section className="bg-white border border-page-200 rounded-2xl p-4 print:p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2 font-medium">
                  Program compliance
                </p>
                <p className="text-sm print:text-[12px] text-slate-700 leading-relaxed">
                  {DISTRIBUTOR_PROGRAM_COMPLIANCE}
                </p>
              </section>
            </div>
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
