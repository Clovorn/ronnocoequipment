import RonnocoLogo from './RonnocoLogo.jsx';
import { signOut } from '../lib/useAuth.js';

const TABS = [
  { key: 'home',       label: 'Home',       routeName: 'home',       icon: HomeIcon },
  { key: 'catalog',    label: 'Catalog',    routeName: 'catalog',    icon: CatalogIcon },
  { key: 'bundles',    label: 'Bundles',    routeName: 'bundles',    icon: BundlesIcon },
  { key: 'favorites',  label: 'Favorites',  routeName: 'favorites',  icon: StarIcon },
];

const ADMIN_TAB = { key: 'admin', label: 'Admin', routeName: 'admin', icon: AdminIcon };

/**
 * Shell takes a `routeName` (one of 'home','catalog','bundles','favorites','admin',
 * 'vendor','vendors','not-found') and a `navigate(name, params)` function.
 * It highlights the corresponding tab. Vendor / vendors pages bucket under 'home'
 * for navigation highlighting since they're reached from there.
 */
export default function Shell({ profile, session, routeName, navigate, children }) {
  const role = profile?.role || 'sales';
  const isAdmin = role === 'admin' || role === 'director';
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;
  const roleLabel = { admin: 'Admin', director: 'Director', sales: 'Sales', customer: 'Customer' }[role];

  // For highlighting, treat vendor sub-pages as part of 'home'
  const activeTab =
    routeName === 'vendor' || routeName === 'vendors' ? 'home' : routeName;

  return (
    <div className="min-h-screen bg-page-50 pb-16 md:pb-0">
      <header className="bg-navy-900 text-chalk-50 shadow-navbar sticky top-0 z-30">
        <div className="px-4 md:px-6 lg:px-10 py-3 md:py-4 flex items-center justify-between gap-4">
          <button onClick={() => navigate('home')}
                  className="flex items-center gap-4 group" aria-label="Go to home">
            <RonnocoLogo variant="on-dark" />
            <div className="hidden md:block h-6 w-px bg-chalk-50/15" />
            <div className="hidden md:block">
              <div className="text-xs uppercase tracking-[0.18em] text-chalk-300 group-hover:text-chalk-50 transition-colors font-medium">
                Equipment Catalog
              </div>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => navigate(t.routeName)}
                      className={`px-3 py-1.5 text-sm rounded transition-colors font-medium
                        ${activeTab === t.key
                          ? 'bg-white/10 text-chalk-50'
                          : 'text-chalk-200 hover:text-chalk-50 hover:bg-white/5'}`}>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-chalk-50 leading-tight">
                {profile?.display_name || session.user.email}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-chalk-300 font-medium">
                {roleLabel}
              </div>
            </div>
            <button onClick={() => signOut()}
                    className="text-sm text-chalk-200 hover:text-chalk-50 transition-colors
                               px-2 sm:px-3 py-1.5 hover:bg-white/5 rounded"
                    aria-label="Sign out" title="Sign out">
              <span className="hidden sm:inline">Sign out</span>
              <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="hidden md:flex px-6 lg:px-10 py-6 mt-12 border-t border-page-200 text-xs text-slate-500 justify-between">
        <span>Ronnoco Equipment Catalog · v0.3</span>
        <span className="font-mono">{new Date().getFullYear()}</span>
      </footer>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-page-200 z-40
                      shadow-[0_-2px_8px_rgba(10,31,61,0.05)]">
        <div className={`grid ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => navigate(t.routeName)}
                      className={`py-2.5 flex flex-col items-center gap-0.5 transition-colors
                        ${active ? 'text-navy-900' : 'text-slate-500 hover:text-slate-700'}`}
                      aria-label={t.label}>
                <Icon active={active} />
                <span className={`text-[10px] uppercase tracking-wider font-medium
                                  ${active ? 'text-navy-900' : 'text-slate-500'}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HomeIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" />
    </svg>
  );
}
function CatalogIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function BundlesIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
function StarIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}
function AdminIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
