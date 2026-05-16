import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Clock, MapPin, Camera, Coffee, LogOut as LogOutIcon, CheckCircle, AlertCircle, X, ArrowLeft } from 'lucide-react';
import { showToast } from '../lib/toast';

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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadTimeClockData();
  }, [profile]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const loadTimeClockData = async () => {
    if (!profile) return;

    try {
      const { data: entries } = await supabase
        .from('time_clocks')
        .select('*, shifts(sites(name, address, latitude, longitude))')
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

          if (activeBreak) {
            setOnBreak(true);
            setCurrentBreakId(activeBreak.id);
          }
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setMessage({ type: 'error', text: 'Could not access camera' });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
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

      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(photoData);
      stopCamera();
    }
  };

  const checkGeofence = async (latitude: number, longitude: number, shift: any): Promise<boolean> => {
    if (!shift?.sites) return false;

    const siteLat = shift.sites.latitude;
    const siteLng = shift.sites.longitude;

    const distance = calculateDistance(latitude, longitude, siteLat, siteLng);
    return distance <= 0.2;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const clockIn = async () => {
    setProcessing(true);
    setMessage(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { data: upcomingShift } = await supabase
        .from('shifts')
        .select('*, sites(name, address, latitude, longitude)')
        .eq('guard_id', profile!.id)
        .gte('start_time', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .lte('start_time', new Date(Date.now() + 60 * 60 * 1000).toISOString())
        .maybeSingle();

      const isWithinGeofence = upcomingShift
        ? await checkGeofence(position.coords.latitude, position.coords.longitude, upcomingShift)
        : false;

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
        .select('*, shifts(sites(name, address, latitude, longitude))')
        .single();

      if (error) throw error;

      setCurrentEntry(newEntry);
      setCapturedPhoto(null);
      setMessage({
        type: 'success',
        text: isWithinGeofence
          ? 'Clocked in successfully within site boundary!'
          : 'Clocked in, but you are outside the site boundary.'
      });
    } catch (error) {
      console.error('Error clocking in:', error);
      setMessage({ type: 'error', text: 'Failed to clock in. Please try again.' });
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
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      await supabase
        .from('time_clocks')
        .update({
          clock_out_time: new Date().toISOString(),
          clock_out_latitude: position.coords.latitude,
          clock_out_longitude: position.coords.longitude,
          clock_out_photo_url: capturedPhoto,
        })
        .eq('id', currentEntry.id);

      setCapturedPhoto(null);
      setMessage({ type: 'success', text: 'Clocked out successfully!' });
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
      const { data } = await supabase
        .from('break_logs')
        .insert({
          time_clock_id: currentEntry.id,
          break_start: new Date().toISOString(),
          break_type: 'rest',
        })
        .select()
        .single();

      if (data) {
        setOnBreak(true);
        setCurrentBreakId(data.id);
        setMessage({ type: 'success', text: 'Break started' });
      }
    } catch (error) {
      console.error('Error starting break:', error);
    }
  };

  const endBreak = async () => {
    if (!currentBreakId) return;

    try {
      await supabase
        .from('break_logs')
        .update({ break_end: new Date().toISOString() })
        .eq('id', currentBreakId);

      setOnBreak(false);
      setCurrentBreakId(null);
      setMessage({ type: 'success', text: 'Break ended' });
    } catch (error) {
      console.error('Error ending break:', error);
    }
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const diffMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

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
        <h2 className="text-2xl font-bold text-gray-900">Time & Attendance</h2>
        <p className="text-gray-600">Clock in/out with geofence verification</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h3>

        {currentEntry ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Currently Clocked In</p>
                  <p className="text-sm text-green-700">
                    {formatDuration(currentEntry.clock_in_time)}
                  </p>
                </div>
              </div>
              {currentEntry.is_within_geofence && (
                <CheckCircle className="h-6 w-6 text-green-600" />
              )}
            </div>

            <div className="flex gap-3">
              {!onBreak ? (
                <>
                  <button
                    onClick={startBreak}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    <Coffee className="h-5 w-5" />
                    Start Break
                  </button>
                  <button
                    onClick={() => startCamera()}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <LogOutIcon className="h-5 w-5" />
                    Clock Out
                  </button>
                </>
              ) : (
                <button
                  onClick={endBreak}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Coffee className="h-5 w-5" />
                  End Break
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">You are not currently clocked in.</p>
            <button
              onClick={() => startCamera()}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Clock className="h-5 w-5" />
              Clock In
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Time Entries</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {recentEntries.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No time entries yet
            </div>
          ) : (
            recentEntries.map((entry) => (
              <div key={entry.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {new Date(entry.clock_in_time).toLocaleDateString()} -
                        {' '}{new Date(entry.clock_in_time).toLocaleTimeString()}
                      </span>
                    </div>
                    {entry.shifts?.sites && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {entry.shifts.sites.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {entry.total_hours && (
                      <p className="text-sm font-medium text-gray-900">
                        {entry.total_hours.toFixed(2)}h
                      </p>
                    )}
                    {entry.overtime_hours && entry.overtime_hours > 0 && (
                      <p className="text-xs text-orange-600">
                        +{entry.overtime_hours.toFixed(2)}h OT
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Take Photo</h3>
              <button onClick={stopCamera} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg mb-4" />
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex gap-3">
              <button
                onClick={capturePhoto}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Camera className="h-5 w-5 mx-auto" />
              </button>
              <button
                onClick={stopCamera}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {capturedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Photo</h3>
            <img src={capturedPhoto} alt="Captured" className="w-full rounded-lg mb-4" />

            <div className="flex gap-3">
              <button
                onClick={currentEntry ? clockOut : clockIn}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processing ? 'Processing...' : currentEntry ? 'Clock Out' : 'Clock In'}
              </button>
              <button
                onClick={() => setCapturedPhoto(null)}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Retake
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
