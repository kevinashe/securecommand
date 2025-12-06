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
  console.log('AuthProvider rendering');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, companyCode?: string) => {
    console.log('[FETCH_PROFILE] Starting for userId:', userId, 'companyCode:', companyCode);
    let query = supabase
      .from('profiles')
      .select('id, full_name, role, company_id, avatar_url, phone, staff_code, is_active, created_at, updated_at')
      .eq('id', userId);

    // If company code provided, filter by it during login
    if (companyCode) {
      console.log('[FETCH_PROFILE] Filtering by company code:', companyCode);
      const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('company_code', companyCode)
        .maybeSingle();

      if (companyError) {
        console.error('[FETCH_PROFILE] Error fetching company:', companyError);
      }

      if (!companies) {
        console.warn('[FETCH_PROFILE] No company found for code:', companyCode);
        return;
      }

      query = query.eq('company_id', companies.id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('[FETCH_PROFILE] Error fetching profile:', error);
      return;
    }

    if (!data) {
      console.warn('[FETCH_PROFILE] No profile data found');
      return;
    }

    console.log('[FETCH_PROFILE] Profile data fetched:', { role: data.role, company_id: data.company_id });
    setProfile(data);

    if (data.company_id) {
      console.log('[FETCH_PROFILE] Fetching company logo...');
      const { data: companyData, error: logoError } = await supabase
        .from('companies')
        .select('logo_url')
        .eq('id', data.company_id)
        .maybeSingle();

      if (logoError) {
        console.error('[FETCH_PROFILE] Error fetching logo:', logoError);
      }

      if (companyData?.logo_url) {
        console.log('[FETCH_PROFILE] Logo found');
        setCompanyLogo(companyData.logo_url);
      } else {
        console.log('[FETCH_PROFILE] No logo found');
        setCompanyLogo(null);
      }
    } else {
      console.log('[FETCH_PROFILE] No company_id, skipping logo fetch');
      setCompanyLogo(null);
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
    console.log('[AUTH] Starting sign-in for:', email);
    // Sign in with email and password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('[AUTH] Sign-in failed:', authError);
      return { error: authError };
    }

    console.log('[AUTH] Authentication successful, checking profile...');

    if (authData.user) {
      // First, get the user's profile to check their role
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', authData.user.id)
        .maybeSingle();

      console.log('Profile check during sign-in:', {
        userProfile,
        profileError: profileError ? {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code
        } : null
      });

      // If no profile found, sign out and return error
      if (!userProfile) {
        console.error('[AUTH] No profile found for user');
        await supabase.auth.signOut();
        return { error: { message: 'No profile found. Please complete your registration.' } as AuthError };
      }

      console.log('[AUTH] Profile found:', { role: userProfile.role, hasCompanyId: !!userProfile.company_id });

      // If user already has a company_id, they don't need to enter company code again
      if (userProfile.company_id) {
        console.log('[AUTH] User has company, fetching company data...');
        // Get the company code for this user's company
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('company_code')
          .eq('id', userProfile.company_id)
          .maybeSingle();

        if (companyError) {
          console.error('[AUTH] Error fetching company:', companyError);
        } else {
          console.log('[AUTH] Company data fetched, loading full profile...');
        }

        await fetchProfile(authData.user.id, companyData?.company_code);
        console.log('[AUTH] Sign-in complete!');
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
