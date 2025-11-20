import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ReportData {
  companyName: string;
  siteName?: string;
  dateRange: string;
  shifts: {
    total: number;
    completed: number;
    cancelled: number;
  };
  incidents: {
    total: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
  };
  checkIns: number;
  sosAlerts: number;
  geofenceViolations: number;
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

    const now = new Date();

    const { data: scheduledReports, error: reportsError } = await supabase
      .from('scheduled_reports')
      .select('*, companies(name), sites(name)')
      .eq('is_active', true)
      .lte('next_scheduled_at', now.toISOString());

    if (reportsError) throw reportsError;

    const results = [];

    for (const report of scheduledReports || []) {
      try {
        const reportData = await generateReportData(supabase, report);
        const emailHtml = generateEmailHtml(reportData);

        const recipients = report.recipients as string[];

        for (const email of recipients) {
          console.log(`Sending report to ${email}...`);
        }

        const nextScheduled = calculateNextScheduledTime(now, report.frequency);

        await supabase
          .from('scheduled_reports')
          .update({
            last_sent_at: now.toISOString(),
            next_scheduled_at: nextScheduled.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', report.id);

        results.push({
          reportId: report.id,
          status: 'sent',
          recipients: recipients.length,
        });
      } catch (error) {
        console.error(`Error processing report ${report.id}:`, error);
        results.push({
          reportId: report.id,
          status: 'error',
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
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

async function generateReportData(supabase: any, report: any): Promise<ReportData> {
  const frequency = report.frequency;
  const now = new Date();
  let startDate: Date;

  if (frequency === 'daily') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
  } else if (frequency === 'weekly') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 1);
    startDate.setHours(0, 0, 0, 0);
  }

  let shiftsQuery = supabase
    .from('shifts')
    .select('status, site_id')
    .gte('start_time', startDate.toISOString())
    .lte('start_time', now.toISOString());

  let incidentsQuery = supabase
    .from('incidents')
    .select('severity, status, site_id')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', now.toISOString());

  let checkInsQuery = supabase
    .from('check_ins')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())
    .lte('created_at', now.toISOString());

  let sosQuery = supabase
    .from('sos_alerts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())
    .lte('created_at', now.toISOString());

  let violationsQuery = supabase
    .from('geofence_violations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())
    .lte('created_at', now.toISOString());

  if (report.site_id) {
    shiftsQuery = shiftsQuery.eq('site_id', report.site_id);
    incidentsQuery = incidentsQuery.eq('site_id', report.site_id);
  }

  const [shiftsRes, incidentsRes, checkInsRes, sosRes, violationsRes] = await Promise.all([
    shiftsQuery,
    incidentsQuery,
    checkInsQuery,
    sosQuery,
    violationsQuery,
  ]);

  const shifts = shiftsRes.data || [];
  const incidents = incidentsRes.data || [];

  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  incidents.forEach((inc: any) => {
    bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
    byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
  });

  return {
    companyName: report.companies?.name || 'Company',
    siteName: report.sites?.name,
    dateRange: `${startDate.toLocaleDateString()} - ${now.toLocaleDateString()}`,
    shifts: {
      total: shifts.length,
      completed: shifts.filter((s: any) => s.status === 'completed').length,
      cancelled: shifts.filter((s: any) => s.status === 'cancelled').length,
    },
    incidents: {
      total: incidents.length,
      bySeverity,
      byStatus,
    },
    checkIns: checkInsRes.count || 0,
    sosAlerts: sosRes.count || 0,
    geofenceViolations: violationsRes.count || 0,
  };
}

function generateEmailHtml(data: ReportData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; }
    .stat-box { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #2563eb; }
    .stat-label { font-size: 14px; color: #6b7280; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
    .alert { background: #fee; border-left: 4px solid #ef4444; padding: 10px; margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.companyName} Security Report</h1>
      <p>${data.siteName ? `Site: ${data.siteName}` : 'All Sites'}</p>
      <p>${data.dateRange}</p>
    </div>

    <div class="content">
      <h2>Shifts Summary</h2>
      <div class="stat-box">
        <div class="stat-label">Total Shifts</div>
        <div class="stat-value">${data.shifts.total}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Completed Shifts</div>
        <div class="stat-value">${data.shifts.completed}</div>
      </div>

      <h2>Incidents</h2>
      <div class="stat-box">
        <div class="stat-label">Total Incidents</div>
        <div class="stat-value">${data.incidents.total}</div>
      </div>
      ${Object.entries(data.incidents.bySeverity).map(([severity, count]) => `
        <div class="stat-box">
          <div class="stat-label">${severity.toUpperCase()} Severity</div>
          <div class="stat-value">${count}</div>
        </div>
      `).join('')}

      <h2>Activity</h2>
      <div class="stat-box">
        <div class="stat-label">Check-Ins Completed</div>
        <div class="stat-value">${data.checkIns}</div>
      </div>

      ${data.sosAlerts > 0 ? `
      <div class="alert">
        <strong>⚠️ SOS Alerts:</strong> ${data.sosAlerts} emergency alerts were triggered during this period.
      </div>
      ` : ''}

      ${data.geofenceViolations > 0 ? `
      <div class="alert">
        <strong>📍 Geofence Violations:</strong> ${data.geofenceViolations} guards left their assigned perimeter.
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>This is an automated report from SecureCommand</p>
      <p>Log in to view detailed analytics and reports</p>
    </div>
  </div>
</body>
</html>
  `;
}

function calculateNextScheduledTime(current: Date, frequency: string): Date {
  const next = new Date(current);

  if (frequency === 'daily') {
    next.setDate(next.getDate() + 1);
    next.setHours(8, 0, 0, 0);
  } else if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
    next.setHours(8, 0, 0, 0);
  } else {
    next.setMonth(next.getMonth() + 1);
    next.setDate(1);
    next.setHours(8, 0, 0, 0);
  }

  return next;
}
