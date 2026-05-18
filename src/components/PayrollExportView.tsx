import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import {
  ArrowLeft,
  Download,
  Calendar,
  Clock,
  Users,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  Info,
  Loader,
  ArrowUpDown,
} from 'lucide-react';

interface PayrollExportViewProps {
  onBack?: () => void;
}

interface TimeClockRecord {
  id: string;
  guard_id: string;
  shift_id: string | null;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_photo_url: string | null;
  clock_out_photo_url: string | null;
  is_within_geofence: boolean;
  total_hours: number | null;
  overtime_hours: number | null;
  shifts?: {
    site_id: string | null;
    sites?: {
      name: string;
    };
  };
}

interface BreakLog {
  id: string;
  time_clock_id: string;
  break_start: string;
  break_end: string | null;
  break_type: string;
}

interface GuardProfile {
  id: string;
  full_name: string;
  staff_code: string | null;
}

interface DailyRecord {
  date: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  breakMinutes: number;
  siteName: string;
  isWithinGeofence: boolean;
  timeClockId: string;
}

interface GuardSummary {
  guardId: string;
  guardName: string;
  staffCode: string;
  totalDays: number;
  regularHours: number;
  overtimeHours: number;
  totalBreakMinutes: number;
  payableHours: number;
  geofenceCompliance: number;
  dailyRecords: DailyRecord[];
}

type SortField =
  | 'guardName'
  | 'staffCode'
  | 'totalDays'
  | 'regularHours'
  | 'overtimeHours'
  | 'payableHours'
  | 'totalBreakMinutes'
  | 'geofenceCompliance';

type SortDirection = 'asc' | 'desc';

export const PayrollExportView: React.FC<PayrollExportViewProps> = ({ onBack }) => {
  const { profile } = useAuth();

  const getDefaultDates = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [loading, setLoading] = useState(false);
  const [guardSummaries, setGuardSummaries] = useState<GuardSummary[]>([]);
  const [expandedGuard, setExpandedGuard] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('guardName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const allowedRoles = ['company_admin', 'finance_officer', 'super_admin'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  useEffect(() => {
    if (hasAccess && startDate && endDate) {
      fetchPayrollData();
    }
  }, [profile, startDate, endDate]);

  const fetchPayrollData = async () => {
    if (!profile || !startDate || !endDate) return;

    setLoading(true);
    try {
      // Step 1: Fetch guards belonging to this company
      let guardsQuery = supabase
        .from('profiles')
        .select('id, full_name, staff_code')
        .in('role', ['security_officer', 'guard', 'site_manager']);

      if (profile.role !== 'super_admin') {
        guardsQuery = guardsQuery.eq('company_id', profile.company_id);
      }

      const { data: guards, error: guardsError } = await guardsQuery;

      if (guardsError) {
        showToast('error', 'Failed to load guard profiles.');
        setLoading(false);
        return;
      }

      if (!guards || guards.length === 0) {
        setGuardSummaries([]);
        setLoading(false);
        return;
      }

      const guardIds = guards.map((g) => g.id);
      const guardMap = new Map<string, GuardProfile>();
      guards.forEach((g) => guardMap.set(g.id, g as GuardProfile));

      // Step 2: Fetch time clock records within the date range
      const rangeStart = `${startDate}T00:00:00`;
      const rangeEnd = `${endDate}T23:59:59`;

      const { data: timeClocks, error: tcError } = await supabase
        .from('time_clocks')
        .select('*, shifts(site_id, sites(name))')
        .in('guard_id', guardIds)
        .gte('clock_in_time', rangeStart)
        .lte('clock_in_time', rangeEnd)
        .order('clock_in_time', { ascending: true });

      if (tcError) {
        showToast('error', 'Failed to load time clock data.');
        setLoading(false);
        return;
      }

      if (!timeClocks || timeClocks.length === 0) {
        setGuardSummaries([]);
        setLoading(false);
        return;
      }

      // Step 3: Fetch break logs for all time clocks
      const clockIds = timeClocks.map((tc) => tc.id);
      let allBreakLogs: BreakLog[] = [];

      // Supabase .in() has limits, batch if needed
      const batchSize = 200;
      for (let i = 0; i < clockIds.length; i += batchSize) {
        const batch = clockIds.slice(i, i + batchSize);
        const { data: breakData } = await supabase
          .from('break_logs')
          .select('*')
          .in('time_clock_id', batch);

        if (breakData) {
          allBreakLogs = [...allBreakLogs, ...breakData];
        }
      }

      const breaksByClockId = new Map<string, BreakLog[]>();
      allBreakLogs.forEach((bl) => {
        const existing = breaksByClockId.get(bl.time_clock_id) || [];
        existing.push(bl);
        breaksByClockId.set(bl.time_clock_id, existing);
      });

      // Step 4: Process data per guard
      const clocksByGuard = new Map<string, TimeClockRecord[]>();
      timeClocks.forEach((tc) => {
        const existing = clocksByGuard.get(tc.guard_id) || [];
        existing.push(tc as TimeClockRecord);
        clocksByGuard.set(tc.guard_id, existing);
      });

      const summaries: GuardSummary[] = [];

      clocksByGuard.forEach((records, guardId) => {
        const guardInfo = guardMap.get(guardId);
        if (!guardInfo) return;

        const dailyRecords: DailyRecord[] = [];
        let totalRegular = 0;
        let totalOvertime = 0;
        let totalBreakMins = 0;
        let geofenceTrue = 0;
        let geofenceTotal = 0;

        // Group records by date
        const recordsByDate = new Map<string, TimeClockRecord[]>();
        records.forEach((r) => {
          const dateKey = new Date(r.clock_in_time).toISOString().split('T')[0];
          const existing = recordsByDate.get(dateKey) || [];
          existing.push(r);
          recordsByDate.set(dateKey, existing);
        });

        // Track weekly hours for weekly OT
        const weeklyHours = new Map<string, number>();

        recordsByDate.forEach((dayRecords, dateStr) => {
          let dayTotalHours = 0;
          let dayBreakMinutes = 0;

          dayRecords.forEach((r) => {
            if (!r.clock_out_time) return;

            const clockIn = new Date(r.clock_in_time).getTime();
            const clockOut = new Date(r.clock_out_time).getTime();
            const rawHours = (clockOut - clockIn) / 3600000;

            // Calculate break minutes for this clock entry
            const breaks = breaksByClockId.get(r.id) || [];
            let entryBreakMins = 0;
            breaks.forEach((b) => {
              if (b.break_end) {
                const bStart = new Date(b.break_start).getTime();
                const bEnd = new Date(b.break_end).getTime();
                entryBreakMins += (bEnd - bStart) / 60000;
              }
            });

            dayBreakMinutes += entryBreakMins;
            dayTotalHours += rawHours;

            geofenceTotal++;
            if (r.is_within_geofence) geofenceTrue++;

            const siteName = r.shifts?.sites?.name || 'Unknown Site';

            dailyRecords.push({
              date: dateStr,
              clockIn: r.clock_in_time,
              clockOut: r.clock_out_time,
              totalHours: rawHours,
              regularHours: 0, // Calculated below
              overtimeHours: 0,
              breakMinutes: entryBreakMins,
              siteName,
              isWithinGeofence: r.is_within_geofence,
              timeClockId: r.id,
            });
          });

          // Calculate daily OT (over 8 hours after breaks)
          const breakHours = dayBreakMinutes / 60;
          const netHours = Math.max(dayTotalHours - breakHours, 0);
          const dailyRegular = Math.min(netHours, 8);
          const dailyOT = Math.max(netHours - 8, 0);

          // Update daily records with calculated values
          dailyRecords
            .filter((dr) => dr.date === dateStr)
            .forEach((dr) => {
              const proportion = dayTotalHours > 0 ? dr.totalHours / dayTotalHours : 0;
              dr.regularHours = dailyRegular * proportion;
              dr.overtimeHours = dailyOT * proportion;
            });

          totalRegular += dailyRegular;
          totalOvertime += dailyOT;
          totalBreakMins += dayBreakMinutes;

          // Track weekly hours
          const d = new Date(dateStr);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const weekKey = weekStart.toISOString().split('T')[0];
          weeklyHours.set(weekKey, (weeklyHours.get(weekKey) || 0) + netHours);
        });

        // Check weekly OT (over 40 hours per week)
        let weeklyOTAdjustment = 0;
        weeklyHours.forEach((hours) => {
          if (hours > 40) {
            const weeklyOT = hours - 40;
            // Only add additional weekly OT not already covered by daily OT
            if (weeklyOT > totalOvertime) {
              weeklyOTAdjustment = weeklyOT - totalOvertime;
            }
          }
        });

        if (weeklyOTAdjustment > 0) {
          totalOvertime += weeklyOTAdjustment;
          totalRegular -= weeklyOTAdjustment;
        }

        const compliance =
          geofenceTotal > 0 ? (geofenceTrue / geofenceTotal) * 100 : 0;

        // Sort daily records by date
        dailyRecords.sort((a, b) => a.date.localeCompare(b.date));

        summaries.push({
          guardId,
          guardName: guardInfo.full_name,
          staffCode: guardInfo.staff_code || 'N/A',
          totalDays: recordsByDate.size,
          regularHours: Math.max(totalRegular, 0),
          overtimeHours: totalOvertime,
          totalBreakMinutes: totalBreakMins,
          payableHours: Math.max(totalRegular, 0) + totalOvertime,
          geofenceCompliance: compliance,
          dailyRecords,
        });
      });

      setGuardSummaries(summaries);
    } catch (err) {
      showToast('error', 'An unexpected error occurred while loading payroll data.');
    } finally {
      setLoading(false);
    }
  };

  // Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedSummaries = [...guardSummaries].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    const modifier = sortDirection === 'asc' ? 1 : -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return valA.localeCompare(valB) * modifier;
    }
    return ((valA as number) - (valB as number)) * modifier;
  });

  // Summary stats
  const totalHoursWorked = guardSummaries.reduce(
    (sum, g) => sum + g.regularHours + g.overtimeHours,
    0
  );
  const totalRegularHours = guardSummaries.reduce((sum, g) => sum + g.regularHours, 0);
  const totalOvertimeHours = guardSummaries.reduce((sum, g) => sum + g.overtimeHours, 0);
  const totalEmployees = guardSummaries.length;
  const avgHoursPerGuard = totalEmployees > 0 ? totalHoursWorked / totalEmployees : 0;

  // Export: Detailed CSV
  const exportDetailedCSV = () => {
    if (guardSummaries.length === 0) {
      showToast('warning', 'No data to export.');
      return;
    }

    const headers = [
      'Employee Name',
      'Staff Code',
      'Date',
      'Clock In',
      'Clock Out',
      'Regular Hours',
      'Overtime Hours',
      'Break Minutes',
      'Site',
      'Geofence Compliant',
    ];

    const rows: string[][] = [];

    guardSummaries.forEach((guard) => {
      guard.dailyRecords.forEach((dr) => {
        rows.push([
          `"${guard.guardName}"`,
          `"${guard.staffCode}"`,
          dr.date,
          new Date(dr.clockIn).toLocaleTimeString(),
          dr.clockOut ? new Date(dr.clockOut).toLocaleTimeString() : 'Active',
          dr.regularHours.toFixed(2),
          dr.overtimeHours.toFixed(2),
          Math.round(dr.breakMinutes).toString(),
          `"${dr.siteName}"`,
          dr.isWithinGeofence ? 'Yes' : 'No',
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('success', 'Detailed payroll CSV exported successfully.');
  };

  // Export: Summary CSV
  const exportSummaryCSV = () => {
    if (guardSummaries.length === 0) {
      showToast('warning', 'No data to export.');
      return;
    }

    const headers = [
      'Name',
      'Staff Code',
      'Total Days',
      'Regular Hours',
      'Overtime Hours',
      'Total Hours',
      'Compliance %',
    ];

    const rows: string[][] = guardSummaries.map((g) => [
      `"${g.guardName}"`,
      `"${g.staffCode}"`,
      g.totalDays.toString(),
      g.regularHours.toFixed(2),
      g.overtimeHours.toFixed(2),
      g.payableHours.toFixed(2),
      g.geofenceCompliance.toFixed(1),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-summary-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('success', 'Summary payroll CSV exported successfully.');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const SortHeader: React.FC<{
    label: string;
    field: SortField;
    className?: string;
  }> = ({ label, field, className }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          size={12}
          className={
            sortField === field ? 'text-blue-600' : 'text-gray-400'
          }
        />
        {sortField === field && (
          <span className="text-blue-600 text-xs">
            {sortDirection === 'asc' ? 'A' : 'D'}
          </span>
        )}
      </div>
    </th>
  );

  // Access guard
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            Only company administrators, finance officers, and super admins can access
            the payroll export module.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Payroll Export
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Overtime tracking and payroll data export
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportSummaryCSV}
              disabled={loading || guardSummaries.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={16} />
              Summary CSV
            </button>
            <button
              onClick={exportDetailedCSV}
              disabled={loading || guardSummaries.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              Export Detailed CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Period Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Calendar size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Payroll Period
            </h2>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <button
              onClick={fetchPayrollData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Clock size={16} />
              )}
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Summary Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">
                Total Hours
              </span>
              <Clock size={18} className="text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {totalHoursWorked.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">
                Regular Hours
              </span>
              <CheckCircle size={18} className="text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">
              {totalRegularHours.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">
                Overtime Hours
              </span>
              <AlertCircle size={18} className="text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {totalOvertimeHours.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">
                Employees
              </span>
              <Users size={18} className="text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">
                Avg Hours/Guard
              </span>
              <Users size={18} className="text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {avgHoursPerGuard.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Overtime Rules Info Card */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                Overtime Calculation Rules
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-blue-800">
                <div>
                  <span className="font-medium">Daily OT Threshold:</span>{' '}
                  8 hours per day
                </div>
                <div>
                  <span className="font-medium">Weekly OT Threshold:</span>{' '}
                  40 hours per week
                </div>
                <div>
                  <span className="font-medium">Calculation Method:</span>{' '}
                  Net hours after breaks, daily threshold applied first, then
                  weekly check
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Breakdown Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Employee Breakdown
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Click a row to view daily details. Click column headers to sort.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader size={24} className="animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">
                Loading payroll data...
              </span>
            </div>
          ) : sortedSummaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <FileText size={40} className="mb-3 text-gray-300" />
              <p className="text-base font-medium">No records found</p>
              <p className="text-sm mt-1">
                Adjust the date range and try again.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-8">
                      {/* Expand icon column */}
                    </th>
                    <SortHeader label="Guard Name" field="guardName" />
                    <SortHeader label="Staff Code" field="staffCode" />
                    <SortHeader label="Days" field="totalDays" />
                    <SortHeader label="Regular Hrs" field="regularHours" />
                    <SortHeader label="Overtime Hrs" field="overtimeHours" />
                    <SortHeader label="Break (min)" field="totalBreakMinutes" />
                    <SortHeader label="Payable Hrs" field="payableHours" />
                    <SortHeader
                      label="Geofence %"
                      field="geofenceCompliance"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedSummaries.map((guard, idx) => (
                    <React.Fragment key={guard.guardId}>
                      <tr
                        className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        } ${
                          expandedGuard === guard.guardId
                            ? 'bg-blue-50'
                            : ''
                        }`}
                        onClick={() =>
                          setExpandedGuard(
                            expandedGuard === guard.guardId
                              ? null
                              : guard.guardId
                          )
                        }
                      >
                        <td className="px-4 py-3">
                          {expandedGuard === guard.guardId ? (
                            <ChevronDown
                              size={16}
                              className="text-blue-600"
                            />
                          ) : (
                            <ChevronRight
                              size={16}
                              className="text-gray-400"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {guard.guardName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                          {guard.staffCode}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {guard.totalDays}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-green-700">
                          {guard.regularHours.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-orange-600">
                          {guard.overtimeHours.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {Math.round(guard.totalBreakMinutes)}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                          {guard.payableHours.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              guard.geofenceCompliance >= 90
                                ? 'bg-green-100 text-green-800'
                                : guard.geofenceCompliance >= 70
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {guard.geofenceCompliance.toFixed(1)}%
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Daily Detail View */}
                      {expandedGuard === guard.guardId && (
                        <tr>
                          <td colSpan={9} className="px-0 py-0">
                            <div className="bg-gray-50 border-t border-b border-gray-200 px-8 py-4">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                Daily Breakdown for {guard.guardName}
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-300">
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Date
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Clock In
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Clock Out
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Hours
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Overtime
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Break
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Site
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                                        Geofence
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {guard.dailyRecords.map((dr, drIdx) => (
                                      <tr
                                        key={`${dr.timeClockId}-${drIdx}`}
                                        className={
                                          drIdx % 2 === 0
                                            ? 'bg-white'
                                            : 'bg-gray-50'
                                        }
                                      >
                                        <td className="px-3 py-2 text-gray-900">
                                          {formatDate(dr.date)}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700">
                                          {formatTime(dr.clockIn)}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700">
                                          {dr.clockOut
                                            ? formatTime(dr.clockOut)
                                            : '--'}
                                        </td>
                                        <td className="px-3 py-2 text-gray-900 font-medium">
                                          {dr.totalHours.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2">
                                          <span
                                            className={
                                              dr.overtimeHours > 0
                                                ? 'text-orange-600 font-medium'
                                                : 'text-gray-400'
                                            }
                                          >
                                            {dr.overtimeHours.toFixed(2)}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">
                                          {Math.round(dr.breakMinutes)} min
                                        </td>
                                        <td className="px-3 py-2 text-gray-700">
                                          {dr.siteName}
                                        </td>
                                        <td className="px-3 py-2">
                                          {dr.isWithinGeofence ? (
                                            <CheckCircle
                                              size={16}
                                              className="text-green-500"
                                            />
                                          ) : (
                                            <XCircle
                                              size={16}
                                              className="text-red-500"
                                            />
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table footer with totals */}
          {sortedSummaries.length > 0 && (
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <span className="text-gray-500">
                  Totals for {totalEmployees} employee{totalEmployees !== 1 ? 's' : ''}:
                </span>
                <span className="text-gray-900 font-medium">
                  {totalHoursWorked.toFixed(2)} total hours
                </span>
                <span className="text-green-700 font-medium">
                  {totalRegularHours.toFixed(2)} regular
                </span>
                <span className="text-orange-600 font-medium">
                  {totalOvertimeHours.toFixed(2)} overtime
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
