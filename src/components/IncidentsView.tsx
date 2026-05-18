import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Plus, MapPin, Clock, User, X, Camera, ArrowLeft } from 'lucide-react';
import { showToast } from '../lib/toast';
import { playIncidentAlert } from '../lib/soundAlerts';

interface IncidentsViewProps {
  onBack?: () => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sites, setSites] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    site_id: '',
    title: '',
    description: '',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadIncidents();
    loadSites();
    getCurrentLocation();

    const channel = supabase
      .channel('incidents_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, () => {
        playIncidentAlert();
        loadIncidents();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, () => {
        loadIncidents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  useEffect(() => {
    if (!showCreateModal) {
      setCapturedPhotos([]);
    }
  }, [showCreateModal]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
      });
    }
  };

  const loadIncidents = async () => {
    if (!profile) return;

    try {
      let query = supabase
        .from('incidents')
        .select('*, sites!inner(name, company_id), profiles(full_name), incident_photos(photo_url)')
        .order('created_at', { ascending: false });

      if (profile.role === 'security_officer') {
        query = query.eq('reported_by', profile.id);
      } else if (profile.role === 'company_admin' || profile.role === 'site_manager') {
        query = query.eq('sites.company_id', profile.company_id);
      }

      const { data, error } = await query;

      if (!error && data) {
        setIncidents(data);
      }
    } catch (error) {
      console.error('Error loading incidents:', error);
      showToast('error', 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    if (!profile) return;

    try {
      const query = profile.role === 'super_admin'
        ? supabase.from('sites').select('*').eq('is_active', true)
        : supabase.from('sites').select('*').eq('company_id', profile.company_id!).eq('is_active', true);

      const { data } = await query;
      if (data) setSites(data);
    } catch (error) {
      console.error('Error loading sites:', error);
      showToast('error', 'Failed to load sites');
    }
  };


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCapturedPhotos(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const removePhoto = (index: number) => {
    setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotosToStorage = async (incidentId: string, photos: string[]) => {
    const photoUrls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const base64Data = photo.split(',')[1];
      const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(r => r.blob());

      const fileName = `incident_${incidentId}_${Date.now()}_${i}.jpg`;
      const filePath = `incidents/${incidentId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('incident-photos')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from('incident-photos')
          .getPublicUrl(data.path);

        photoUrls.push(urlData.publicUrl);
      }
    }

    return photoUrls;
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: incidentData, error } = await supabase.from('incidents').insert([
        {
          ...formData,
          reported_by: profile!.id,
          status: 'open',
          occurred_at: new Date().toISOString(),
        },
      ]).select().single();

      if (!error && incidentData) {
        // Upload photos if any were captured
        if (capturedPhotos.length > 0) {
          const photoUrls = await uploadPhotosToStorage(incidentData.id, capturedPhotos);

          // Save photo records to incident_photos table
          const photoRecords = photoUrls.map(url => ({
            incident_id: incidentData.id,
            photo_url: url,
            uploaded_by: profile!.id
          }));

          await supabase.from('incident_photos').insert(photoRecords);
        }

        setShowCreateModal(false);
        setFormData({
          site_id: '',
          title: '',
          description: '',
          severity: 'medium',
          latitude: null,
          longitude: null,
        });
        setCapturedPhotos([]);
        loadIncidents();
        getCurrentLocation();
      }
    } catch (error) {
      console.error('Error creating incident:', error);
      showToast('error', 'Failed to create incident');
    }
  };

  const updateIncidentStatus = async (incidentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('incidents')
        .update({ status: newStatus })
        .eq('id', incidentId);

      if (!error) {
        loadIncidents();
      }
    } catch (error) {
      console.error('Error updating incident:', error);
      showToast('error', 'Failed to update incident status');
    }
  };

  const canManageIncidents = profile?.role !== 'security_officer';

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
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Go back"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Incidents</h1>
            <p className="text-gray-600 mt-1">Track and manage security incidents</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Report Incident</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {incidents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No incidents reported</p>
          </div>
        ) : (
          incidents.map((incident) => (
            <div
              key={incident.id}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-lg ${
                        incident.severity === 'critical'
                          ? 'bg-red-100'
                          : incident.severity === 'high'
                          ? 'bg-orange-100'
                          : incident.severity === 'medium'
                          ? 'bg-yellow-100'
                          : 'bg-blue-100'
                      }`}
                    >
                      <AlertTriangle
                        className={`h-5 w-5 ${
                          incident.severity === 'critical'
                            ? 'text-red-600'
                            : incident.severity === 'high'
                            ? 'text-orange-600'
                            : incident.severity === 'medium'
                            ? 'text-yellow-600'
                            : 'text-blue-600'
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {incident.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {incident.sites?.name}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-700">{incident.description}</p>

                  {incident.incident_photos && incident.incident_photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto py-2">
                      {incident.incident_photos.map((photo: any, idx: number) => (
                        <img
                          key={idx}
                          src={photo.photo_url}
                          alt={`Incident photo ${idx + 1}`}
                          className="h-24 w-24 object-cover rounded-lg border border-gray-200 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => window.open(photo.photo_url, '_blank')}
                        />
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {incident.profiles?.full_name}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {new Date(incident.occurred_at).toLocaleString()}
                      </span>
                    </div>

                    {incident.latitude && incident.longitude && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">
                          Location Recorded
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ml-4 flex flex-col items-end space-y-2">
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${
                      incident.severity === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : incident.severity === 'high'
                        ? 'bg-orange-100 text-orange-700'
                        : incident.severity === 'medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {incident.severity}
                  </span>

                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${
                      incident.status === 'open'
                        ? 'bg-red-100 text-red-700'
                        : incident.status === 'investigating'
                        ? 'bg-yellow-100 text-yellow-700'
                        : incident.status === 'resolved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {incident.status}
                  </span>

                  {canManageIncidents && incident.status === 'open' && (
                    <button
                      onClick={() => updateIncidentStatus(incident.id, 'investigating')}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Investigate
                    </button>
                  )}

                  {canManageIncidents && incident.status === 'investigating' && (
                    <button
                      onClick={() => updateIncidentStatus(incident.id, 'resolved')}
                      className="text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Report Incident</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site
                </label>
                <select
                  value={formData.site_id}
                  onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief incident title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Detailed description of the incident"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Severity
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) =>
                    setFormData({ ...formData, severity: e.target.value as any })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {formData.latitude && formData.longitude && (
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700">Location captured</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photos
                </label>

                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <Camera className="h-5 w-5 text-gray-600" />
                    <span className="text-gray-600">Add Photo</span>
                  </label>
                </div>

                {capturedPhotos.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {capturedPhotos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={photo}
                          alt={`Captured ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
