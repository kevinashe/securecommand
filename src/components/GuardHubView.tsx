import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import {
  Clock, QrCode, AlertTriangle, ShieldAlert, ArrowLeft,
  BookOpen, CalendarDays, Activity, Plus, Loader2,
  ChevronRight, MapPin, Circle,
} from 'lucide-react';

interface GuardHubViewProps {
  onViewChange: (view: string) => void;
  onBack?: () => void;
}

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  site_id: string | null;
}

interface UpcomingShift {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  site_id: string | null;
  sites?: { name: string } | null;
}

interface LogbookEntry {
  id: string;
  title: string;
  created_at: string;
  category: string | null;
}

interface RecentCheckIn {
  id: string;
  checked_in_at: string;
  checkpoints?: { name: string } | null;
}

type ActivityItem = {
  id: string;
  type: 'logbook' | 'checkin';
  label: string;
  detail: string;
  timestamp: string;
};

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

function formatRelativeTime(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function formatShiftTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatClockDuration(clockIn: string): string {
  const diffMs = Date.now() - new Date(clockIn).getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const QUICK_ACTIONS = [
  { id: 'time-attendance', label: 'Clock In/Out', icon: Clock, color: 'bg-blue-600 hover:bg-blue-700' },
  { id: 'checkin', label: 'Check In', icon: QrCode, color: 'bg-green-600 hover:bg-green-700' },
  { id: 'incidents', label: 'Report Incident', icon: AlertTriangle, color: 'bg-amber-600 hover:bg-amber-700' },
  { id: 'sos', label: 'SOS Alert', icon: ShieldAlert, color: 'bg-red-600 hover:bg-red-700' },
];

export const GuardHubView: React.FC<GuardHubViewProps> = ({ onViewChange, onBack }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clockEntry, setClockEntry] = useState<ClockEntry | null>(null);
  const [upcomingShifts, setUpcomingShifts] = useState<UpcomingShift[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [logbookNote, setLogbookNote] = useState('');
  const [showLogbookModal, setShowLogbookModal] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      loadHubData();
    }
  }, [profile?.id]);

  const loadHubData = async () => {
    if (!profile?.id || !profile?.company_id) return;
    setLoading(true);

    try {
      const [clockRes, shiftsRes, logbookRes, checkInsRes] = await Promise.all([
        supabase
          .from('time_clocks')
          .select('id, clock_in, clock_out, site_id')
          .eq('guard_id', profile.id)
          .eq('company_id', profile.company_id)
          .is('clock_out', null)
          .order('clock_in', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('shifts')
          .select('id, start_time, end_time, status, site_id, sites(name)')
          .eq('guard_id', profile.id)
          .eq('company_id', profile.company_id)
          .eq('status', 'scheduled')
          .gt('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(3),
        supabase
          .from('logbook_entries')
          .select('id, title, created_at, category')
          .eq('guard_id', profile.id)
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('check_ins')
          .select('id, checked_in_at, checkpoints(name)')
          .eq('guard_id', profile.id)
          .eq('company_id', profile.company_id)
          .order('checked_in_at', { ascending: false })
          .limit(5),
      ]);

      if (!clockRes.error) setClockEntry(clockRes.data);
      if (!shiftsRes.error) setUpcomingShifts((shiftsRes.data as unknown as UpcomingShift[]) || []);

      const activities: ActivityItem[] = [
        ...(!logbookRes.error && logbookRes.data
          ? (logbookRes.data as LogbookEntry[]).map((e) => ({
              id: `log-${e.id}`, type: 'logbook' as const,
              label: e.title || 'Logbook entry', detail: e.category || 'General',
              timestamp: e.created_at,
            }))
          : []),
        ...(!checkInsRes.error && checkInsRes.data
          ? (checkInsRes.data as unknown as RecentCheckIn[]).map((ci) => ({
              id: `ci-${ci.id}`, type: 'checkin' as const,
              label: ci.checkpoints?.name || 'Checkpoint', detail: 'Check-in completed',
              timestamp: ci.checked_in_at,
            }))
          : []),
      ];
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivityFeed(activities.slice(0, 8));
    } catch (err) {
      console.error('Error loading guard hub data:', err);
      showToast('error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogbook = async () => {
    if (!logbookNote.trim() || !profile?.id || !profile?.company_id) return;
    setSubmittingNote(true);

    try {
      const { error } = await supabase.from('logbook_entries').insert({
        guard_id: profile.id,
        company_id: profile.company_id,
        title: logbookNote.trim(),
        category: 'general',
        description: logbookNote.trim(),
      });
      if (error) throw error;

      showToast('success', 'Logbook entry saved');
      setLogbookNote('');
      setShowLogbookModal(false);
      loadHubData();
    } catch (err) {
      console.error('Error saving logbook entry:', err);
      showToast('error', 'Failed to save logbook entry');
    } finally {
      setSubmittingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <p className="text-sm text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const displayName = profile?.full_name?.split(' ')[0] || 'Guard';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Go back">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{getGreeting(displayName)}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Circle className={`h-2.5 w-2.5 fill-current ${clockEntry ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="text-sm text-gray-500">{clockEntry ? 'On duty' : 'Off duty'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Quick Actions Grid */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => onViewChange(action.id)}
                  className={`${action.color} text-white rounded-xl p-4 min-h-[80px] flex flex-col items-center justify-center gap-2 transition-colors shadow-sm active:scale-[0.97]`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Current Shift Status */}
        <section>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Shift Status</h2>
            </div>
            {clockEntry ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Clocked in at</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(clockEntry.clock_in).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Duration</span>
                  <span className="text-sm font-medium text-gray-900">{formatClockDuration(clockEntry.clock_in)}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-green-700">Currently on shift</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-gray-400" />
                  <span className="text-sm text-gray-500">Not currently on shift</span>
                </div>
                <button onClick={() => onViewChange('time-attendance')} className="text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors">
                  Clock in now
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Upcoming Shifts */}
        <section>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">Upcoming Shifts</h2>
              </div>
              <button
                onClick={() => onViewChange('shifts')}
                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                View all
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {upcomingShifts.length > 0 ? (
              <div className="space-y-3">
                {upcomingShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                  >
                    <CalendarDays className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {shift.sites?.name || 'Unassigned site'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatShiftTime(shift.start_time)} -{' '}
                        {new Date(shift.end_time).toLocaleString(undefined, {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      Scheduled
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No upcoming shifts scheduled
              </p>
            )}
          </div>
        </section>

        {/* Recent Activity Feed */}
        <section>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
              </div>
              <button
                onClick={() => onViewChange('logbook')}
                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                Logbook
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {activityFeed.length > 0 ? (
              <div className="space-y-2">
                {activityFeed.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-b-0"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {item.type === 'logbook' ? (
                        <BookOpen className="h-4 w-4 text-blue-500" />
                      ) : (
                        <MapPin className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.detail}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </section>
      </div>

      {/* Floating Action Button - Quick Logbook Entry */}
      <button
        onClick={() => setShowLogbookModal(true)}
        className="fixed bottom-6 right-6 h-14 w-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors active:scale-95 z-40"
        aria-label="Add logbook entry"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Quick Logbook Modal */}
      {showLogbookModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Quick Logbook Entry</h3>
              <button
                onClick={() => { setShowLogbookModal(false); setLogbookNote(''); }}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <span className="text-gray-400 text-xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={logbookNote}
                onChange={(e) => setLogbookNote(e.target.value)}
                placeholder="What happened? Write a quick note..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div className="p-4 pt-0 flex gap-3">
              <button
                onClick={() => { setShowLogbookModal(false); setLogbookNote(''); }}
                className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-h-[48px]"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickLogbook}
                disabled={!logbookNote.trim() || submittingNote}
                className="flex-1 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px]"
              >
                {submittingNote ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Entry'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
