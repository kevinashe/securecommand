import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { QrCode, CheckCircle, MapPin, Clock, Camera, X } from 'lucide-react';
import jsQR from 'jsqr';

interface Checkpoint {
  id: string;
  patrol_route_id: string;
  name: string;
  description: string;
  qr_code: string;
  order_index: number;
  route_name?: string;
}

interface CheckIn {
  id: string;
  checkpoint_id: string;
  guard_id: string;
  checked_in_at: string;
  photo_url: string | null;
  checkpoint_name?: string;
  description?: string;
}

export const CheckInView: React.FC = () => {
  const { profile } = useAuth();
  const [qrInput, setQrInput] = useState('');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadCheckpoints();
    loadRecentCheckIns();
  }, [profile]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const loadCheckpoints = async () => {
    try {
      const { data, error } = await supabase
        .from('checkpoints')
        .select('*, patrol_routes(name)')
        .order('order_index');

      if (error) throw error;

      const formattedData = data?.map((item: any) => ({
        ...item,
        route_name: item.patrol_routes?.name,
      }));

      setCheckpoints(formattedData || []);
    } catch (error) {
      console.error('Error loading checkpoints:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentCheckIns = async () => {
    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select('*, checkpoints(name, description)')
        .eq('guard_id', profile?.id)
        .order('checked_in_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const formattedData = data?.map((item: any) => ({
        ...item,
        checkpoint_name: item.checkpoints?.name,
        description: item.checkpoints?.description,
      }));

      setRecentCheckIns(formattedData || []);
    } catch (error) {
      console.error('Error loading recent check-ins:', error);
    }
  };

  const startCamera = async () => {
    try {
      console.log('Starting camera...');

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported. Please use HTTPS or localhost.');
      }

      console.log('Requesting camera permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false,
      });

      console.log('Camera stream obtained:', stream.getVideoTracks().length, 'video tracks');

      // Check if video track is active
      const videoTrack = stream.getVideoTracks()[0];
      console.log('Video track enabled:', videoTrack.enabled);
      console.log('Video track ready state:', videoTrack.readyState);
      console.log('Video track settings:', videoTrack.getSettings());

      streamRef.current = stream;
      setShowCamera(true);

      // Use requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log('Attempting to attach stream to video element...');
          console.log('Video element exists:', !!videoRef.current);
          console.log('Stream exists:', !!streamRef.current);

          if (videoRef.current && streamRef.current) {
            // Set srcObject directly
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;

            console.log('Stream attached to video element');
            console.log('Video paused:', videoRef.current.paused);
            console.log('Video readyState:', videoRef.current.readyState);

            // Force play
            const playPromise = videoRef.current.play();

            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('Video playing successfully');
                  console.log('Video dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
                })
                .catch((e) => {
                  console.error('Error playing video:', e);
                  alert('Error starting camera preview: ' + e.message);
                });
            }
          } else {
            console.error('Video element or stream missing');
            alert('Failed to initialize video element');
          }
        });
      });

    } catch (error: any) {
      console.error('Error accessing camera:', error);

      let errorMessage = 'Unable to access camera. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please grant camera permissions and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please check your browser settings.';
      }

      alert(errorMessage);
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
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
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(photoData);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const startQrScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      qrStreamRef.current = stream;
      setShowQrScanner(true);
      setScanning(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (qrVideoRef.current && qrStreamRef.current) {
            qrVideoRef.current.srcObject = qrStreamRef.current;
            qrVideoRef.current.play().then(() => {
              scanQrCode();
            });
          }
        });
      });
    } catch (error: any) {
      console.error('Error accessing camera for QR scanning:', error);
      alert('Unable to access camera for QR scanning. Please check permissions.');
    }
  };

  const stopQrScanner = () => {
    setScanning(false);
    if (scanIntervalRef.current) {
      cancelAnimationFrame(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((track) => track.stop());
      qrStreamRef.current = null;
    }
    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
    setShowQrScanner(false);
  };

  const scanQrCode = () => {
    if (!scanning || !qrVideoRef.current || !qrCanvasRef.current) return;

    const video = qrVideoRef.current;
    const canvas = qrCanvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        setQrInput(code.data);
        stopQrScanner();
        setMessage({ type: 'success', text: 'QR Code scanned successfully!' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
    }

    if (scanning) {
      scanIntervalRef.current = requestAnimationFrame(scanQrCode);
    }
  };

  const handleCheckIn = async (checkpointQR?: string) => {
    setCheckingIn(true);
    setMessage(null);

    try {
      const qrCode = checkpointQR || qrInput.trim();

      if (!qrCode) {
        setMessage({ type: 'error', text: 'Please enter or scan a QR code.' });
        setCheckingIn(false);
        return;
      }

      const checkpoint = checkpoints.find((cp) => cp.qr_code === qrCode);

      if (!checkpoint) {
        setMessage({ type: 'error', text: 'Invalid QR code. Please scan a valid checkpoint.' });
        setCheckingIn(false);
        return;
      }

      if (!capturedPhoto) {
        setMessage({ type: 'error', text: 'Please take a selfie before checking in.' });
        setCheckingIn(false);
        return;
      }

      const photoData = capturedPhoto.split(',')[1];
      const blob = Uint8Array.from(atob(photoData), (c) => c.charCodeAt(0));
      const fileName = `checkin-${profile?.id}-${Date.now()}.jpg`;
      const filePath = `${profile?.company_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('check-in-photos')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      let photoUrl = null;
      if (!uploadError) {
        const { data } = supabase.storage.from('check-in-photos').getPublicUrl(filePath);
        photoUrl = data.publicUrl;
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }).catch(() => null);

      const { error } = await supabase.from('check_ins').insert([
        {
          checkpoint_id: checkpoint.id,
          guard_id: profile?.id,
          checked_in_at: new Date().toISOString(),
          photo_url: photoUrl,
          latitude: position?.coords.latitude || null,
          longitude: position?.coords.longitude || null,
        },
      ]);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Successfully checked in at ${checkpoint.name}!`,
      });
      setQrInput('');
      setCapturedPhoto(null);
      loadRecentCheckIns();
    } catch (error: any) {
      console.error('Error checking in:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to check in' });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleQuickCheckIn = async (checkpoint: Checkpoint) => {
    if (!capturedPhoto) {
      setMessage({ type: 'error', text: 'Please take a selfie before checking in.' });
      return;
    }
    await handleCheckIn(checkpoint.qr_code);
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Time Attendance Check-In</h1>
        <p className="text-gray-600 mt-1">Take a selfie and scan checkpoint QR codes</p>
        {!window.isSecureContext && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ Camera requires HTTPS or localhost. Current URL: {window.location.protocol}//{window.location.host}
            </p>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <p
            className={`font-medium ${
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Camera className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Step 1: Take Selfie</h2>
            <p className="text-sm text-gray-600">Required for time attendance verification</p>
          </div>
        </div>

        {!showCamera && !capturedPhoto && (
          <button
            onClick={() => {
              console.log('Open Camera button clicked');
              startCamera();
            }}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Camera className="h-5 w-5" />
            <span>Open Camera</span>
          </button>
        )}

        {showCamera && (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden mx-auto" style={{ maxWidth: '400px', height: '300px' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={capturePhoto}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Capture Photo
              </button>
              <button
                onClick={stopCamera}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {capturedPhoto && (
          <div className="space-y-4">
            <div className="relative bg-gray-100 rounded-lg overflow-hidden mx-auto" style={{ maxWidth: '400px' }}>
              <img
                src={capturedPhoto}
                alt="Captured selfie"
                className="w-full"
                style={{ transform: 'scaleX(-1)' }}
              />
              <button
                onClick={() => setCapturedPhoto(null)}
                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={retakePhoto}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Retake Photo
            </button>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-lg">
            <QrCode className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Step 2: Scan QR Code</h2>
            <p className="text-sm text-gray-600">Enter or scan checkpoint QR code</p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleCheckIn(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">QR Code</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                placeholder="CHECKPOINT-1234567890"
                disabled={checkingIn || !capturedPhoto}
              />
              <button
                type="button"
                onClick={startQrScanner}
                disabled={!capturedPhoto || showQrScanner}
                className="px-4 py-3 bg-blue-600 border border-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Scan QR Code"
              >
                <QrCode className="h-6 w-6" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={checkingIn || !qrInput.trim() || !capturedPhoto}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {checkingIn ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Checking In...</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                <span>Check In</span>
              </>
            )}
          </button>
        </form>

        {showQrScanner && (
          <div className="mt-4 space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden mx-auto" style={{ maxWidth: '400px', height: '300px' }}>
              <video
                ref={qrVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-4 border-blue-500 opacity-50"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-blue-500"></div>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">Position QR code within the frame</p>
              <button
                onClick={stopQrScanner}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel Scanning
              </button>
            </div>
          </div>
        )}

        <canvas ref={qrCanvasRef} style={{ display: 'none' }} />
      </div>

      {checkpoints.length > 0 && capturedPhoto && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Check-In</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {checkpoints.slice(0, 6).map((checkpoint) => (
              <button
                key={checkpoint.id}
                onClick={() => handleQuickCheckIn(checkpoint)}
                disabled={checkingIn}
                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="bg-blue-100 p-2 rounded-lg">
                  <MapPin className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{checkpoint.name}</p>
                  <p className="text-sm text-gray-500 truncate">{checkpoint.description}</p>
                  <p className="text-xs text-gray-400">{checkpoint.route_name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Recent Check-Ins</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentCheckIns.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No check-ins yet</p>
            </div>
          ) : (
            recentCheckIns.map((checkIn) => (
              <div key={checkIn.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4">
                  {checkIn.photo_url && (
                    <img
                      src={checkIn.photo_url}
                      alt="Check-in selfie"
                      className="w-16 h-16 rounded-lg object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <p className="font-medium text-gray-900">{checkIn.checkpoint_name}</p>
                    </div>
                    <p className="text-sm text-gray-600">{checkIn.description}</p>
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-sm text-gray-900">
                        {new Date(checkIn.checked_in_at).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(checkIn.checked_in_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
