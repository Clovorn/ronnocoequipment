import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

/**
 * useAuth: returns { session, profile, loading }
 * - session: Supabase auth session, or null
 * - profile: row from user_profiles (includes role + director_id), or null
 * - loading: true until the initial check completes
 *
 * v23+: director_id is included so the Deal Builder can auto-stamp the
 * rep's director on each submitted deal.
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(userId, sessionUser = null) {
      // Preferred read — includes the v33 contact fields (title, phone).
      let { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, role, display_name, active, director_id, title, phone')
        .eq('user_id', userId)
        .maybeSingle();

      // If the rich select fails for ANY reason (most commonly because the
      // v33 title/phone columns haven't been added to this Supabase project
      // yet, but also transient schema-cache errors), retry with the minimal
      // column set that has existed since the original schema. We don't match
      // on the error text anymore — PostgREST's missing-column message isn't
      // guaranteed to name the column, and a missed retry left the whole
      // profile null, which renders the profile page blank.
      if (error) {
        console.warn('Profile rich-select failed, retrying minimal columns:', error.message);
        ({ data, error } = await supabase
          .from('user_profiles')
          .select('user_id, role, display_name, active, director_id')
          .eq('user_id', userId)
          .maybeSingle());
      }

      if (cancelled) return;

      if (error) {
        // Both reads failed. Rather than leave profile null (blank profile
        // page, role stuck on "Loading…"), synthesize a minimal profile from
        // the auth session so the app stays usable and the email at least
        // shows. Role defaults to 'sales' — the least-privileged working role.
        console.error('Failed to load profile (both attempts):', error);
        if (sessionUser) {
          setProfile({
            user_id: userId,
            role: 'sales',
            display_name: sessionUser.email || null,
            active: true,
            director_id: null,
            title: null,
            phone: null,
            _synthesized: true,
          });
        } else {
          setProfile(null);
        }
      } else {
        setProfile(data);
      }
    }

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id, data.session.user).finally(() => {
          if (!cancelled) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Subscribe to changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;
      setSession(newSession);
      if (newSession?.user) {
        loadProfile(newSession.user.id, newSession.user);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, profile, loading, setProfile };
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}
