import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import {
  ArrowLeft, Plus, X, Camera, LogOut, Search, Users, UserCheck,
  UserMinus, CalendarDays, Loader2, CreditCard, Phone, Mail, Building2, Clock,
} from 'lucide-react';

interface Visitor {
  id: string;
  company_id: string;
  site_id: string;
  logged_by: string;
  visitor_name: string;
  visitor_company: string | null;
  visitor_phone: string | null;
  visitor_email: string | null;
  purpose: string;
  host_name: string | null;
  id_type: string;
  id_number: string | null;
  id_photo_url: string | null;
  visitor_photo_url: string | null;
  badge_number: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  notes: string | null;
  created_at: string;
  logged_by_name?: string;
  site_name?: string;
}

interface Site { id: string; name: string; }

interface VisitorManagementViewProps { onBack?: () => void; }

const ID_TYPE_OPTIONS = [
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'employee_badge', label: 'Employee Badge' },
  { value: 'other', label: 'Other' },
];

const initialFormData = {
  visitor_name: '', visitor_company: '', visitor_phone: '', visitor_email: '',
  purpose: '', host_name: '', id_type: 'drivers_license', id_number: '',
  badge_number: '', notes: '', site_id: '',
};

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export const VisitorManagementView: React.FC<VisitorManagementViewProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  const [showVisitorCamera, setShowVisitorCamera] = useState(false);
  const [showIdCamera, setShowIdCamera] = useState(false);
  const [visitorPhoto, setVisitorPhoto] = useState<string | null>(null);
  const [idPhoto, setIdPhoto] = useState<string | null>(null);

  const visitorVideoRef = useRef<HTMLVideoElement>(null);
  const visitorCanvasRef = useRef<HTMLCanvasElement>(null);
  const visitorStreamRef = useRef<MediaStream | null>(null);
  const idVideoRef = useRef<HTMLVideoElement>(null);
  const idCanvasRef = useRef<HTMLCanvasElement>(null);
  const idStreamRef = useRef<MediaStream | null>(null);

  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'on-site' | 'checked-out'>('all');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const canCreate = profile?.role === 'security_officer' || profile?.role === 'site_manager' || profile?.role === 'company_admin';
  const canCheckout = profile?.role === 'security_officer' || profile?.role === 'site_manager' || profile?.role === 'company_admin';

  const loadVisitors = useCallback(async () => {
    if (!profile?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('visitors').select('*')
        .eq('company_id', profile.company_id)
        .order('checked_in_at', { ascending: false });
      if (error) throw error;
      if (!data) return;

      const guardIds = [...new Set(data.map((v) => v.logged_by))];
      const siteIds = [...new Set(data.map((v) => v.site_id))];
      const [{ data: guards }, { data: siteNames }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', guardIds),
        supabase.from('sites').select('id, name').in('id', siteIds),
      ]);

      const guardMap = new Map(guards?.map((g) => [g.id, g.full_name]) ?? []);
      const siteMap = new Map(siteNames?.map((s) => [s.id, s.name]) ?? []);
      setVisitors(data.map((v) => ({
        ...v,
        logged_by_name: guardMap.get(v.logged_by) ?? 'Unknown',
        site_name: siteMap.get(v.site_id) ?? 'Unknown',
      })));
    } catch (err) {
      console.error('Error loading visitors:', err);
      showToast('error', 'Failed to load visitors');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadSites = useCallback(async () => {
    if (!profile?.company_id) return;
    const { data } = await supabase
      .from('sites').select('id, name')
      .eq('company_id', profile.company_id).eq('is_active', true);
    if (data) setSites(data);
  }, [profile]);

  useEffect(() => { loadVisitors(); loadSites(); }, [loadVisitors, loadSites]);

  useEffect(() => {
    return () => { stopStream(visitorStreamRef); stopStream(idStreamRef); };
  }, []);

  useEffect(() => {
    if (!showCheckInModal) {
      setFormData(initialFormData);
      setVisitorPhoto(null);
      setIdPhoto(null);
      setShowVisitorCamera(false);
      setShowIdCamera(false);
      stopStream(visitorStreamRef);
      stopStream(idStreamRef);
    }
  }, [showCheckInModal]);

  // Stats
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const currentlyOnSite = visitors.filter((v) => !v.checked_out_at).length;
  const checkedOutToday = visitors.filter((v) => v.checked_out_at && v.checked_out_at >= todayStart).length;
  const totalToday = visitors.filter((v) => v.checked_in_at >= todayStart).length;
  const totalThisWeek = visitors.filter((v) => v.checked_in_at >= weekStart).length;

  // Filtered list
  const filteredVisitors = visitors.filter((v) => {
    if (filterSiteId && v.site_id !== filterSiteId) return false;
    if (filterStatus === 'on-site' && v.checked_out_at) return false;
    if (filterStatus === 'checked-out' && !v.checked_out_at) return false;
    if (filterDate && new Date(v.checked_in_at).toISOString().split('T')[0] !== filterDate) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return v.visitor_name.toLowerCase().includes(q) ||
        v.visitor_company?.toLowerCase().includes(q) ||
        v.host_name?.toLowerCase().includes(q) ||
        v.purpose.toLowerCase().includes(q);
    }
    return true;
  });

  // Camera helpers
  function stopStream(ref: React.MutableRefObject<MediaStream | null>) {
    ref.current?.getTracks().forEach((t) => t.stop());
    ref.current = null;
  }

  const openCamera = async (
    facingMode: 'user' | 'environment',
    streamRef: React.MutableRefObject<MediaStream | null>,
    videoRef: React.RefObject<HTMLVideoElement | null>,
    setShow: (v: boolean) => void,
  ) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported. Please use HTTPS or localhost.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
      });
      streamRef.current = stream;
      setShow(true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.play().catch((e) => showToast('error', 'Camera preview error: ' + e.message));
        }
      }));
    } catch (error: any) {
      const msgs: Record<string, string> = {
        NotAllowedError: 'Please grant camera permissions and try again.',
        NotFoundError: 'No camera found on this device.',
        NotReadableError: 'Camera is already in use by another application.',
      };
      showToast('error', 'Unable to access camera. ' + (msgs[error.name] || error.message || 'Check browser settings.'));
      setShow(false);
    }
  };

  const snap = (
    videoRef: React.RefObject<HTMLVideoElement | null>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    streamRef: React.MutableRefObject<MediaStream | null>,
    setPhoto: (v: string | null) => void,
    setShow: (v: boolean) => void,
  ) => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      setPhoto(canvas.toDataURL('image/jpeg', 0.8));
      stopStream(streamRef);
      setShow(false);
    }
  };

  const uploadPhoto = async (base64: string, prefix: string): Promise<string | null> => {
    if (!profile?.company_id) return null;
    try {
      const blob = await fetch(base64).then((r) => r.blob());
      const filename = `${profile.company_id}/${prefix}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('visitor-photos').upload(filename, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from('visitor-photos').getPublicUrl(filename);
      return data.publicUrl;
    } catch (err) {
      console.error('Error uploading photo:', err);
      return null;
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id || !profile?.id) return;
    if (!formData.visitor_name.trim() || !formData.purpose.trim() || !formData.site_id) {
      showToast('error', 'Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const [visitorPhotoUrl, idPhotoUrl] = await Promise.all([
        visitorPhoto ? uploadPhoto(visitorPhoto, 'visitor') : Promise.resolve(null),
        idPhoto ? uploadPhoto(idPhoto, 'id') : Promise.resolve(null),
      ]);
      const { error } = await supabase.from('visitors').insert({
        company_id: profile.company_id, site_id: formData.site_id, logged_by: profile.id,
        visitor_name: formData.visitor_name.trim(),
        visitor_company: formData.visitor_company.trim() || null,
        visitor_phone: formData.visitor_phone.trim() || null,
        visitor_email: formData.visitor_email.trim() || null,
        purpose: formData.purpose.trim(),
        host_name: formData.host_name.trim() || null,
        id_type: formData.id_type,
        id_number: formData.id_number.trim() || null,
        id_photo_url: idPhotoUrl, visitor_photo_url: visitorPhotoUrl,
        badge_number: formData.badge_number.trim() || null,
        notes: formData.notes.trim() || null,
        checked_in_at: new Date().toISOString(),
      });
      if (error) throw error;
      showToast('success', `${formData.visitor_name} has been checked in`);
      setShowCheckInModal(false);
      loadVisitors();
    } catch (err) {
      console.error('Error checking in visitor:', err);
      showToast('error', 'Failed to check in visitor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async (visitor: Visitor) => {
    try {
      const { error } = await supabase.from('visitors')
        .update({ checked_out_at: new Date().toISOString() }).eq('id', visitor.id);
      if (error) throw error;
      showToast('success', `${visitor.visitor_name} has been checked out`);
      loadVisitors();
    } catch (err) {
      console.error('Error checking out visitor:', err);
      showToast('error', 'Failed to check out visitor');
    }
  };

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const idLabel = (v: string) => ID_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
  const setField = (key: string, val: string) => setFormData((p) => ({ ...p, [key]: val }));

  // Camera capture UI block
  const renderCameraSection = (
    label: string, buttonText: string, facingMode: 'user' | 'environment',
    photo: string | null, setPhoto: (v: string | null) => void,
    showCam: boolean, setShowCam: (v: boolean) => void,
    videoRef: React.RefObject<HTMLVideoElement | null>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    streamRef: React.MutableRefObject<MediaStream | null>,
    imgClass: string,
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {photo ? (
        <div className="relative inline-block">
          <img src={photo} alt={label} className={`${imgClass} rounded-lg object-cover border border-gray-200`} />
          <button type="button" onClick={() => setPhoto(null)}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : showCam ? (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full" />
          </div>
          <div className="flex items-center justify-center gap-3">
            <button type="button"
              onClick={() => snap(videoRef, canvasRef, streamRef, setPhoto, setShowCam)}
              className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center border-4 border-blue-300 transition-colors">
              <Camera className="w-6 h-6" />
            </button>
            <button type="button"
              onClick={() => { stopStream(streamRef); setShowCam(false); }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : (
        <button type="button"
          onClick={() => openCamera(facingMode, streamRef, videoRef, setShowCam)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <Camera className="w-4 h-4" />{buttonText}
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">Visitor Management</h1>
              <p className="text-sm text-gray-500">Track and manage site visitors</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={() => setShowCheckInModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" />Check In Visitor
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { label: 'Currently On Site', value: currentlyOnSite, icon: Users, color: 'green' },
            { label: 'Checked Out Today', value: checkedOutToday, icon: UserMinus, color: 'gray' },
            { label: 'Total Today', value: totalToday, icon: UserCheck, color: 'blue' },
            { label: 'Total This Week', value: totalThisWeek, icon: CalendarDays, color: 'purple' },
          ] as const).map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-${stat.color}-100 rounded-lg`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Search visitors..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className={`${inputCls} pl-10`} />
            </div>
            <select value={filterSiteId} onChange={(e) => setFilterSiteId(e.target.value)} className={inputCls}>
              <option value="">All Sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'on-site' | 'checked-out')} className={inputCls}>
              <option value="all">All Status</option>
              <option value="on-site">On Site</option>
              <option value="checked-out">Checked Out</option>
            </select>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Visitor List */}
        <div className="space-y-3">
          {filteredVisitors.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No visitors found</p>
              <p className="text-sm text-gray-400 mt-1">
                {visitors.length === 0 ? 'Check in your first visitor to get started' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : filteredVisitors.map((v) => (
            <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  {v.visitor_photo_url ? (
                    <img src={v.visitor_photo_url} alt={v.visitor_name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-semibold text-lg">
                        {v.visitor_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{v.visitor_name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        v.checked_out_at ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                      }`}>
                        {v.checked_out_at ? 'Checked Out' : 'On Site'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                      {v.visitor_company && (
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{v.visitor_company}</span>
                      )}
                      {v.visitor_phone && (
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{v.visitor_phone}</span>
                      )}
                      {v.visitor_email && (
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{v.visitor_email}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                      <span>Purpose: {v.purpose}</span>
                      {v.host_name && <span>Host: {v.host_name}</span>}
                      {v.badge_number && (
                        <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" />Badge #{v.badge_number}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />In: {fmtDate(v.checked_in_at)} {fmtTime(v.checked_in_at)}
                      </span>
                      {v.checked_out_at && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Out: {fmtTime(v.checked_out_at)}</span>
                      )}
                      <span>Site: {v.site_name}</span>
                      <span>Logged by: {v.logged_by_name}</span>
                      <span>ID: {idLabel(v.id_type)}{v.id_number ? ` - ${v.id_number}` : ''}</span>
                    </div>
                    {v.notes && <p className="mt-1 text-xs text-gray-400 italic">Notes: {v.notes}</p>}
                  </div>
                </div>
                {canCheckout && !v.checked_out_at && (
                  <button onClick={() => handleCheckOut(v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium flex-shrink-0">
                    <LogOut className="w-4 h-4" />Check Out
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Check-In Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl w-full max-w-lg my-8 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Check In Visitor</h2>
              <button onClick={() => setShowCheckInModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCheckIn} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site <span className="text-red-500">*</span></label>
                <select value={formData.site_id} onChange={(e) => setField('site_id', e.target.value)} required className={inputCls}>
                  <option value="">Select a site</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Name <span className="text-red-500">*</span></label>
                <input type="text" value={formData.visitor_name} onChange={(e) => setField('visitor_name', e.target.value)}
                  required placeholder="Full name" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input type="text" value={formData.visitor_company} onChange={(e) => setField('visitor_company', e.target.value)}
                    placeholder="Company name" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={formData.visitor_phone} onChange={(e) => setField('visitor_phone', e.target.value)}
                    placeholder="Phone number" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={formData.visitor_email} onChange={(e) => setField('visitor_email', e.target.value)}
                  placeholder="visitor@example.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose <span className="text-red-500">*</span></label>
                <input type="text" value={formData.purpose} onChange={(e) => setField('purpose', e.target.value)}
                  required placeholder="Purpose of visit" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Host Name</label>
                <input type="text" value={formData.host_name} onChange={(e) => setField('host_name', e.target.value)}
                  placeholder="Person being visited" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Type</label>
                  <select value={formData.id_type} onChange={(e) => setField('id_type', e.target.value)} className={inputCls}>
                    {ID_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                  <input type="text" value={formData.id_number} onChange={(e) => setField('id_number', e.target.value)}
                    placeholder="ID number" className={inputCls} />
                </div>
              </div>

              {renderCameraSection('Visitor Photo', 'Take Visitor Photo', 'user',
                visitorPhoto, setVisitorPhoto, showVisitorCamera, setShowVisitorCamera,
                visitorVideoRef, visitorCanvasRef, visitorStreamRef, 'w-32 h-32')}

              {renderCameraSection('ID Photo', 'Take ID Photo', 'environment',
                idPhoto, setIdPhoto, showIdCamera, setShowIdCamera,
                idVideoRef, idCanvasRef, idStreamRef, 'w-48 h-32')}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Badge Number</label>
                <input type="text" value={formData.badge_number} onChange={(e) => setField('badge_number', e.target.value)}
                  placeholder="Issued badge number" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setField('notes', e.target.value)}
                  rows={3} placeholder="Additional notes..." className={`${inputCls} resize-none`} />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Checking In...</>
                    : <><UserCheck className="w-4 h-4" />Check In Visitor</>}
                </button>
                <button type="button" onClick={() => setShowCheckInModal(false)} disabled={submitting}
                  className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
