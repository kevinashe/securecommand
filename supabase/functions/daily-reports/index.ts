import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DailyReport {
  date: string;
  totalShifts: number;
  activeShifts: number;
  completedShifts: number;
  totalIncidents: number;
  incidentsBySeverity: Record<string, number>;
  totalCheckIns: number;
  sosAlerts: number;
  guards: {
    total: number;
    active: number;
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const companyId = url.searchParams.get('company_id');

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    let shiftsQuery = supabase
      .from('shifts')
      .select('status')
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString());

    let incidentsQuery = supabase
      .from('incidents')
      .select('severity')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    let checkInsQuery = supabase
      .from('check_ins')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    let sosQuery = supabase
      .from('sos_alerts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    let guardsQuery = supabase.from('profiles').select('id, role');

    if (companyId) {
      guardsQuery = guardsQuery.eq('company_id', companyId);
    }

    const [shiftsRes, incidentsRes, checkInsRes, sosRes, guardsRes] = await Promise.all([
      shiftsQuery,
      incidentsQuery,
      checkInsQuery,
      sosQuery,
      guardsQuery,
    ]);

    const shifts = shiftsRes.data || [];
    const incidents = incidentsRes.data || [];
    const guards = guardsRes.data || [];

    const incidentsBySeverity = incidents.reduce((acc: Record<string, number>, inc: any) => {
      acc[inc.severity] = (acc[inc.severity] || 0) + 1;
      return acc;
    }, {});

    const activeGuards = guards.filter((g: any) => g.role === 'security_officer');

    const report: DailyReport = {
      date,
      totalShifts: shifts.length,
      activeShifts: shifts.filter((s: any) => s.status === 'active').length,
      completedShifts: shifts.filter((s: any) => s.status === 'completed').length,
      totalIncidents: incidents.length,
      incidentsBySeverity,
      totalCheckIns: checkInsRes.count || 0,
      sosAlerts: sosRes.count || 0,
      guards: {
        total: activeGuards.length,
        active: shifts.filter((s: any) => s.status === 'active').length,
      },
    };

    return new Response(JSON.stringify(report), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});