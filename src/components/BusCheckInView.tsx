import { useState, useEffect, useRef } from 'react';
import { Bus, Camera, CheckCircle, Clock, LogOut, ArrowLeft, ShieldAlert } from 'lucide-react';
import jsQR from 'jsqr';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../lib/toast';

interface CompanyBus {
  id: string;
  bus_number: string;
  route_name: string;
  capacity: number;
  driver_name: string;
}

interface CheckIn {
  id: string;
  bus_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  company_buses: CompanyBus[];
}

interface BusCheckInViewProps {
  onBack: () => void;
}

export default function BusCheckInView({ onBack }: BusCheckInViewProps) {
  const { profile } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [currentCheckIn, setCurrentCheckIn] = useState<CheckIn | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchCurrentCheckIn();
    fetchRecentCheckIns();
  }, [profile?.id]);

  useEffect(() => {
    if (scanning) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => stopScanning();
  }, [scanning]);

  const fetchCurrentCheckIn = async () => {
    try {
      const { data, error } = await supabase
        .from('bus_check_ins')
        .select(`
          id,
          bus_id,
          checked_in_at,
          checked_out_at,
          company_buses (
            id,
            bus_number,
            route_name,
            capacity,
            driver_name
          )
        `)
        .eq('user_id', profile?.id)
        .is('checked_out_at', null)
        .order('checked_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentCheckIn(data);
    } catch (error) {
      console.error('Error fetching current check-in:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentCheckIns = async () => {
    try {
      const { data, error } = await supabase
        .from('bus_check_ins')
        .select(`
          id,
          bus_id,
          checked_in_at,
          checked_out_at,
          company_buses (
            id,
            bus_number,
            route_name,
            capacity,
            driver_name
          )
        `)
        .eq('user_id', profile?.id)
        .order('checked_in_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentCheckIns(data || []);
    } catch (error) {
      console.error('Error fetching recent check-ins:', error);
    }
  };

  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        streamRef.current = stream;
        requestAnimationFrame(scanQRCode);
      }
    } catch (err) {
      setError('Unable to access camera. Please check permissions.');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const scanQRCode = () => {
    if (!scanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      handleCheckIn(code.data);
      setScanning(false);
    } else {
      requestAnimationFrame(scanQRCode);
    }
  };

  const handleCheckIn = async (qrCode: string) => {
    setError('');

    try {
      const { data: bus, error: busError } = await supabase
        .from('company_buses')
        .select('id, bus_number, route_name, is_active')
        .eq('qr_code', qrCode)
        .eq('company_id', profile?.company_id)
        .maybeSingle();

      if (busError) throw busError;

      if (!bus) {
        setError('Invalid QR code or bus not found');
        return;
      }

      if (!bus.is_active) {
        setError('This bus is currently inactive');
        return;
      }

      let position: GeolocationPosition | null = null;
      try {
        position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
        });
      } catch {
        setError('Location access is required for bus check-in. Please enable GPS and try again.');
        return;
      }

      const { error: checkInError } = await supabase
        .from('bus_check_ins')
        .insert([{
          bus_id: bus.id,
          user_id: profile?.id,
          company_id: profile?.company_id,
          location_lat: position.coords.latitude,
          location_lng: position.coords.longitude,
          is_within_geofence: true,
        }]);

      if (checkInError) throw checkInError;

      setManualCode('');
      await fetchCurrentCheckIn();
      await fetchRecentCheckIns();
      showToast('success', `Successfully checked in to Bus ${bus.bus_number}`);
    } catch (error: any) {
      setError('Error checking in: ' + error.message);
    }
  };

  const handleCheckOut = async () => {
    if (!currentCheckIn) return;

    try {
      const { error } = await supabase
        .from('bus_check_ins')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('id', currentCheckIn.id);

      if (error) throw error;

      setCurrentCheckIn(null);
      await fetchRecentCheckIns();
      showToast('success', 'Successfully checked out');
    } catch (error: any) {
      setError('Error checking out: ' + error.message);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
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
        <h2 className="text-2xl font-bold text-gray-900">Bus Check-In</h2>
        <p className="text-gray-600 mt-1">Scan QR code or enter bus code to check in</p>
      </div>

      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          Location verification is required. Your GPS position will be recorded with each check-in.
        </p>
      </div>

      {currentCheckIn && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Bus className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-900">Currently on Bus {currentCheckIn.company_buses[0].bus_number}</span>
                </div>
                {currentCheckIn.company_buses[0].route_name && (
                  <p className="text-sm text-green-700">{currentCheckIn.company_buses[0].route_name}</p>
                )}
                <p className="text-sm text-green-600 mt-1">
                  Checked in at {formatTime(currentCheckIn.checked_in_at)}
                </p>
              </div>
            </div>
            <button
              onClick={handleCheckOut}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <LogOut className="w-4 h-4" />
              Check Out
            </button>
          </div>
        </div>
      )}

      {!currentCheckIn && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan QR Code</h3>

            {scanning ? (
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="border-2 border-white w-64 h-64 rounded-lg"></div>
                  </div>
                </div>
                <button
                  onClick={() => setScanning(false)}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setScanning(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Camera className="w-5 h-5" />
                Start Camera
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Manual Entry</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) {
                  handleCheckIn(manualCode.trim());
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter Bus Code
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="BUS-XXXXX-XXXXX"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Check In
              </button>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Check-Ins</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {recentCheckIns.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No check-ins yet
            </div>
          ) : (
            recentCheckIns.map((checkIn) => (
              <div key={checkIn.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Bus className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Bus {checkIn.company_buses[0].bus_number}
                      </p>
                      {checkIn.company_buses[0].route_name && (
                        <p className="text-sm text-gray-600">{checkIn.company_buses[0].route_name}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(checkIn.checked_in_at)}
                        </span>
                        <span>{formatDate(checkIn.checked_in_at)}</span>
                      </div>
                    </div>
                  </div>
                  {checkIn.checked_out_at && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                      Checked out at {formatTime(checkIn.checked_out_at)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
