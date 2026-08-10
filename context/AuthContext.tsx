'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { EnrichedDbProfile } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  profile: EnrichedDbProfile | null;
  loading: boolean;
  emailConfirmed: boolean;
  profileSetupInProgress: boolean;
  suspended: boolean;
  setProfileSetupInProgress: (v: boolean) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  emailConfirmed: false,
  profileSetupInProgress: false,
  suspended: false,
  setProfileSetupInProgress: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<EnrichedDbProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [profileSetupInProgress, setProfileSetupInProgress] = useState(false);
  const [suspended, setSuspended] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    const [profileRes, interestsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_interests').select('interest').eq('user_id', userId),
    ]);
    if (profileRes.data) {
      const interests = (interestsRes.data ?? []).map(r => r.interest);
      setProfile({ ...profileRes.data, interests });
      setSuspended(!!profileRes.data.suspended);
    } else {
      setProfile(null);
      setSuspended(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setEmailConfirmed(!!sessionUser?.email_confirmed_at);
      if (sessionUser) {
        loadProfile(sessionUser.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setEmailConfirmed(!!sessionUser?.email_confirmed_at);
      if (sessionUser) {
        (async () => {
          await loadProfile(sessionUser.id);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSuspended(false);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, emailConfirmed, profileSetupInProgress, suspended, setProfileSetupInProgress, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
