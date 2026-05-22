import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * ProfilePage — lets a user edit their own profile.
 *
 * Two cards:
 *   1. Display info — name (editable), email (read-only), role (read-only).
 *      Email and role can't be self-edited; email is managed by Supabase Auth
 *      and role changes require an admin.
 *   2. Change password — requires the new password to be confirmed.
 *
 * Save state for each card is independent so a user can change just one
 * without touching the other.
 */
export default function ProfilePage({ profile, session, navigate, onProfileUpdated }) {
  return (
    <div className="px-4 md:px-6 lg:px-10 py-4 md:py-6 max-w-2xl">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 font-medium">
          Account
        </p>
        <h1 className="text-2xl md:text-3xl font-light text-slate-900">My profile</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your display name and password. Email and role are managed by an admin.
        </p>
      </div>

      <DisplayInfoCard
        profile={profile}
        session={session}
        onUpdated={onProfileUpdated}
      />

      <PasswordCard />
    </div>
  );
}

/* ────────── Display info card ────────── */

function DisplayInfoCard({ profile, session, onUpdated }) {
  const [name, setName] = useState(profile?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const role = profile?.role || 'sales';
  const roleLabel = { admin: 'Admin', director: 'Director', sales: 'Sales', customer: 'Customer' }[role];
  const isDirty = name.trim() !== (profile?.display_name || '');

  async function save() {
    if (!isDirty) return;
    setSaving(true); setError(null);
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ display_name: name.trim() || null })
      .eq('user_id', session.user.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2500);
    onUpdated?.(data);
  }

  return (
    <section className="bg-white border border-page-200 rounded-lg overflow-hidden mb-4">
      <header className="px-4 md:px-5 py-3 border-b border-page-100">
        <h2 className="text-sm font-medium text-slate-900">Display info</h2>
      </header>
      <div className="p-4 md:p-5 space-y-4">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-slate-600 mb-1 font-semibold">
            Display name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full px-3 py-2 bg-page-50 border border-page-200 rounded text-sm
                       focus:border-navy-500 focus:ring-2 focus:ring-navy-500/10 focus:bg-white
                       focus:outline-none transition-colors"
          />
          <span className="block text-[11px] text-slate-500 mt-1">
            Shown in the user menu and on deals you submit.
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-slate-600 mb-1 font-semibold">
              Email
            </span>
            <div className="w-full px-3 py-2 bg-page-100 border border-page-200 rounded text-sm text-slate-600">
              {session.user.email}
            </div>
            <span className="block text-[11px] text-slate-500 mt-1">
              Contact an admin to change.
            </span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-slate-600 mb-1 font-semibold">
              Role
            </span>
            <div className="w-full px-3 py-2 bg-page-100 border border-page-200 rounded text-sm text-slate-600">
              {roleLabel}
            </div>
            <span className="block text-[11px] text-slate-500 mt-1">
              Set by an admin.
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-page-100">
          {savedAt && <span className="text-xs text-ok font-medium">✓ Saved</span>}
          <button
            onClick={save}
            disabled={!isDirty || saving}
            className="px-4 py-2 bg-navy-900 text-chalk-50 text-sm font-medium rounded
                       hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ────────── Password card ────────── */

function PasswordCard() {
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const tooShort = newPwd.length > 0 && newPwd.length < 8;
  const mismatch = confirmPwd.length > 0 && confirmPwd !== newPwd;
  const canSave = newPwd.length >= 8 && newPwd === confirmPwd && !saving;

  async function save() {
    setSaving(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNewPwd('');
    setConfirmPwd('');
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2500);
  }

  return (
    <section className="bg-white border border-page-200 rounded-lg overflow-hidden">
      <header className="px-4 md:px-5 py-3 border-b border-page-100">
        <h2 className="text-sm font-medium text-slate-900">Change password</h2>
      </header>
      <div className="p-4 md:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-slate-600 mb-1 font-semibold">
              New password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="At least 8 characters"
              className={`w-full px-3 py-2 bg-page-50 border rounded text-sm
                         focus:ring-2 focus:bg-white focus:outline-none transition-colors
                         ${tooShort
                           ? 'border-bad/50 focus:border-bad focus:ring-bad/10'
                           : 'border-page-200 focus:border-navy-500 focus:ring-navy-500/10'}`}
            />
            {tooShort && <span className="block text-[11px] text-bad mt-1">Must be at least 8 characters.</span>}
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-slate-600 mb-1 font-semibold">
              Confirm new password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="Re-enter password"
              className={`w-full px-3 py-2 bg-page-50 border rounded text-sm
                         focus:ring-2 focus:bg-white focus:outline-none transition-colors
                         ${mismatch
                           ? 'border-bad/50 focus:border-bad focus:ring-bad/10'
                           : 'border-page-200 focus:border-navy-500 focus:ring-navy-500/10'}`}
            />
            {mismatch && <span className="block text-[11px] text-bad mt-1">Passwords don't match.</span>}
          </label>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-page-100">
          {savedAt && <span className="text-xs text-ok font-medium">✓ Password updated</span>}
          <button
            onClick={save}
            disabled={!canSave}
            className="px-4 py-2 bg-navy-900 text-chalk-50 text-sm font-medium rounded
                       hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
          >
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </div>
    </section>
  );
}
