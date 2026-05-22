import { useAuth } from './lib/useAuth.js';
import { useRouter } from './lib/useRouter.js';
import LoginScreen from './components/LoginScreen.jsx';
import Shell from './components/Shell.jsx';
import Home from './components/Home.jsx';
import CatalogBrowser from './components/CatalogBrowser.jsx';
import BundlesBrowser from './components/BundlesBrowser.jsx';
import VendorPage from './components/VendorPage.jsx';
import VendorsDirectory from './components/VendorsDirectory.jsx';
import AdminHome from './components/admin/AdminHome.jsx';
import AnnouncementsAdmin from './components/admin/AnnouncementsAdmin.jsx';
import BundlesAdmin from './components/admin/BundlesAdmin.jsx';
import VendorsAdmin from './components/admin/VendorsAdmin.jsx';
import HeroAdmin from './components/admin/HeroAdmin.jsx';
import DealBuilder from './components/DealBuilder.jsx';
import RonnocoLogo from './components/RonnocoLogo.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function App() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return <ConfigurationRequired />;
  }

  const { session, profile, loading } = useAuth();
  const { route, navigate } = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-50">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  const role = profile?.role || 'sales';
  const canEdit = role === 'admin' || role === 'director';
  const isAdmin = canEdit;
  const userId = session.user.id;

  // Customer view — restricted, no catalog/vendor access
  if (role === 'customer') {
    return (
      <Shell profile={profile} session={session} routeName="home" navigate={navigate}>
        <div className="px-4 md:px-10 py-10">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
            Customer Portal
          </p>
          <h1 className="text-2xl md:text-3xl font-light text-slate-900 mb-4">Your Quotes</h1>
          <p className="text-slate-600">
            Quote viewer coming soon. You'll see your active and archived quotes here.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell profile={profile} session={session} routeName={route.name} navigate={navigate}>
      {route.name === 'home' && (
        <Home navigate={navigate} profile={profile} />
      )}

      {route.name === 'catalog' && (
        <CatalogBrowser canEdit={canEdit} role={role} userId={userId} />
      )}

      {route.name === 'bundles' && (
        <BundlesBrowser canEdit={canEdit} />
      )}

      {route.name === 'favorites' && (
        <CatalogBrowser canEdit={canEdit} role={role} userId={userId} favoritesOnly={true} />
      )}

      {route.name === 'vendor' && (
        <VendorPage
          slug={route.params.slug}
          navigate={navigate}
          canEdit={canEdit}
          role={role}
          userId={userId}
        />
      )}

      {route.name === 'vendors' && (
        <VendorsDirectory navigate={navigate} />
      )}

      {route.name === 'deal' && (
        <DealBuilder profile={profile} session={session} navigate={navigate} />
      )}

      {route.name === 'admin' && isAdmin && (
        <>
          {!route.params.section && <AdminHome onNavigate={(s) => navigate('admin', { section: s })} />}
          {route.params.section === 'hero' && (
            <HeroAdmin onBack={() => navigate('admin')} userId={userId} />
          )}
          {route.params.section === 'announcements' && (
            <AnnouncementsAdmin onBack={() => navigate('admin')} userId={userId} />
          )}
          {route.params.section === 'bundles' && (
            <BundlesAdmin onBack={() => navigate('admin')} userId={userId} />
          )}
          {route.params.section === 'vendors' && (
            <VendorsAdmin onBack={() => navigate('admin')} />
          )}
        </>
      )}

      {route.name === 'admin' && !isAdmin && (
        <div className="px-4 md:px-10 py-10 text-center">
          <p className="text-slate-500">You don't have access to this section.</p>
        </div>
      )}

      {route.name === 'not-found' && (
        <div className="px-4 md:px-10 py-10 max-w-2xl">
          <h1 className="text-2xl font-light text-slate-900 mb-2">Page not found</h1>
          <p className="text-slate-600 text-sm mb-4">
            The URL <code className="bg-page-100 px-1.5 py-0.5 rounded font-mono text-xs">{route.params.path}</code> doesn't exist.
          </p>
          <button onClick={() => navigate('home')}
                  className="text-sm text-navy-700 hover:text-navy-900 font-medium">
            ← Back to home
          </button>
        </div>
      )}
    </Shell>
  );
}

function ConfigurationRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-page-50">
      <div className="max-w-md bg-white border border-page-200 rounded-lg shadow-card p-8">
        <RonnocoLogo variant="on-light" className="mb-6" />
        <h1 className="text-xl font-medium text-slate-900 mb-3">Configuration required</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          The Supabase environment variables are not set. Add{' '}
          <code className="bg-page-100 px-1.5 py-0.5 rounded text-xs font-mono">VITE_SUPABASE_URL</code>{' '}
          and{' '}
          <code className="bg-page-100 px-1.5 py-0.5 rounded text-xs font-mono">VITE_SUPABASE_ANON_KEY</code>{' '}
          to your Netlify site's environment variables, then redeploy.
        </p>
      </div>
    </div>
  );
}
