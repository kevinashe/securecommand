import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, SOSAlert } from '../lib/supabase';
import { Bell, AlertCircle, CheckCircle, MapPin, Clock, User } from 'lucide-react';

export const SOSView: React.FC = () => {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadAlerts();
    const subscription = supabase
      .channel('sos_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => {
        loadAlerts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);

  const loadAlerts = async () => {
    if (!profile) return;

    try {
      let query = supabase
        .from('sos_alerts')
        .select('*, profiles!sos_alerts_guard_id_fkey(full_name, phone), sites(name)')
        .order('created_at', { ascending: false });

      if (profile.role === 'security_officer') {
        query = query.eq('guard_id', profile.id);
      }

      const { data, error } = await query;

      if (!error && data) {
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendSOSAlert = async () => {
    setSending(true);

    try {
      let latitude = null;
      let longitude = null;

      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      const { error } = await supabase.from('sos_alerts').insert([
        {
          guard_id: profile!.id,
          latitude,
          longitude,
          message: 'Emergency assistance needed',
          status: 'active',
        },
      ]);

      if (!error) {
        loadAlerts();
      }
    } catch (error) {
      console.error('Error sending SOS:', error);
    } finally {
      setSending(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('sos_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_by: profile!.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (!error) {
        loadAlerts();
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('sos_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (!error) {
        loadAlerts();
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const canManageAlerts = profile?.role !== 'security_officer';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SOS Alerts</h1>
          <p className="text-gray-600 mt-1">Emergency alert management system</p>
        </div>
      </div>

      {profile?.role === 'security_officer' && (
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">Emergency SOS</h3>
              <p className="text-red-100">
                Press this button only in case of emergency. Your location will be sent to
                dispatch immediately.
              </p>
            </div>
            <button
              onClick={sendSOSAlert}
              disabled={sending}
              className="bg-white text-red-600 hover:bg-red-50 px-8 py-4 rounded-full font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 shadow-lg"
            >
              <Bell className="h-6 w-6" />
              <span>{sending ? 'Sending...' : 'SEND SOS'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {alerts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No SOS alerts</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl shadow-sm p-6 border-2 transition-all ${
                alert.status === 'active'
                  ? 'bg-red-50 border-red-300 shadow-lg'
                  : alert.status === 'acknowledged'
                  ? 'bg-yellow-50 border-yellow-300'
                  : 'bg-green-50 border-green-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-3 rounded-full ${
                        alert.status === 'active'
                          ? 'bg-red-200 animate-pulse'
                          : alert.status === 'acknowledged'
                          ? 'bg-yellow-200'
                          : 'bg-green-200'
                      }`}
                    >
                      {alert.status === 'active' ? (
                        <AlertCircle className="h-6 w-6 text-red-700" />
                      ) : alert.status === 'acknowledged' ? (
                        <Bell className="h-6 w-6 text-yellow-700" />
                      ) : (
                        <CheckCircle className="h-6 w-6 text-green-700" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {alert.status === 'active' ? 'ACTIVE EMERGENCY' : 'SOS Alert'}
                      </h3>
                      <p className="text-sm text-gray-700">{alert.message}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {alert.profiles?.full_name}
                        </p>
                        <p className="text-xs text-gray-600">{alert.profiles?.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-700">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>

                    {alert.latitude && alert.longitude && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-600" />
                        <a
                          href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View on Map
                        </a>
                      </div>
                    )}
                  </div>

                  {alert.sites && (
                    <div className="bg-white bg-opacity-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">
                        Site: {alert.sites.name}
                      </p>
                    </div>
                  )}
                </div>

                <div className="ml-4 flex flex-col items-end space-y-2">
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                      alert.status === 'active'
                        ? 'bg-red-600 text-white'
                        : alert.status === 'acknowledged'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-green-600 text-white'
                    }`}
                  >
                    {alert.status}
                  </span>

                  {canManageAlerts && alert.status === 'active' && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Acknowledge
                    </button>
                  )}

                  {canManageAlerts && alert.status === 'acknowledged' && (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
