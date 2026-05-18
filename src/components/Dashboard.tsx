import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Company } from '../lib/supabase';
import {
  Users, MapPin, Calendar, AlertTriangle, TrendingUp,
  Shield, Building, ArrowRight,
  CheckCircle, Zap, QrCode, LogIn, LogOut
} from 'lucide-react';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { showToast } from '../lib/toast';

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
  const [_superAdminStats, setSuperAdminStats] = useState<SuperAdminStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    totalUsers: 0,
    totalLeads: 0,
    systemUptime: '99.9%',
  });
  const [_recentCompanies, setRecentCompanies] = useState<any[]>([]);
  const [_recentLeads, setRecentLeads] = useState<any[]>([]);
  const [clockEntry, setClockEntry] = useState<any>(null);

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
        const officeStaffRoles = ['dispatcher', 'hr_manager', 'finance_officer', 'office_admin'];
        const isOfficeStaff = officeStaffRoles.includes(profile.role);

        if (isOfficeStaff && profile.company_id) {
          const [guardsRes, sitesRes, shiftsRes, incidentsRes, clockRes] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id).eq('role', 'security_officer'),
            supabase.from('sites').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id).eq('is_active', true),
            supabase.from('shifts').select('id, sites!inner(company_id)', { count: 'exact', head: true }).eq('sites.company_id', profile.company_id).eq('status', 'active'),
            supabase.from('incidents').select('id, sites!inner(company_id)', { count: 'exact', head: true }).eq('sites.company_id', profile.company_id).eq('status', 'open'),
            supabase.from('time_clocks').select('id, clock_in_time, shift_id, is_within_geofence')
              .eq('guard_id', profile.id)
              .is('clock_out_time', null)
              .order('clock_in_time', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          setStats({
            totalGuards: guardsRes.count || 0,
            activeSites: sitesRes.count || 0,
            activeShifts: shiftsRes.count || 0,
            openIncidents: incidentsRes.count || 0,
            activeSOSAlerts: 0,
            equipment: 0,
          });

          setClockEntry(clockRes.data);
        } else {
          const [shiftsRes, incidentsRes, clockRes] = await Promise.all([
            supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('guard_id', profile.id).eq('status', 'active'),
            supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('reported_by', profile.id),
            supabase.from('time_clocks').select('id, clock_in_time, shift_id, is_within_geofence')
              .eq('guard_id', profile.id)
              .is('clock_out_time', null)
              .order('clock_in_time', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          setStats({
            totalGuards: 0,
            activeSites: 0,
            activeShifts: shiftsRes.count || 0,
            openIncidents: incidentsRes.count || 0,
            activeSOSAlerts: 0,
            equipment: 0,
          });

          setClockEntry(clockRes.data);
        }
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
          : supabase.from('shifts').select('*, sites!inner(name, company_id), profiles!shifts_guard_id_fkey(full_name)').eq('sites.company_id', profile.company_id!);

        const { data: shifts } = await query
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(5);

        setUpcomingShifts(shifts || []);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      showToast('error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Guards',
      value: stats.totalGuards,
      icon: Users,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      action: 'guards',
      show: profile?.role !== 'security_officer',
    },
    {
      label: 'Active Sites',
      value: stats.activeSites,
      icon: MapPin,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      action: 'sites',
      show: profile?.role !== 'security_officer',
    },
    {
      label: 'Active Shifts',
      value: stats.activeShifts,
      icon: Calendar,
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      action: 'shifts',
      show: true,
    },
    {
      label: 'Open Incidents',
      value: stats.openIncidents,
      icon: AlertTriangle,
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      action: 'incidents',
      show: true,
    },
  ].filter(card => card.show);

  const employeeRoles = ['security_officer', 'dispatcher', 'hr_manager', 'finance_officer', 'office_admin'];
  const isEmployee = employeeRoles.includes(profile?.role || '');

  const quickActions = [
    {
      label: 'Schedule Shift',
      icon: Calendar,
      color: 'bg-blue-600',
      action: 'shifts',
      show: profile?.role === 'company_admin' || profile?.role === 'site_manager',
    },
    {
      label: 'Smart Schedule',
      icon: Zap,
      color: 'bg-emerald-600',
      action: 'advanced-scheduling',
      show: profile?.role === 'company_admin',
    },
    {
      label: 'Report Incident',
      icon: AlertTriangle,
      color: 'bg-orange-600',
      action: 'incidents',
      show: true,
    },
    {
      label: 'Analytics',
      icon: TrendingUp,
      color: 'bg-cyan-600',
      action: 'analytics',
      show: profile?.role === 'company_admin' || profile?.role === 'site_manager',
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

      {/* Employee Clock & Check-In Panel */}
      {isEmployee && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">My Actions</h2>
            {clockEntry && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Clocked In since {new Date(clockEntry.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Clock In/Out */}
            <button
              onClick={() => onViewChange?.('time-attendance')}
              className={`relative flex items-center gap-4 p-5 rounded-xl border-2 transition-all duration-200 group ${
                clockEntry
                  ? 'border-red-200 bg-red-50 hover:border-red-400 hover:shadow-md'
                  : 'border-green-200 bg-green-50 hover:border-green-400 hover:shadow-md'
              }`}
            >
              <div className={`p-3 rounded-xl ${clockEntry ? 'bg-red-100' : 'bg-green-100'}`}>
                {clockEntry
                  ? <LogOut className="h-7 w-7 text-red-600" />
                  : <LogIn className="h-7 w-7 text-green-600" />
                }
              </div>
              <div className="text-left">
                <p className={`text-base font-bold ${clockEntry ? 'text-red-900' : 'text-green-900'}`}>
                  {clockEntry ? 'Clock Out' : 'Clock In'}
                </p>
                <p className={`text-xs ${clockEntry ? 'text-red-600' : 'text-green-600'}`}>
                  {clockEntry ? 'End your shift' : 'Start your shift'}
                </p>
              </div>
            </button>

            {/* Checkpoint Check-In */}
            <button
              onClick={() => onViewChange?.('checkin')}
              className="flex items-center gap-4 p-5 rounded-xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:shadow-md transition-all duration-200 group"
            >
              <div className="p-3 rounded-xl bg-blue-100">
                <QrCode className="h-7 w-7 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-base font-bold text-blue-900">Check In</p>
                <p className="text-xs text-blue-600">Scan checkpoint QR</p>
              </div>
            </button>

            {/* Report Incident */}
            <button
              onClick={() => onViewChange?.('incidents')}
              className="flex items-center gap-4 p-5 rounded-xl border-2 border-orange-200 bg-orange-50 hover:border-orange-400 hover:shadow-md transition-all duration-200 group"
            >
              <div className="p-3 rounded-xl bg-orange-100">
                <AlertTriangle className="h-7 w-7 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="text-base font-bold text-orange-900">Report Incident</p>
                <p className="text-xs text-orange-600">Log a new incident</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions (admin roles) */}
      {quickActions.length > 0 && !isEmployee && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => onViewChange?.(action.action)}
                  className={`${action.color} rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-5 text-white text-center group`}
                >
                  <Icon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm font-semibold">{action.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => onViewChange?.(card.action)}
              className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 p-6 border border-gray-100 text-left group"
            >
              <div className={`${card.bgColor} p-3 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`h-7 w-7 ${card.iconColor}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">{card.label}</p>
                <p className="text-4xl font-bold text-gray-900">{card.value}</p>
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
    </div>
  );
};
