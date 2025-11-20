import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, User, Battery, Clock, Activity, Navigation } from 'lucide-react';

interface LocationData {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  battery_level: number | null;
  is_active: boolean;
  updated_at: string;
  profile?: {
    full_name: string;
    role: string;
  };
}

export const LiveTrackingMap: React.FC = () => {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [selectedUser, setSelectedUser] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    loadLocations();

    const subscription = supabase
      .channel('real_time_locations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'real_time_locations'
        },
        () => {
          loadLocations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      stopTracking();
    };
  }, []);

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('real_time_locations')
        .select(`
          *,
          profiles:user_id(full_name, role)
        `)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map((item: any) => ({
        ...item,
        profile: item.profiles
      })) || [];

      setLocations(formattedData);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const locationData = {
          user_id: profile?.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          is_active: true
        };

        try {
          const { data: existingLocation } = await supabase
            .from('real_time_locations')
            .select('id')
            .eq('user_id', profile?.id)
            .maybeSingle();

          if (existingLocation) {
            await supabase
              .from('real_time_locations')
              .update(locationData)
              .eq('user_id', profile?.id);
          } else {
            await supabase
              .from('real_time_locations')
              .insert([locationData]);
          }
        } catch (error) {
          console.error('Error updating location:', error);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please check your permissions.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000
      }
    );

    setWatchId(id);
  };

  const stopTracking = async () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    setIsTracking(false);

    try {
      await supabase
        .from('real_time_locations')
        .update({ is_active: false })
        .eq('user_id', profile?.id);
    } catch (error) {
      console.error('Error stopping tracking:', error);
    }
  };

  const getBatteryColor = (level: number | null) => {
    if (!level) return 'text-gray-400';
    if (level > 50) return 'text-green-600';
    if (level > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTimeSinceUpdate = (timestamp: string) => {
    const now = new Date();
    const updated = new Date(timestamp);
    const diffMs = now.getTime() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Live GPS Tracking</h1>
          <p className="text-gray-600 mt-2">Real-time location monitoring for all active personnel</p>
        </div>

        {profile?.role === 'guard' && (
          <button
            onClick={isTracking ? stopTracking : startTracking}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
              isTracking
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <Activity className="h-5 w-5" />
            <span>{isTracking ? 'Stop Sharing Location' : 'Start Sharing Location'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Active Personnel</h2>
            <span className="text-sm text-gray-500">
              {locations.length} {locations.length === 1 ? 'person' : 'people'} tracked
            </span>
          </div>

          <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Interactive Map</p>
              <p className="text-sm text-gray-500">
                Map visualization showing all active personnel locations in real-time
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <User className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold text-blue-900">{locations.length}</span>
              </div>
              <p className="text-sm text-blue-700">Active Personnel</p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Activity className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold text-green-900">
                  {locations.filter(l => {
                    const updated = new Date(l.updated_at);
                    const now = new Date();
                    return (now.getTime() - updated.getTime()) / 60000 < 5;
                  }).length}
                </span>
              </div>
              <p className="text-sm text-green-700">Recently Active</p>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Navigation className="h-5 w-5 text-yellow-600" />
                <span className="text-2xl font-bold text-yellow-900">
                  {locations.filter(l => l.speed && l.speed > 0).length}
                </span>
              </div>
              <p className="text-sm text-yellow-700">In Motion</p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Battery className="h-5 w-5 text-purple-600" />
                <span className="text-2xl font-bold text-purple-900">
                  {locations.filter(l => l.battery_level && l.battery_level < 20).length}
                </span>
              </div>
              <p className="text-sm text-purple-700">Low Battery</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Personnel List</h2>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {locations.map((location) => (
              <div
                key={location.id}
                onClick={() => setSelectedUser(location)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedUser?.id === location.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {location.profile?.full_name || 'Unknown User'}
                    </h3>
                    <p className="text-sm text-gray-600 capitalize">{location.profile?.role || 'N/A'}</p>
                  </div>
                  {location.battery_level !== null && (
                    <div className={`flex items-center space-x-1 ${getBatteryColor(location.battery_level)}`}>
                      <Battery className="h-4 w-4" />
                      <span className="text-sm font-medium">{Math.round(location.battery_level)}%</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>{getTimeSinceUpdate(location.updated_at)}</span>
                  </div>

                  {location.speed !== null && location.speed > 0 && (
                    <div className="flex items-center space-x-2">
                      <Navigation className="h-4 w-4" />
                      <span>{(location.speed * 3.6).toFixed(1)} km/h</span>
                    </div>
                  )}

                  {location.accuracy !== null && (
                    <div className="text-xs text-gray-500">
                      Accuracy: ±{Math.round(location.accuracy)}m
                    </div>
                  )}
                </div>
              </div>
            ))}

            {locations.length === 0 && (
              <div className="text-center py-12">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No active personnel tracking</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
