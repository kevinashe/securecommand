import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  MapPin, Users, AlertTriangle, CheckCircle, MessageSquare,
  BarChart3, Clock, Shield, Activity, FileText, ArrowLeft
} from 'lucide-react';

interface Site {
  id: string;
  name: string;
  address: string;
  contact_name: string;
  contact_phone: string;
  is_active: boolean;
}

interface Guard {
  id: string;
  full_name: string;
  phone: string;
  avatar_url: string;
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  occurred_at: string;
  sites: { name: string };
}

interface CheckIn {
  id: string;
  checked_in_at: string;
  notes: string;
  checkpoints: { name: string };
  profiles: { full_name: string };
}

interface ClientPortalViewProps {
  onBack: () => void;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'incidents' | 'checkins' | 'analytics'>('overview');
  const [sites, setSites] = useState<Site[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [stats, setStats] = useState({
    totalSites: 0,
    activeGuards: 0,
    openIncidents: 0,
    todayCheckIns: 0
  });

  useEffect(() => {
    if (profile?.role === 'client') {
      loadClientData();
    }
  }, [profile]);

  const loadClientData = async () => {
    try {
      setLoading(true);

      const { data: clientAccess, error: accessError } = await supabase
        .from('client_access')
        .select('site_id, sites(*)')
        .eq('client_id', profile?.id)
        .eq('is_active', true);

      if (accessError) throw accessError;

      const clientSites = clientAccess?.map(ca => ca.sites).filter(Boolean) as Site[];
      setSites(clientSites || []);

      const siteIds = clientSites?.map(s => s.id) || [];

      if (siteIds.length > 0) {
        const { data: shiftsData } = await supabase
          .from('shifts')
          .select('guard_id, profiles!shifts_guard_id_fkey(id, full_name, phone, avatar_url)')
          .in('site_id', siteIds)
          .eq('status', 'active');

        const uniqueGuards = Array.from(
          new Map(
            shiftsData
              ?.filter(s => s.profiles)
              .map(s => [s.profiles.id, s.profiles])
          ).values()
        ) as Guard[];

        setGuards(uniqueGuards);

        const { data: incidentsData } = await supabase
          .from('incidents')
          .select('id, title, severity, status, occurred_at, sites(name)')
          .in('site_id', siteIds)
          .order('occurred_at', { ascending: false })
          .limit(20);

        setIncidents((incidentsData || []) as Incident[]);

        const { data: checkInsData } = await supabase
          .from('check_ins')
          .select(`
            id,
            checked_in_at,
            notes,
            site_id,
            checkpoints(name),
            profiles(full_name)
          `)
          .in('site_id', siteIds)
          .order('checked_in_at', { ascending: false })
          .limit(20);

        setCheckIns((checkInsData || []) as CheckIn[]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count: openIncidentsCount } = await supabase
          .from('incidents')
          .select('id', { count: 'exact', head: true })
          .in('site_id', siteIds)
          .in('status', ['open', 'investigating']);

        const { count: todayCheckInsCount } = await supabase
          .from('check_ins')
          .select('id', { count: 'exact', head: true })
          .in('site_id', siteIds)
          .gte('checked_in_at', today.toISOString());

        setStats({
          totalSites: clientSites?.length || 0,
          activeGuards: uniqueGuards.length,
          openIncidents: openIncidentsCount || 0,
          todayCheckIns: todayCheckInsCount || 0
        });
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'client') {
    return (
      <div className="max-w-6xl">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          This view is only accessible to client users.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const severityColors: Record<string, string> = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  };

  const statusColors: Record<string, string> = {
    open: 'bg-red-100 text-red-800',
    investigating: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Dashboard</span>
      </button>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-gray-600 mt-1">Monitor your security operations and sites</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Sites</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalSites}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <MapPin className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Guards</p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeGuards}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Open Incidents</p>
              <p className="text-3xl font-bold text-gray-900">{stats.openIncidents}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Today's Check-Ins</p>
              <p className="text-3xl font-bold text-gray-900">{stats.todayCheckIns}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <CheckCircle className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex space-x-4 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span className="font-medium">Overview</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('incidents')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'incidents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Incidents</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('checkins')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'checkins'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Check-Ins</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'analytics'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span className="font-medium">Analytics</span>
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Sites</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sites.length > 0 ? (
                    sites.map((site) => (
                      <div
                        key={site.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{site.name}</h4>
                          {site.is_active && (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{site.address}</p>
                        {site.contact_name && (
                          <div className="text-sm text-gray-500">
                            <p>Contact: {site.contact_name}</p>
                            {site.contact_phone && <p>Phone: {site.contact_phone}</p>}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8 text-gray-500">
                      No sites assigned to your account.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Guards</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {guards.length > 0 ? (
                    guards.map((guard) => (
                      <div
                        key={guard.id}
                        className="border border-gray-200 rounded-lg p-4 flex items-center space-x-3"
                      >
                        <div className="bg-blue-100 h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{guard.full_name}</p>
                          {guard.phone && (
                            <p className="text-sm text-gray-500 truncate">{guard.phone}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-8 text-gray-500">
                      No active guards currently assigned.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'incidents' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Incidents</h3>
              <div className="space-y-3">
                {incidents.length > 0 ? (
                  incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">{incident.title}</h4>
                          <p className="text-sm text-gray-600">{incident.sites?.name}</p>
                        </div>
                        <div className="flex space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${severityColors[incident.severity]}`}>
                            {incident.severity}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[incident.status]}`}>
                            {incident.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(incident.occurred_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No incidents to display.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'checkins' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Check-Ins</h3>
              <div className="space-y-3">
                {checkIns.length > 0 ? (
                  checkIns.map((checkIn) => (
                    <div
                      key={checkIn.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{checkIn.checkpoints?.name || 'Check-In'}</h4>
                          <p className="text-sm text-gray-600">Guard: {checkIn.profiles?.full_name}</p>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Clock className="h-4 w-4" />
                          <span>{new Date(checkIn.checked_in_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {checkIn.notes && (
                        <p className="text-sm text-gray-600 mt-2">{checkIn.notes}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No check-ins to display.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Analytics & Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Incident Summary</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Incidents</span>
                      <span className="font-semibold">{incidents.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Open/Investigating</span>
                      <span className="font-semibold text-orange-600">{stats.openIncidents}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Resolved</span>
                      <span className="font-semibold text-green-600">
                        {incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-green-100 p-3 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Activity Summary</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Check-Ins</span>
                      <span className="font-semibold">{checkIns.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Today's Check-Ins</span>
                      <span className="font-semibold text-blue-600">{stats.todayCheckIns}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Active Sites</span>
                      <span className="font-semibold">{sites.filter(s => s.is_active).length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Custom Reports</h4>
                    <p className="text-sm text-blue-800">
                      Need detailed reports? Contact your security manager to set up automated reports
                      delivered to your email on a schedule of your choosing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <MessageSquare className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Need Assistance?</h3>
            <p className="text-sm text-blue-800 mb-3">
              Have questions or need to report an issue? Contact your security team directly through
              the Messages section or reach out to your account manager.
            </p>
            <button className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Open Messages
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
