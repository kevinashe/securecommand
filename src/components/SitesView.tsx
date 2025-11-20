import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MapPin, Plus, Edit, Trash2, X, QrCode, Download, Printer, Calendar, ChevronLeft, ChevronRight, Users, Shield } from 'lucide-react';

interface Site {
  id: string;
  name: string;
  address: string;
  contact_name: string;
  contact_phone: string;
  is_active: boolean;
  company_id: string;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  profiles: {
    full_name: string;
  };
}

export const SitesView: React.FC = () => {
  const { profile } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [siteShifts, setSiteShifts] = useState<Shift[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loadingShifts, setLoadingShifts] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    is_active: true,
    company_id: '',
  });

  useEffect(() => {
    loadSites();
    loadCompanies();
  }, [profile]);

  const loadSites = async () => {
    try {
      let query = supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });

      if ((profile?.role === 'company_admin' || profile?.role === 'site_manager') && profile.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error('Error loading sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadSiteShifts = async (siteId: string) => {
    setLoadingShifts(true);
    try {
      const startDate = getStartOfWeek(currentDate);
      const endDate = getEndOfWeek(currentDate);

      const { data, error } = await supabase
        .from('shifts')
        .select('*, profiles(full_name)')
        .eq('site_id', siteId)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSiteShifts(data || []);
    } catch (error) {
      console.error('Error loading site shifts:', error);
    } finally {
      setLoadingShifts(false);
    }
  };

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getEndOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (6 - day));
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const getWeekDays = () => {
    const days = [];
    const start = getStartOfWeek(currentDate);
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getShiftsForDate = (date: Date) => {
    return siteShifts.filter(shift => {
      const shiftDate = new Date(shift.start_time);
      return shiftDate.toDateString() === date.toDateString();
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const openShiftsModal = async (site: Site) => {
    setSelectedSite(site);
    setShowShiftsModal(true);
    await loadSiteShifts(site.id);
  };

  useEffect(() => {
    if (showShiftsModal && selectedSite) {
      loadSiteShifts(selectedSite.id);
    }
  }, [currentDate, showShiftsModal]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const companyId = formData.company_id || profile?.company_id;

      if (!companyId) {
        alert('Please select a company');
        return;
      }

      const { error } = await supabase.from('sites').insert([
        {
          name: formData.name,
          address: formData.address,
          contact_name: formData.contact_name,
          contact_phone: formData.contact_phone,
          is_active: formData.is_active,
          company_id: companyId,
        },
      ]);

      if (error) throw error;

      await loadSites();
      setShowCreateModal(false);
      setFormData({
        name: '',
        address: '',
        contact_name: '',
        contact_phone: '',
        is_active: true,
        company_id: '',
      });
    } catch (error) {
      console.error('Error creating site:', error);
      alert('Failed to create site. Please try again.');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite) return;

    try {
      const { error } = await supabase
        .from('sites')
        .update(formData)
        .eq('id', selectedSite.id);

      if (!error) {
        setShowEditModal(false);
        setSelectedSite(null);
        loadSites();
      }
    } catch (error) {
      console.error('Error updating site:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this site?')) return;

    try {
      const { error } = await supabase.from('sites').delete().eq('id', id);

      if (!error) {
        loadSites();
      }
    } catch (error) {
      console.error('Error deleting site:', error);
    }
  };

  const openEditModal = (site: Site) => {
    setSelectedSite(site);
    setFormData({
      name: site.name,
      address: site.address,
      contact_name: site.contact_name,
      contact_phone: site.contact_phone,
      is_active: site.is_active,
      company_id: site.company_id,
    });
    setShowEditModal(true);
  };

  const openQRModal = async (site: Site) => {
    setSelectedSite(site);
    setShowQRModal(true);

    const qrData = JSON.stringify({
      siteId: site.id,
      siteName: site.name,
      type: 'site_checkin'
    });

    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`;
    setQrCodeUrl(url);
  };

  const downloadQRCode = async () => {
    if (!selectedSite || !qrCodeUrl) return;
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedSite.name.replace(/\s+/g, '_')}_QR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  const printQRCode = () => {
    if (!qrCodeUrl || !selectedSite) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print QR Code - ${selectedSite.name}</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px;
                font-family: Arial, sans-serif;
              }
              h1 {
                margin-bottom: 10px;
                font-size: 24px;
              }
              p {
                margin: 5px 0;
                color: #666;
                font-size: 14px;
              }
              img {
                margin: 20px 0;
                max-width: 400px;
              }
              @media print {
                body { padding: 20px; }
              }
            </style>
          </head>
          <body>
            <h1>${selectedSite.name}</h1>
            <p>${selectedSite.address}</p>
            <img src="${qrCodeUrl}" alt="QR Code" onload="window.print();" />
            <p>Scan this QR code to check in at this site</p>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Sites Management</h1>
          <p className="text-gray-600 mt-1">Manage security locations and schedules</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          <span>Add Site</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sites Yet</h3>
            <p className="text-gray-600 mb-4">Get started by adding your first site location.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Add Site</span>
            </button>
          </div>
        ) : (
          sites.map((site) => (
            <div
              key={site.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden"
            >
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-2.5 rounded-lg shadow-sm">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{site.name}</h3>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${
                      site.is_active
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}
                  >
                    {site.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Address</p>
                  <p className="text-sm text-gray-900">{site.address}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Contact</p>
                  <p className="text-sm font-medium text-gray-900">{site.contact_name}</p>
                  <p className="text-sm text-gray-600">{site.contact_phone}</p>
                </div>
              </div>

              <div className="px-6 pb-6 grid grid-cols-2 gap-2">
                <button
                  onClick={() => openShiftsModal(site)}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-medium"
                >
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Schedule</span>
                </button>
                <button
                  onClick={() => openQRModal(site)}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors font-medium"
                >
                  <QrCode className="h-4 w-4" />
                  <span className="text-sm">QR Code</span>
                </button>
                <button
                  onClick={() => openEditModal(site)}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors font-medium"
                >
                  <Edit className="h-4 w-4" />
                  <span className="text-sm">Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(site.id)}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm">Delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Site</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {(!profile?.company_id || profile.role === 'super_admin') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <select
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Downtown Office"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="123 Main St, City, State 12345"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Site is active
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Site</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedSite(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active_edit"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active_edit" className="ml-2 text-sm text-gray-700">
                  Site is active
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedSite(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQRModal && selectedSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col my-8">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Site QR Code</h2>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setSelectedSite(null);
                  setQrCodeUrl('');
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="text-center space-y-4 p-6 overflow-y-auto">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedSite.name}</h3>
                <p className="text-sm text-gray-600">{selectedSite.address}</p>
              </div>

              {qrCodeUrl ? (
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                  <img
                    src={qrCodeUrl}
                    alt="Site QR Code"
                    className="w-full max-w-sm mx-auto"
                  />
                </div>
              ) : (
                <div className="bg-gray-100 p-8 rounded-lg">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              )}

              <p className="text-sm text-gray-600">
                Guards can scan this QR code to check in at this site
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={printQRCode}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Printer className="h-5 w-5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={downloadQRCode}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-5 w-5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShiftsModal && selectedSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedSite.name}</h2>
                <p className="text-sm text-gray-600 mt-1">Weekly Shift Schedule</p>
              </div>
              <button
                onClick={() => {
                  setShowShiftsModal(false);
                  setSelectedSite(null);
                  setSiteShifts([]);
                  setCurrentDate(new Date());
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => navigateWeek('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h3 className="text-lg font-semibold text-gray-900">
                  {getStartOfWeek(currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {getEndOfWeek(currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => navigateWeek('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {loadingShifts ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="bg-gray-50 p-3 text-center text-sm font-semibold text-gray-700">
                      {day}
                    </div>
                  ))}
                  {getWeekDays().map((day, idx) => {
                    const dayShifts = getShiftsForDate(day);
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                      <div
                        key={idx}
                        className={`bg-white min-h-32 p-2 ${isToday ? 'bg-blue-50' : ''}`}
                      >
                        <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                          {day.getDate()}
                        </div>
                        <div className="space-y-1">
                          {dayShifts.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center mt-4">No shifts</p>
                          ) : (
                            dayShifts.map(shift => (
                              <div
                                key={shift.id}
                                className={`text-xs p-1.5 rounded ${
                                  shift.status === 'scheduled'
                                    ? 'bg-blue-100 text-blue-700'
                                    : shift.status === 'active'
                                    ? 'bg-green-100 text-green-700'
                                    : shift.status === 'completed'
                                    ? 'bg-gray-100 text-gray-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                <div className="font-medium truncate flex items-center space-x-1">
                                  <Shield className="h-3 w-3" />
                                  <span>{shift.profiles?.full_name}</span>
                                </div>
                                <div className="opacity-75">
                                  {new Date(shift.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!loadingShifts && siteShifts.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No shifts scheduled for this week</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
