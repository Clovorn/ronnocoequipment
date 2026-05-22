import { useState } from 'react';
import { signIn } from '../lib/useAuth.js';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success, useAuth picks up the new session and re-renders App.
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Two-column layout: brand panel + form */}
      <div className="flex-1 grid lg:grid-cols-[1.1fr_1fr]">
        {/* Brand panel */}
        <div className="hidden lg:flex relative flex-col justify-between p-12 bg-ink-900 text-cream-50 overflow-hidden">
          {/* Decorative circle — coffee bean silhouette */}
          <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-copper-600 opacity-20 blur-2xl" />
          <div className="absolute right-1/3 bottom-1/4 w-2 h-2 rounded-full bg-copper-500" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-cream-50/40 flex items-center justify-center font-serif text-lg">
                R
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-cream-50/60">
                Ronnoco · Internal
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-md">
            <p className="text-xs uppercase tracking-[0.2em] text-copper-500 mb-4">
              Equipment Catalog
            </p>
            <h1 className="font-serif text-5xl leading-tight mb-6">
              The single source of truth for every machine we sell.
            </h1>
            <p className="text-cream-50/70 leading-relaxed">
              Search the catalog. Price a deal. Generate a quote. Print a vendor
              PO. All from one place, all from the same data.
            </p>
          </div>

          <div className="relative z-10 text-xs text-cream-50/40 font-mono">
            v0.1 · build {new Date().toISOString().slice(0, 10)}
          </div>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center p-8 lg:p-16">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm"
            autoComplete="on"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500 mb-3">
              Sign in
            </p>
            <h2 className="font-serif text-3xl mb-8 text-ink-900">
              Welcome back.
            </h2>

            <label className="block mb-5">
              <span className="block text-xs uppercase tracking-wider text-ink-600 mb-2">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-sm
                           focus:bg-cream-50 focus:border-ink-600 focus:outline-none
                           transition-colors text-ink-900"
                placeholder="you@ronnoco.com"
              />
            </label>

            <label className="block mb-8">
              <span className="block text-xs uppercase tracking-wider text-ink-600 mb-2">
                Password
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-sm
                           focus:bg-cream-50 focus:border-ink-600 focus:outline-none
                           transition-colors text-ink-900"
              />
            </label>

            {error && (
              <div className="mb-6 p-3 bg-copper-500/10 border border-copper-500/30 rounded-sm">
                <p className="text-sm text-copper-700 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-ink-900 text-cream-50 font-medium tracking-wide
                         hover:bg-ink-800 active:bg-ink-700 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         rounded-sm"
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>

            <p className="mt-8 text-xs text-ink-500 leading-relaxed">
              This is an internal Ronnoco tool. Contact your administrator if
              you need an account.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
