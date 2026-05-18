import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import {
  Calendar, Plus, Clock, MapPin, User, X, ChevronLeft, ChevronRight,
  List, CreditCard as Edit, Trash2, Play, ArrowLeft, Repeat, AlertTriangle,
} from 'lucide-react';

type ViewMode = 'week' | 'month' | 'list';

interface RecurringConfig {
  enabled: boolean;
  days: boolean[];
  startDate: string;
  endDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function generateRecurringShifts(
  config: RecurringConfig,
  siteId: string,
  guardId: string,
  notes: string,
): { start_time: string; end_time: string; site_id: string; guard_id: string; notes: string; status: string; recurring_group_id: string }[] {
  const groupId = crypto.randomUUID();
  const shifts: ReturnType<typeof generateRecurringShifts> = [];
  const start = new Date(config.startDate + 'T00:00:00');
  const end = new Date(config.endDate + 'T23:59:59');

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (config.days[dayOfWeek]) {
      const dateStr = current.toISOString().slice(0, 10);
      const startTime = `${dateStr}T${config.shiftStartTime}`;
      let endTime = `${dateStr}T${config.shiftEndTime}`;

      if (config.shiftEndTime <= config.shiftStartTime) {
        const nextDay = new Date(current);
        nextDay.setDate(nextDay.getDate() + 1);
        endTime = `${nextDay.toISOString().slice(0, 10)}T${config.shiftEndTime}`;
      }

      shifts.push({
        site_id: siteId,
        guard_id: guardId,
        start_time: startTime,
        end_time: endTime,
        notes,
        status: 'scheduled',
        recurring_group_id: groupId,
      });
    }
    current.setDate(current.getDate() + 1);
  }

  return shifts;
}

interface ShiftsViewProps {
  onBack?: () => void;
}

export const ShiftsView: React.FC<ShiftsViewProps> = ({ onBack }) => {
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
  const [creating, setCreating] = useState(false);
  const [showDeleteSeriesConfirm, setShowDeleteSeriesConfirm] = useState(false);
  const [deletingSeriesId, setDeletingSeriesId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    site_id: '',
    guard_id: '',
    start_time: '',
    end_time: '',
    notes: '',
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  const [recurring, setRecurring] = useState<RecurringConfig>({
    enabled: false,
    days: [false, true, true, true, true, true, false],
    startDate: todayStr,
    endDate: '',
    shiftStartTime: '08:00',
    shiftEndTime: '18:00',
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
      showToast('error', 'Failed to load shifts');
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
      showToast('error', 'Failed to load sites and guards');
    }
  };

  const resetForm = () => {
    setFormData({ site_id: '', guard_id: '', start_time: '', end_time: '', notes: '' });
    setRecurring({
      enabled: false,
      days: [false, true, true, true, true, true, false],
      startDate: todayStr,
      endDate: '',
      shiftStartTime: '08:00',
      shiftEndTime: '18:00',
    });
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      if (recurring.enabled) {
        if (!recurring.startDate || !recurring.endDate) {
          showToast('error', 'Please select a start and end date for the recurring schedule');
          setCreating(false);
          return;
        }
        if (!recurring.days.some(Boolean)) {
          showToast('error', 'Please select at least one day of the week');
          setCreating(false);
          return;
        }

        const shiftsToCreate = generateRecurringShifts(
          recurring,
          formData.site_id,
          formData.guard_id,
          formData.notes,
        );

        if (shiftsToCreate.length === 0) {
          showToast('error', 'No shifts to create. Check your date range and selected days.');
          setCreating(false);
          return;
        }

        if (shiftsToCreate.length > 366) {
          showToast('error', 'Too many shifts. Please use a shorter date range (max ~1 year).');
          setCreating(false);
          return;
        }

        const batchSize = 50;
        for (let i = 0; i < shiftsToCreate.length; i += batchSize) {
          const batch = shiftsToCreate.slice(i, i + batchSize);
          const { error } = await supabase.from('shifts').insert(batch);
          if (error) throw error;
        }

        showToast('success', `Created ${shiftsToCreate.length} shifts successfully`);
      } else {
        const { error } = await supabase.from('shifts').insert([
          { ...formData, status: 'scheduled' },
        ]);
        if (error) throw error;
      }

      setShowCreateModal(false);
      resetForm();
      loadShifts();
    } catch (error) {
      console.error('Error creating shift:', error);
      showToast('error', 'Failed to create shift(s)');
    } finally {
      setCreating(false);
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
        resetForm();
        loadShifts();
      }
    } catch (error) {
      console.error('Error updating shift:', error);
      showToast('error', 'Failed to update shift');
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;

    try {
      const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
      if (!error) {
        loadShifts();
      }
    } catch (error) {
      console.error('Error deleting shift:', error);
      showToast('error', 'Failed to delete shift');
    }
  };

  const handleDeleteSeries = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('recurring_group_id', groupId)
        .eq('status', 'scheduled');

      if (error) throw error;

      showToast('success', 'Deleted all scheduled shifts in this series');
      setShowDeleteSeriesConfirm(false);
      setDeletingSeriesId(null);
      setShowShiftDetailModal(false);
      setSelectedShift(null);
      loadShifts();
    } catch (error) {
      console.error('Error deleting series:', error);
      showToast('error', 'Failed to delete shift series');
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
      showToast('error', 'Failed to update shift status');
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
    resetForm();
    if (date) {
      const dateStr = date.toISOString().slice(0, 16);
      setFormData(prev => ({ ...prev, start_time: dateStr, end_time: dateStr }));
    }
    setShowCreateModal(true);
  };

  const previewCount = recurring.enabled && recurring.startDate && recurring.endDate && recurring.days.some(Boolean)
    ? generateRecurringShifts(
        recurring,
        formData.site_id || 'x',
        formData.guard_id || 'x',
        '',
      ).length
    : 0;

  const applyPreset = (preset: 'weekdays' | 'everyday' | 'weekends') => {
    const days = [false, false, false, false, false, false, false];
    if (preset === 'weekdays') {
      for (let i = 1; i <= 5; i++) days[i] = true;
    } else if (preset === 'everyday') {
      for (let i = 0; i < 7; i++) days[i] = true;
    } else {
      days[0] = true;
      days[6] = true;
    }
    setRecurring(prev => ({ ...prev, days }));
  };

  const setEndDatePreset = (weeks: number) => {
    if (!recurring.startDate) return;
    const d = new Date(recurring.startDate + 'T00:00:00');
    d.setDate(d.getDate() + weeks * 7 - 1);
    setRecurring(prev => ({ ...prev, endDate: d.toISOString().slice(0, 10) }));
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Go back">
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shift Schedule</h1>
            <p className="text-gray-600 mt-1">Manage guard shifts and schedules</p>
          </div>
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

      {/* Calendar Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <button onClick={navigatePrevious} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <button onClick={navigateToday} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Today
            </button>
            <button onClick={navigateNext} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">{formatDateHeader()}</h2>
          </div>

          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            {(['week', 'month', 'list'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode === 'list' ? <List className="h-4 w-4" /> : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Week View */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
            {DAY_LABELS.map(day => (
              <div key={day} className="bg-gray-50 p-3 text-center text-sm font-semibold text-gray-700">{day}</div>
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
                          shift.status === 'scheduled' ? 'bg-blue-100 text-blue-700'
                            : shift.status === 'active' ? 'bg-green-100 text-green-700'
                            : shift.status === 'completed' ? 'bg-gray-100 text-gray-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                        onClick={(e) => { e.stopPropagation(); setSelectedShift(shift); setShowShiftDetailModal(true); }}
                      >
                        <div className="font-medium truncate flex items-center gap-1">
                          {shift.recurring_group_id && <Repeat className="h-3 w-3 flex-shrink-0 opacity-60" />}
                          <span className="truncate">{shift.sites?.name}</span>
                        </div>
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

        {/* Month View */}
        {viewMode === 'month' && (
          <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
            {DAY_LABELS.map(day => (
              <div key={day} className="bg-gray-50 p-3 text-center text-sm font-semibold text-gray-700">{day}</div>
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
                        className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 flex items-center gap-0.5 ${
                          shift.status === 'scheduled' ? 'bg-blue-100 text-blue-700'
                            : shift.status === 'active' ? 'bg-green-100 text-green-700'
                            : shift.status === 'completed' ? 'bg-gray-100 text-gray-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                        onClick={(e) => { e.stopPropagation(); setSelectedShift(shift); setShowShiftDetailModal(true); }}
                      >
                        {shift.recurring_group_id && <Repeat className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />}
                        <span className="truncate">{shift.sites?.name}</span>
                      </div>
                    ))}
                    {dayShifts.length > 3 && (
                      <div className="text-xs text-gray-500 font-medium pl-1">+{dayShifts.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="space-y-3">
            {shifts.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No shifts scheduled</p>
              </div>
            ) : (
              shifts.map(shift => (
                <div key={shift.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                          <MapPin className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{shift.sites?.name}</h3>
                            {shift.recurring_group_id && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded border border-blue-200">
                                <Repeat className="h-3 w-3" />
                                Recurring
                              </span>
                            )}
                          </div>
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
                            {new Date(shift.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {new Date(shift.end_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {shift.notes && <p className="text-sm text-gray-600 pl-11">{shift.notes}</p>}
                    </div>

                    <div className="ml-4 flex flex-col items-end space-y-2">
                      <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${
                        shift.status === 'scheduled' ? 'bg-blue-100 text-blue-700'
                          : shift.status === 'active' ? 'bg-green-100 text-green-700'
                          : shift.status === 'completed' ? 'bg-gray-100 text-gray-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {shift.status}
                      </span>

                      {canManageShifts && (
                        <div className="flex items-center space-x-2">
                          <button onClick={() => openEditModal(shift)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit shift">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteShift(shift.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete shift">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {canManageShifts && shift.status === 'scheduled' && (
                        <button onClick={() => updateShiftStatus(shift.id, 'active')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                          Start Shift
                        </button>
                      )}
                      {canManageShifts && shift.status === 'active' && (
                        <button onClick={() => updateShiftStatus(shift.id, 'completed')} className="text-xs text-green-600 hover:text-green-700 font-medium">
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

      {/* Create Shift Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create Shift</h2>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="space-y-5">
              {/* Site & Guard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Site</label>
                  <select
                    value={formData.site_id}
                    onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  >
                    <option value="">Select Site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Guard</label>
                  <select
                    value={formData.guard_id}
                    onChange={(e) => setFormData({ ...formData, guard_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    required
                  >
                    <option value="">Select Guard</option>
                    {guards.map((guard) => (
                      <option key={guard.id} value={guard.id}>{guard.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recurring Toggle */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRecurring(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    recurring.enabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Repeat className={`h-5 w-5 ${recurring.enabled ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div>
                      <p className={`text-sm font-semibold ${recurring.enabled ? 'text-blue-900' : 'text-gray-700'}`}>
                        Recurring Shift
                      </p>
                      <p className="text-xs text-gray-500">Schedule across days, weeks, or months</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors flex items-center ${recurring.enabled ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'}`}>
                    <div className="w-4 h-4 bg-white rounded-full mx-1 shadow-sm" />
                  </div>
                </button>

                {recurring.enabled && (
                  <div className="p-4 space-y-4 border-t border-gray-200">
                    {/* Day-of-week selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Days of the Week</label>
                      <div className="flex gap-1.5 mb-2">
                        {DAY_LABELS.map((label, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              const days = [...recurring.days];
                              days[i] = !days[i];
                              setRecurring(prev => ({ ...prev, days }));
                            }}
                            className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                              recurring.days[i]
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => applyPreset('weekdays')} className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors">
                          Weekdays
                        </button>
                        <button type="button" onClick={() => applyPreset('weekends')} className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors">
                          Weekends
                        </button>
                        <button type="button" onClick={() => applyPreset('everyday')} className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors">
                          Every Day
                        </button>
                      </div>
                    </div>

                    {/* Shift times */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Shift Start</label>
                        <input
                          type="time"
                          value={recurring.shiftStartTime}
                          onChange={(e) => setRecurring(prev => ({ ...prev, shiftStartTime: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          required={recurring.enabled}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Shift End</label>
                        <input
                          type="time"
                          value={recurring.shiftEndTime}
                          onChange={(e) => setRecurring(prev => ({ ...prev, shiftEndTime: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          required={recurring.enabled}
                        />
                      </div>
                    </div>

                    {recurring.shiftEndTime && recurring.shiftStartTime && recurring.shiftEndTime <= recurring.shiftStartTime && (
                      <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                        Overnight shift detected -- end time is the next day.
                      </p>
                    )}

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">From Date</label>
                        <input
                          type="date"
                          value={recurring.startDate}
                          onChange={(e) => setRecurring(prev => ({ ...prev, startDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          required={recurring.enabled}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Until Date</label>
                        <input
                          type="date"
                          value={recurring.endDate}
                          min={recurring.startDate}
                          onChange={(e) => setRecurring(prev => ({ ...prev, endDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          required={recurring.enabled}
                        />
                      </div>
                    </div>

                    {/* Quick presets for duration */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-gray-500 self-center">Quick:</span>
                      {[
                        { label: '1 Week', weeks: 1 },
                        { label: '2 Weeks', weeks: 2 },
                        { label: '1 Month', weeks: 4 },
                        { label: '3 Months', weeks: 13 },
                        { label: '6 Months', weeks: 26 },
                      ].map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setEndDatePreset(p.weeks)}
                          className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Preview */}
                    {previewCount > 0 && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <p className="text-sm text-blue-800">
                          <span className="font-semibold">{previewCount}</span> shift{previewCount !== 1 ? 's' : ''} will be created
                          {previewCount > 0 && (
                            <span className="text-blue-600">
                              {' '}from {new Date(recurring.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to {new Date(recurring.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Single shift date/time (only shown when not recurring) */}
              {!recurring.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Time</label>
                    <input
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      required={!recurring.enabled}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">End Time</label>
                    <input
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      required={!recurring.enabled}
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={2}
                  placeholder="Any special instructions..."
                />
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>Creating...</span>
                    </>
                  ) : recurring.enabled ? (
                    <>
                      <Repeat className="h-4 w-4" />
                      <span>Create {previewCount > 0 ? `${previewCount} Shifts` : 'Recurring Shifts'}</span>
                    </>
                  ) : (
                    'Create Shift'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Shift Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Shift</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedShift(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleEditShift} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Site</label>
                <select
                  value={formData.site_id}
                  onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Site</option>
                  {sites.map((site) => (<option key={site.id} value={site.id}>{site.name}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Guard</label>
                <select
                  value={formData.guard_id}
                  onChange={(e) => setFormData({ ...formData, guard_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Guard</option>
                  {guards.map((guard) => (<option key={guard.id} value={guard.id}>{guard.full_name}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input type="datetime-local" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input type="datetime-local" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" rows={3} />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedShift(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Detail Modal */}
      {showShiftDetailModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900">Shift Details</h2>
                {selectedShift.recurring_group_id && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-full border border-blue-200">
                    <Repeat className="h-3 w-3" />
                    Recurring
                  </span>
                )}
              </div>
              <button onClick={() => { setShowShiftDetailModal(false); setSelectedShift(null); }} className="text-gray-400 hover:text-gray-600">
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
                    {new Date(selectedShift.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">End Time</label>
                  <p className="text-gray-900">
                    {new Date(selectedShift.end_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <span className={`inline-block mt-1 text-xs px-3 py-1 rounded-full font-medium capitalize ${
                  selectedShift.status === 'scheduled' ? 'bg-blue-100 text-blue-700'
                    : selectedShift.status === 'active' ? 'bg-green-100 text-green-700'
                    : selectedShift.status === 'completed' ? 'bg-gray-100 text-gray-700'
                    : 'bg-red-100 text-red-700'
                }`}>
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
                          const { error } = await supabase.from('shifts').update({ status: 'active' }).eq('id', selectedShift.id);
                          if (error) throw error;
                          setShowShiftDetailModal(false);
                          setSelectedShift(null);
                          loadShifts();
                        } catch (error) {
                          console.error('Error starting shift:', error);
                          showToast('error', 'Failed to start shift');
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
                          const { error } = await supabase.from('shifts').update({ status: 'completed' }).eq('id', selectedShift.id);
                          if (error) throw error;
                          setShowShiftDetailModal(false);
                          setSelectedShift(null);
                          loadShifts();
                        } catch (error) {
                          console.error('Error ending shift:', error);
                          showToast('error', 'Failed to end shift');
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
                      onClick={() => { setShowShiftDetailModal(false); openEditModal(selectedShift); }}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => { setShowShiftDetailModal(false); handleDeleteShift(selectedShift.id); }}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {selectedShift.recurring_group_id && (
                    <button
                      onClick={() => {
                        setDeletingSeriesId(selectedShift.recurring_group_id);
                        setShowDeleteSeriesConfirm(true);
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete Entire Series (Scheduled Only)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Series Confirmation */}
      {showDeleteSeriesConfirm && deletingSeriesId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Shift Series</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              This will delete all <span className="font-semibold">scheduled</span> shifts in this recurring series. Active or completed shifts will not be affected.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => { setShowDeleteSeriesConfirm(false); setDeletingSeriesId(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSeries(deletingSeriesId)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Delete Series
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
