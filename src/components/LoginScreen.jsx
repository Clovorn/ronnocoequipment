import { useState } from 'react';
import { signIn } from '../lib/useAuth.js';
import RonnocoLogo from './RonnocoLogo.jsx';

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
  }

  return (
    <div className="min-h-screen flex flex-col bg-page-50">
      <div className="flex-1 grid lg:grid-cols-[1.1fr_1fr]">
        {/* Brand panel (dark navy) */}
        <div className="hidden lg:flex relative flex-col justify-between p-12 bg-navy-900 text-chalk-50 overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -right-24 -top-24 w-[28rem] h-[28rem] rounded-full bg-navy-700 opacity-40 blur-3xl" />
          <div className="absolute left-1/3 bottom-1/4 w-2 h-2 rounded-full bg-accent-500" />

          <div className="relative z-10">
            <RonnocoLogo variant="on-dark" />
          </div>

          <div className="relative z-10 max-w-md">
            <p className="text-xs uppercase tracking-[0.2em] text-chalk-300 mb-4 font-medium">
              Deal Builder
            </p>
            <h1 className="text-4xl xl:text-5xl font-light leading-tight mb-6 text-chalk-50">
              The single source of truth for every machine we sell.
            </h1>
            <p className="text-chalk-200 leading-relaxed">
              Search the catalog. Price a deal. Generate a quote. Print a vendor
              PO. All from one place, all from the same data.
            </p>
          </div>

          <div className="relative z-10 text-xs text-chalk-400 font-mono">
            v0.1 · build {new Date().toISOString().slice(0, 10)}
          </div>
        </div>

        {/* Form panel (light) */}
        <div className="flex items-center justify-center p-8 lg:p-16">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm"
            autoComplete="on"
          >
            {/* Mobile: show logo above form since brand panel is hidden */}
            <div className="lg:hidden mb-8">
              <RonnocoLogo variant="on-light" />
            </div>

            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3 font-medium">
              Sign in
            </p>
            <h2 className="text-3xl font-light mb-8 text-slate-900">
              Welcome back.
            </h2>

            <label className="block mb-5">
              <span className="block text-xs uppercase tracking-wider text-slate-600 mb-2 font-medium">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-page-200 rounded
                           focus:bg-white focus:border-navy-500 focus:outline-none
                           focus:ring-2 focus:ring-navy-500/10
                           transition-colors text-slate-900"
                placeholder="you@ronnoco.com"
              />
            </label>

            <label className="block mb-8">
              <span className="block text-xs uppercase tracking-wider text-slate-600 mb-2 font-medium">
                Password
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-page-200 rounded
                           focus:bg-white focus:border-navy-500 focus:outline-none
                           focus:ring-2 focus:ring-navy-500/10
                           transition-colors text-slate-900"
              />
            </label>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-navy-900 text-chalk-50 font-medium tracking-wide
                         hover:bg-navy-800 active:bg-navy-700 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         rounded"
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>

            <p className="mt-8 text-xs text-slate-500 leading-relaxed">
              This is an internal Ronnoco tool. Contact your administrator if
              you need an account.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
