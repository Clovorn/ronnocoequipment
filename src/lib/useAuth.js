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

    async function loadProfile(userId) {
      let { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, role, display_name, active, director_id, title, phone')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && /title|phone/i.test(error.message || '')) {
        ({ data, error } = await supabase
          .from('user_profiles')
          .select('user_id, role, display_name, active, director_id')
          .eq('user_id', userId)
          .maybeSingle());
      }
      if (cancelled) return;
      if (error) {
        console.error('Failed to load profile:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    }

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => {
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
        loadProfile(newSession.user.id);
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
