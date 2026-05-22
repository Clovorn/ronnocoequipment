import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import BundleDetailView from './BundleDetailView.jsx';

export default function BundlesBrowser({ canEdit }) {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('v_bundles_with_totals')
      .select('*')
      .order('featured', { ascending: false })
      .order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setBundles(data || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = search.trim()
    ? bundles.filter((b) =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.category || '').toLowerCase().includes(search.toLowerCase())
      )
    : bundles;

  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6">
      <div className="mb-4 md:mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
          Catalog
        </p>
        <h1 className="text-2xl md:text-3xl font-light text-slate-900 mb-4">
          Bundles
          <span className="ml-2 md:ml-3 text-sm md:text-base text-slate-500 font-normal">
            {filtered.length}
          </span>
        </h1>

        <div className="relative max-w-md">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bundles…"
            className="w-full pl-10 pr-3 py-2.5 md:py-2 bg-white border border-page-200
                       rounded focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10
                       focus:outline-none transition-colors text-sm"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
               fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
      </div>

      {loading && <div className="py-20 text-center text-slate-500">Loading bundles…</div>}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-700">Couldn't load bundles: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-white border border-page-200 rounded-lg py-16 text-center">
              <p className="text-slate-500 text-sm mb-1">
                {search ? 'No bundles match your search.' : 'No bundles yet.'}
              </p>
              {canEdit && !search && (
                <p className="text-xs text-slate-400">
                  Create your first bundle in the Admin section.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {filtered.map((bundle) => (
                <BundleCard key={bundle.id} bundle={bundle} onClick={() => setSelectedBundle(bundle)} />
              ))}
            </div>
          )}
        </>
      )}

      {selectedBundle && (
        <BundleDetailView
          bundle={selectedBundle}
          onClose={() => setSelectedBundle(null)}
        />
      )}
    </div>
  );
}

function BundleCard({ bundle, onClick }) {
  const hasMonthly = bundle.monthly_lease_price != null;
  const hasList = bundle.list_price != null;
  const included = bundle.included_items_total;
  const savings = hasList && included > 0 ? included - bundle.list_price : 0;

  return (
    <article
      onClick={onClick}
      className={`bg-white border rounded-lg p-4 md:p-5 cursor-pointer transition-all
                  hover:shadow-card active:bg-navy-50
                  ${bundle.featured ? 'border-accent-500/40 ring-1 ring-accent-500/20' : 'border-page-200'}`}
    >
      {bundle.featured && (
        <div className="inline-block mb-2 text-[10px] uppercase tracking-wider font-bold
                        text-accent-700 bg-accent-500/10 px-2 py-0.5 rounded">
          Featured
        </div>
      )}

      {bundle.image_url ? (
        <img src={bundle.image_url} alt={bundle.name}
             className="w-full h-32 object-contain rounded mb-3 bg-page-100" />
      ) : (
        <div className="w-full h-32 rounded mb-3 bg-gradient-to-br from-navy-100 to-page-100
                        flex items-center justify-center">
          <svg className="w-10 h-10 text-navy-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
      )}

      <h3 className="text-base font-medium text-slate-900 leading-snug mb-1">
        {bundle.name}
      </h3>
      {bundle.category && (
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          {bundle.category}
        </p>
      )}
      {bundle.description && (
        <p className="text-sm text-slate-600 leading-relaxed mb-3 line-clamp-2">
          {bundle.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-page-100">
        <div>
          <div className="text-xs text-slate-500 mb-0.5">
            {bundle.included_items_count} included
            {bundle.optional_items_count > 0 && ` · ${bundle.optional_items_count} optional`}
          </div>
          <div className="flex items-baseline gap-2">
            {hasMonthly && (
              <span className="font-mono tabular-nums text-base font-medium text-navy-900">
                ${bundle.monthly_lease_price.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                <span className="text-xs text-slate-500 font-sans font-normal">/mo</span>
              </span>
            )}
            {hasList && (
              <span className={`font-mono tabular-nums ${hasMonthly ? 'text-xs text-slate-500' : 'text-base font-medium text-navy-900'}`}>
                {hasMonthly && 'or '}${bundle.list_price.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </span>
            )}
          </div>
        </div>
        {savings > 0 && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-accent-700 font-medium">Save</div>
            <div className="text-sm font-mono tabular-nums text-accent-700 font-medium">
              ${savings.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
