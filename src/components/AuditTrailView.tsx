import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import { ArrowLeft, Shield, Plus, RefreshCw, Download, Search, Filter, ChevronDown, ChevronRight, Clock, CreditCard as Edit, Trash2, LogIn, LogOut, MapPin, AlertTriangle, FileText, Briefcase, Truck, Eye, BookOpen, Award, Webhook, BarChart3, CalendarCheck, UserCheck, UserX, Activity, Database, X } from 'lucide-react';

interface AuditLog {
  id: string;
  company_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_name?: string;
  user_role?: string;
}

interface ProfileInfo { id: string; full_name: string; role: string }
interface AuditTrailViewProps { onBack?: () => void }

const ACTION_LABELS: Record<string, string> = {
  create: 'Created', update: 'Updated', delete: 'Deleted',
  login: 'Logged in', logout: 'Logged out',
  clock_in: 'Clocked in', clock_out: 'Clocked out',
  check_in: 'Checked in', approve: 'Approved', deny: 'Denied', export: 'Exported',
};

const ENTITY_LABELS: Record<string, string> = {
  shift: 'shift', incident: 'incident', guard: 'guard', site: 'site',
  invoice: 'invoice', equipment: 'equipment', visitor: 'visitor',
  logbook: 'logbook entry', certification: 'certification',
  webhook: 'webhook', report: 'report', coverage_request: 'coverage request',
};

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' }, { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' }, { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' }, { value: 'logout', label: 'Logout' },
  { value: 'clock_in', label: 'Clock In' }, { value: 'clock_out', label: 'Clock Out' },
  { value: 'check_in', label: 'Check In' }, { value: 'approve', label: 'Approve' },
  { value: 'deny', label: 'Deny' }, { value: 'export', label: 'Export' },
];

const ENTITY_TYPES = [
  { value: 'all', label: 'All Entities' }, { value: 'shift', label: 'Shift' },
  { value: 'incident', label: 'Incident' }, { value: 'guard', label: 'Guard' },
  { value: 'site', label: 'Site' }, { value: 'invoice', label: 'Invoice' },
  { value: 'equipment', label: 'Equipment' }, { value: 'visitor', label: 'Visitor' },
  { value: 'logbook', label: 'Logbook' }, { value: 'certification', label: 'Certification' },
  { value: 'webhook', label: 'Webhook' }, { value: 'report', label: 'Report' },
  { value: 'coverage_request', label: 'Coverage Request' },
];

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

function getActionColor(action: string): { bg: string; text: string; icon: string } {
  switch (action) {
    case 'create': return { bg: 'bg-green-100', text: 'text-green-700', icon: 'text-green-500' };
    case 'update': return { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'text-blue-500' };
    case 'delete': return { bg: 'bg-red-100', text: 'text-red-700', icon: 'text-red-500' };
    case 'login': case 'logout':
      return { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'text-gray-500' };
    case 'clock_in': case 'check_in':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'text-emerald-500' };
    case 'clock_out': return { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'text-amber-500' };
    case 'approve': return { bg: 'bg-green-100', text: 'text-green-700', icon: 'text-green-500' };
    case 'deny': return { bg: 'bg-red-100', text: 'text-red-700', icon: 'text-red-500' };
    case 'export': return { bg: 'bg-purple-100', text: 'text-purple-700', icon: 'text-purple-500' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'text-gray-500' };
  }
}

function getEntityIcon(entityType: string) {
  const map: Record<string, typeof Clock> = {
    shift: Clock, incident: AlertTriangle, guard: Shield, site: MapPin,
    invoice: FileText, equipment: Truck, visitor: Eye, logbook: BookOpen,
    certification: Award, webhook: Webhook, report: BarChart3, coverage_request: Briefcase,
  };
  return map[entityType] || Database;
}

function getActionIcon(action: string) {
  const map: Record<string, typeof Plus> = {
    create: Plus, update: Edit, delete: Trash2, login: LogIn, logout: LogOut,
    clock_in: CalendarCheck, clock_out: Clock, check_in: UserCheck,
    approve: UserCheck, deny: UserX, export: Download,
  };
  return map[action] || Activity;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(dateStr).toLocaleString();
}

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatChanges(changes: Record<string, { old: unknown; new: unknown }> | null): React.ReactNode {
  if (!changes || Object.keys(changes).length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {Object.entries(changes).map(([field, diff]) => {
        const oldVal = diff.old == null ? '(empty)' : String(diff.old);
        const newVal = diff.new == null ? '(empty)' : String(diff.new);
        return (
          <div key={field} className="flex items-start gap-2 text-sm font-mono">
            <span className="text-gray-500 font-medium min-w-[100px]">{field}:</span>
            <span className="text-red-600 line-through bg-red-50 px-1 rounded truncate max-w-[200px]" title={oldVal}>{oldVal}</span>
            <span className="text-gray-400">-&gt;</span>
            <span className="text-green-600 bg-green-50 px-1 rounded truncate max-w-[200px]" title={newVal}>{newVal}</span>
          </div>
        );
      })}
    </div>
  );
}

function groupLogsByDate(logs: AuditLog[]): Record<string, AuditLog[]> {
  const groups: Record<string, AuditLog[]> = {};
  for (const log of logs) {
    const key = new Date(log.created_at).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(log);
  }
  return groups;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [statsToday, setStatsToday] = useState({ total: 0, creates: 0, updates: 0, deletes: 0 });

  const PAGE_SIZE = 100;
  const isAdmin = profile?.role === 'company_admin' || profile?.role === 'super_admin';

  useEffect(() => {
    if (!isAdmin) return;
    fetchProfiles();
    fetchLogs(false);
    fetchStats();
  }, [profile?.company_id]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchLogs(false);
  }, [filterAction, filterEntity, filterUser, dateStart, dateEnd]);

  const fetchProfiles = async () => {
    if (!profile?.company_id) return;
    const { data, error } = await supabase
      .from('profiles').select('id, full_name, role').eq('company_id', profile.company_id);
    if (error) { showToast('error', 'Failed to load user profiles'); return; }
    setProfiles(data || []);
  };

  const fetchStats = async () => {
    if (!profile?.company_id) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('audit_logs').select('action').eq('company_id', profile.company_id)
      .gte('created_at', todayStart.toISOString());
    if (error) return;
    const items = data || [];
    setStatsToday({
      total: items.length,
      creates: items.filter((l) => l.action === 'create').length,
      updates: items.filter((l) => l.action === 'update').length,
      deletes: items.filter((l) => l.action === 'delete').length,
    });
  };

  const fetchLogs = async (loadMore: boolean) => {
    if (!profile?.company_id) return;
    loadMore ? setLoadingMore(true) : setLoading(true);

    let query = supabase
      .from('audit_logs').select('*').eq('company_id', profile.company_id)
      .order('created_at', { ascending: false }).limit(PAGE_SIZE);

    if (filterAction !== 'all') query = query.eq('action', filterAction);
    if (filterEntity !== 'all') query = query.eq('entity_type', filterEntity);
    if (filterUser !== 'all') query = query.eq('user_id', filterUser);
    if (dateStart) query = query.gte('created_at', new Date(dateStart).toISOString());
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    if (loadMore && logs.length > 0) {
      query = query.lt('created_at', logs[logs.length - 1].created_at);
    }

    const { data, error } = await query;
    if (error) {
      showToast('error', 'Failed to load audit logs');
      setLoading(false); setLoadingMore(false); return;
    }

    const items = data || [];
    setHasMore(items.length === PAGE_SIZE);

    const enriched = items.map((log) => {
      const p = profiles.find((u) => u.id === log.user_id);
      return { ...log, user_name: p?.full_name || 'Unknown User', user_role: p?.role || 'unknown' };
    });

    loadMore ? setLogs((prev) => [...prev, ...enriched]) : setLogs(enriched);
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    if (profiles.length > 0 && logs.length > 0) {
      setLogs((prev) => prev.map((log) => {
        const p = profiles.find((u) => u.id === log.user_id);
        return { ...log, user_name: p?.full_name || log.user_name || 'Unknown User', user_role: p?.role || log.user_role || 'unknown' };
      }));
    }
  }, [profiles]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRefresh = () => { fetchLogs(false); fetchStats(); };

  const handleExportCSV = () => {
    if (logs.length === 0) { showToast('warning', 'No data to export'); return; }
    const headers = ['Date', 'User', 'Action', 'Entity Type', 'Entity ID', 'Changes'];
    const rows = logs.map((log) => [
      new Date(log.created_at).toLocaleString(), log.user_name || 'Unknown',
      getActionLabel(log.action), log.entity_type || '', log.entity_id || '',
      log.changes ? JSON.stringify(log.changes) : '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', 'Audit trail exported successfully');
  };

  const clearFilters = () => {
    setFilterAction('all'); setFilterEntity('all'); setFilterUser('all');
    setSearchQuery(''); setDateStart(''); setDateEnd('');
  };

  const hasActiveFilters = filterAction !== 'all' || filterEntity !== 'all' ||
    filterUser !== 'all' || dateStart !== '' || dateEnd !== '' || searchQuery !== '';

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (log.entity_id?.toLowerCase().includes(q)) ||
      (log.changes ? JSON.stringify(log.changes).toLowerCase().includes(q) : false) ||
      (log.user_name?.toLowerCase().includes(q)) ||
      log.action.toLowerCase().includes(q) ||
      log.entity_type?.toLowerCase().includes(q);
  });

  const groupedLogs = groupLogsByDate(filteredLogs);
  const dateKeys = Object.keys(groupedLogs).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-500 mb-4">Only company administrators and super administrators can view the audit trail.</p>
          {onBack && (
            <button onClick={onBack} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, color }: { icon: typeof Plus; label: string; value: number; color: string }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color === 'text-indigo-500' ? 'text-gray-900' : color.replace('500', '600')}`}>{value}</p>
    </div>
  );

  const FilterSelect = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  Audit Trail
                </h1>
                <p className="text-sm text-gray-500">Track all changes and activity across your organization</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleRefresh} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
              <button onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Activity} label="Events Today" value={statsToday.total} color="text-indigo-500" />
          <StatCard icon={Plus} label="Creates" value={statsToday.creates} color="text-green-500" />
          <StatCard icon={Edit} label="Updates" value={statsToday.updates} color="text-blue-500" />
          <StatCard icon={Trash2} label="Deletes" value={statsToday.deletes} color="text-red-500" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">Active</span>}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by entity ID, user, or changes..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLogs(false)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <FilterSelect label="Action" value={filterAction} onChange={setFilterAction} options={ACTION_TYPES} />
              <FilterSelect label="Entity Type" value={filterEntity} onChange={setFilterEntity} options={ENTITY_TYPES} />
              <FilterSelect label="User" value={filterUser} onChange={setFilterUser}
                options={[{ value: 'all', label: 'All Users' }, ...profiles.map((p) => ({ value: p.id, label: p.full_name }))]} />
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading audit trail...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No audit events found</p>
              <p className="text-gray-400 text-sm mt-1">
                {hasActiveFilters ? 'Try adjusting your filters to see more results.' : 'Activity will appear here as changes are made.'}
              </p>
            </div>
          ) : dateKeys.map((dateKey) => {
            const dayLogs = groupedLogs[dateKey];
            return (
              <div key={dateKey}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-gray-900 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {formatDateGroup(dateKey)}
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{dayLogs.length} event{dayLogs.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="relative">
                  <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gray-200" />
                  <div className="space-y-1">
                    {dayLogs.map((log, idx) => {
                      const ac = getActionColor(log.action);
                      const ActionIcon = getActionIcon(log.action);
                      const EntityIcon = getEntityIcon(log.entity_type);
                      const isExpanded = expandedIds.has(log.id);
                      const hasChanges = log.changes && Object.keys(log.changes).length > 0;
                      const entityLabel = ENTITY_LABELS[log.entity_type] || log.entity_type;
                      const showEntity = !['login', 'logout'].includes(log.action);

                      return (
                        <div key={log.id} className={`relative flex gap-4 ${idx < dayLogs.length - 1 ? 'pb-3' : ''}`}>
                          <div className="relative z-10 flex-shrink-0">
                            <div className={`w-[46px] h-[46px] rounded-full flex items-center justify-center ${ac.bg} border-2 border-white shadow-sm`}>
                              <ActionIcon className={`w-5 h-5 ${ac.icon}`} />
                            </div>
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-semibold text-gray-600">
                                      {(log.user_name || 'U').charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <span className="text-sm font-semibold text-gray-900 truncate">{log.user_name}</span>
                                  {log.user_role && (
                                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                                      {log.user_role.replace('_', ' ')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${ac.bg} ${ac.text}`}>
                                    {getActionLabel(log.action)}
                                  </span>
                                  {showEntity && (
                                    <>
                                      <span className="text-sm text-gray-500">a</span>
                                      <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                                        <EntityIcon className="w-3.5 h-3.5 text-gray-400" />
                                        {entityLabel}
                                      </span>
                                    </>
                                  )}
                                  {log.entity_id && (
                                    <span className="text-xs text-gray-400 font-mono truncate max-w-[140px]" title={log.entity_id}>
                                      {log.entity_id.substring(0, 8)}...
                                    </span>
                                  )}
                                </div>
                                {log.ip_address && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    IP: {log.ip_address}
                                    {log.user_agent && (
                                      <span className="ml-2 truncate inline-block max-w-[200px] align-bottom" title={log.user_agent}>
                                        {log.user_agent}
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <p className="text-xs text-gray-500 whitespace-nowrap">{formatRelativeTime(log.created_at)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            {hasChanges && (
                              <div className="mt-2">
                                <button onClick={() => toggleExpanded(log.id)}
                                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  {Object.keys(log.changes!).length} field{Object.keys(log.changes!).length !== 1 ? 's' : ''} changed
                                </button>
                                {isExpanded && (
                                  <div className="mt-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                                    {formatChanges(log.changes)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More */}
        {!loading && hasMore && filteredLogs.length > 0 && (
          <div className="text-center py-4">
            <button onClick={() => fetchLogs(true)} disabled={loadingMore}
              className="px-6 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
              {loadingMore ? (
                <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading...</span>
              ) : 'Load More'}
            </button>
          </div>
        )}

        {!loading && filteredLogs.length > 0 && (
          <p className="text-center text-xs text-gray-400 pb-4">
            Showing {filteredLogs.length} event{filteredLogs.length !== 1 ? 's' : ''}
            {hasMore && ' (scroll down or click Load More for older events)'}
          </p>
        )}
      </div>
    </div>
  );
};
