import { supabaseMissing } from './lib/supabase.js';
import { useAuth, signOut } from './lib/useAuth.js';
import LoginScreen from './components/LoginScreen.jsx';
import CatalogBrowser from './components/CatalogBrowser.jsx';

export default function App() {
  if (supabaseMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 p-6">
        <div className="max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-ink-900 text-cream-50 flex items-center justify-center font-serif text-xl mx-auto mb-4">
            R
          </div>
          <h1 className="font-serif text-2xl text-ink-900 mb-2">Configuration Required</h1>
          <p className="text-ink-600 text-sm leading-relaxed">
            The Supabase environment variables are not set.
            Add <code className="font-mono text-copper-600 bg-cream-100 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono text-copper-600 bg-cream-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to
            your Netlify site's environment variables, then redeploy.
          </p>
        </div>
      </div>
    );
  }

  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-ink-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  // Customers see a different view (placeholder for now)
  const role = profile?.role || 'sales';
  const canEdit = role === 'admin' || role === 'director';

  if (role === 'customer') {
    return (
      <Shell profile={profile} session={session}>
        <div className="p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500 mb-1">
            Customer Portal
          </p>
          <h1 className="font-serif text-3xl text-ink-900 mb-4">Your Quotes</h1>
          <p className="text-ink-600">
            Quote viewer coming soon. You'll see your active and archived quotes here.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell profile={profile} session={session}>
      <CatalogBrowser canEdit={canEdit} />
    </Shell>
  );
}

function Shell({ profile, session, children }) {
  const role = profile?.role || 'sales';
  const roleLabel = {
    admin: 'Admin',
    director: 'Director',
    sales: 'Sales',
    customer: 'Customer',
  }[role];

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="border-b border-cream-200 bg-cream-50/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 lg:px-10 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-ink-900 text-cream-50 flex items-center justify-center font-serif text-base">
              R
            </div>
            <div>
              <div className="font-serif text-lg text-ink-900 leading-none">Ronnoco</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
                Equipment Catalog
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-ink-900">
                {profile?.display_name || session.user.email}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-copper-600 font-medium">
                {roleLabel}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="text-sm text-ink-600 hover:text-ink-900 transition-colors
                         px-3 py-1.5 hover:bg-cream-100 rounded-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="px-6 lg:px-10 py-6 mt-12 border-t border-cream-200 text-xs text-ink-500 flex justify-between">
        <span>Ronnoco Equipment Catalog · v0.1</span>
        <span className="font-mono">{new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
