import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Company } from '../lib/supabase';
import {
  Users, MapPin, Calendar, AlertTriangle, TrendingUp,
  Shield, Package, Bell, Activity, Building
} from 'lucide-react';

interface Stats {
  totalGuards: number;
  activeSites: number;
  activeShifts: number;
  openIncidents: number;
  activeSOSAlerts: number;
  equipment: number;
}

export const Dashboard: React.FC = () => {
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

  useEffect(() => {
    loadDashboardData();
  }, [profile]);

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
        const [guardsRes, sitesRes, shiftsRes, incidentsRes, sosRes, equipmentRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('sites').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('sos_alerts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('equipment').select('id', { count: 'exact', head: true }),
        ]);

        setStats({
          totalGuards: guardsRes.count || 0,
          activeSites: sitesRes.count || 0,
          activeShifts: shiftsRes.count || 0,
          openIncidents: incidentsRes.count || 0,
          activeSOSAlerts: sosRes.count || 0,
          equipment: equipmentRes.count || 0,
        });
      } else if (profile.role === 'company_admin' || profile.role === 'site_manager') {
        const [guardsRes, sitesRes, shiftsRes, incidentsRes, sosRes, equipmentRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id!),
          supabase.from('sites').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id!).eq('is_active', true),
          supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('sos_alerts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
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

      const { data: incidents } = await supabase
        .from('incidents')
        .select('*, sites(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentIncidents(incidents || []);

      const query = profile.role === 'security_officer'
        ? supabase.from('shifts').select('*, sites(name)').eq('guard_id', profile.id)
        : supabase.from('shifts').select('*, sites(name), profiles(full_name)');

      const { data: shifts } = await query
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);

      setUpcomingShifts(shifts || []);
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
      color: 'bg-blue-500',
      show: profile?.role !== 'security_officer',
    },
    {
      label: 'Active Sites',
      value: stats.activeSites,
      icon: MapPin,
      color: 'bg-green-500',
      show: profile?.role !== 'security_officer',
    },
    {
      label: 'Active Shifts',
      value: stats.activeShifts,
      icon: Calendar,
      color: 'bg-purple-500',
      show: true,
    },
    {
      label: 'Open Incidents',
      value: stats.openIncidents,
      icon: AlertTriangle,
      color: 'bg-orange-500',
      show: true,
    },
    {
      label: 'SOS Alerts',
      value: stats.activeSOSAlerts,
      icon: Bell,
      color: 'bg-red-500',
      show: profile?.role !== 'security_officer',
    },
    {
      label: 'Equipment',
      value: stats.equipment,
      icon: Package,
      color: 'bg-indigo-500',
      show: profile?.role !== 'security_officer',
    },
  ].filter(card => card.show);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {profile?.full_name}</p>
        </div>
        {company && profile?.role === 'company_admin' && (
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Building className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Company Code</p>
                <p className="text-lg font-mono font-bold text-gray-900">{company.company_code}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Incidents</h2>
            <AlertTriangle className="h-5 w-5 text-gray-400" />
          </div>

          {recentIncidents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent incidents</p>
          ) : (
            <div className="space-y-4">
              {recentIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
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
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    incident.status === 'open' ? 'bg-red-100 text-red-700' :
                    incident.status === 'investigating' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {incident.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Upcoming Shifts</h2>
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>

          {upcomingShifts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No upcoming shifts</p>
          ) : (
            <div className="space-y-4">
              {upcomingShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
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
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    shift.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                    shift.status === 'active' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {shift.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-sm p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2">System Status: Online</h3>
            <p className="text-blue-100">All systems operational</p>
          </div>
          <Activity className="h-12 w-12 text-blue-200" />
        </div>
      </div>
    </div>
  );
};
