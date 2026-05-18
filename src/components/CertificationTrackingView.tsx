import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import { Award, Plus, CreditCard as Edit2, X, ArrowLeft, Search, Shield, AlertTriangle, Clock, CheckCircle, XCircle, Upload, FileText, User, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface Certification {
  id: string;
  company_id: string;
  guard_id: string;
  certification_name: string;
  certification_type: string;
  issuing_authority: string | null;
  certificate_number: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: string;
  document_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  guard_name?: string;
}

interface Guard {
  id: string;
  full_name: string;
}

interface CertificationTrackingViewProps {
  onBack?: () => void;
}

const CERTIFICATION_TYPES = [
  { value: 'license', label: 'License' },
  { value: 'certification', label: 'Certification' },
  { value: 'training', label: 'Training' },
  { value: 'permit', label: 'Permit' },
];

function computeDisplayStatus(expiryDate: string | null, originalStatus: string): string {
  if (originalStatus === 'revoked') return 'revoked';
  if (!expiryDate) return originalStatus;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  if (expiry < today) return 'expired';
  const thirtyDays = new Date(today);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  if (expiry <= thirtyDays) return 'expiring_soon';
  return 'active';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString();
}

function daysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export const CertificationTrackingView: React.FC<CertificationTrackingViewProps> = ({ onBack }) => {
  const { profile } = useAuth();

  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGuard, setFilterGuard] = useState('');
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    guard_id: '',
    certification_name: '',
    certification_type: 'license',
    issuing_authority: '',
    certificate_number: '',
    issued_date: '',
    expiry_date: '',
    notes: '',
    document_url: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const canManage =
    profile?.role === 'company_admin' ||
    profile?.role === 'site_manager' ||
    profile?.role === 'hr_manager' ||
    profile?.role === 'super_admin';

  useEffect(() => {
    if (profile) {
      loadCertifications();
      loadGuards();
    }
  }, [profile]);

  const loadCertifications = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('guard_certifications')
        .select('*, profiles!guard_certifications_guard_id_fkey(full_name)')
        .order('expiry_date', { ascending: true });

      if (profile?.role !== 'super_admin' && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map((cert: any) => ({
        ...cert,
        guard_name: cert.profiles?.full_name || 'Unknown Guard',
        status: computeDisplayStatus(cert.expiry_date, cert.status),
      }));

      setCertifications(mapped);
    } catch (err: any) {
      showToast('error', 'Failed to load certifications: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadGuards = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      if (profile?.role !== 'super_admin' && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setGuards(data || []);
    } catch (err: any) {
      showToast('error', 'Failed to load guards: ' + err.message);
    }
  };

  const handleFileUpload = async (guardId: string): Promise<string | null> => {
    if (!selectedFile || !profile?.company_id) return null;
    try {
      setUploading(true);
      const filename = `${profile.company_id}/${guardId}-${Date.now()}-${selectedFile.name}`;
      const { error } = await supabase.storage
        .from('certification-docs')
        .upload(filename, selectedFile);
      if (error) throw error;
      const { data } = supabase.storage.from('certification-docs').getPublicUrl(filename);
      return data.publicUrl;
    } catch (err: any) {
      showToast('error', 'File upload failed: ' + err.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;

    if (!formData.certification_name.trim()) {
      showToast('error', 'Certification name is required');
      return;
    }
    if (!formData.guard_id) {
      showToast('error', 'Please select a guard');
      return;
    }

    try {
      let documentUrl = formData.document_url;
      if (selectedFile) {
        const uploadedUrl = await handleFileUpload(formData.guard_id);
        if (uploadedUrl) documentUrl = uploadedUrl;
      }

      const certStatus = computeDisplayStatus(formData.expiry_date || null, 'active');

      const payload = {
        company_id: profile.company_id,
        guard_id: formData.guard_id,
        certification_name: formData.certification_name.trim(),
        certification_type: formData.certification_type,
        issuing_authority: formData.issuing_authority.trim() || null,
        certificate_number: formData.certificate_number.trim() || null,
        issued_date: formData.issued_date || null,
        expiry_date: formData.expiry_date || null,
        status: certStatus,
        document_url: documentUrl || null,
        notes: formData.notes.trim() || null,
      };

      if (editingCert) {
        const { error } = await supabase
          .from('guard_certifications')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingCert.id);
        if (error) throw error;
        showToast('success', 'Certification updated successfully');
      } else {
        const { error } = await supabase
          .from('guard_certifications')
          .insert(payload);
        if (error) throw error;
        showToast('success', 'Certification added successfully');
      }

      resetForm();
      loadCertifications();
    } catch (err: any) {
      showToast('error', 'Failed to save certification: ' + err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      guard_id: '',
      certification_name: '',
      certification_type: 'license',
      issuing_authority: '',
      certificate_number: '',
      issued_date: '',
      expiry_date: '',
      notes: '',
      document_url: '',
    });
    setSelectedFile(null);
    setEditingCert(null);
    setShowModal(false);
  };

  const openEditModal = (cert: Certification) => {
    setEditingCert(cert);
    setFormData({
      guard_id: cert.guard_id,
      certification_name: cert.certification_name,
      certification_type: cert.certification_type,
      issuing_authority: cert.issuing_authority || '',
      certificate_number: cert.certificate_number || '',
      issued_date: cert.issued_date || '',
      expiry_date: cert.expiry_date || '',
      notes: cert.notes || '',
      document_url: cert.document_url || '',
    });
    setSelectedFile(null);
    setShowModal(true);
  };

  // --- Computed data ---

  const filtered = certifications.filter((cert) => {
    const matchesSearch =
      !searchQuery ||
      cert.certification_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cert.guard_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || cert.certification_type === filterType;
    const matchesStatus = !filterStatus || cert.status === filterStatus;
    const matchesGuard = !filterGuard || cert.guard_id === filterGuard;
    return matchesSearch && matchesType && matchesStatus && matchesGuard;
  });

  const stats = {
    total: certifications.length,
    active: certifications.filter((c) => c.status === 'active').length,
    expiringSoon: certifications.filter((c) => c.status === 'expiring_soon').length,
    expired: certifications.filter((c) => c.status === 'expired').length,
  };

  const getExpiringWithinDays = (days: number) =>
    certifications.filter((c) => {
      if (!c.expiry_date) return false;
      const d = daysUntilExpiry(c.expiry_date);
      return d >= 0 && d <= days && c.status !== 'revoked';
    });

  const alertGroups = {
    thirty: getExpiringWithinDays(30),
    sixty: getExpiringWithinDays(60).filter(
      (c) => c.expiry_date && daysUntilExpiry(c.expiry_date) > 30
    ),
    ninety: getExpiringWithinDays(90).filter(
      (c) => c.expiry_date && daysUntilExpiry(c.expiry_date) > 60
    ),
  };

  const selectedGuardCerts = selectedGuardId
    ? certifications.filter((c) => c.guard_id === selectedGuardId)
    : [];
  const selectedGuardName =
    selectedGuardId
      ? guards.find((g) => g.id === selectedGuardId)?.full_name ||
        certifications.find((c) => c.guard_id === selectedGuardId)?.guard_name ||
        'Unknown Guard'
      : '';

  // --- Status badge ---

  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      expiring_soon: 'bg-amber-100 text-amber-800',
      expired: 'bg-red-100 text-red-800',
      revoked: 'bg-gray-100 text-gray-600',
    };
    const labels: Record<string, string> = {
      active: 'Active',
      expiring_soon: 'Expiring Soon',
      expired: 'Expired',
      revoked: 'Revoked',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.active}`}>
        {labels[status] || status}
      </span>
    );
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-7 h-7 text-blue-600" />
              Certification Tracking
            </h1>
            <p className="text-sm text-gray-500 mt-1">Manage guard licenses, certifications, and training records</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
              showAlerts
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Expiry Alerts
            {stats.expiringSoon + stats.expired > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {stats.expiringSoon + stats.expired}
              </span>
            )}
          </button>
          {canManage && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Certification
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Certifications</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{stats.expiringSoon}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Expired</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.expired}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Expiry Alerts Panel */}
      {showAlerts && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Expiry Alerts
          </h2>

          {alertGroups.thirty.length === 0 && alertGroups.sixty.length === 0 && alertGroups.ninety.length === 0 ? (
            <p className="text-gray-500 text-sm">No upcoming expiries in the next 90 days.</p>
          ) : (
            <div className="space-y-4">
              {alertGroups.thirty.length > 0 && (
                <div className="border-l-4 border-red-400 bg-red-50 rounded-r-lg p-4">
                  <h3 className="font-medium text-red-800 mb-2">
                    Within 30 Days ({alertGroups.thirty.length})
                  </h3>
                  <div className="space-y-2">
                    {alertGroups.thirty.map((cert) => (
                      <div key={cert.id} className="flex items-center justify-between text-sm">
                        <span className="text-red-700">
                          <span className="font-medium">{cert.guard_name}</span> - {cert.certification_name}
                        </span>
                        <span className="text-red-600 font-medium">
                          {cert.expiry_date && daysUntilExpiry(cert.expiry_date) <= 0
                            ? 'Expired'
                            : `${daysUntilExpiry(cert.expiry_date!)} days left`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {alertGroups.sixty.length > 0 && (
                <div className="border-l-4 border-amber-400 bg-amber-50 rounded-r-lg p-4">
                  <h3 className="font-medium text-amber-800 mb-2">
                    31-60 Days ({alertGroups.sixty.length})
                  </h3>
                  <div className="space-y-2">
                    {alertGroups.sixty.map((cert) => (
                      <div key={cert.id} className="flex items-center justify-between text-sm">
                        <span className="text-amber-700">
                          <span className="font-medium">{cert.guard_name}</span> - {cert.certification_name}
                        </span>
                        <span className="text-amber-600 font-medium">
                          {daysUntilExpiry(cert.expiry_date!)} days left
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {alertGroups.ninety.length > 0 && (
                <div className="border-l-4 border-yellow-400 bg-yellow-50 rounded-r-lg p-4">
                  <h3 className="font-medium text-yellow-800 mb-2">
                    61-90 Days ({alertGroups.ninety.length})
                  </h3>
                  <div className="space-y-2">
                    {alertGroups.ninety.map((cert) => (
                      <div key={cert.id} className="flex items-center justify-between text-sm">
                        <span className="text-yellow-700">
                          <span className="font-medium">{cert.guard_name}</span> - {cert.certification_name}
                        </span>
                        <span className="text-yellow-600 font-medium">
                          {daysUntilExpiry(cert.expiry_date!)} days left
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Guard Profile View */}
      {selectedGuardId && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              {selectedGuardName} - Certifications
            </h2>
            <button
              onClick={() => setSelectedGuardId(null)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {selectedGuardCerts.length === 0 ? (
            <p className="text-gray-500 text-sm">No certifications found for this guard.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedGuardCerts.map((cert) => (
                <div
                  key={cert.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{cert.certification_name}</h3>
                    <StatusBadge status={cert.status} />
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Type: <span className="capitalize">{cert.certification_type}</span></p>
                    {cert.issuing_authority && <p>Authority: {cert.issuing_authority}</p>}
                    {cert.certificate_number && <p>Number: {cert.certificate_number}</p>}
                    <p>Issued: {formatDate(cert.issued_date)}</p>
                    <p>Expires: {formatDate(cert.expiry_date)}</p>
                  </div>
                  {cert.document_url && (
                    <a
                      href={cert.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      <FileText className="w-3 h-3" />
                      View Document
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by certification or guard name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterGuard}
              onChange={(e) => setFilterGuard(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Guards</option>
              {guards.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.full_name}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {CERTIFICATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="expiring_soon">Expiring Soon</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Certification Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Guard</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Certification</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Authority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Issued</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                {canManage && (
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Shield className="w-8 h-8 text-gray-300" />
                      <p>No certifications found</p>
                      {searchQuery || filterType || filterStatus || filterGuard ? (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setFilterType('');
                            setFilterStatus('');
                            setFilterGuard('');
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((cert) => (
                  <tr
                    key={cert.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedGuardId(cert.guard_id)}
                        className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                      >
                        {cert.guard_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {cert.certification_name}
                      {cert.certificate_number && (
                        <span className="block text-xs text-gray-400 mt-0.5">
                          #{cert.certificate_number}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell capitalize text-gray-600">
                      {cert.certification_type}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                      {cert.issuing_authority || '--'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                      {formatDate(cert.issued_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(cert.expiry_date)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={cert.status} />
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEditModal(cert)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
            Showing {filtered.length} of {certifications.length} certifications
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCert ? 'Edit Certification' : 'Add Certification'}
              </h2>
              <button
                onClick={resetForm}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guard <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.guard_id}
                    onChange={(e) => setFormData({ ...formData, guard_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select a guard</option>
                    {guards.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Certification Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.certification_name}
                    onChange={(e) => setFormData({ ...formData, certification_name: e.target.value })}
                    required
                    placeholder="e.g., PSIRA Grade B"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Certification Type
                  </label>
                  <select
                    value={formData.certification_type}
                    onChange={(e) => setFormData({ ...formData, certification_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {CERTIFICATION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issuing Authority
                  </label>
                  <input
                    type="text"
                    value={formData.issuing_authority}
                    onChange={(e) => setFormData({ ...formData, issuing_authority: e.target.value })}
                    placeholder="e.g., PSIRA"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Certificate Number
                  </label>
                  <input
                    type="text"
                    value={formData.certificate_number}
                    onChange={(e) => setFormData({ ...formData, certificate_number: e.target.value })}
                    placeholder="e.g., PSI-12345"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issued Date
                  </label>
                  <input
                    type="date"
                    value={formData.issued_date}
                    onChange={(e) => setFormData({ ...formData, issued_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Upload
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-sm text-gray-600">
                      <Upload className="w-4 h-4" />
                      {selectedFile ? selectedFile.name : 'Choose file'}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    {formData.document_url && !selectedFile && (
                      <a
                        href={formData.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Current document
                      </a>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Additional notes..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Uploading...
                    </>
                  ) : editingCert ? (
                    'Update Certification'
                  ) : (
                    'Add Certification'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
