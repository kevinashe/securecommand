import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Shield,
  Clock,
  Mail,
  Smartphone,
  AlertTriangle,
  FileText,
  Award,
  CalendarClock,
  Loader,
  Save,
  Info,
} from 'lucide-react';

interface NotificationPreference {
  id?: string;
  company_id: string | null;
  user_id: string;
  notify_missed_checkin: boolean;
  notify_sos: boolean;
  notify_shift_reminder: boolean;
  notify_incident: boolean;
  notify_certification_expiry: boolean;
  reminder_minutes_before: number;
  email_enabled: boolean;
  sms_enabled: boolean;
}

interface RecentAlert {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationPreferencesViewProps {
  onBack?: () => void;
}

const Toggle: React.FC<{ enabled: boolean; onToggle: () => void }> = ({ enabled, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    onClick={onToggle}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      enabled ? 'bg-blue-600' : 'bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const defaultPreferences: Omit<NotificationPreference, 'user_id' | 'company_id'> = {
  notify_missed_checkin: true,
  notify_sos: true,
  notify_shift_reminder: true,
  notify_incident: true,
  notify_certification_expiry: true,
  reminder_minutes_before: 30,
  email_enabled: true,
  sms_enabled: false,
};

export const NotificationPreferencesView: React.FC<NotificationPreferencesViewProps> = ({ onBack }) => {
  const { profile } = useAuth();

  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (profile) {
      loadPreferences();
      loadRecentAlerts();
    }
  }, [profile]);

  const loadPreferences = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingId(data.id);
        setPreferences({
          id: data.id,
          company_id: data.company_id,
          user_id: data.user_id,
          notify_missed_checkin: data.notify_missed_checkin,
          notify_sos: data.notify_sos,
          notify_shift_reminder: data.notify_shift_reminder,
          notify_incident: data.notify_incident,
          notify_certification_expiry: data.notify_certification_expiry,
          reminder_minutes_before: data.reminder_minutes_before,
          email_enabled: data.email_enabled,
          sms_enabled: data.sms_enabled,
        });
      } else {
        setPreferences({
          ...defaultPreferences,
          user_id: profile.id,
          company_id: profile.company_id,
        });
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      showToast('error', 'Failed to load notification preferences');
      setPreferences({
        ...defaultPreferences,
        user_id: profile.id,
        company_id: profile.company_id,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRecentAlerts = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        // Table might not exist; fail gracefully
        console.warn('Could not load recent alerts:', error.message);
        return;
      }

      setRecentAlerts(data || []);
    } catch {
      // Silently handle - notifications table may not exist
    }
  };

  const updatePreference = <K extends keyof NotificationPreference>(
    key: K,
    value: NotificationPreference[K]
  ) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!preferences || !profile) return;

    try {
      setSaving(true);

      const payload = {
        user_id: profile.id,
        company_id: profile.company_id,
        notify_missed_checkin: preferences.notify_missed_checkin,
        notify_sos: preferences.notify_sos,
        notify_shift_reminder: preferences.notify_shift_reminder,
        notify_incident: preferences.notify_incident,
        notify_certification_expiry: preferences.notify_certification_expiry,
        reminder_minutes_before: preferences.reminder_minutes_before,
        email_enabled: preferences.email_enabled,
        sms_enabled: preferences.sms_enabled,
        updated_at: new Date().toISOString(),
      };

      if (existingId) {
        const { error } = await supabase
          .from('notification_preferences')
          .update(payload)
          .eq('id', existingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('notification_preferences')
          .insert(payload)
          .select('id')
          .single();

        if (error) throw error;
        if (data) setExistingId(data.id);
      }

      setHasChanges(false);
      showToast('success', 'Notification preferences saved successfully');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      showToast('error', 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'sos':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'incident':
        return <FileText className="w-4 h-4 text-orange-500" />;
      case 'shift':
        return <CalendarClock className="w-4 h-4 text-blue-500" />;
      case 'certification':
        return <Award className="w-4 h-4 text-yellow-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Unable to load preferences</p>
      </div>
    );
  }

  const notificationCategories = [
    {
      key: 'notify_missed_checkin' as const,
      title: 'Missed Check-in Alerts',
      description: 'Get notified when a guard misses a scheduled check-in',
      icon: <BellOff className="w-5 h-5 text-red-500" />,
    },
    {
      key: 'notify_sos' as const,
      title: 'SOS Alerts',
      description: 'Receive immediate alerts for SOS activations',
      icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
    },
    {
      key: 'notify_shift_reminder' as const,
      title: 'Shift Reminders',
      description: 'Get reminded before your shift starts',
      icon: <CalendarClock className="w-5 h-5 text-blue-500" />,
    },
    {
      key: 'notify_incident' as const,
      title: 'Incident Reports',
      description: 'Be notified of new incident reports',
      icon: <FileText className="w-5 h-5 text-orange-500" />,
    },
    {
      key: 'notify_certification_expiry' as const,
      title: 'Certification Expiry',
      description: 'Alerts when certifications are expiring',
      icon: <Award className="w-5 h-5 text-yellow-500" />,
    },
  ];

  const reminderOptions = [
    { value: 15, label: '15 minutes before' },
    { value: 30, label: '30 minutes before' },
    { value: 45, label: '45 minutes before' },
    { value: 60, label: '60 minutes before' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Notification Preferences</h1>
              <p className="text-sm text-gray-500">Configure your alerts and notification settings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        {/* Notification Categories */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Alert Categories
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Choose which types of notifications you want to receive
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {notificationCategories.map((category) => (
              <div
                key={category.key}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                    {category.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{category.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{category.description}</p>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  <Toggle
                    enabled={preferences[category.key]}
                    onToggle={() => updatePreference(category.key, !preferences[category.key])}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Methods */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Delivery Methods
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              How you want to receive your notifications
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Receive alerts via your registered email address
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                <Toggle
                  enabled={preferences.email_enabled}
                  onToggle={() => updatePreference('email_enabled', !preferences.email_enabled)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">SMS Notifications</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Receive text message alerts on your phone
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                <Toggle
                  enabled={preferences.sms_enabled}
                  onToggle={() => updatePreference('sms_enabled', !preferences.sms_enabled)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Timing Configuration */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Timing Configuration
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure when you receive certain notifications
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Shift Reminder Time</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    How early to receive shift start reminders
                  </p>
                </div>
              </div>
              <select
                value={preferences.reminder_minutes_before}
                onChange={(e) =>
                  updatePreference('reminder_minutes_before', parseInt(e.target.value, 10))
                }
                className="block w-48 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                {reminderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        {!preferences.email_enabled && !preferences.sms_enabled && (
          <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
            <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">No delivery methods enabled</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                You will only see notifications within the app. Enable email or SMS to receive alerts
                externally.
              </p>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Preferences
              </>
            )}
          </button>
        </div>

        {/* Recent Alerts Feed */}
        {recentAlerts.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                Recent Alerts
              </h2>
              <p className="text-sm text-gray-500 mt-1">Your last 10 notifications</p>
            </div>
            <div className="divide-y divide-gray-100">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 px-5 py-3 transition-colors ${
                    alert.is_read ? 'bg-white' : 'bg-blue-50/50'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">{getAlertTypeIcon(alert.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-sm truncate ${
                          alert.is_read
                            ? 'text-gray-700 font-normal'
                            : 'text-gray-900 font-medium'
                        }`}
                      >
                        {alert.title}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                        {formatTimeAgo(alert.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.message}</p>
                  </div>
                  {!alert.is_read && (
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-600 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
