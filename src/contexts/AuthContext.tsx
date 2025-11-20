import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  companyLogo: string | null;
  loading: boolean;
  signIn: (email: string, password: string, companyCode?: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, companyCode?: string) => {
    let query = supabase
      .from('profiles')
      .select('id, full_name, role, company_id, avatar_url, phone, staff_code, is_active, created_at, updated_at')
      .eq('id', userId);

    // If company code provided, filter by it during login
    if (companyCode) {
      const { data: companies } = await supabase
        .from('companies')
        .select('id')
        .eq('company_code', companyCode)
        .maybeSingle();

      if (!companies) {
        return;
      }

      query = query.eq('company_id', companies.id);
    }

    const { data, error } = await query.maybeSingle();

    if (!error && data) {
      setProfile(data);

      if (data.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('logo_url')
          .eq('id', data.company_id)
          .maybeSingle();

        if (companyData?.logo_url) {
          setCompanyLogo(companyData.logo_url);
        } else {
          setCompanyLogo(null);
        }
      } else {
        setCompanyLogo(null);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string, companyCode?: string) => {
    // Sign in with email and password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return { error: authError };
    }

    if (authData.user) {
      // First, get the user's profile to check their role
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', authData.user.id)
        .maybeSingle();

      console.log('Profile check during sign-in:', { userProfile, profileError });

      // If no profile found, sign out and return error
      if (!userProfile) {
        await supabase.auth.signOut();
        return { error: { message: 'No profile found. Please complete your registration.' } as AuthError };
      }

      // Super admins, company admins, and site managers don't need company codes
      if (userProfile.role === 'super_admin' || userProfile.role === 'company_admin' || userProfile.role === 'site_manager') {
        await fetchProfile(authData.user.id);
        return { error: null };
      }

      // For other roles (security_officer), verify company code
      if (!companyCode) {
        await supabase.auth.signOut();
        return { error: { message: 'Company code is required for security officers' } as AuthError };
      }

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, company_code')
        .eq('company_code', companyCode)
        .maybeSingle();

      if (companyError || !company) {
        await supabase.auth.signOut();
        return { error: { message: 'Invalid company code' } as AuthError };
      }

      // Verify user has a profile with this company
      const { data: profileData, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id, company_id')
        .eq('id', authData.user.id)
        .eq('company_id', company.id)
        .maybeSingle();

      if (profileCheckError || !profileData) {
        await supabase.auth.signOut();
        return { error: { message: 'You do not have access to this company' } as AuthError };
      }

      // Fetch full profile
      await fetchProfile(authData.user.id, companyCode);
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: fullName,
          role: role,
          company_id: null,
        });

      if (profileError) {
        return { error: profileError as AuthError };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, companyLogo, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
