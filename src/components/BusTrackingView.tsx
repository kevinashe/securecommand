import { useState, useEffect } from 'react';
import { Bus, Users, TrendingUp, Clock, User, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../lib/toast';

interface BusWithPassengers {
  id: string;
  bus_number: string;
  route_name: string;
  capacity: number;
  driver_name: string;
  is_active: boolean;
  passenger_count: number;
  passengers: Array<{
    id: string;
    checked_in_at: string;
    profile: {
      full_name: string;
      staff_code: string;
    };
  }>;
}

interface DailyStats {
  total_check_ins: number;
  unique_passengers: number;
  most_used_bus: string;
}

interface BusTrackingViewProps {
  onBack: () => void;
}

export default function BusTrackingView({ onBack }: BusTrackingViewProps) {
  const { profile } = useAuth();
  const [buses, setBuses] = useState<BusWithPassengers[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [selectedBus, setSelectedBus] = useState<BusWithPassengers | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (profile?.company_id) {
      fetchBusData();
      fetchDailyStats();
    }
  }, [profile?.company_id]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchBusData();
        fetchDailyStats();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, profile?.company_id]);

  const fetchBusData = async () => {
    try {
      const { data: busesData, error: busesError } = await supabase
        .from('company_buses')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('bus_number');

      if (busesError) throw busesError;

      const busesWithPassengers = await Promise.all(
        (busesData || []).map(async (bus) => {
          const { data: checkIns, error: checkInsError } = await supabase
            .from('bus_check_ins')
            .select(`
              id,
              checked_in_at,
              profiles:user_id (
                full_name,
                staff_code
              )
            `)
            .eq('bus_id', bus.id)
            .is('checked_out_at', null)
            .order('checked_in_at', { ascending: false });

          if (checkInsError) {
            console.error('Error fetching check-ins:', checkInsError);
          }

          return {
            ...bus,
            passenger_count: checkIns?.length || 0,
            passengers: (checkIns || []).map((checkIn) => ({
              id: checkIn.id,
              checked_in_at: checkIn.checked_in_at,
              profile: checkIn.profiles
            }))
          };
        })
      );

      setBuses(busesWithPassengers);
    } catch (error) {
      console.error('Error fetching bus data:', error);
      showToast('error', 'Failed to load bus data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayCheckIns, error } = await supabase
        .from('bus_check_ins')
        .select('bus_id, user_id')
        .eq('company_id', profile?.company_id)
        .gte('checked_in_at', today.toISOString());

      if (error) throw error;

      const uniquePassengers = new Set(todayCheckIns?.map((c) => c.user_id)).size;

      const busIdCounts = todayCheckIns?.reduce((acc, checkIn) => {
        acc[checkIn.bus_id] = (acc[checkIn.bus_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const topBusId = Object.entries(busIdCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const topBus = topBusId ? buses.find((b) => b.id === topBusId) : null;

      setDailyStats({
        total_check_ins: todayCheckIns?.length || 0,
        unique_passengers: uniquePassengers,
        most_used_bus: topBus?.bus_number || 'N/A',
      });
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      showToast('error', 'Failed to load daily statistics');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getOccupancyColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 70) return 'text-orange-600 bg-orange-100';
    return 'text-green-600 bg-green-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading bus tracking data...</div>
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
          <h2 className="text-2xl font-bold text-gray-900">Bus Tracking</h2>
          <p className="text-gray-600 mt-1">Real-time monitoring of bus occupancy and passengers</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            Auto-refresh (30s)
          </label>
        </div>
      </div>

      {dailyStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Today's Check-ins</p>
                <p className="text-2xl font-bold text-gray-900">{dailyStats.total_check_ins}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Unique Passengers</p>
                <p className="text-2xl font-bold text-gray-900">{dailyStats.unique_passengers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Bus className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Most Used Bus</p>
                <p className="text-2xl font-bold text-gray-900">{dailyStats.most_used_bus}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {buses.map((bus) => {
          const occupancyPercentage = (bus.passenger_count / bus.capacity) * 100;
          return (
            <div
              key={bus.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedBus(bus)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Bus className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Bus {bus.bus_number}</h3>
                    {bus.route_name && (
                      <p className="text-sm text-gray-600">{bus.route_name}</p>
                    )}
                  </div>
                </div>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  bus.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {bus.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {bus.driver_name && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <User className="w-4 h-4" />
                  Driver: {bus.driver_name}
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-600" />
                    <span className="text-sm text-gray-600">Current Passengers</span>
                  </div>
                  <span className={`px-3 py-1 text-sm font-bold rounded-full ${getOccupancyColor(occupancyPercentage)}`}>
                    {bus.passenger_count} / {bus.capacity}
                  </span>
                </div>

                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">Occupancy</span>
                    <span className="text-xs font-semibold text-gray-700">
                      {Math.round(occupancyPercentage)}%
                    </span>
                  </div>
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                    <div
                      style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                        occupancyPercentage >= 90
                          ? 'bg-red-500'
                          : occupancyPercentage >= 70
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                      }`}
                    ></div>
                  </div>
                </div>

                {bus.passenger_count > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">Recent Boardings:</p>
                    <div className="space-y-1">
                      {bus.passengers.slice(0, 3).map((passenger) => (
                        <div key={passenger.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700">
                            {passenger.profile?.full_name || 'Unknown'}
                            {passenger.profile?.staff_code && ` (${passenger.profile.staff_code})`}
                          </span>
                          <span className="text-gray-500">{formatTime(passenger.checked_in_at)}</span>
                        </div>
                      ))}
                      {bus.passenger_count > 3 && (
                        <p className="text-xs text-gray-500 italic">
                          +{bus.passenger_count - 3} more...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {buses.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Bus className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No buses found</p>
          <p className="text-sm text-gray-500 mt-1">Add buses in Bus Management to start tracking</p>
        </div>
      )}

      {selectedBus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Bus className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Bus {selectedBus.bus_number}
                    </h3>
                    {selectedBus.route_name && (
                      <p className="text-sm text-gray-600">{selectedBus.route_name}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBus(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Current Occupancy</span>
                    <span className="text-lg font-bold text-gray-900">
                      {selectedBus.passenger_count} / {selectedBus.capacity}
                    </span>
                  </div>
                  <div className="relative pt-1">
                    <div className="overflow-hidden h-3 text-xs flex rounded bg-gray-200">
                      <div
                        style={{ width: `${Math.min((selectedBus.passenger_count / selectedBus.capacity) * 100, 100)}%` }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                      ></div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Passengers On Board</h4>
                  {selectedBus.passenger_count === 0 ? (
                    <p className="text-center py-8 text-gray-500">No passengers currently on board</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedBus.passengers.map((passenger) => (
                        <div
                          key={passenger.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-full">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {passenger.profile?.full_name || 'Unknown'}
                              </p>
                              {passenger.profile?.staff_code && (
                                <p className="text-sm text-gray-500">
                                  Staff Code: {passenger.profile.staff_code}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              {formatTime(passenger.checked_in_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
