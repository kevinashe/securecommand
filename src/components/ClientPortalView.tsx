import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import {
  MapPin, Users, AlertTriangle, CheckCircle, MessageSquare,
  BarChart3, Clock, Shield, Activity, FileText, ArrowLeft,
  Plus, X, Calendar, Send, DollarSign, ClipboardCheck,
  ChevronDown, Eye
} from 'lucide-react';

interface Site { id: string; name: string; address: string; contact_name: string; contact_phone: string; is_active: boolean; }
interface Guard { id: string; full_name: string; phone: string; avatar_url: string; }
interface Incident { id: string; title: string; severity: string; status: string; occurred_at: string; sites: { name: string }; }
interface CheckIn { id: string; checked_in_at: string; notes: string; checkpoints: { name: string }; profiles: { full_name: string }; }
interface CoverageRequest {
  id: string; site_id: string; request_type: string; title: string; description: string;
  requested_date: string; requested_start_time: string | null; requested_end_time: string | null;
  guards_needed: number; status: string; admin_notes: string | null; created_at: string;
  site_name?: string;
}
interface Invoice {
  id: string; invoice_number: string; billing_period_start: string; billing_period_end: string;
  total_amount: number; status: string; due_date: string; created_at: string;
}

interface ClientPortalViewProps { onBack: () => void; }

const REQUEST_TYPES = [
  { value: 'extra_coverage', label: 'Extra Coverage' },
  { value: 'schedule_change', label: 'Schedule Change' },
  { value: 'special_event', label: 'Special Event' },
  { value: 'emergency', label: 'Emergency' },
];

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'incidents' | 'checkins' | 'coverage' | 'invoices' | 'analytics'>('overview');
  const [sites, setSites] = useState<Site[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [coverageRequests, setCoverageRequests] = useState<CoverageRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ totalSites: 0, activeGuards: 0, openIncidents: 0, todayCheckIns: 0 });

  const [requestForm, setRequestForm] = useState({
    site_id: '', request_type: 'extra_coverage', title: '', description: '',
    requested_date: '', requested_start_time: '', requested_end_time: '', guards_needed: 1,
  });

  useEffect(() => {
    if (profile?.role === 'client') loadClientData();
  }, [profile]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      const { data: clientAccess, error: accessError } = await supabase
        .from('client_access').select('site_id, sites(*)').eq('client_id', profile?.id).eq('is_active', true);
      if (accessError) throw accessError;

      const clientSites = clientAccess?.map(ca => ca.sites).filter(Boolean) as Site[];
      setSites(clientSites || []);
      const siteIds = clientSites?.map(s => s.id) || [];

      if (siteIds.length > 0) {
        const [shiftsRes, incidentsRes, checkInsRes, coverageRes, invoicesRes] = await Promise.all([
          supabase.from('shifts').select('guard_id, profiles!shifts_guard_id_fkey(id, full_name, phone, avatar_url)').in('site_id', siteIds).eq('status', 'active'),
          supabase.from('incidents').select('id, title, severity, status, occurred_at, sites(name)').in('site_id', siteIds).order('occurred_at', { ascending: false }).limit(20),
          supabase.from('check_ins').select('id, checked_in_at, notes, site_id, checkpoints(name), profiles(full_name)').in('site_id', siteIds).order('checked_in_at', { ascending: false }).limit(20),
          supabase.from('coverage_requests').select('*').eq('client_id', profile?.id).order('created_at', { ascending: false }),
          supabase.from('invoices').select('id, invoice_number, billing_period_start, billing_period_end, total_amount, status, due_date, created_at').eq('company_id', profile?.company_id).order('created_at', { ascending: false }).limit(20),
        ]);

        const uniqueGuards = Array.from(new Map(shiftsRes.data?.filter(s => s.profiles).map(s => [s.profiles.id, s.profiles])).values()) as Guard[];
        setGuards(uniqueGuards);
        setIncidents((incidentsRes.data || []) as Incident[]);
        setCheckIns((checkInsRes.data || []) as CheckIn[]);
        setInvoices((invoicesRes.data || []) as Invoice[]);

        const siteMap = new Map(clientSites.map(s => [s.id, s.name]));
        setCoverageRequests((coverageRes.data || []).map(cr => ({ ...cr, site_name: siteMap.get(cr.site_id) || 'Unknown' })));

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [openCount, todayCount] = await Promise.all([
          supabase.from('incidents').select('id', { count: 'exact', head: true }).in('site_id', siteIds).in('status', ['open', 'investigating']),
          supabase.from('check_ins').select('id', { count: 'exact', head: true }).in('site_id', siteIds).gte('checked_in_at', today.toISOString()),
        ]);

        setStats({ totalSites: clientSites?.length || 0, activeGuards: uniqueGuards.length, openIncidents: openCount.count || 0, todayCheckIns: todayCount.count || 0 });
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('coverage_requests').insert({
        company_id: profile.company_id,
        client_id: profile.id,
        site_id: requestForm.site_id,
        request_type: requestForm.request_type,
        title: requestForm.title,
        description: requestForm.description,
        requested_date: requestForm.requested_date,
        requested_start_time: requestForm.requested_start_time || null,
        requested_end_time: requestForm.requested_end_time || null,
        guards_needed: requestForm.guards_needed,
      });
      if (error) throw error;
      showToast('success', 'Coverage request submitted');
      setShowRequestModal(false);
      setRequestForm({ site_id: '', request_type: 'extra_coverage', title: '', description: '', requested_date: '', requested_start_time: '', requested_end_time: '', guards_needed: 1 });
      loadClientData();
    } catch (error) {
      console.error('Error submitting request:', error);
      showToast('error', 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (profile?.role !== 'client') {
    return (
      <div className="max-w-6xl"><div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl">This view is only accessible to client users.</div></div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const severityColors: Record<string, string> = { low: 'bg-blue-100 text-blue-800', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-800' };
  const statusColors: Record<string, string> = { open: 'bg-red-100 text-red-800', investigating: 'bg-yellow-100 text-yellow-800', resolved: 'bg-green-100 text-green-800', closed: 'bg-gray-100 text-gray-800', pending: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-800', denied: 'bg-red-100 text-red-800', completed: 'bg-blue-100 text-blue-800', draft: 'bg-gray-100 text-gray-800', sent: 'bg-blue-100 text-blue-800', paid: 'bg-green-100 text-green-800', overdue: 'bg-red-100 text-red-800' };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'checkins', label: 'Check-Ins', icon: CheckCircle },
    { id: 'coverage', label: 'Coverage', icon: Shield },
    { id: 'invoices', label: 'Invoices', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="h-6 w-6 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Client Portal</h1>
          <p className="text-gray-600 mt-1">Monitor your security operations, request coverage, and view invoices</p>
        </div>
        <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
          <Plus className="h-5 w-5" /> Request Coverage
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600 mb-1">Total Sites</p><p className="text-3xl font-bold text-gray-900">{stats.totalSites}</p></div>
            <div className="bg-blue-100 p-3 rounded-xl"><MapPin className="h-7 w-7 text-blue-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600 mb-1">Active Guards</p><p className="text-3xl font-bold text-gray-900">{stats.activeGuards}</p></div>
            <div className="bg-green-100 p-3 rounded-xl"><Shield className="h-7 w-7 text-green-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600 mb-1">Open Incidents</p><p className="text-3xl font-bold text-gray-900">{stats.openIncidents}</p></div>
            <div className="bg-orange-100 p-3 rounded-xl"><AlertTriangle className="h-7 w-7 text-orange-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600 mb-1">Today's Check-Ins</p><p className="text-3xl font-bold text-gray-900">{stats.todayCheckIns}</p></div>
            <div className="bg-teal-100 p-3 rounded-xl"><CheckCircle className="h-7 w-7 text-teal-600" /></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex px-4 min-w-max">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`py-3.5 px-4 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                  <Icon className="h-4 w-4" /><span className="font-medium text-sm">{tab.label}</span>
                  {tab.id === 'coverage' && coverageRequests.filter(r => r.status === 'pending').length > 0 && (
                    <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-medium px-1.5 py-0.5 rounded-full">{coverageRequests.filter(r => r.status === 'pending').length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Sites</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sites.length > 0 ? sites.map(site => (
                    <div key={site.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{site.name}</h4>
                        {site.is_active && <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{site.address}</p>
                      {site.contact_name && <div className="text-sm text-gray-500"><p>Contact: {site.contact_name}</p>{site.contact_phone && <p>Phone: {site.contact_phone}</p>}</div>}
                    </div>
                  )) : <div className="col-span-2 text-center py-8 text-gray-500">No sites assigned.</div>}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Guards</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {guards.length > 0 ? guards.map(guard => (
                    <div key={guard.id} className="border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                      <div className="bg-blue-100 h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{guard.full_name}</p>
                        {guard.phone && <p className="text-sm text-gray-500 truncate">{guard.phone}</p>}
                      </div>
                    </div>
                  )) : <div className="col-span-3 text-center py-8 text-gray-500">No active guards assigned.</div>}
                </div>
              </div>
            </div>
          )}

          {/* Incidents Tab */}
          {activeTab === 'incidents' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Incidents</h3>
              <div className="space-y-3">
                {incidents.length > 0 ? incidents.map(incident => (
                  <div key={incident.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1"><h4 className="font-semibold text-gray-900 mb-1">{incident.title}</h4><p className="text-sm text-gray-600">{incident.sites?.name}</p></div>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${severityColors[incident.severity]}`}>{incident.severity}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[incident.status]}`}>{incident.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500"><Clock className="h-4 w-4" /><span>{new Date(incident.occurred_at).toLocaleString()}</span></div>
                  </div>
                )) : <div className="text-center py-8 text-gray-500">No incidents to display.</div>}
              </div>
            </div>
          )}

          {/* Check-Ins Tab */}
          {activeTab === 'checkins' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Check-Ins</h3>
              <div className="space-y-3">
                {checkIns.length > 0 ? checkIns.map(ci => (
                  <div key={ci.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div><h4 className="font-semibold text-gray-900">{ci.checkpoints?.name || 'Check-In'}</h4><p className="text-sm text-gray-600">Guard: {ci.profiles?.full_name}</p></div>
                      <div className="flex items-center gap-2 text-sm text-gray-500"><Clock className="h-4 w-4" /><span>{new Date(ci.checked_in_at).toLocaleString()}</span></div>
                    </div>
                    {ci.notes && <p className="text-sm text-gray-600 mt-2">{ci.notes}</p>}
                  </div>
                )) : <div className="text-center py-8 text-gray-500">No check-ins to display.</div>}
              </div>
            </div>
          )}

          {/* Coverage Requests Tab */}
          {activeTab === 'coverage' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Coverage Requests</h3>
                <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                  <Plus className="h-4 w-4" /> New Request
                </button>
              </div>
              <div className="space-y-3">
                {coverageRequests.length > 0 ? coverageRequests.map(req => (
                  <div key={req.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{req.title}</h4>
                        <p className="text-sm text-gray-600 mt-0.5">{req.site_name}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${req.request_type === 'emergency' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                          {REQUEST_TYPES.find(t => t.value === req.request_type)?.label || req.request_type}
                        </span>
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${statusColors[req.status] || 'bg-gray-100 text-gray-800'}`}>{req.status}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{req.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(req.requested_date).toLocaleDateString()}</span>
                      {req.requested_start_time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {req.requested_start_time} - {req.requested_end_time}</span>}
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {req.guards_needed} guard{req.guards_needed > 1 ? 's' : ''}</span>
                    </div>
                    {req.admin_notes && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-xs font-medium text-blue-800 mb-1">Admin Response:</p>
                        <p className="text-sm text-blue-900">{req.admin_notes}</p>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-4">No coverage requests yet</p>
                    <button onClick={() => setShowRequestModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                      <Plus className="h-4 w-4" /> Submit First Request
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoices</h3>
              <div className="space-y-3">
                {invoices.length > 0 ? invoices.map(inv => (
                  <div key={inv.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-semibold text-gray-900">Invoice #{inv.invoice_number}</h4>
                          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${statusColors[inv.status] || 'bg-gray-100 text-gray-800'}`}>{inv.status}</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(inv.billing_period_start).toLocaleDateString()} - {new Date(inv.billing_period_end).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">${inv.total_amount?.toFixed(2) || '0.00'}</p>
                        <p className="text-xs text-gray-500">Due: {new Date(inv.due_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                )) : <div className="text-center py-8 text-gray-500">No invoices to display.</div>}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Analytics & Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-3 rounded-xl"><BarChart3 className="h-6 w-6 text-blue-600" /></div>
                    <h4 className="font-semibold text-gray-900">Incident Summary</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Total Incidents</span><span className="font-semibold">{incidents.length}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Open/Investigating</span><span className="font-semibold text-orange-600">{stats.openIncidents}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Resolved</span><span className="font-semibold text-green-600">{incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length}</span></div>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-green-100 p-3 rounded-xl"><CheckCircle className="h-6 w-6 text-green-600" /></div>
                    <h4 className="font-semibold text-gray-900">Activity Summary</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Total Check-Ins</span><span className="font-semibold">{checkIns.length}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Today's Check-Ins</span><span className="font-semibold text-blue-600">{stats.todayCheckIns}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Active Sites</span><span className="font-semibold">{sites.filter(s => s.is_active).length}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Need Assistance Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Need Assistance?</h3>
            <p className="text-sm text-blue-800 mb-3">Have questions or need to report an issue? Contact your security team through the Messages section.</p>
            <button className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Open Messages</button>
          </div>
        </div>
      </div>

      {/* Coverage Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Request Coverage</h2>
                <p className="text-sm text-gray-500 mt-0.5">Submit a request for additional security coverage</p>
              </div>
              <button onClick={() => setShowRequestModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Site</label>
                <select value={requestForm.site_id} onChange={e => setRequestForm({ ...requestForm, site_id: e.target.value })} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
                  <option value="">Select a site</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Request Type</label>
                  <select value={requestForm.request_type} onChange={e => setRequestForm({ ...requestForm, request_type: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
                    {REQUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Guards Needed</label>
                  <input type="number" min={1} max={50} value={requestForm.guards_needed} onChange={e => setRequestForm({ ...requestForm, guards_needed: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input type="text" value={requestForm.title} onChange={e => setRequestForm({ ...requestForm, title: e.target.value })} required placeholder="Brief description of what you need" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input type="date" value={requestForm.requested_date} onChange={e => setRequestForm({ ...requestForm, requested_date: e.target.value })} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Time (optional)</label>
                  <input type="time" value={requestForm.requested_start_time} onChange={e => setRequestForm({ ...requestForm, requested_start_time: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">End Time (optional)</label>
                  <input type="time" value={requestForm.requested_end_time} onChange={e => setRequestForm({ ...requestForm, requested_end_time: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Details</label>
                <textarea value={requestForm.description} onChange={e => setRequestForm({ ...requestForm, description: e.target.value })} rows={3} placeholder="Additional details about your coverage needs..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRequestModal(false)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  <Send className="h-4 w-4" /> {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
