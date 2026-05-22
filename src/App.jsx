import { useState } from 'react';
import { useAuth } from './lib/useAuth.js';
import LoginScreen from './components/LoginScreen.jsx';
import Shell from './components/Shell.jsx';
import CatalogBrowser from './components/CatalogBrowser.jsx';
import BundlesBrowser from './components/BundlesBrowser.jsx';
import AdminHome from './components/admin/AdminHome.jsx';
import AnnouncementsAdmin from './components/admin/AnnouncementsAdmin.jsx';
import BundlesAdmin from './components/admin/BundlesAdmin.jsx';
import RonnocoLogo from './components/RonnocoLogo.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function App() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return <ConfigurationRequired />;
  }

  const { session, profile, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('catalog');
  const [adminPage, setAdminPage] = useState(null); // null | 'announcements' | 'bundles'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-50">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  const role = profile?.role || 'sales';
  const canEdit = role === 'admin' || role === 'director';
  const isAdmin = canEdit;
  const userId = session.user.id;

  // Customer-only view — no catalog access
  if (role === 'customer') {
    return (
      <Shell profile={profile} session={session}
             currentTab="catalog" onTabChange={() => {}}>
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

  function handleTabChange(tab) {
    setCurrentTab(tab);
    if (tab !== 'admin') setAdminPage(null);
  }

  return (
    <Shell
      profile={profile}
      session={session}
      currentTab={currentTab}
      onTabChange={handleTabChange}
    >
      {currentTab === 'catalog' && (
        <CatalogBrowser canEdit={canEdit} userId={userId} />
      )}

      {currentTab === 'bundles' && (
        <BundlesBrowser canEdit={canEdit} />
      )}

      {currentTab === 'favorites' && (
        <CatalogBrowser
          canEdit={canEdit}
          userId={userId}
          favoritesOnly={true}
          showAnnouncements={false}
        />
      )}

      {currentTab === 'admin' && isAdmin && (
        <>
          {!adminPage && <AdminHome onNavigate={setAdminPage} />}
          {adminPage === 'announcements' && (
            <AnnouncementsAdmin onBack={() => setAdminPage(null)} userId={userId} />
          )}
          {adminPage === 'bundles' && (
            <BundlesAdmin onBack={() => setAdminPage(null)} userId={userId} />
          )}
        </>
      )}

      {currentTab === 'admin' && !isAdmin && (
        <div className="px-4 md:px-10 py-10 text-center">
          <p className="text-slate-500">You don't have access to this section.</p>
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
        <h1 className="text-xl font-medium text-slate-900 mb-3">
          Configuration required
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          The Supabase environment variables are not set. Add{' '}
          <code className="bg-page-100 px-1.5 py-0.5 rounded text-xs font-mono">
            VITE_SUPABASE_URL
          </code>{' '}
          and{' '}
          <code className="bg-page-100 px-1.5 py-0.5 rounded text-xs font-mono">
            VITE_SUPABASE_ANON_KEY
          </code>{' '}
          to your Netlify site's environment variables, then redeploy.
        </p>
      </div>
    </div>
  );
}
