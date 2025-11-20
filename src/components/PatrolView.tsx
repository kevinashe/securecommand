import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MapPin, Plus, Edit, Trash2, X, QrCode, Clock, Download } from 'lucide-react';

interface PatrolRoute {
  id: string;
  name: string;
  site_id: string;
  is_active: boolean;
  created_at: string;
  site_name?: string;
  checkpoint_count?: number;
}

interface Checkpoint {
  id: string;
  patrol_route_id: string;
  name: string;
  description: string;
  qr_code: string;
  order_index: number;
  created_at: string;
}

interface Site {
  id: string;
  name: string;
}

interface CheckpointDraft {
  name: string;
  description: string;
  order_index: number;
}

export const PatrolView: React.FC = () => {
  const { profile } = useAuth();
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<PatrolRoute | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showEditRouteModal, setShowEditRouteModal] = useState(false);
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [showEditCheckpointModal, setShowEditCheckpointModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [draftCheckpoints, setDraftCheckpoints] = useState<CheckpointDraft[]>([]);

  const [routeFormData, setRouteFormData] = useState({
    name: '',
    site_id: '',
    is_active: true,
  });

  const [checkpointFormData, setCheckpointFormData] = useState({
    name: '',
    description: '',
    order_index: 1,
  });

  useEffect(() => {
    loadRoutes();
    loadSites();
  }, [profile]);

  const loadRoutes = async () => {
    try {
      let query = supabase.from('patrol_routes').select('*, sites(name)').order('created_at', { ascending: false });

      if (profile?.role === 'company_admin') {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const routesWithCounts = await Promise.all(
        (data || []).map(async (route: any) => {
          const { count } = await supabase
            .from('checkpoints')
            .select('id', { count: 'exact', head: true })
            .eq('patrol_route_id', route.id);

          return {
            ...route,
            site_name: route.sites?.name,
            checkpoint_count: count || 0,
          };
        })
      );

      setRoutes(routesWithCounts);
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      let query = supabase.from('sites').select('id, name').eq('is_active', true);

      if (profile?.role === 'company_admin') {
        query = query.eq('company_id', profile.company_id);
      }

      const { data } = await query;
      setSites(data || []);
    } catch (error) {
      console.error('Error loading sites:', error);
    }
  };

  const loadCheckpoints = async (routeId: string) => {
    try {
      const { data, error } = await supabase
        .from('checkpoints')
        .select('*')
        .eq('patrol_route_id', routeId)
        .order('order_index');

      if (error) throw error;
      setCheckpoints(data || []);
    } catch (error) {
      console.error('Error loading checkpoints:', error);
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: newRoute, error: routeError } = await supabase
        .from('patrol_routes')
        .insert([
          {
            ...routeFormData,
            company_id: profile?.company_id,
          },
        ])
        .select()
        .single();

      if (routeError) throw routeError;

      if (draftCheckpoints.length > 0 && newRoute) {
        const checkpointsToInsert = draftCheckpoints.map((cp) => ({
          ...cp,
          patrol_route_id: newRoute.id,
          qr_code: `CHECKPOINT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
        }));

        const { error: checkpointsError } = await supabase
          .from('checkpoints')
          .insert(checkpointsToInsert);

        if (checkpointsError) throw checkpointsError;
      }

      setShowRouteModal(false);
      setRouteFormData({ name: '', site_id: '', is_active: true });
      setDraftCheckpoints([]);
      setCheckpointFormData({ name: '', description: '', order_index: 1 });
      loadRoutes();
    } catch (error) {
      console.error('Error creating route:', error);
      alert('Failed to create route. Please try again.');
    }
  };

  const addDraftCheckpoint = () => {
    if (!checkpointFormData.name || !checkpointFormData.description) {
      alert('Please fill in checkpoint name and description');
      return;
    }

    setDraftCheckpoints([...draftCheckpoints, { ...checkpointFormData }]);
    setCheckpointFormData({
      name: '',
      description: '',
      order_index: checkpointFormData.order_index + 1,
    });
  };

  const removeDraftCheckpoint = (index: number) => {
    setDraftCheckpoints(draftCheckpoints.filter((_, i) => i !== index));
  };

  const handleUpdateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheckpoint) return;

    try {
      const { error } = await supabase
        .from('checkpoints')
        .update({
          name: checkpointFormData.name,
          description: checkpointFormData.description,
          order_index: checkpointFormData.order_index,
        })
        .eq('id', selectedCheckpoint.id);

      if (!error) {
        setShowEditCheckpointModal(false);
        setSelectedCheckpoint(null);
        setCheckpointFormData({ name: '', description: '', order_index: 1 });
        if (selectedRoute) {
          loadCheckpoints(selectedRoute.id);
          loadRoutes();
        }
      }
    } catch (error) {
      console.error('Error updating checkpoint:', error);
      alert('Failed to update checkpoint. Please try again.');
    }
  };

  const openEditCheckpointModal = (checkpoint: Checkpoint) => {
    setSelectedCheckpoint(checkpoint);
    setCheckpointFormData({
      name: checkpoint.name,
      description: checkpoint.description,
      order_index: checkpoint.order_index,
    });
    setShowEditCheckpointModal(true);
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) return;

    try {
      const { error } = await supabase
        .from('patrol_routes')
        .update(routeFormData)
        .eq('id', selectedRoute.id);

      if (!error) {
        setShowEditRouteModal(false);
        setSelectedRoute(null);
        loadRoutes();
      }
    } catch (error) {
      console.error('Error updating route:', error);
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route? All checkpoints will be deleted.'))
      return;

    try {
      const { error } = await supabase.from('patrol_routes').delete().eq('id', id);

      if (!error) {
        loadRoutes();
      }
    } catch (error) {
      console.error('Error deleting route:', error);
    }
  };

  const handleCreateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) return;

    try {
      const qrCode = `CHECKPOINT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      const { error } = await supabase.from('checkpoints').insert([
        {
          ...checkpointFormData,
          patrol_route_id: selectedRoute.id,
          qr_code: qrCode,
        },
      ]);

      if (!error) {
        setShowCheckpointModal(false);
        setCheckpointFormData({ name: '', description: '', order_index: 1 });
        loadCheckpoints(selectedRoute.id);
        loadRoutes();
      }
    } catch (error) {
      console.error('Error creating checkpoint:', error);
    }
  };

  const handleDeleteCheckpoint = async (id: string) => {
    if (!confirm('Are you sure you want to delete this checkpoint?')) return;

    try {
      const { error } = await supabase.from('checkpoints').delete().eq('id', id);

      if (!error && selectedRoute) {
        loadCheckpoints(selectedRoute.id);
        loadRoutes();
      }
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
    }
  };

  const viewRouteDetails = (route: PatrolRoute) => {
    setSelectedRoute(route);
    loadCheckpoints(route.id);
  };

  const openEditRouteModal = (route: PatrolRoute) => {
    setSelectedRoute(route);
    setRouteFormData({
      name: route.name,
      site_id: route.site_id,
      is_active: route.is_active,
    });
    setShowEditRouteModal(true);
  };

  const openCheckpointQRModal = async (checkpoint: Checkpoint) => {
    setSelectedCheckpoint(checkpoint);
    const qrData = JSON.stringify({
      checkpointId: checkpoint.id,
      routeId: checkpoint.patrol_route_id,
      checkpointName: checkpoint.name,
      qrCode: checkpoint.qr_code,
      type: 'checkpoint_scan'
    });
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`;
    setQrCodeUrl(url);
    setShowQRModal(true);
  };

  const downloadCheckpointQRCode = () => {
    if (!selectedCheckpoint || !qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `${selectedCheckpoint.name.replace(/\s+/g, '_')}_Checkpoint_QR.png`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedRoute) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                setSelectedRoute(null);
                setCheckpoints([]);
              }}
              className="text-blue-600 hover:text-blue-700 mb-2 text-sm font-medium"
            >
              ← Back to Routes
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{selectedRoute.name}</h1>
            <p className="text-gray-600 mt-1">{selectedRoute.site_name}</p>
          </div>
          <button
            onClick={() => setShowCheckpointModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Checkpoint</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {checkpoints.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Checkpoints</h3>
              <p className="text-gray-600 mb-4">Add checkpoints to this patrol route.</p>
              <button
                onClick={() => setShowCheckpointModal(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Add Checkpoint</span>
              </button>
            </div>
          ) : (
            checkpoints.map((checkpoint) => (
              <div
                key={checkpoint.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <MapPin className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{checkpoint.name}</h3>
                      <span className="text-xs text-gray-500">
                        Checkpoint #{checkpoint.order_index}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Description</p>
                    <p className="text-sm text-gray-900">{checkpoint.description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">QR Code</p>
                    <p className="text-xs text-gray-900 font-mono bg-gray-50 p-2 rounded">
                      {checkpoint.qr_code}
                    </p>
                  </div>
                </div>

                <div className="flex space-x-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => openCheckpointQRModal(checkpoint)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <QrCode className="h-4 w-4" />
                    <span className="text-sm font-medium">QR</span>
                  </button>
                  <button
                    onClick={() => openEditCheckpointModal(checkpoint)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="text-sm font-medium">Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteCheckpoint(checkpoint.id)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {showCheckpointModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add Checkpoint</h2>
                <button
                  onClick={() => setShowCheckpointModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleCreateCheckpoint} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Checkpoint Name
                  </label>
                  <input
                    type="text"
                    value={checkpointFormData.name}
                    onChange={(e) =>
                      setCheckpointFormData({ ...checkpointFormData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Main Entrance"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={checkpointFormData.description}
                    onChange={(e) =>
                      setCheckpointFormData({ ...checkpointFormData, description: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="North side, building entrance"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Index
                  </label>
                  <input
                    type="number"
                    value={checkpointFormData.order_index}
                    onChange={(e) =>
                      setCheckpointFormData({
                        ...checkpointFormData,
                        order_index: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Order in which this checkpoint should be visited</p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCheckpointModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Checkpoint
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEditCheckpointModal && selectedCheckpoint && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Edit Checkpoint</h2>
                <button
                  onClick={() => {
                    setShowEditCheckpointModal(false);
                    setSelectedCheckpoint(null);
                    setCheckpointFormData({ name: '', description: '', order_index: 1 });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleUpdateCheckpoint} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Checkpoint Name
                  </label>
                  <input
                    type="text"
                    value={checkpointFormData.name}
                    onChange={(e) =>
                      setCheckpointFormData({ ...checkpointFormData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Main Entrance"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={checkpointFormData.description}
                    onChange={(e) =>
                      setCheckpointFormData({ ...checkpointFormData, description: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="North side, building entrance"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Index
                  </label>
                  <input
                    type="number"
                    value={checkpointFormData.order_index}
                    onChange={(e) =>
                      setCheckpointFormData({
                        ...checkpointFormData,
                        order_index: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Order in which this checkpoint should be visited</p>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">QR Code (cannot be changed)</p>
                  <p className="text-xs text-gray-900 font-mono">{selectedCheckpoint.qr_code}</p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditCheckpointModal(false);
                      setSelectedCheckpoint(null);
                      setCheckpointFormData({ name: '', description: '', order_index: 1 });
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patrol Routes</h1>
          <p className="text-gray-600 mt-1">Manage patrol routes and checkpoints</p>
        </div>
        <button
          onClick={() => setShowRouteModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Add Route</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {routes.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Routes Yet</h3>
            <p className="text-gray-600 mb-4">Create your first patrol route.</p>
            <button
              onClick={() => setShowRouteModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Add Route</span>
            </button>
          </div>
        ) : (
          routes.map((route) => (
            <div
              key={route.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <MapPin className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{route.name}</h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        route.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {route.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Site</p>
                  <p className="text-sm text-gray-900">{route.site_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Checkpoints</p>
                  <p className="text-sm text-gray-900">{route.checkpoint_count} checkpoints</p>
                </div>
              </div>

              <div className="flex space-x-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => viewRouteDetails(route)}
                  className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <QrCode className="h-4 w-4" />
                  <span className="text-sm font-medium">View</span>
                </button>
                <button
                  onClick={() => openEditRouteModal(route)}
                  className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  <span className="text-sm font-medium">Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteRoute(route.id)}
                  className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showRouteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Patrol Route</h2>
              <button
                onClick={() => {
                  setShowRouteModal(false);
                  setDraftCheckpoints([]);
                  setCheckpointFormData({ name: '', description: '', order_index: 1 });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Route Details</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Route Name</label>
                  <input
                    type="text"
                    value={routeFormData.name}
                    onChange={(e) => setRouteFormData({ ...routeFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Evening Patrol"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Site</label>
                  <select
                    value={routeFormData.site_id}
                    onChange={(e) => setRouteFormData({ ...routeFormData, site_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="route_active"
                    checked={routeFormData.is_active}
                    onChange={(e) =>
                      setRouteFormData({ ...routeFormData, is_active: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="route_active" className="ml-2 text-sm text-gray-700">
                    Route is active
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Checkpoints (Optional)</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Checkpoint Name</label>
                    <input
                      type="text"
                      value={checkpointFormData.name}
                      onChange={(e) =>
                        setCheckpointFormData({ ...checkpointFormData, name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Main Entrance"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Order Index</label>
                    <input
                      type="number"
                      value={checkpointFormData.order_index}
                      onChange={(e) =>
                        setCheckpointFormData({
                          ...checkpointFormData,
                          order_index: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={checkpointFormData.description}
                    onChange={(e) =>
                      setCheckpointFormData({ ...checkpointFormData, description: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="North side, building entrance"
                  />
                </div>

                <button
                  type="button"
                  onClick={addDraftCheckpoint}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Checkpoint to Route</span>
                </button>

                {draftCheckpoints.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Checkpoints to be created:</p>
                    {draftCheckpoints.map((cp, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {cp.order_index}. {cp.name}
                          </p>
                          <p className="text-xs text-gray-600">{cp.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDraftCheckpoint(idx)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowRouteModal(false);
                    setDraftCheckpoints([]);
                    setCheckpointFormData({ name: '', description: '', order_index: 1 });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Route {draftCheckpoints.length > 0 && `with ${draftCheckpoints.length} Checkpoint${draftCheckpoints.length > 1 ? 's' : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditRouteModal && selectedRoute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Patrol Route</h2>
              <button
                onClick={() => {
                  setShowEditRouteModal(false);
                  setSelectedRoute(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateRoute} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Route Name</label>
                <input
                  type="text"
                  value={routeFormData.name}
                  onChange={(e) => setRouteFormData({ ...routeFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Site</label>
                <select
                  value={routeFormData.site_id}
                  onChange={(e) => setRouteFormData({ ...routeFormData, site_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="route_active_edit"
                  checked={routeFormData.is_active}
                  onChange={(e) =>
                    setRouteFormData({ ...routeFormData, is_active: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="route_active_edit" className="ml-2 text-sm text-gray-700">
                  Route is active
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditRouteModal(false);
                    setSelectedRoute(null);
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

      {showQRModal && selectedCheckpoint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Checkpoint QR Code</h2>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setSelectedCheckpoint(null);
                  setQrCodeUrl('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="text-center space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedCheckpoint.name}</h3>
                <p className="text-sm text-gray-600 mb-1">{selectedCheckpoint.description}</p>
                <p className="text-xs text-gray-500">Checkpoint #{selectedCheckpoint.order_index}</p>
              </div>

              {qrCodeUrl && (
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                  <img src={qrCodeUrl} alt="Checkpoint QR Code" className="w-full max-w-sm mx-auto" />
                </div>
              )}

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-800 font-medium mb-1">QR Code ID</p>
                <p className="text-xs text-blue-900 font-mono">{selectedCheckpoint.qr_code}</p>
              </div>

              <p className="text-sm text-gray-600">
                Guards must scan this QR code when reaching this checkpoint
              </p>

              <button
                onClick={downloadCheckpointQRCode}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="h-5 w-5" />
                <span>Download QR Code</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
