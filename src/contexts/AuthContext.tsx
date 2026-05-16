import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  companyLogo: string | null;
  loading: boolean;
  signIn: (email: string, password: string, companyCode?: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string, role: string, companyCode: string) => Promise<{ error: AuthError | null }>;
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

      // If no profile found, sign out and return error
      if (!userProfile) {
        await supabase.auth.signOut();
        return { error: { message: 'No profile found. Please complete your registration.' } as AuthError };
      }

      // Super admins don't need a company code
      if (userProfile.role === 'super_admin') {
        await fetchProfile(authData.user.id);
        return { error: null };
      }

      // If user already has a company_id, they don't need to enter company code again
      if (userProfile.company_id) {
        // Get the company code for this user's company
        const { data: companyData } = await supabase
          .from('companies')
          .select('company_code')
          .eq('id', userProfile.company_id)
          .maybeSingle();

        await fetchProfile(authData.user.id, companyData?.company_code);
        return { error: null };
      }

      // For users without a company_id (shouldn't happen normally), require company code
      if (!companyCode) {
        await supabase.auth.signOut();
        return { error: { message: 'Company code is required' } as AuthError };
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

  const signUp = async (email: string, password: string, fullName: string, role: string, companyCode: string) => {
    if (!companyCode || companyCode.trim() === '') {
      return { error: { message: 'Company code is required to sign up' } as AuthError };
    }

    if (password.length < 8) {
      return { error: { message: 'Password must be at least 8 characters' } as AuthError };
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return { error: { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' } as AuthError };
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, is_active')
      .eq('company_code', companyCode.toUpperCase())
      .maybeSingle();

    if (companyError || !company) {
      return { error: { message: 'Invalid company code. Please verify with your company administrator.' } as AuthError };
    }

    if (!company.is_active) {
      return { error: { message: 'This company account is inactive. Please contact support.' } as AuthError };
    }

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
          company_id: company.id,
        });

      if (profileError) {
        return { error: { message: profileError.message } as AuthError };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      // Clear local state regardless of API call success
      setUser(null);
      setProfile(null);
      setCompanyLogo(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, companyLogo, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
