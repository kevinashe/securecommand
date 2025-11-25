import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Company } from '../lib/supabase';
import {
  Users, MapPin, Calendar, AlertTriangle, TrendingUp,
  Shield, Package, Bell, Activity, Building, ArrowRight,
  Clock, CheckCircle, Zap, Eye
} from 'lucide-react';
import { SuperAdminDashboard } from './SuperAdminDashboard';

interface Stats {
  totalGuards: number;
  activeSites: number;
  activeShifts: number;
  openIncidents: number;
  activeSOSAlerts: number;
  equipment: number;
}

interface SuperAdminStats {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalLeads: number;
  systemUptime: string;
}

interface DashboardProps {
  onViewChange?: (view: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalGuards: 0,
    activeSites: 0,
    activeShifts: 0,
    openIncidents: 0,
    activeSOSAlerts: 0,
    equipment: 0,
  });
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentIncidents, setRecentIncidents] = useState<any[]>([]);
  const [upcomingShifts, setUpcomingShifts] = useState<any[]>([]);
  const [superAdminStats, setSuperAdminStats] = useState<SuperAdminStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    totalUsers: 0,
    totalLeads: 0,
    systemUptime: '99.9%',
  });
  const [recentCompanies, setRecentCompanies] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [profile?.id]);

  const loadDashboardData = async () => {
    if (!profile) return;

    try {
      if (profile.company_id && profile.role !== 'super_admin') {
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .maybeSingle();

        setCompany(companyData);
      }

      if (profile.role === 'super_admin') {
        const [companiesRes, activeCompaniesRes, usersRes, leadsRes] = await Promise.all([
          supabase.from('companies').select('id', { count: 'exact', head: true }),
          supabase.from('companies').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id', { count: 'exact', head: true }),
        ]);

        setSuperAdminStats({
          totalCompanies: companiesRes.count || 0,
          activeCompanies: activeCompaniesRes.count || 0,
          totalUsers: usersRes.count || 0,
          totalLeads: leadsRes.count || 0,
          systemUptime: '99.9%',
        });

        const { data: companies } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentCompanies(companies || []);

        const { data: leads } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentLeads(leads || []);
      } else if (profile.role === 'company_admin' || profile.role === 'site_manager') {
        const [guardsRes, sitesRes, shiftsRes, incidentsRes, sosRes, equipmentRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id!).eq('role', 'security_officer'),
          supabase.from('sites').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id!).eq('is_active', true),
          supabase.from('shifts').select('id, sites!inner(company_id)', { count: 'exact', head: true }).eq('sites.company_id', profile.company_id!).eq('status', 'active'),
          supabase.from('incidents').select('id, sites!inner(company_id)', { count: 'exact', head: true }).eq('sites.company_id', profile.company_id!).eq('status', 'open'),
          supabase.from('sos_alerts').select('id, sites!inner(company_id)', { count: 'exact', head: true }).eq('sites.company_id', profile.company_id!).eq('status', 'active'),
          supabase.from('equipment').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id!),
        ]);

        setStats({
          totalGuards: guardsRes.count || 0,
          activeSites: sitesRes.count || 0,
          activeShifts: shiftsRes.count || 0,
          openIncidents: incidentsRes.count || 0,
          activeSOSAlerts: sosRes.count || 0,
          equipment: equipmentRes.count || 0,
        });
      } else {
        const [shiftsRes, incidentsRes] = await Promise.all([
          supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('guard_id', profile.id).eq('status', 'active'),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('reported_by', profile.id),
        ]);

        setStats({
          totalGuards: 0,
          activeSites: 0,
          activeShifts: shiftsRes.count || 0,
          openIncidents: incidentsRes.count || 0,
          activeSOSAlerts: 0,
          equipment: 0,
        });
      }

      if (profile.role !== 'super_admin') {
        const { data: incidents } = await supabase
          .from('incidents')
          .select('*, sites(name)')
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentIncidents(incidents || []);

        const query = profile.role === 'security_officer'
          ? supabase.from('shifts').select('*, sites(name)').eq('guard_id', profile.id)
          : supabase.from('shifts').select('*, sites(name), profiles!shifts_guard_id_fkey(full_name)');

        const { data: shifts } = await query
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(5);

        setUpcomingShifts(shifts || []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Guards',
      value: stats.totalGuards,
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: '+12%',
      action: 'guards',
      show: profile?.role !== 'security_officer',
    },
    {
      label: 'Active Sites',
      value: stats.activeSites,
      icon: MapPin,
      gradient: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: '+5%',
      action: 'sites',
      show: profile?.role !== 'security_officer',
    },
    {
      label: 'Active Shifts',
      value: stats.activeShifts,
      icon: Calendar,
      gradient: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      trend: '+8%',
      action: 'shifts',
      show: true,
    },
    {
      label: 'Open Incidents',
      value: stats.openIncidents,
      icon: AlertTriangle,
      gradient: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      trend: '-3%',
      action: 'incidents',
      show: true,
    },
    {
      label: 'SOS Alerts',
      value: stats.activeSOSAlerts,
      icon: Bell,
      gradient: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      trend: '0%',
      action: 'sos-alerts',
      show: profile?.role !== 'security_officer',
    },
    {
      label: 'Equipment',
      value: stats.equipment,
      icon: Package,
      gradient: 'from-cyan-500 to-cyan-600',
      bgColor: 'bg-cyan-50',
      iconColor: 'text-cyan-600',
      trend: '+2%',
      action: 'equipment',
      show: profile?.role !== 'security_officer',
    },
  ].filter(card => card.show);

  const quickActions = [
    {
      label: 'Create Shift',
      description: 'Schedule a new guard shift',
      icon: Calendar,
      color: 'bg-gradient-to-br from-blue-500 to-blue-600',
      action: 'shifts',
      show: profile?.role === 'company_admin' || profile?.role === 'site_manager',
    },
    {
      label: 'Smart Schedule',
      description: 'Auto-assign shifts with AI',
      icon: Zap,
      color: 'bg-gradient-to-br from-purple-500 to-purple-600',
      action: 'advanced-scheduling',
      show: profile?.role === 'company_admin',
    },
    {
      label: 'Clock In',
      description: 'Start your shift now',
      icon: Clock,
      color: 'bg-gradient-to-br from-green-500 to-green-600',
      action: 'time-attendance',
      show: profile?.role === 'security_officer',
    },
    {
      label: 'Report Incident',
      description: 'File a new incident report',
      icon: AlertTriangle,
      color: 'bg-gradient-to-br from-orange-500 to-orange-600',
      action: 'incidents',
      show: true,
    },
    {
      label: 'View Analytics',
      description: 'Check performance metrics',
      icon: TrendingUp,
      color: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
      action: 'analytics',
      show: profile?.role === 'company_admin' || profile?.role === 'site_manager',
    },
    {
      label: 'Generate Invoice',
      description: 'Create client invoice',
      icon: Package,
      color: 'bg-gradient-to-br from-pink-500 to-pink-600',
      action: 'invoicing',
      show: profile?.role === 'company_admin',
    },
  ].filter(action => action.show);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (profile?.role === 'super_admin') {
    return <SuperAdminDashboard onViewChange={onViewChange} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Dashboard</h1>
          <p className="text-gray-600">Welcome back, <span className="font-semibold text-gray-900">{profile?.full_name}</span></p>
        </div>
        {company && profile?.role === 'company_admin' && (
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <Building className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-100 mb-1">Company Code</p>
                <p className="text-lg font-mono font-bold text-white">{company.company_code}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => onViewChange?.(card.action)}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6 border border-gray-200 text-left group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${card.bgColor} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                  <Icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-green-600">
                  <TrendingUp className="h-3 w-3" />
                  {card.trend}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className="mt-3 flex items-center text-sm text-gray-500 group-hover:text-blue-600 transition-colors">
                <span>View details</span>
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => onViewChange?.(action.action)}
              className={`${action.color} rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 p-6 text-white text-left group hover:scale-105`}
            >
              <Icon className="h-8 w-8 mb-3 opacity-90" />
              <h3 className="text-lg font-bold mb-1">{action.label}</h3>
              <p className="text-sm text-white/80">{action.description}</p>
              <div className="mt-3 flex items-center text-sm font-semibold">
                <span>Get started</span>
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Incidents</h2>
            <button
              onClick={() => onViewChange?.('incidents')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {recentIncidents.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-gray-500">No recent incidents</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentIncidents.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => onViewChange?.('incidents')}
                  className="w-full flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div className={`p-2 rounded-lg ${
                    incident.severity === 'critical' ? 'bg-red-100' :
                    incident.severity === 'high' ? 'bg-orange-100' :
                    incident.severity === 'medium' ? 'bg-yellow-100' :
                    'bg-blue-100'
                  }`}>
                    <AlertTriangle className={`h-4 w-4 ${
                      incident.severity === 'critical' ? 'text-red-600' :
                      incident.severity === 'high' ? 'text-orange-600' :
                      incident.severity === 'medium' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {incident.title}
                    </p>
                    <p className="text-xs text-gray-500">{incident.sites?.name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize font-medium ${
                    incident.status === 'open' ? 'bg-red-100 text-red-700' :
                    incident.status === 'investigating' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {incident.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Upcoming Shifts</h2>
            <button
              onClick={() => onViewChange?.('shifts')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {upcomingShifts.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No upcoming shifts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingShifts.map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => onViewChange?.('shifts')}
                  className="w-full flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Shield className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {shift.sites?.name}
                    </p>
                    {shift.profiles && (
                      <p className="text-xs text-gray-600">{shift.profiles.full_name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(shift.start_time).toLocaleString()} -{' '}
                      {new Date(shift.end_time).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize font-medium ${
                    shift.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                    shift.status === 'active' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {shift.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-6 w-6" />
              <h3 className="text-2xl font-bold">System Status: Online</h3>
            </div>
            <p className="text-blue-100">All systems operational • Last checked: {new Date().toLocaleTimeString()}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
            <CheckCircle className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
};
