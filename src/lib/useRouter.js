import { useEffect, useState, useCallback } from 'react';

/**
 * Lightweight hash-based router.
 *
 * Why hash routing: works on Netlify with no extra config (no SPA-redirect file
 * mapping every path to index.html — the hash never hits the server). Also keeps
 * the rest of the app simple — no react-router dependency, no provider.
 *
 * Routes are just strings after the '#'. We expose them as:
 *   parseRoute('#/vendor/bunn')  => { name: 'vendor', params: { slug: 'bunn' } }
 *   parseRoute('')               => { name: 'home', params: {} }
 *
 * Pattern table is small enough to keep inline; if it grows past ~10 routes
 * we'd switch to a real route matcher.
 */
function parseRoute(hash) {
  // Strip leading "#" and any leading "/" so "#/vendor/bunn" and "#vendor/bunn" both work
  const stripped = (hash || '').replace(/^#\/?/, '');
  if (!stripped) return { name: 'home', params: {} };

  const parts = stripped.split('/').filter(Boolean);
  const [first, second] = parts;

  switch (first) {
    case 'home':       return { name: 'home',       params: {} };
    case 'catalog':    return { name: 'catalog',    params: {} };
    case 'bundles':    return { name: 'bundles',    params: {} };
    case 'favorites':  return { name: 'favorites',  params: {} };
    case 'vendor':     return { name: 'vendor',     params: { slug: second || null } };
    case 'vendors':    return { name: 'vendors',    params: {} }; // full list
    case 'admin':      return { name: 'admin',      params: { section: second || null } };
    default:           return { name: 'not-found',  params: { path: stripped } };
  }
}

/**
 * Build a URL from a route name + params. Used for navigation.
 */
export function routeToHash(name, params = {}) {
  switch (name) {
    case 'home':       return '#/home';
    case 'catalog':    return '#/catalog';
    case 'bundles':    return '#/bundles';
    case 'favorites':  return '#/favorites';
    case 'vendors':    return '#/vendors';
    case 'vendor':     return `#/vendor/${params.slug || ''}`;
    case 'admin':      return params.section ? `#/admin/${params.section}` : '#/admin';
    default:           return '#/home';
  }
}

/**
 * React hook returning the current route and a navigate function.
 * Components don't need to know about window.location; they just call
 * navigate('vendor', { slug: 'bunn' }).
 */
export function useRouter() {
  const [route, setRoute] = useState(() =>
    typeof window !== 'undefined' ? parseRoute(window.location.hash) : { name: 'home', params: {} }
  );

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((name, params) => {
    const target = routeToHash(name, params);
    if (window.location.hash !== target) {
      window.location.hash = target;
    } else {
      // Re-fire even on same-route navigation so click-on-active-tab feels responsive
      setRoute(parseRoute(target));
    }
  }, []);

  return { route, navigate };
}
