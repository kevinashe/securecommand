import React, { useState, useEffect } from 'react';
import { Bus, Plus, Edit2, Trash2, QrCode, X, MapPin, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CompanyBus {
  id: string;
  company_id: string;
  bus_number: string;
  license_plate: string;
  capacity: number;
  qr_code: string;
  route_name: string;
  driver_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BusManagementViewProps {
  onBack: () => void;
}

export default function BusManagementView({ onBack }: BusManagementViewProps) {
  const { profile } = useAuth();
  const [buses, setBuses] = useState<CompanyBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedBus, setSelectedBus] = useState<CompanyBus | null>(null);
  const [formData, setFormData] = useState({
    bus_number: '',
    license_plate: '',
    capacity: 50,
    route_name: '',
    driver_name: '',
    is_active: true
  });

  useEffect(() => {
    if (profile?.company_id) {
      fetchBuses();
    }
  }, [profile?.company_id]);

  const fetchBuses = async () => {
    try {
      const { data, error } = await supabase
        .from('company_buses')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBuses(data || []);
    } catch (error) {
      console.error('Error fetching buses:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = () => {
    return `BUS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedBus) {
        const { error } = await supabase
          .from('company_buses')
          .update(formData)
          .eq('id', selectedBus.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_buses')
          .insert([{
            ...formData,
            company_id: profile?.company_id,
            qr_code: generateQRCode()
          }]);

        if (error) throw error;
      }

      setShowModal(false);
      setSelectedBus(null);
      resetForm();
      fetchBuses();
    } catch (error: any) {
      alert('Error saving bus: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bus?')) return;

    try {
      const { error } = await supabase
        .from('company_buses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchBuses();
    } catch (error: any) {
      alert('Error deleting bus: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      bus_number: '',
      license_plate: '',
      capacity: 50,
      route_name: '',
      driver_name: '',
      is_active: true
    });
  };

  const openEditModal = (bus: CompanyBus) => {
    setSelectedBus(bus);
    setFormData({
      bus_number: bus.bus_number,
      license_plate: bus.license_plate,
      capacity: bus.capacity,
      route_name: bus.route_name,
      driver_name: bus.driver_name,
      is_active: bus.is_active
    });
    setShowModal(true);
  };

  const openAddModal = () => {
    setSelectedBus(null);
    resetForm();
    setShowModal(true);
  };

  const showQRCode = (bus: CompanyBus) => {
    setSelectedBus(bus);
    setShowQRModal(true);
  };

  const downloadQRCode = (bus: CompanyBus) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 500;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Bus ${bus.bus_number}`, 200, 40);

    ctx.font = '16px Arial';
    ctx.fillText(bus.route_name || 'Company Transport', 200, 70);

    const qrSize = 300;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 100;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);

    ctx.font = '14px monospace';
    ctx.fillText(bus.qr_code, 200, qrY + qrSize / 2);

    ctx.font = '12px Arial';
    ctx.fillText('Scan to check in', 200, 450);
    ctx.fillText(`Capacity: ${bus.capacity} passengers`, 200, 480);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bus-${bus.bus_number}-qr-code.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading buses...</div>
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

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bus Management</h2>
          <p className="text-gray-600 mt-1">Manage company transport vehicles and QR codes</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add Bus
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {buses.map((bus) => (
          <div key={bus.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bus className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Bus {bus.bus_number}</h3>
                  <p className="text-sm text-gray-500">{bus.license_plate}</p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                bus.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {bus.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              {bus.route_name && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  {bus.route_name}
                </div>
              )}
              {bus.driver_name && (
                <p className="text-sm text-gray-600">Driver: {bus.driver_name}</p>
              )}
              <p className="text-sm text-gray-600">Capacity: {bus.capacity} passengers</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => showQRCode(bus)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
              >
                <QrCode className="w-4 h-4" />
                QR Code
              </button>
              <button
                onClick={() => openEditModal(bus)}
                className="px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(bus.id)}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {buses.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Bus className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No buses added yet</p>
          <p className="text-sm text-gray-500 mt-1">Add your first bus to start tracking staff check-ins</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedBus ? 'Edit Bus' : 'Add New Bus'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedBus(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bus Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.bus_number}
                    onChange={(e) => setFormData({ ...formData, bus_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 001, A1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Plate
                  </label>
                  <input
                    type="text"
                    value={formData.license_plate}
                    onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., ABC-123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route Name
                  </label>
                  <input
                    type="text"
                    value={formData.route_name}
                    onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., North Route, City Center"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    value={formData.driver_name}
                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Driver's name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    Bus is active
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setSelectedBus(null);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {selectedBus ? 'Update' : 'Add'} Bus
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showQRModal && selectedBus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  QR Code - Bus {selectedBus.bus_number}
                </h3>
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setSelectedBus(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <div className="bg-white inline-block p-4 rounded-lg border-2 border-gray-200 mb-4">
                  <QrCode className="w-48 h-48 text-gray-800 mx-auto" />
                  <p className="text-xs font-mono text-gray-600 mt-2 break-all">
                    {selectedBus.qr_code}
                  </p>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Staff can scan this QR code to check in to the bus
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setSelectedBus(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => downloadQRCode(selectedBus)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Download QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
