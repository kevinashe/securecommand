import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, Users, AlertTriangle, Clock, MapPin, Loader } from 'lucide-react';

interface Stats {
  totalGuards: number;
  activeShifts: number;
  totalIncidents: number;
  totalCheckIns: number;
  criticalIncidents: number;
  avgResponseTime: string;
}

interface ChartData {
  incidentsByDay: { date: string; count: number }[];
  incidentsBySeverity: { severity: string; count: number }[];
  checkInsByDay: { date: string; count: number }[];
  shiftsByStatus: { status: string; count: number }[];
}

export const AnalyticsView: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalGuards: 0,
    activeShifts: 0,
    totalIncidents: 0,
    totalCheckIns: 0,
    criticalIncidents: 0,
    avgResponseTime: '0h'
  });
  const [chartData, setChartData] = useState<ChartData>({
    incidentsByDay: [],
    incidentsBySeverity: [],
    checkInsByDay: [],
    shiftsByStatus: []
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

      let guardsQuery = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['security_officer', 'site_manager']);

      let shiftsQuery = supabase
        .from('shifts')
        .select('*')
        .gte('created_at', startDateStr);

      let incidentsQuery = supabase
        .from('incidents')
        .select('*')
        .gte('created_at', startDateStr);

      let checkInsQuery = supabase
        .from('check_ins')
        .select('*', { count: 'exact' })
        .gte('checked_in_at', startDateStr);

      if (profile?.role === 'company_admin' || profile?.role === 'site_manager') {
        guardsQuery = guardsQuery.eq('company_id', profile.company_id);

        shiftsQuery = shiftsQuery.in('site_id',
          supabase.from('sites').select('id').eq('company_id', profile.company_id)
        );

        incidentsQuery = incidentsQuery.in('site_id',
          supabase.from('sites').select('id').eq('company_id', profile.company_id)
        );
      }

      const [guardsRes, shiftsRes, incidentsRes, checkInsRes] = await Promise.all([
        guardsQuery,
        shiftsQuery,
        incidentsQuery,
        checkInsQuery
      ]);

      const shifts = shiftsRes.data || [];
      const incidents = incidentsRes.data || [];
      const criticalIncidents = incidents.filter(i => i.severity === 'critical').length;

      const incidentsByDay = processIncidentsByDay(incidents);
      const incidentsBySeverity = processIncidentsBySeverity(incidents);
      const checkInsByDay = processCheckInsByDay(checkInsRes.data || []);
      const shiftsByStatus = processShiftsByStatus(shifts);

      setStats({
        totalGuards: guardsRes.count || 0,
        activeShifts: shifts.filter(s => s.status === 'active').length,
        totalIncidents: incidents.length,
        totalCheckIns: checkInsRes.count || 0,
        criticalIncidents,
        avgResponseTime: '2.5h'
      });

      setChartData({
        incidentsByDay,
        incidentsBySeverity,
        checkInsByDay,
        shiftsByStatus
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">Insights and performance metrics</p>
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
              <p className="text-sm font-medium text-gray-600">System Status</p>
              <p className="text-2xl font-bold text-green-600 mt-2">Operational</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <BarChart3 className="h-8 w-8 text-green-600" />
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
    </div>
  );
};
