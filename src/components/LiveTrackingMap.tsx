import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, User, Battery, Activity, Navigation, ArrowLeft, Maximize2, Minimize2, RefreshCw, Crosshair, Layers } from 'lucide-react';
import { showToast } from '../lib/toast';

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

interface SiteMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  geofence_radius: number;
}

interface LiveTrackingMapProps {
  onBack?: () => void;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [sites, setSites] = useState<SiteMarker[]>([]);
  const [selectedUser, setSelectedUser] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [showSites, setShowSites] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadLocations();
    loadSites();

    const subscription = supabase
      .channel('real_time_locations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'real_time_locations' }, () => { loadLocations(); })
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
        .select('*, profiles:user_id(full_name, role)')
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

  const loadSites = async () => {
    try {
      let query = supabase.from('sites').select('id, name, latitude, longitude, geofence_radius').eq('is_active', true);
      if (profile?.company_id && profile.role !== 'super_admin') {
        query = query.eq('company_id', profile.company_id);
      }
      const { data } = await query;
      setSites((data || []).filter(s => s.latitude && s.longitude) as SiteMarker[]);
    } catch (error) {
      console.error('Error loading sites:', error);
    }
  };

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const allPoints = [
      ...locations.map(l => ({ lat: l.latitude, lng: l.longitude })),
      ...sites.map(s => ({ lat: s.latitude, lng: s.longitude }))
    ];

    if (allPoints.length === 0) {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No active locations to display', canvas.width / 2, canvas.height / 2);
      return;
    }

    const padding = 60;
    let minLat = Math.min(...allPoints.map(p => p.lat));
    let maxLat = Math.max(...allPoints.map(p => p.lat));
    let minLng = Math.min(...allPoints.map(p => p.lng));
    let maxLng = Math.max(...allPoints.map(p => p.lng));

    if (minLat === maxLat) { minLat -= 0.005; maxLat += 0.005; }
    if (minLng === maxLng) { minLng -= 0.005; maxLng += 0.005; }

    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    minLat -= latRange * 0.15; maxLat += latRange * 0.15;
    minLng -= lngRange * 0.15; maxLng += lngRange * 0.15;

    const toX = (lng: number) => padding + ((lng - minLng) / (maxLng - minLng)) * (canvas.width - 2 * padding);
    const toY = (lat: number) => padding + ((maxLat - lat) / (maxLat - minLat)) * (canvas.height - 2 * padding);

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const x = padding + (i / 10) * (canvas.width - 2 * padding);
      ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, canvas.height - padding); ctx.stroke();
      const y = padding + (i / 10) * (canvas.height - 2 * padding);
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(canvas.width - padding, y); ctx.stroke();
    }

    // Site geofences and markers
    if (showSites) {
      sites.forEach(site => {
        const x = toX(site.longitude);
        const y = toY(site.latitude);
        const metersPerDegLat = 111320;
        const metersPerDegLng = metersPerDegLat * Math.cos(site.latitude * Math.PI / 180);
        const radiusPxLat = (site.geofence_radius / metersPerDegLat) / (maxLat - minLat) * (canvas.height - 2 * padding);
        const radiusPxLng = (site.geofence_radius / metersPerDegLng) / (maxLng - minLng) * (canvas.width - 2 * padding);
        const radiusPx = Math.max((radiusPxLat + radiusPxLng) / 2, 20);

        ctx.beginPath();
        ctx.arc(x, y, radiusPx, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Site icon
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Site name
        ctx.fillStyle = '#3b82f6';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(site.name, x, y - 12);
      });
    }

    // Guard locations
    locations.forEach(loc => {
      const x = toX(loc.longitude);
      const y = toY(loc.latitude);
      const isSelected = selectedUser?.id === loc.id;
      const isRecent = (Date.now() - new Date(loc.updated_at).getTime()) < 300000;

      // Pulse for recently active
      if (isRecent) {
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.fill();
      }

      // Guard dot
      const radius = isSelected ? 10 : 8;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isRecent ? '#22c55e' : '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#1e40af' : '#ffffff';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Name label
      ctx.fillStyle = '#1f2937';
      ctx.font = `${isSelected ? 'bold ' : ''}12px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText(loc.profile?.full_name || 'Unknown', x, y - 14);

      // Speed indicator
      if (loc.speed && loc.speed > 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px system-ui';
        ctx.fillText(`${(loc.speed * 3.6).toFixed(0)} km/h`, x, y + 20);
      }
    });

    // Legend
    const legendY = canvas.height - 25;
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'left';

    ctx.beginPath(); ctx.arc(padding, legendY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#22c55e'; ctx.fill();
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Active (< 5 min)', padding + 10, legendY + 4);

    ctx.beginPath(); ctx.arc(padding + 120, legendY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#f59e0b'; ctx.fill();
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Stale', padding + 130, legendY + 4);

    if (showSites) {
      ctx.beginPath(); ctx.arc(padding + 190, legendY, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#3b82f6'; ctx.fill();
      ctx.fillStyle = '#6b7280';
      ctx.fillText('Site', padding + 200, legendY + 4);
    }
  }, [locations, sites, selectedUser, showSites]);

  useEffect(() => {
    drawMap();
    const handleResize = () => drawMap();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawMap]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || locations.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const allPoints = [...locations.map(l => ({ lat: l.latitude, lng: l.longitude })), ...sites.map(s => ({ lat: s.latitude, lng: s.longitude }))];
    const padding = 60;
    let minLat = Math.min(...allPoints.map(p => p.lat));
    let maxLat = Math.max(...allPoints.map(p => p.lat));
    let minLng = Math.min(...allPoints.map(p => p.lng));
    let maxLng = Math.max(...allPoints.map(p => p.lng));
    if (minLat === maxLat) { minLat -= 0.005; maxLat += 0.005; }
    if (minLng === maxLng) { minLng -= 0.005; maxLng += 0.005; }
    const latRange = maxLat - minLat; const lngRange = maxLng - minLng;
    minLat -= latRange * 0.15; maxLat += latRange * 0.15;
    minLng -= lngRange * 0.15; maxLng += lngRange * 0.15;

    const toX = (lng: number) => padding + ((lng - minLng) / (maxLng - minLng)) * (canvas.width - 2 * padding);
    const toY = (lat: number) => padding + ((maxLat - lat) / (maxLat - minLat)) * (canvas.height - 2 * padding);

    let closest: LocationData | null = null;
    let closestDist = Infinity;
    locations.forEach(loc => {
      const dx = toX(loc.longitude) - clickX;
      const dy = toY(loc.latitude) - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 25 && dist < closestDist) { closest = loc; closestDist = dist; }
    });

    setSelectedUser(closest);
  }, [locations, sites]);

  const startTracking = () => {
    if (!navigator.geolocation) { showToast('error', 'Geolocation not supported'); return; }
    setIsTracking(true);
    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const locationData = { user_id: profile?.id, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, heading: position.coords.heading, speed: position.coords.speed, is_active: true };
        try {
          const { data: existing } = await supabase.from('real_time_locations').select('id').eq('user_id', profile?.id).maybeSingle();
          if (existing) { await supabase.from('real_time_locations').update(locationData).eq('user_id', profile?.id); }
          else { await supabase.from('real_time_locations').insert([locationData]); }
        } catch (error) { console.error('Error updating location:', error); }
      },
      (error) => { console.error('Location error:', error); showToast('error', 'Unable to get location'); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    setWatchId(id);
  };

  const stopTracking = async () => {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); setWatchId(null); }
    setIsTracking(false);
    try { await supabase.from('real_time_locations').update({ is_active: false }).eq('user_id', profile?.id); } catch {}
  };

  const getBatteryColor = (level: number | null) => {
    if (!level) return 'text-gray-400';
    if (level > 50) return 'text-green-600';
    if (level > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTimeSinceUpdate = (timestamp: string) => {
    const diffMins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} min ago`;
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live GPS Tracking</h1>
            <p className="text-gray-600 mt-1">Real-time location monitoring for all active personnel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(profile?.role === 'security_officer' || (profile?.role as string) === 'guard') && (
            <button
              onClick={isTracking ? stopTracking : startTracking}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${isTracking ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
            >
              <Activity className="h-5 w-5" />
              {isTracking ? 'Stop Sharing' : 'Share Location'}
            </button>
          )}
          <button onClick={loadLocations} className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <User className="h-5 w-5 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{locations.length}</span>
          </div>
          <p className="text-sm text-gray-600">Active Personnel</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <Activity className="h-5 w-5 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">
              {locations.filter(l => (Date.now() - new Date(l.updated_at).getTime()) < 300000).length}
            </span>
          </div>
          <p className="text-sm text-gray-600">Recently Active</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <Navigation className="h-5 w-5 text-amber-600" />
            <span className="text-2xl font-bold text-gray-900">
              {locations.filter(l => l.speed && l.speed > 0).length}
            </span>
          </div>
          <p className="text-sm text-gray-600">In Motion</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <Battery className="h-5 w-5 text-red-600" />
            <span className="text-2xl font-bold text-gray-900">
              {locations.filter(l => l.battery_level != null && l.battery_level < 20).length}
            </span>
          </div>
          <p className="text-sm text-gray-600">Low Battery</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Map */}
        <div className={`${mapExpanded ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white rounded-xl border border-gray-200 overflow-hidden`}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Live Map</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSites(!showSites)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showSites ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
              >
                <Layers className="h-3.5 w-3.5" />
                Sites
              </button>
              <button onClick={() => setMapExpanded(!mapExpanded)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
                {mapExpanded ? <Minimize2 className="h-4 w-4 text-gray-600" /> : <Maximize2 className="h-4 w-4 text-gray-600" />}
              </button>
            </div>
          </div>
          <div ref={mapContainerRef} className={`relative ${mapExpanded ? 'h-[600px]' : 'h-[420px]'}`}>
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-full cursor-crosshair"
            />
          </div>
        </div>

        {/* Personnel List */}
        {!mapExpanded && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Personnel ({locations.length})</h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
              {locations.map((location) => {
                const isRecent = (Date.now() - new Date(location.updated_at).getTime()) < 300000;
                return (
                  <div
                    key={location.id}
                    onClick={() => setSelectedUser(selectedUser?.id === location.id ? null : location)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${selectedUser?.id === location.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold text-white ${isRecent ? 'bg-green-500' : 'bg-amber-500'}`}>
                          {(location.profile?.full_name || '?').charAt(0)}
                        </div>
                        {isRecent && <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-400 rounded-full border-2 border-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{location.profile?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{getTimeSinceUpdate(location.updated_at)}</p>
                      </div>
                      <div className="text-right">
                        {location.speed != null && location.speed > 0 && (
                          <p className="text-xs text-gray-600">{(location.speed * 3.6).toFixed(0)} km/h</p>
                        )}
                        {location.battery_level != null && (
                          <div className={`flex items-center gap-1 ${getBatteryColor(location.battery_level)}`}>
                            <Battery className="h-3 w-3" />
                            <span className="text-xs">{Math.round(location.battery_level)}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedUser?.id === location.id && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
                        </div>
                        {location.accuracy != null && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Crosshair className="h-3.5 w-3.5" />
                            <span>Accuracy: +/-{Math.round(location.accuracy)}m</span>
                          </div>
                        )}
                        {location.heading != null && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Navigation className="h-3.5 w-3.5" />
                            <span>Heading: {Math.round(location.heading)}deg</span>
                          </div>
                        )}
                        <a
                          href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Open in Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
              {locations.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <MapPin className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No active tracking</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
