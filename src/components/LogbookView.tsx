import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import {
  BookOpen, Plus, X, ArrowLeft, Clock, MapPin, User,
  Filter, ChevronDown, AlertTriangle, Eye, Search, Pencil, Save
} from 'lucide-react';

interface LogbookEntry {
  id: string;
  company_id: string;
  site_id: string | null;
  guard_id: string;
  shift_id: string | null;
  entry_type: string;
  title: string;
  description: string;
  priority: string;
  created_at: string;
  guard_name?: string;
  site_name?: string;
}

interface Site {
  id: string;
  name: string;
}

interface LogbookViewProps {
  onBack?: () => void;
}

const ENTRY_TYPES = [
  { value: 'activity', label: 'Activity', color: 'bg-blue-100 text-blue-700' },
  { value: 'observation', label: 'Observation', color: 'bg-teal-100 text-teal-700' },
  { value: 'visitor', label: 'Visitor', color: 'bg-amber-100 text-amber-700' },
  { value: 'handover', label: 'Handover', color: 'bg-green-100 text-green-700' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-100 text-orange-700' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700' },
];

const PRIORITIES = [
  { value: 'normal', label: 'Normal', color: 'text-gray-600', dot: 'bg-gray-400' },
  { value: 'important', label: 'Important', color: 'text-amber-600', dot: 'bg-amber-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600', dot: 'bg-red-500' },
];

export const LogbookView: React.FC<LogbookViewProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LogbookEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSite, setFilterSite] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const [editingEntry, setEditingEntry] = useState(false);
  const [editData, setEditData] = useState({ entry_type: '', title: '', description: '', priority: '', site_id: '' });

  const [formData, setFormData] = useState({
    site_id: '',
    entry_type: 'activity',
    title: '',
    description: '',
    priority: 'normal',
  });

  const canCreate = profile?.role === 'security_officer' || profile?.role === 'site_manager';
  const canEdit = profile?.role === 'company_admin';
  const isAdmin = profile?.role === 'company_admin' || profile?.role === 'site_manager' || profile?.role === 'super_admin' || profile?.role === 'client';

  useEffect(() => {
    loadEntries();
    loadSites();
  }, [profile?.id]);

  const loadEntries = async () => {
    try {
      let query = supabase
        .from('logbook_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (profile?.role !== 'super_admin' && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const guardIds = [...new Set(data.map(e => e.guard_id))];
      const siteIds = [...new Set(data.filter(e => e.site_id).map(e => e.site_id))];

      const [guardsRes, sitesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', guardIds),
        siteIds.length > 0
          ? supabase.from('sites').select('id, name').in('id', siteIds)
          : Promise.resolve({ data: [] }),
      ]);

      const guardMap = new Map((guardsRes.data || []).map(g => [g.id, g.full_name]));
      const siteMap = new Map((sitesRes.data || []).map(s => [s.id, s.name]));

      const formatted = data.map(entry => ({
        ...entry,
        guard_name: guardMap.get(entry.guard_id) || 'Unknown',
        site_name: entry.site_id ? siteMap.get(entry.site_id) || 'Unknown Site' : null,
      }));

      setEntries(formatted);
    } catch (error) {
      console.error('Error loading logbook entries:', error);
      showToast('error', 'Failed to load logbook entries');
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      let query = supabase.from('sites').select('id, name').eq('is_active', true);
      if (profile?.company_id && profile.role !== 'super_admin') {
        query = query.eq('company_id', profile.company_id);
      }
      const { data } = await query;
      setSites(data || []);
    } catch {
      // Sites are optional context
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) {
      showToast('error', 'No company associated with your account');
      return;
    }

    try {
      const { error } = await supabase
        .from('logbook_entries')
        .insert({
          company_id: profile.company_id,
          site_id: formData.site_id || null,
          guard_id: profile.id,
          entry_type: formData.entry_type,
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
        });

      if (error) throw error;

      showToast('success', 'Logbook entry recorded');
      setShowCreateModal(false);
      setFormData({ site_id: '', entry_type: 'activity', title: '', description: '', priority: 'normal' });
      loadEntries();
    } catch (error) {
      console.error('Error creating logbook entry:', error);
      showToast('error', 'Failed to record logbook entry');
    }
  };

  const startEditing = () => {
    if (!selectedEntry) return;
    setEditData({
      entry_type: selectedEntry.entry_type,
      title: selectedEntry.title,
      description: selectedEntry.description,
      priority: selectedEntry.priority,
      site_id: selectedEntry.site_id || '',
    });
    setEditingEntry(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;

    try {
      const { error } = await supabase
        .from('logbook_entries')
        .update({
          entry_type: editData.entry_type,
          title: editData.title,
          description: editData.description,
          priority: editData.priority,
          site_id: editData.site_id || null,
        })
        .eq('id', selectedEntry.id);

      if (error) throw error;

      showToast('success', 'Logbook entry updated');
      setEditingEntry(false);
      setShowDetailModal(false);
      setSelectedEntry(null);
      loadEntries();
    } catch (error) {
      console.error('Error updating logbook entry:', error);
      showToast('error', 'Failed to update logbook entry');
    }
  };

  const getEntryTypeStyle = (type: string) => {
    return ENTRY_TYPES.find(t => t.value === type)?.color || 'bg-gray-100 text-gray-700';
  };

  const getEntryTypeLabel = (type: string) => {
    return ENTRY_TYPES.find(t => t.value === type)?.label || type;
  };

  const getPriorityInfo = (priority: string) => {
    return PRIORITIES.find(p => p.value === priority) || PRIORITIES[0];
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatTimestamp = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const filteredEntries = entries.filter(entry => {
    if (filterType !== 'all' && entry.entry_type !== filterType) return false;
    if (filterSite !== 'all' && entry.site_id !== filterSite) return false;
    if (filterPriority !== 'all' && entry.priority !== filterPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        (entry.guard_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const groupedByDate = filteredEntries.reduce<Record<string, LogbookEntry[]>>((acc, entry) => {
    const dateKey = new Date(entry.created_at).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(entry);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Security Logbook</h1>
            <p className="text-gray-600 mt-1">
              {isAdmin ? 'View all daily activity logs from security personnel' : 'Record your daily activities and observations'}
            </p>
          </div>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5" />
            <span className="font-medium">New Entry</span>
          </button>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{entries.length}</span>
          </div>
          <p className="text-sm text-gray-600">Total Entries</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <Clock className="h-5 w-5 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">
              {entries.filter(e => {
                const diff = Date.now() - new Date(e.created_at).getTime();
                return diff < 24 * 60 * 60 * 1000;
              }).length}
            </span>
          </div>
          <p className="text-sm text-gray-600">Today</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-2xl font-bold text-gray-900">
              {entries.filter(e => e.priority === 'important').length}
            </span>
          </div>
          <p className="text-sm text-gray-600">Important</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-2xl font-bold text-gray-900">
              {entries.filter(e => e.priority === 'urgent').length}
            </span>
          </div>
          <p className="text-sm text-gray-600">Urgent</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="all">All Types</option>
                {ENTRY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {sites.length > 0 && (
              <div className="relative">
                <select
                  value={filterSite}
                  onChange={(e) => setFilterSite(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="all">All Sites</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            <div className="relative">
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="all">All Priorities</option>
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Entries */}
      {Object.keys(groupedByDate).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Logbook Entries</h3>
          <p className="text-gray-500 mb-6">
            {canCreate
              ? 'Start recording your daily activities, observations, and shift notes.'
              : 'No log entries have been recorded yet.'}
          </p>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">Write First Entry</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByDate).map(([dateLabel, dateEntries]) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm font-semibold text-gray-500 whitespace-nowrap">{dateLabel}</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 hidden md:block" />

                <div className="space-y-4">
                  {dateEntries.map((entry) => {
                    const priorityInfo = getPriorityInfo(entry.priority);
                    return (
                      <div
                        key={entry.id}
                        onClick={() => { setSelectedEntry(entry); setShowDetailModal(true); setEditingEntry(false); }}
                        className="relative md:pl-12 cursor-pointer group"
                      >
                        <div className={`absolute left-3.5 top-5 h-3 w-3 rounded-full border-2 border-white shadow-sm hidden md:block ${priorityInfo.dot}`} />

                        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEntryTypeStyle(entry.entry_type)}`}>
                                {getEntryTypeLabel(entry.entry_type)}
                              </span>
                              {entry.priority !== 'normal' && (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  entry.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  <AlertTriangle className="h-3 w-3" />
                                  {priorityInfo.label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-100 whitespace-nowrap">
                              <Clock className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-xs font-semibold text-gray-700">{formatTime(entry.created_at)}</span>
                            </div>
                          </div>

                          <h3 className="font-semibold text-gray-900 mb-1.5 group-hover:text-blue-700 transition-colors">
                            {entry.title}
                          </h3>
                          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{entry.description}</p>

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                {entry.guard_name}
                              </span>
                              {entry.site_name && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {entry.site_name}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">
                              {formatTimestamp(entry.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Entry Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">New Logbook Entry</h2>
                <p className="text-sm text-gray-500 mt-0.5">Record an activity, observation, or note</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                  <select
                    value={formData.entry_type}
                    onChange={(e) => setFormData({ ...formData, entry_type: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {ENTRY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {sites.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Site (optional)</label>
                  <select
                    value={formData.site_id}
                    onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">No specific site</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Brief summary of the activity"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={5}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                  placeholder="Describe the activity in detail. Include relevant information such as time, location, people involved, actions taken, etc."
                  required
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  Record Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / Edit Modal */}
      {showDetailModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 my-8">
            {editingEntry ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Edit Logbook Entry</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Modify the entry details below</p>
                  </div>
                  <button onClick={() => setEditingEntry(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleUpdate} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                      <select
                        value={editData.entry_type}
                        onChange={(e) => setEditData({ ...editData, entry_type: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        {ENTRY_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                      <select
                        value={editData.priority}
                        onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        {PRIORITIES.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {sites.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Site (optional)</label>
                      <select
                        value={editData.site_id}
                        onChange={(e) => setEditData({ ...editData, site_id: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="">No specific site</option>
                        {sites.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                    <input
                      type="text"
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                    <textarea
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      rows={5}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                      required
                    />
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingEntry(false)}
                      className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Changes
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEntryTypeStyle(selectedEntry.entry_type)}`}>
                      {getEntryTypeLabel(selectedEntry.entry_type)}
                    </span>
                    {selectedEntry.priority !== 'normal' && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedEntry.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        <AlertTriangle className="h-3 w-3" />
                        {getPriorityInfo(selectedEntry.priority).label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button
                        onClick={startEditing}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                        title="Edit entry"
                      >
                        <Pencil className="h-4.5 w-4.5 text-gray-400 group-hover:text-blue-600" />
                      </button>
                    )}
                    <button onClick={() => { setShowDetailModal(false); setEditingEntry(false); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <X className="h-5 w-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedEntry.title}</h2>

                <div className="flex items-center gap-4 mb-5 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {selectedEntry.guard_name}
                  </span>
                  {selectedEntry.site_name && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {selectedEntry.site_name}
                    </span>
                  )}
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-5">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedEntry.description}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    {formatFullDate(selectedEntry.created_at)}
                  </div>
                  {canEdit && (
                    <button
                      onClick={startEditing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Entry
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
