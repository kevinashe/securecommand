import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Users, Building, TrendingUp, Activity, DollarSign, HardDrive,
  AlertCircle, CheckCircle, Clock, Database, Zap, FileText
} from 'lucide-react';
import { showToast } from '../lib/toast';
import { QuickActionsPanel } from './QuickActionsPanel';
import { SimpleLineChart } from './SimpleLineChart';

interface SuperAdminStats {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalLeads: number;
  convertedLeads: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalStorage: number;
}

interface SystemHealth {
  uptime: number;
  apiResponseTime: number;
  errorRate: number;
  databaseQueryTime: number;
}

interface SuperAdminDashboardProps {
  onViewChange?: (view: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onViewChange }) => {
  const [stats, setStats] = useState<SuperAdminStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    totalUsers: 0,
    totalLeads: 0,
    convertedLeads: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalStorage: 0,
  });
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentCompanies, setRecentCompanies] = useState<any[]>([]);
  const [inactiveCompanies, setInactiveCompanies] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [
        companiesRes,
        activeCompaniesRes,
        usersRes,
        leadsRes,
        convertedLeadsRes,
      ] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('companies').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }).not('converted_to_company_id', 'is', null),
      ]);

      const { data: revenueData } = await supabase
        .from('revenue_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: storageData } = await supabase
        .from('storage_usage')
        .select('total_bytes');

      const totalStorage = storageData?.reduce((sum, s) => sum + (s.total_bytes || 0), 0) || 0;

      setStats({
        totalCompanies: companiesRes.count || 0,
        activeCompanies: activeCompaniesRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalLeads: leadsRes.count || 0,
        convertedLeads: convertedLeadsRes.count || 0,
        totalRevenue: revenueData?.total_revenue || 0,
        monthlyRevenue: revenueData?.subscription_revenue || 0,
        totalStorage: totalStorage,
      });

      const { data: companies } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentCompanies(companies || []);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: inactive } = await supabase
        .from('companies')
        .select('*')
        .eq('is_active', true)
        .lt('last_activity_at', thirtyDaysAgo.toISOString())
        .limit(5);

      setInactiveCompanies(inactive || []);

      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentActivity(auditLogs || []);

      const { data: growthMetrics } = await supabase
        .from('company_growth_metrics')
        .select('*')
        .order('date', { ascending: true })
        .limit(30);

      const formattedGrowth = growthMetrics?.map(m => ({
        date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: m.total_companies,
      })) || [];

      setGrowthData(formattedGrowth);

      const { data: activityMetrics } = await supabase
        .from('user_activity_metrics')
        .select('*')
        .order('date', { ascending: true })
        .limit(30);

      const formattedActivity = activityMetrics?.map(m => ({
        date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: m.unique_users,
      })) || [];

      setActivityData(formattedActivity);

      const { data: healthMetrics } = await supabase
        .from('system_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(4);

      if (healthMetrics && healthMetrics.length > 0) {
        const healthMap: Record<string, number> = {};
        healthMetrics.forEach((m: { metric_type: string; value: number }) => {
          healthMap[m.metric_type] = m.value;
        });

        setSystemHealth({
          uptime: healthMap.uptime ?? 0,
          apiResponseTime: healthMap.api_response_time ?? 0,
          errorRate: healthMap.error_rate ?? 0,
          databaseQueryTime: healthMap.database_query_time ?? 0,
        });
      }
    } catch (error) {
      console.error('Error loading super admin dashboard:', error);
      showToast('error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    if (!onViewChange) return;

    const actionMap: Record<string, string> = {
      'create-company': 'companies',
      'manage-users': 'guards',
      'view-billing': 'billing',
      'system-settings': 'system-settings',
      'send-notification': 'notifications',
    };

    const view = actionMap[action];
    if (view) {
      onViewChange(view);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const conversionRate = stats.totalLeads > 0
    ? ((stats.convertedLeads / stats.totalLeads) * 100).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Administration</h1>
        <p className="text-gray-600">Monitor and manage the SecureCommand platform</p>
      </div>

      <QuickActionsPanel onAction={handleQuickAction} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-green-600">
              {stats.activeCompanies} active
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Companies</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Users</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-orange-100 p-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-blue-600">
              {conversionRate}% rate
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1">Leads</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalLeads}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Monthly Revenue</p>
          <p className="text-2xl font-bold text-gray-900">
            ${(stats.monthlyRevenue || 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Company Growth</h3>
          <SimpleLineChart data={growthData} label="Total Companies" color="#3b82f6" />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">User Activity</h3>
          <SimpleLineChart data={activityData} label="Daily Active Users" color="#8b5cf6" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">System Health</h3>
        {systemHealth ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Uptime</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{systemHealth.uptime}%</p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">API Response</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{systemHealth.apiResponseTime}ms</p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-gray-700">Error Rate</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{systemHealth.errorRate}%</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">DB Query</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{systemHealth.databaseQueryTime}ms</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Database className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No system health metrics available yet</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Recent Companies</h3>
            <Building className="h-5 w-5 text-gray-400" />
          </div>

          {recentCompanies.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No companies yet</p>
          ) : (
            <div className="space-y-3">
              {recentCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{company.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(company.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    company.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {company.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Inactive Companies</h3>
            <Clock className="h-5 w-5 text-orange-400" />
          </div>

          {inactiveCompanies.length === 0 ? (
            <p className="text-gray-500 text-center py-8">All companies active</p>
          ) : (
            <div className="space-y-3">
              {inactiveCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{company.name}</p>
                    <p className="text-xs text-gray-500">
                      Last active: {new Date(company.last_activity_at).toLocaleDateString()}
                    </p>
                  </div>
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Storage Usage</h3>
            <HardDrive className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-center py-6">
            <p className="text-4xl font-bold text-gray-900 mb-2">
              {formatBytes(stats.totalStorage)}
            </p>
            <p className="text-sm text-gray-600">Total storage used</p>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600">Across {stats.activeCompanies} active companies</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">System Activity Log</h3>
          <FileText className="h-5 w-5 text-gray-400" />
        </div>

        {recentActivity.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Activity className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{log.profiles?.full_name || 'System'}</span>
                    {' '}{log.action}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-sm p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2">System Status: Online</h3>
            <p className="text-blue-100">
              {systemHealth ? `Uptime: ${systemHealth.uptime}% | All systems operational` : 'Monitoring active'}
            </p>
          </div>
          <Activity className="h-12 w-12 text-blue-200" />
        </div>
      </div>
    </div>
  );
};
