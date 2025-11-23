import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RegisterCompanyRequest {
  companyData: {
    companyName: string;
    address: string;
    phone: string;
    email: string;
  };
  adminData: {
    fullName: string;
    email: string;
    password: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { companyData, adminData }: RegisterCompanyRequest = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: adminData.email,
      password: adminData.password,
      email_confirm: true,
    });

    if (signUpError) {
      if (signUpError.message.includes('User already registered') || signUpError.message.includes('already exists')) {
        return new Response(
          JSON.stringify({ error: 'This email is already registered. Please use the login page or try a different email address.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      throw signUpError;
    }

    if (!authData.user) {
      throw new Error('Failed to create user account');
    }

    const { data: companyResult, error: companyError } = await supabaseAdmin.rpc('create_company_bypass_rls', {
      p_name: companyData.companyName,
      p_address: companyData.address,
      p_phone: companyData.phone,
      p_email: companyData.email,
    });

    if (companyError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create company: ${companyError.message}`);
    }

    if (!companyResult || !companyResult.id) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error('Company was created but data was not returned');
    }

    const { error: profileError } = await supabaseAdmin.rpc('create_profile_bypass_rls', {
      p_id: authData.user.id,
      p_full_name: adminData.fullName,
      p_role: 'company_admin',
      p_company_id: companyResult.id,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create admin profile: ${profileError.message}`);
    }

    const company = companyResult;

    return new Response(
      JSON.stringify({
        success: true,
        companyCode: company.company_code,
        message: `Company registered successfully! Your company code is: ${company.company_code}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to create company account' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});