import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user && event !== 'INITIAL_SESSION') {
        fetchProfile(session.user.id);
      } else if (!session?.user) {
        setProfile(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setProfile(data);
    }
  }, []);

  const signUp = useCallback(async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName || email.split('@')[0],
        updated_at: new Date().toISOString(),
      });
      if (profileError) console.error('Profile creation error:', profileError);
      await fetchProfile(data.user.id);
    }
    return data;
  }, [fetchProfile]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      ...updates,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setProfile(prev => ({ ...prev, ...updates }));
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
