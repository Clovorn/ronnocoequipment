import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import ItemDetailDrawer from './ItemDetailDrawer.jsx';

const PAGE_SIZE = 50;

export default function CatalogBrowser({ canEdit }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [leaseOnly, setLeaseOnly] = useState(false);
  const [sortKey, setSortKey] = useState('description');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  // Drawer state
  const [selectedItem, setSelectedItem] = useState(null);

  // Load catalog data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    supabase
      .from('v_catalog')
      .select('*')
      .order('description', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          setItems(data || []);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Derive filter options from data
  const { vendors, categories } = useMemo(() => {
    const v = new Set();
    const c = new Set();
    for (const item of items) {
      if (item.vendor) v.add(item.vendor);
      if (item.category) c.add(item.category);
    }
    return {
      vendors: [...v].sort(),
      categories: [...c].sort(),
    };
  }, [items]);

  // Apply filters + sort + paginate
  const filtered = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          (item.description || '').toLowerCase().includes(q) ||
          (item.model || '').toLowerCase().includes(q) ||
          (item.sku || '').toLowerCase().includes(q) ||
          (item.vendor_item_num || '').toLowerCase().includes(q)
      );
    }
    if (vendorFilter) {
      result = result.filter((item) => item.vendor === vendorFilter);
    }
    if (categoryFilter) {
      result = result.filter((item) => item.category === categoryFilter);
    }
    if (leaseOnly) {
      result = result.filter((item) => item.lease_eligible);
    }
    // Sort
    result = [...result].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return result;
  }, [items, search, vendorFilter, categoryFilter, leaseOnly, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [search, vendorFilter, categoryFilter, leaseOnly]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function clearFilters() {
    setSearch('');
    setVendorFilter('');
    setCategoryFilter('');
    setLeaseOnly(false);
  }

  const hasActiveFilters =
    search || vendorFilter || categoryFilter || leaseOnly;

  return (
    <div className="px-6 lg:px-10 py-6">
      {/* Header / Filter bar */}
      <div className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500 mb-1">
              Catalog
            </p>
            <h1 className="font-serif text-3xl text-ink-900">
              Equipment
              <span className="ml-3 text-base font-sans text-ink-500 font-normal">
                {filtered.length.toLocaleString()}
                {filtered.length !== items.length && (
                  <span className="text-ink-500/60">
                    {' '}of {items.length.toLocaleString()}
                  </span>
                )}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, model, SKU, vendor #…"
              className="w-full pl-9 pr-3 py-2 bg-cream-50 border border-cream-300
                         rounded-sm focus:bg-white focus:border-ink-600
                         transition-colors text-sm"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>

          {/* Vendor filter */}
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="px-3 py-2 bg-cream-50 border border-cream-300 rounded-sm
                       text-sm focus:bg-white focus:border-ink-600 transition-colors"
          >
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-cream-50 border border-cream-300 rounded-sm
                       text-sm focus:bg-white focus:border-ink-600 transition-colors"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Lease-eligible toggle */}
          <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={leaseOnly}
              onChange={(e) => setLeaseOnly(e.target.checked)}
              className="accent-copper-600 w-4 h-4"
            />
            Lease-eligible only
          </label>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-copper-700 hover:text-copper-600
                         underline-offset-2 hover:underline transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading && (
        <div className="py-20 text-center text-ink-500">Loading catalog…</div>
      )}

      {error && (
        <div className="p-4 bg-copper-500/10 border border-copper-500/30 rounded-sm">
          <p className="text-sm text-copper-700">Couldn't load catalog: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-cream-50 border border-cream-200 rounded-sm shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 border-b border-cream-200">
                <tr className="text-left text-xs uppercase tracking-wider text-ink-600">
                  <Th sortKey="sku" current={sortKey} dir={sortDir} onClick={toggleSort}>
                    SKU
                  </Th>
                  <Th sortKey="vendor" current={sortKey} dir={sortDir} onClick={toggleSort}>
                    Vendor
                  </Th>
                  <Th sortKey="description" current={sortKey} dir={sortDir} onClick={toggleSort}>
                    Description
                  </Th>
                  <Th sortKey="category" current={sortKey} dir={sortDir} onClick={toggleSort}>
                    Category
                  </Th>
                  <Th
                    sortKey="list_price"
                    current={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  >
                    List
                  </Th>
                  <th className="px-3 py-3 text-center w-12">Lease</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`cursor-pointer transition-colors border-b border-cream-200 last:border-b-0
                                hover:bg-cream-100/60
                                ${idx % 2 === 0 ? 'bg-cream-50' : 'bg-cream-50/50'}`}
                  >
                    <td className="px-3 py-3 font-mono text-xs text-ink-600">
                      {item.sku}
                    </td>
                    <td className="px-3 py-3 text-ink-800 whitespace-nowrap">
                      {item.vendor || '—'}
                    </td>
                    <td className="px-3 py-3 text-ink-900">
                      <div className="font-medium">{item.description}</div>
                      {item.model && (
                        <div className="text-xs text-ink-500 mt-0.5">{item.model}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-700 text-xs whitespace-nowrap">
                      {item.category || '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-900">
                      {item.list_price != null
                        ? `$${item.list_price.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {item.lease_eligible && (
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-copper-500"
                          title="Lease eligible"
                        />
                      )}
                    </td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-3 py-16 text-center text-ink-500">
                      No items match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="px-4 py-3 bg-cream-100 border-t border-cream-200 flex items-center justify-between text-sm">
              <div className="text-ink-600">
                Showing{' '}
                <span className="font-medium text-ink-900">
                  {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, filtered.length)}
                </span>{' '}
                of {filtered.length.toLocaleString()}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border border-cream-300 rounded-sm
                             hover:bg-cream-50 disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border border-cream-300 rounded-sm
                             hover:bg-cream-50 disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail drawer */}
      {selectedItem && (
        <ItemDetailDrawer
          item={selectedItem}
          canEdit={canEdit}
          onClose={() => setSelectedItem(null)}
          onUpdated={(updated) => {
            // Reflect changes locally without a full refetch
            setItems((prev) =>
              prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it))
            );
            setSelectedItem({ ...selectedItem, ...updated });
          }}
        />
      )}
    </div>
  );
}

function Th({ sortKey, current, dir, onClick, align = 'left', children }) {
  const isActive = sortKey === current;
  return (
    <th
      onClick={() => onClick(sortKey)}
      className={`px-3 py-3 font-medium cursor-pointer select-none
                  hover:text-ink-900 transition-colors
                  ${align === 'right' ? 'text-right' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive && (
          <span className="text-copper-600 text-[10px]">
            {dir === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </span>
    </th>
  );
}
