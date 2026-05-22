export default function AdminHome({ onNavigate }) {
  const cards = [
    {
      key: 'announcements',
      title: 'Announcements',
      description: 'Manage promotions, special deals, and news posts shown above the catalog.',
      icon: AnnouncementsIcon,
    },
    {
      key: 'bundles',
      title: 'Bundles',
      description: 'Create and edit equipment bundles with included items and pricing.',
      icon: BundlesIcon,
    },
  ];

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6">
      <div className="mb-6 md:mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
          Admin
        </p>
        <h1 className="text-2xl md:text-3xl font-light text-slate-900">Manage content</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-3xl">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              onClick={() => onNavigate(card.key)}
              className="text-left bg-white border border-page-200 rounded-lg p-5 md:p-6
                         hover:border-navy-300 hover:shadow-card transition-all
                         active:bg-navy-50"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-navy-900 text-chalk-50 flex items-center justify-center flex-shrink-0">
                  <Icon />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-medium text-slate-900 mb-1">{card.title}</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{card.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-10 max-w-3xl text-xs text-slate-500 leading-relaxed border-t border-page-200 pt-6">
        <p className="mb-2 font-medium text-slate-700">Coming soon</p>
        <ul className="space-y-1">
          <li>• User management — add reps, set roles, deactivate accounts</li>
          <li>• Vendor link templates — edit auto-resolved URL patterns per vendor</li>
          <li>• Price history audit log — review equipment price changes over time</li>
          <li>• Bulk import / export — CSV updates to the catalog</li>
        </ul>
      </div>
    </div>
  );
}

function AnnouncementsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  );
}

function BundlesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
