import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Clock, MapPin, Camera, Coffee, LogOut as LogOutIcon, CheckCircle, AlertCircle, X, ArrowLeft, Briefcase, Shield, AlertTriangle, Navigation } from 'lucide-react';
import { showToast } from '../lib/toast';

const officeRoles = ['dispatcher', 'hr_manager', 'finance_officer', 'office_admin'];

interface TimeClockEntry {
  id: string;
  shift_id: string | null;
  clock_in_time: string;
  clock_out_time: string | null;
  is_within_geofence: boolean;
  total_hours: number | null;
  overtime_hours: number | null;
  shifts?: {
    sites: {
      name: string;
      address: string;
      latitude: number;
      longitude: number;
      geofence_radius?: number;
    };
  };
}

interface TimeAttendanceProps {
  onBack: () => void;
}

export const TimeAttendance: React.FC<TimeAttendanceProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [currentEntry, setCurrentEntry] = useState<TimeClockEntry | null>(null);
  const [recentEntries, setRecentEntries] = useState<TimeClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [currentBreakId, setCurrentBreakId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [geofenceInfo, setGeofenceInfo] = useState<{ distance: number; radius: number; siteName: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => { loadTimeClockData(); }, [profile]);
  useEffect(() => { return () => { stopCamera(); }; }, []);

  const loadTimeClockData = async () => {
    if (!profile) return;
    try {
      const { data: entries } = await supabase
        .from('time_clocks')
        .select('*, shifts(sites(name, address, latitude, longitude, geofence_radius))')
        .eq('guard_id', profile.id)
        .order('clock_in_time', { ascending: false })
        .limit(10);

      if (entries) {
        const openEntry = entries.find(e => !e.clock_out_time);
        setCurrentEntry(openEntry || null);
        setRecentEntries(entries.filter(e => e.clock_out_time));

        if (openEntry) {
          const { data: activeBreak } = await supabase
            .from('break_logs')
            .select('id')
            .eq('time_clock_id', openEntry.id)
            .is('break_end', null)
            .maybeSingle();

          if (activeBreak) { setOnBreak(true); setCurrentBreakId(activeBreak.id); }
        }
      }
    } catch (error) {
      console.error('Error loading time clock data:', error);
      showToast('error', 'Failed to load time attendance data');
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) { videoRef.current.srcObject = stream; streamRef.current = stream; setShowCamera(true); }
    } catch (error) {
      console.error('Camera error:', error);
      setMessage({ type: 'error', text: 'Could not access camera' });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const checkGeofence = (latitude: number, longitude: number, shift: any): { withinFence: boolean; distanceMeters: number; radiusMeters: number; siteName: string } => {
    if (!shift?.sites?.latitude || !shift?.sites?.longitude) {
      return { withinFence: false, distanceMeters: 0, radiusMeters: 200, siteName: 'Unknown' };
    }
    const radiusMeters = shift.sites.geofence_radius || 200;
    const distanceMeters = calculateDistance(latitude, longitude, shift.sites.latitude, shift.sites.longitude);
    return {
      withinFence: distanceMeters <= radiusMeters,
      distanceMeters: Math.round(distanceMeters),
      radiusMeters,
      siteName: shift.sites.name || 'Unknown'
    };
  };

  const clockIn = async () => {
    setProcessing(true);
    setMessage(null);
    setGeofenceInfo(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      });

      const { data: upcomingShift } = await supabase
        .from('shifts')
        .select('*, sites(name, address, latitude, longitude, geofence_radius)')
        .eq('guard_id', profile!.id)
        .gte('start_time', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .lte('start_time', new Date(Date.now() + 60 * 60 * 1000).toISOString())
        .maybeSingle();

      let isWithinGeofence = false;
      let geofenceResult: ReturnType<typeof checkGeofence> | null = null;

      if (upcomingShift) {
        geofenceResult = checkGeofence(position.coords.latitude, position.coords.longitude, upcomingShift);
        isWithinGeofence = geofenceResult.withinFence;

        if (!isWithinGeofence && !officeRoles.includes(profile?.role || '')) {
          setGeofenceInfo({
            distance: geofenceResult.distanceMeters,
            radius: geofenceResult.radiusMeters,
            siteName: geofenceResult.siteName,
          });
          setMessage({
            type: 'error',
            text: `You are ${geofenceResult.distanceMeters}m from ${geofenceResult.siteName}. You must be within ${geofenceResult.radiusMeters}m of the site to clock in. Please move closer and try again.`
          });
          setProcessing(false);
          return;
        }
      }

      const { data: newEntry, error } = await supabase
        .from('time_clocks')
        .insert({
          guard_id: profile!.id,
          shift_id: upcomingShift?.id || null,
          clock_in_time: new Date().toISOString(),
          clock_in_latitude: position.coords.latitude,
          clock_in_longitude: position.coords.longitude,
          clock_in_photo_url: capturedPhoto,
          is_within_geofence: isWithinGeofence,
        })
        .select('*, shifts(sites(name, address, latitude, longitude, geofence_radius))')
        .single();

      if (error) throw error;

      setCurrentEntry(newEntry);
      setCapturedPhoto(null);

      if (!upcomingShift) {
        setMessage({ type: 'warning', text: 'Clocked in, but no matching shift was found. Contact your supervisor if this is unexpected.' });
      } else if (isWithinGeofence) {
        setMessage({ type: 'success', text: `Clocked in at ${geofenceResult?.siteName} -- within site boundary.` });
      } else {
        setMessage({ type: 'success', text: 'Clocked in successfully.' });
      }

      // Log audit
      try {
        await supabase.from('audit_logs').insert({
          company_id: profile!.company_id,
          user_id: profile!.id,
          action: 'clock_in',
          entity_type: 'time_clock',
          entity_id: newEntry.id,
          changes: { shift_id: upcomingShift?.id, is_within_geofence: isWithinGeofence },
        });
      } catch {}
    } catch (error: any) {
      console.error('Error clocking in:', error);
      if (error?.code === 1) {
        setMessage({ type: 'error', text: 'Location permission denied. Please allow location access in your browser settings.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to clock in. Please try again.' });
      }
    } finally {
      setProcessing(false);
    }
  };

  const clockOut = async () => {
    if (!currentEntry) return;
    setProcessing(true);
    setMessage(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      });

      const clockInTime = new Date(currentEntry.clock_in_time);
      const now = new Date();
      const totalHours = (now.getTime() - clockInTime.getTime()) / 3600000;
      const overtimeHours = Math.max(totalHours - 8, 0);

      await supabase
        .from('time_clocks')
        .update({
          clock_out_time: now.toISOString(),
          clock_out_latitude: position.coords.latitude,
          clock_out_longitude: position.coords.longitude,
          clock_out_photo_url: capturedPhoto,
          total_hours: Math.round(totalHours * 100) / 100,
          overtime_hours: Math.round(overtimeHours * 100) / 100,
        })
        .eq('id', currentEntry.id);

      setCapturedPhoto(null);
      setMessage({ type: 'success', text: `Clocked out. Total: ${totalHours.toFixed(1)} hours${overtimeHours > 0 ? ` (${overtimeHours.toFixed(1)}h overtime)` : ''}.` });

      try {
        await supabase.from('audit_logs').insert({
          company_id: profile!.company_id,
          user_id: profile!.id,
          action: 'clock_out',
          entity_type: 'time_clock',
          entity_id: currentEntry.id,
          changes: { total_hours: Math.round(totalHours * 100) / 100, overtime_hours: Math.round(overtimeHours * 100) / 100 },
        });
      } catch {}

      loadTimeClockData();
    } catch (error) {
      console.error('Error clocking out:', error);
      setMessage({ type: 'error', text: 'Failed to clock out. Please try again.' });
    } finally {
      setProcessing(false);
    }
  };

  const startBreak = async () => {
    if (!currentEntry) return;
    try {
      const { data } = await supabase.from('break_logs').insert({ time_clock_id: currentEntry.id, break_start: new Date().toISOString(), break_type: 'rest' }).select().single();
      if (data) { setOnBreak(true); setCurrentBreakId(data.id); setMessage({ type: 'success', text: 'Break started' }); }
    } catch (error) { console.error('Error starting break:', error); }
  };

  const endBreak = async () => {
    if (!currentBreakId) return;
    try {
      await supabase.from('break_logs').update({ break_end: new Date().toISOString() }).eq('id', currentBreakId);
      setOnBreak(false); setCurrentBreakId(null); setMessage({ type: 'success', text: 'Break ended' });
    } catch (error) { console.error('Error ending break:', error); }
  };

  const formatDuration = (start: string, end?: string) => {
    const diffMs = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="h-6 w-6 text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time & Attendance</h2>
          <p className="text-gray-600">
            {officeRoles.includes(profile?.role || '')
              ? 'Clock in/out with location verification'
              : 'Clock in/out with photo and geofence verification'}
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" /> :
           message.type === 'warning' ? <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" /> :
           <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />}
          <div className="flex-1">
            <p className="text-sm">{message.text}</p>
            {geofenceInfo && (
              <div className="mt-2 flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> Distance: {geofenceInfo.distance}m</span>
                <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Required: within {geofenceInfo.radius}m</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Site: {geofenceInfo.siteName}</span>
              </div>
            )}
          </div>
          <button onClick={() => { setMessage(null); setGeofenceInfo(null); }} className="p-1 hover:bg-black/5 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Geofence Info Card */}
      {!officeRoles.includes(profile?.role || '') && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">Geofence Verification Active</p>
            <p className="text-xs text-blue-700 mt-0.5">You must be physically present at your assigned site to clock in. Your location is verified against the site boundary.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h3>

        {currentEntry ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Clock className="h-6 w-6 text-green-600" />
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full border-2 border-green-50 animate-pulse" />
                </div>
                <div>
                  <p className="font-medium text-green-900">Currently Clocked In</p>
                  <p className="text-sm text-green-700">{formatDuration(currentEntry.clock_in_time)} elapsed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentEntry.shifts?.sites && (
                  <span className="text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {currentEntry.shifts.sites.name}
                  </span>
                )}
                {currentEntry.is_within_geofence && (
                  <span className="text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Verified
                  </span>
                )}
              </div>
            </div>

            {onBreak && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                <Coffee className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">On Break</span>
              </div>
            )}

            <div className="flex gap-3">
              {!onBreak ? (
                <>
                  <button onClick={startBreak} disabled={processing} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-medium">
                    <Coffee className="h-5 w-5" /> Start Break
                  </button>
                  <button
                    onClick={officeRoles.includes(profile?.role || '') ? clockOut : () => startCamera()}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
                  >
                    {processing ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <LogOutIcon className="h-5 w-5" />}
                    {processing ? 'Processing...' : 'Clock Out'}
                  </button>
                </>
              ) : (
                <button onClick={endBreak} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">
                  <Coffee className="h-5 w-5" /> End Break
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">You are not currently clocked in.</p>
            {officeRoles.includes(profile?.role || '') ? (
              <button onClick={clockIn} disabled={processing} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium">
                {processing ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <Briefcase className="h-5 w-5" />}
                {processing ? 'Verifying Location...' : 'Clock In'}
              </button>
            ) : (
              <button onClick={() => startCamera()} disabled={processing} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">
                <Clock className="h-5 w-5" /> Clock In
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recent Entries */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Time Entries</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {recentEntries.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No time entries yet</div>
          ) : (
            recentEntries.map((entry) => (
              <div key={entry.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700 font-medium">
                        {new Date(entry.clock_in_time).toLocaleDateString()} &middot; {new Date(entry.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {entry.clock_out_time ? new Date(entry.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {entry.shifts?.sites && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {entry.shifts.sites.name}
                        </span>
                      )}
                      {entry.is_within_geofence ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Geofence OK
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Outside fence
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {entry.total_hours != null && (
                      <p className="text-sm font-semibold text-gray-900">{entry.total_hours.toFixed(1)}h</p>
                    )}
                    {entry.overtime_hours != null && entry.overtime_hours > 0 && (
                      <p className="text-xs text-orange-600 font-medium">+{entry.overtime_hours.toFixed(1)}h OT</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Take Photo</h3>
              <button onClick={stopCamera} className="p-2 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl mb-4" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-3">
              <button onClick={capturePhoto} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium flex items-center justify-center gap-2">
                <Camera className="h-5 w-5" /> Capture
              </button>
              <button onClick={stopCamera} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Confirmation */}
      {capturedPhoto && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Photo</h3>
            <img src={capturedPhoto} alt="Captured" className="w-full rounded-xl mb-4" />
            <div className="flex gap-3">
              <button
                onClick={currentEntry ? clockOut : clockIn}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {processing ? 'Verifying Location...' : currentEntry ? 'Confirm & Clock Out' : 'Confirm & Clock In'}
              </button>
              <button onClick={() => setCapturedPhoto(null)} disabled={processing} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium">
                Retake
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
