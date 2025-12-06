import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Calendar, Plus, Clock, MapPin, User, X, ChevronLeft, ChevronRight, List, Edit, Trash2, Play } from 'lucide-react';

type ViewMode = 'week' | 'month' | 'list';

export const ShiftsView: React.FC = () => {
  const { profile } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShiftDetailModal, setShowShiftDetailModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [guards, setGuards] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [formData, setFormData] = useState({
    site_id: '',
    guard_id: '',
    start_time: '',
    end_time: '',
    notes: '',
  });

  useEffect(() => {
    loadShifts();
    loadSitesAndGuards();
  }, [profile, currentDate, viewMode]);

  const loadShifts = async () => {
    if (!profile) return;

    try {
      const startDate = getStartDate();
      const endDate = getEndDate();

      let query = supabase
        .from('shifts')
        .select('*, sites!inner(name, address, company_id), profiles!shifts_guard_id_fkey(full_name)')
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      if (profile.role === 'security_officer') {
        query = query.eq('guard_id', profile.id);
      } else if (profile.role === 'company_admin') {
        query = query.eq('sites.company_id', profile.company_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading shifts:', error);
      } else if (data) {
        setShifts(data);
      }
    } catch (error) {
      console.error('Error loading shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = () => {
    const date = new Date(currentDate);
    if (viewMode === 'week') {
      const day = date.getDay();
      date.setDate(date.getDate() - day);
    } else {
      date.setDate(1);
    }
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const getEndDate = () => {
    const date = new Date(currentDate);
    if (viewMode === 'week') {
      const day = date.getDay();
      date.setDate(date.getDate() + (6 - day));
    } else {
      date.setMonth(date.getMonth() + 1);
      date.setDate(0);
    }
    date.setHours(23, 59, 59, 999);
    return date;
  };

  const loadSitesAndGuards = async () => {
    if (!profile || profile.role === 'security_officer') return;

    try {
      const sitesQuery = (profile.role === 'super_admin' || profile.role === 'site_manager')
        ? supabase.from('sites').select('*').eq('is_active', true)
        : supabase.from('sites').select('*').eq('company_id', profile.company_id!).eq('is_active', true);

      const guardsQuery = (profile.role === 'super_admin' || profile.role === 'site_manager')
        ? supabase.from('profiles').select('id, full_name, role, company_id, phone').eq('role', 'security_officer')
        : supabase.from('profiles').select('id, full_name, role, company_id, phone').eq('company_id', profile.company_id!).eq('role', 'security_officer');

      const [sitesRes, guardsRes] = await Promise.all([sitesQuery, guardsQuery]);

      if (sitesRes.data) setSites(sitesRes.data);
      if (guardsRes.data) setGuards(guardsRes.data);
    } catch (error) {
      console.error('Error loading sites and guards:', error);
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('shifts').insert([
        {
          ...formData,
          status: 'scheduled',
        },
      ]);

      if (!error) {
        setShowCreateModal(false);
        setFormData({
          site_id: '',
          guard_id: '',
          start_time: '',
          end_time: '',
          notes: '',
        });
        loadShifts();
      }
    } catch (error) {
      console.error('Error creating shift:', error);
    }
  };

  const handleEditShift = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('shifts')
        .update({
          site_id: formData.site_id,
          guard_id: formData.guard_id,
          start_time: formData.start_time,
          end_time: formData.end_time,
          notes: formData.notes,
        })
        .eq('id', selectedShift?.id);

      if (!error) {
        setShowEditModal(false);
        setSelectedShift(null);
        setFormData({
          site_id: '',
          guard_id: '',
          start_time: '',
          end_time: '',
          notes: '',
        });
        loadShifts();
      }
    } catch (error) {
      console.error('Error updating shift:', error);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId);

      if (!error) {
        loadShifts();
      }
    } catch (error) {
      console.error('Error deleting shift:', error);
    }
  };

  const openEditModal = (shift: any) => {
    setSelectedShift(shift);
    setFormData({
      site_id: shift.site_id,
      guard_id: shift.guard_id,
      start_time: new Date(shift.start_time).toISOString().slice(0, 16),
      end_time: new Date(shift.end_time).toISOString().slice(0, 16),
      notes: shift.notes || '',
    });
    setShowEditModal(true);
  };

  const updateShiftStatus = async (shiftId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('shifts')
        .update({ status: newStatus })
        .eq('id', shiftId);

      if (!error) {
        loadShifts();
      }
    } catch (error) {
      console.error('Error updating shift:', error);
    }
  };

  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const getWeekDays = () => {
    const days = [];
    const start = getStartDate();
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const days = [];

    for (let i = 0; i < startDay; i++) {
      const day = new Date(firstDay);
      day.setDate(day.getDate() - (startDay - i));
      days.push({ date: day, isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const day = new Date(lastDay);
      day.setDate(lastDay.getDate() + i);
      days.push({ date: day, isCurrentMonth: false });
    }

    return days;
  };

  const getShiftsForDate = (date: Date) => {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.start_time);
      return shiftDate.toDateString() === date.toDateString();
    });
  };

  const formatDateHeader = () => {
    if (viewMode === 'week') {
      const start = getStartDate();
      const end = getEndDate();
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  const canManageShifts = profile?.role !== 'security_officer';

  const openCreateModal = (date?: Date) => {
    if (date) {
      const dateStr = date.toISOString().slice(0, 16);
      setFormData(prev => ({ ...prev, start_time: dateStr, end_time: dateStr }));
    }
    setShowCreateModal(true);
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
          <h1 className="text-3xl font-bold text-gray-900">Shift Schedule</h1>
          <p className="text-gray-600 mt-1">Manage guard shifts and schedules</p>
        </div>
        {canManageShifts && (
          <button
            onClick={() => openCreateModal()}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Create Shift</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={navigatePrevious}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={navigateToday}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={navigateNext}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">{formatDateHeader()}</h2>
          </div>

          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {viewMode === 'week' && (
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
                  className={`bg-white min-h-32 p-2 ${isToday ? 'bg-blue-50' : ''} ${canManageShifts ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={() => canManageShifts && openCreateModal(day)}
                >
                  <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayShifts.map(shift => (
                      <div
                        key={shift.id}
                        className={`text-xs p-1.5 rounded cursor-pointer hover:opacity-80 transition-opacity ${
                          shift.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-700'
                            : shift.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : shift.status === 'completed'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedShift(shift);
                          setShowShiftDetailModal(true);
                        }}
                      >
                        <div className="font-medium truncate">{shift.sites?.name}</div>
                        <div className="truncate opacity-75">{shift.profiles?.full_name}</div>
                        <div className="opacity-75">
                          {new Date(shift.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'month' && (
          <div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-gray-50 p-3 text-center text-sm font-semibold text-gray-700">
                  {day}
                </div>
              ))}
              {getMonthDays().map((day, idx) => {
                const dayShifts = getShiftsForDate(day.date);
                const isToday = day.date.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={idx}
                    className={`bg-white min-h-24 p-2 ${!day.isCurrentMonth ? 'opacity-40' : ''} ${isToday ? 'bg-blue-50' : ''} ${canManageShifts && day.isCurrentMonth ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    onClick={() => canManageShifts && day.isCurrentMonth && openCreateModal(day.date)}
                  >
                    <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                      {day.date.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayShifts.slice(0, 3).map(shift => (
                        <div
                          key={shift.id}
                          className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 ${
                            shift.status === 'scheduled'
                              ? 'bg-blue-100 text-blue-700'
                              : shift.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : shift.status === 'completed'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShift(shift);
                            setShowShiftDetailModal(true);
                          }}
                        >
                          {shift.sites?.name}
                        </div>
                      ))}
                      {dayShifts.length > 3 && (
                        <div className="text-xs text-gray-500 font-medium pl-1">
                          +{dayShifts.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="space-y-3">
            {shifts.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No shifts scheduled</p>
              </div>
            ) : (
              shifts.map(shift => (
                <div
                  key={shift.id}
                  className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                          <MapPin className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{shift.sites?.name}</h3>
                          <p className="text-sm text-gray-600">{shift.sites?.address}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-11">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{shift.profiles?.full_name}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {new Date(shift.start_time).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {new Date(shift.end_time).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      {shift.notes && (
                        <p className="text-sm text-gray-600 pl-11">{shift.notes}</p>
                      )}
                    </div>

                    <div className="ml-4 flex flex-col items-end space-y-2">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${
                          shift.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-700'
                            : shift.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : shift.status === 'completed'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {shift.status}
                      </span>

                      {canManageShifts && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openEditModal(shift)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit shift"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteShift(shift.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete shift"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {canManageShifts && shift.status === 'scheduled' && (
                        <button
                          onClick={() => updateShiftStatus(shift.id, 'active')}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Start Shift
                        </button>
                      )}

                      {canManageShifts && shift.status === 'active' && (
                        <button
                          onClick={() => updateShiftStatus(shift.id, 'completed')}
                          className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create Shift</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="space-y-4">
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
                  Guard
                </label>
                <select
                  value={formData.guard_id}
                  onChange={(e) => setFormData({ ...formData, guard_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Guard</option>
                  {guards.map((guard) => (
                    <option key={guard.id} value={guard.id}>
                      {guard.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
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
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Shift</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedShift(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleEditShift} className="space-y-4">
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
                  Guard
                </label>
                <select
                  value={formData.guard_id}
                  onChange={(e) => setFormData({ ...formData, guard_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Guard</option>
                  {guards.map((guard) => (
                    <option key={guard.id} value={guard.id}>
                      {guard.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedShift(null);
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

      {showShiftDetailModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Shift Details</h2>
              <button
                onClick={() => {
                  setShowShiftDetailModal(false);
                  setSelectedShift(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Site</label>
                <p className="text-gray-900 font-medium">{selectedShift.sites?.name}</p>
                <p className="text-sm text-gray-600">{selectedShift.sites?.address}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Guard</label>
                <p className="text-gray-900 font-medium">{selectedShift.profiles?.full_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Start Time</label>
                  <p className="text-gray-900">
                    {new Date(selectedShift.start_time).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">End Time</label>
                  <p className="text-gray-900">
                    {new Date(selectedShift.end_time).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <span
                  className={`inline-block mt-1 text-xs px-3 py-1 rounded-full font-medium capitalize ${
                    selectedShift.status === 'scheduled'
                      ? 'bg-blue-100 text-blue-700'
                      : selectedShift.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : selectedShift.status === 'completed'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {selectedShift.status}
                </span>
              </div>

              {selectedShift.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="text-gray-900">{selectedShift.notes}</p>
                </div>
              )}

              {canManageShifts && (
                <>
                  {selectedShift.status === 'scheduled' && (
                    <button
                      onClick={async () => {
                        try {
                          const { error } = await supabase
                            .from('shifts')
                            .update({ status: 'active' })
                            .eq('id', selectedShift.id);

                          if (error) throw error;

                          setShowShiftDetailModal(false);
                          setSelectedShift(null);
                          loadShifts();
                        } catch (error) {
                          console.error('Error starting shift:', error);
                          alert('Failed to start shift');
                        }
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <Play className="h-5 w-5" />
                      <span>Start Shift</span>
                    </button>
                  )}

                  {selectedShift.status === 'active' && (
                    <button
                      onClick={async () => {
                        try {
                          const { error } = await supabase
                            .from('shifts')
                            .update({ status: 'completed' })
                            .eq('id', selectedShift.id);

                          if (error) throw error;

                          setShowShiftDetailModal(false);
                          setSelectedShift(null);
                          loadShifts();
                        } catch (error) {
                          console.error('Error ending shift:', error);
                          alert('Failed to end shift');
                        }
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                    >
                      <Clock className="h-5 w-5" />
                      <span>End Shift</span>
                    </button>
                  )}

                  <div className="flex space-x-3 pt-4 border-t">
                    <button
                      onClick={() => {
                        setShowShiftDetailModal(false);
                        openEditModal(selectedShift);
                      }}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowShiftDetailModal(false);
                        handleDeleteShift(selectedShift.id);
                      }}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
