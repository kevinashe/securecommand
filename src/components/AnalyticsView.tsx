import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, Users, AlertTriangle, Clock, MapPin, Loader, DollarSign, Award, Target, ArrowLeft } from 'lucide-react';

interface Stats {
  totalGuards: number;
  activeShifts: number;
  totalIncidents: number;
  totalCheckIns: number;
  criticalIncidents: number;
  avgResponseTime: string;
  totalCost: number;
  geofenceViolations: number;
  sosAlerts: number;
}

interface GuardPerformance {
  guardName: string;
  shiftsCompleted: number;
  checkInsCompleted: number;
  incidentsReported: number;
  performanceScore: number;
}

interface SiteCosts {
  siteName: string;
  guardCount: number;
  shiftCount: number;
  estimatedCost: number;
}

interface ChartData {
  incidentsByDay: { date: string; count: number }[];
  incidentsBySeverity: { severity: string; count: number }[];
  checkInsByDay: { date: string; count: number }[];
  shiftsByStatus: { status: string; count: number }[];
  guardPerformance: GuardPerformance[];
  siteCosts: SiteCosts[];
  responseTimeData: { day: string; avgMinutes: number }[];
}

interface AnalyticsViewProps {
  onBack?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalGuards: 0,
    activeShifts: 0,
    totalIncidents: 0,
    totalCheckIns: 0,
    criticalIncidents: 0,
    avgResponseTime: '0h',
    totalCost: 0,
    geofenceViolations: 0,
    sosAlerts: 0
  });
  const [chartData, setChartData] = useState<ChartData>({
    incidentsByDay: [],
    incidentsBySeverity: [],
    checkInsByDay: [],
    shiftsByStatus: [],
    guardPerformance: [],
    siteCosts: [],
    responseTimeData: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(7);

  useEffect(() => {
    if (profile) {
      loadAnalytics();
    }
  }, [profile, dateRange]);

  const loadAnalytics = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);
      const startDateStr = startDate.toISOString();

      let siteIds: string[] = [];

      if (profile?.role === 'company_admin' || profile?.role === 'site_manager') {
        const { data: sites } = await supabase
          .from('sites')
          .select('id')
          .eq('company_id', profile.company_id);
        siteIds = sites?.map(s => s.id) || [];
      }

      let guardsQuery = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['security_officer', 'site_manager']);

      if (profile?.role === 'company_admin' || profile?.role === 'site_manager') {
        guardsQuery = guardsQuery.eq('company_id', profile.company_id);
      }

      let shiftsQuery = supabase
        .from('shifts')
        .select('*')
        .gte('created_at', startDateStr);

      if (siteIds.length > 0) {
        shiftsQuery = shiftsQuery.in('site_id', siteIds);
      }

      let incidentsQuery = supabase
        .from('incidents')
        .select('*')
        .gte('created_at', startDateStr);

      if (siteIds.length > 0) {
        incidentsQuery = incidentsQuery.in('site_id', siteIds);
      }

      let checkInsQuery = supabase
        .from('check_ins')
        .select('*', { count: 'exact' })
        .gte('checked_in_at', startDateStr);

      if (profile?.company_id) {
        checkInsQuery = checkInsQuery.eq('company_id', profile.company_id);
      }

      let sosQuery = supabase
        .from('sos_alerts')
        .select('*', { count: 'exact' })
        .gte('created_at', startDateStr);

      if (profile?.company_id) {
        sosQuery = sosQuery.eq('company_id', profile.company_id);
      }

      let violationsQuery = supabase
        .from('geofence_violations')
        .select('*', { count: 'exact' })
        .gte('created_at', startDateStr);

      if (profile?.company_id) {
        violationsQuery = violationsQuery.eq('company_id', profile.company_id);
      }

      const [guardsRes, shiftsRes, incidentsRes, checkInsRes, sosRes, violationsRes] = await Promise.all([
        guardsQuery,
        shiftsQuery,
        incidentsQuery,
        checkInsQuery,
        sosQuery,
        violationsQuery
      ]);

      const shifts = shiftsRes.data || [];
      const incidents = incidentsRes.data || [];
      const criticalIncidents = incidents.filter(i => i.severity === 'critical').length;

      const incidentsByDay = processIncidentsByDay(incidents);
      const incidentsBySeverity = processIncidentsBySeverity(incidents);
      const checkInsByDay = processCheckInsByDay(checkInsRes.data || []);
      const shiftsByStatus = processShiftsByStatus(shifts);

      const avgResponseTime = calculateAvgResponseTime(sosRes.data || []);
      const responseTimeData = calculateResponseTimeData(sosRes.data || []);

      const guardPerformance = await calculateGuardPerformance(profile, startDateStr);
      const siteCosts = await calculateSiteCosts(profile, startDateStr);
      const totalCost = siteCosts.reduce((sum, site) => sum + site.estimatedCost, 0);

      setStats({
        totalGuards: guardsRes.count || 0,
        activeShifts: shifts.filter(s => s.status === 'active').length,
        totalIncidents: incidents.length,
        totalCheckIns: checkInsRes.count || 0,
        criticalIncidents,
        avgResponseTime,
        totalCost,
        geofenceViolations: violationsRes.count || 0,
        sosAlerts: sosRes.count || 0
      });

      setChartData({
        incidentsByDay,
        incidentsBySeverity,
        checkInsByDay,
        shiftsByStatus,
        guardPerformance,
        siteCosts,
        responseTimeData
      });

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processIncidentsByDay = (incidents: any[]) => {
    const counts: { [key: string]: number } = {};
    incidents.forEach(incident => {
      const date = new Date(incident.created_at).toLocaleDateString();
      counts[date] = (counts[date] || 0) + 1;
    });
    return Object.entries(counts).map(([date, count]) => ({ date, count })).slice(-7);
  };

  const processIncidentsBySeverity = (incidents: any[]) => {
    const counts: { [key: string]: number } = {};
    incidents.forEach(incident => {
      counts[incident.severity] = (counts[incident.severity] || 0) + 1;
    });
    return Object.entries(counts).map(([severity, count]) => ({ severity, count }));
  };

  const processCheckInsByDay = (checkIns: any[]) => {
    const counts: { [key: string]: number } = {};
    checkIns.forEach(checkIn => {
      const date = new Date(checkIn.checked_in_at).toLocaleDateString();
      counts[date] = (counts[date] || 0) + 1;
    });
    return Object.entries(counts).map(([date, count]) => ({ date, count })).slice(-7);
  };

  const processShiftsByStatus = (shifts: any[]) => {
    const counts: { [key: string]: number } = {};
    shifts.forEach(shift => {
      counts[shift.status] = (counts[shift.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  };

  const calculateAvgResponseTime = (sosAlerts: any[]): string => {
    const acknowledgedAlerts = sosAlerts.filter(
      alert => alert.acknowledged_at && alert.created_at
    );

    if (acknowledgedAlerts.length === 0) return '0m';

    const totalMinutes = acknowledgedAlerts.reduce((sum, alert) => {
      const created = new Date(alert.created_at).getTime();
      const acknowledged = new Date(alert.acknowledged_at).getTime();
      const diffMinutes = (acknowledged - created) / (1000 * 60);
      return sum + diffMinutes;
    }, 0);

    const avgMinutes = Math.round(totalMinutes / acknowledgedAlerts.length);

    if (avgMinutes < 60) return `${avgMinutes}m`;
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const calculateResponseTimeData = (sosAlerts: any[]) => {
    const dataByDay: { [key: string]: { total: number; count: number } } = {};

    sosAlerts.forEach(alert => {
      if (alert.acknowledged_at && alert.created_at) {
        const date = new Date(alert.created_at).toLocaleDateString();
        const created = new Date(alert.created_at).getTime();
        const acknowledged = new Date(alert.acknowledged_at).getTime();
        const diffMinutes = (acknowledged - created) / (1000 * 60);

        if (!dataByDay[date]) {
          dataByDay[date] = { total: 0, count: 0 };
        }
        dataByDay[date].total += diffMinutes;
        dataByDay[date].count += 1;
      }
    });

    return Object.entries(dataByDay)
      .map(([day, data]) => ({
        day,
        avgMinutes: Math.round(data.total / data.count)
      }))
      .slice(-7);
  };

  const calculateGuardPerformance = async (profile: any, startDateStr: string): Promise<GuardPerformance[]> => {
    try {
      let guardsQuery = supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'security_officer');

      if (profile?.role === 'company_admin' || profile?.role === 'site_manager') {
        guardsQuery = guardsQuery.eq('company_id', profile.company_id);
      }

      const { data: guards } = await guardsQuery.limit(10);

      if (!guards) return [];

      const performanceData = await Promise.all(
        guards.map(async (guard) => {
          const [shiftsRes, checkInsRes, incidentsRes] = await Promise.all([
            supabase
              .from('shifts')
              .select('id', { count: 'exact', head: true })
              .eq('guard_id', guard.id)
              .eq('status', 'completed')
              .gte('created_at', startDateStr),
            supabase
              .from('check_ins')
              .select('id', { count: 'exact', head: true })
              .eq('guard_id', guard.id)
              .gte('created_at', startDateStr),
            supabase
              .from('incidents')
              .select('id', { count: 'exact', head: true })
              .eq('reported_by', guard.id)
              .gte('created_at', startDateStr)
          ]);

          const shiftsCompleted = shiftsRes.count || 0;
          const checkInsCompleted = checkInsRes.count || 0;
          const incidentsReported = incidentsRes.count || 0;

          const performanceScore =
            (shiftsCompleted * 10) +
            (checkInsCompleted * 2) +
            (incidentsReported * 1);

          return {
            guardName: guard.full_name,
            shiftsCompleted,
            checkInsCompleted,
            incidentsReported,
            performanceScore
          };
        })
      );

      return performanceData
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, 5);
    } catch (error) {
      console.error('Error calculating guard performance:', error);
      return [];
    }
  };

  const calculateSiteCosts = async (profile: any, startDateStr: string): Promise<SiteCosts[]> => {
    try {
      let sitesQuery = supabase
        .from('sites')
        .select('id, name');

      if (profile?.role === 'company_admin' || profile?.role === 'site_manager') {
        sitesQuery = sitesQuery.eq('company_id', profile.company_id);
      }

      const { data: sites } = await sitesQuery.limit(10);

      if (!sites) return [];

      const { data: billingSettings } = await supabase
        .from('billing_settings')
        .select('per_guard_fee')
        .maybeSingle();

      const perGuardFee = billingSettings?.per_guard_fee || 25;

      const costData = await Promise.all(
        sites.map(async (site) => {
          const [shiftsRes, guardsRes] = await Promise.all([
            supabase
              .from('shifts')
              .select('id', { count: 'exact', head: true })
              .eq('site_id', site.id)
              .gte('created_at', startDateStr),
            supabase
              .from('shifts')
              .select('guard_id')
              .eq('site_id', site.id)
              .gte('created_at', startDateStr)
          ]);

          const shiftCount = shiftsRes.count || 0;
          const uniqueGuards = new Set((guardsRes.data || []).map(s => s.guard_id)).size;
          const estimatedCost = uniqueGuards * perGuardFee;

          return {
            siteName: site.name,
            guardCount: uniqueGuards,
            shiftCount,
            estimatedCost
          };
        })
      );

      return costData.sort((a, b) => b.estimatedCost - a.estimatedCost);
    } catch (error) {
      console.error('Error calculating site costs:', error);
      return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Go back"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
            <p className="text-gray-600 mt-1">Insights and performance metrics</p>
          </div>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Guards</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalGuards}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Shifts</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeShifts}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Incidents</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalIncidents}</p>
              <p className="text-sm text-red-600 mt-1">{stats.criticalIncidents} Critical</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Check-ins</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalCheckIns}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <MapPin className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.avgResponseTime}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <TrendingUp className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Estimated Cost</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${stats.totalCost.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Based on guard fees</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Geofence Violations</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.geofenceViolations}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Target className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">SOS Alerts</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.sosAlerts}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Incidents by Day</h3>
          <div className="space-y-3">
            {chartData.incidentsByDay.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No data available</p>
            ) : (
              chartData.incidentsByDay.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600 w-24">{item.date}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full flex items-center justify-end px-3"
                      style={{ width: `${Math.min((item.count / Math.max(...chartData.incidentsByDay.map(d => d.count))) * 100, 100)}%` }}
                    >
                      <span className="text-xs font-semibold text-white">{item.count}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Incidents by Severity</h3>
          <div className="space-y-3">
            {chartData.incidentsBySeverity.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No data available</p>
            ) : (
              chartData.incidentsBySeverity.map((item, index) => {
                const colors = {
                  critical: 'bg-red-600',
                  high: 'bg-orange-600',
                  medium: 'bg-yellow-600',
                  low: 'bg-blue-600'
                };
                return (
                  <div key={index} className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600 w-24 capitalize">{item.severity}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                      <div
                        className={`${colors[item.severity as keyof typeof colors] || 'bg-gray-600'} h-full rounded-full flex items-center justify-end px-3`}
                        style={{ width: `${Math.min((item.count / Math.max(...chartData.incidentsBySeverity.map(d => d.count))) * 100, 100)}%` }}
                      >
                        <span className="text-xs font-semibold text-white">{item.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-ins by Day</h3>
          <div className="space-y-3">
            {chartData.checkInsByDay.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No data available</p>
            ) : (
              chartData.checkInsByDay.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600 w-24">{item.date}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="bg-purple-600 h-full rounded-full flex items-center justify-end px-3"
                      style={{ width: `${Math.min((item.count / Math.max(...chartData.checkInsByDay.map(d => d.count))) * 100, 100)}%` }}
                    >
                      <span className="text-xs font-semibold text-white">{item.count}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Shifts by Status</h3>
          <div className="space-y-3">
            {chartData.shiftsByStatus.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No data available</p>
            ) : (
              chartData.shiftsByStatus.map((item, index) => {
                const colors = {
                  active: 'bg-green-600',
                  completed: 'bg-blue-600',
                  scheduled: 'bg-yellow-600',
                  cancelled: 'bg-red-600'
                };
                return (
                  <div key={index} className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600 w-24 capitalize">{item.status}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                      <div
                        className={`${colors[item.status as keyof typeof colors] || 'bg-gray-600'} h-full rounded-full flex items-center justify-end px-3`}
                        style={{ width: `${Math.min((item.count / Math.max(...chartData.shiftsByStatus.map(d => d.count))) * 100, 100)}%` }}
                      >
                        <span className="text-xs font-semibold text-white">{item.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Award className="h-5 w-5 text-blue-600" />
            <span>Top Performing Guards</span>
          </h3>
          <div className="space-y-3">
            {chartData.guardPerformance.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No data available</p>
            ) : (
              chartData.guardPerformance.map((guard, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{guard.guardName}</span>
                    <span className="text-sm font-bold text-blue-600">Score: {guard.performanceScore}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">Shifts:</span> {guard.shiftsCompleted}
                    </div>
                    <div>
                      <span className="font-medium">Check-ins:</span> {guard.checkInsCompleted}
                    </div>
                    <div>
                      <span className="font-medium">Incidents:</span> {guard.incidentsReported}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span>Cost Analysis by Site</span>
          </h3>
          <div className="space-y-3">
            {chartData.siteCosts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No data available</p>
            ) : (
              chartData.siteCosts.map((site, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{site.siteName}</span>
                      <span className="text-sm font-bold text-green-600">${site.estimatedCost}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {site.guardCount} guards • {site.shiftCount} shifts
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">SOS Response Times by Day</h3>
          <div className="space-y-3">
            {chartData.responseTimeData.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No SOS alerts to analyze</p>
            ) : (
              chartData.responseTimeData.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600 w-32">{item.day}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="bg-red-600 h-full rounded-full flex items-center justify-end px-3"
                      style={{ width: `${Math.min((item.avgMinutes / Math.max(...chartData.responseTimeData.map(d => d.avgMinutes))) * 100, 100)}%` }}
                    >
                      <span className="text-xs font-semibold text-white">{item.avgMinutes}m</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
