import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { History, MapPin, Calendar, Clock, Briefcase, Loader } from 'lucide-react';

interface Assignment {
  id: string;
  site_name: string;
  site_address: string;
  start_time: string;
  end_time: string;
  status: string;
  hours_worked: number;
  notes: string | null;
}

interface EmploymentHistory {
  id: string;
  company_name: string;
  role: string;
  start_date: string;
  end_date: string | null;
  reason_for_leaving: string | null;
  is_current: boolean;
}

export const AssignmentHistoryView: React.FC = () => {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employmentHistory, setEmploymentHistory] = useState<EmploymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'active'>('all');

  const [stats, setStats] = useState({
    totalShifts: 0,
    totalHours: 0,
    totalSites: 0,
    avgHoursPerShift: 0
  });

  useEffect(() => {
    if (profile) {
      loadAssignments();
      loadEmploymentHistory();
    }
  }, [profile]);

  const loadAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          id,
          start_time,
          end_time,
          status,
          notes,
          sites (
            name,
            address
          )
        `)
        .eq('guard_id', profile?.id)
        .order('start_time', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map((item: any) => ({
        id: item.id,
        site_name: item.sites?.name || 'Unknown Site',
        site_address: item.sites?.address || '',
        start_time: item.start_time,
        end_time: item.end_time,
        status: item.status,
        hours_worked: calculateHours(item.start_time, item.end_time),
        notes: item.notes
      })) || [];

      setAssignments(formattedData);
      calculateStats(formattedData);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmploymentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('employment_history')
        .select(`
          id,
          start_date,
          end_date,
          reason_for_leaving,
          is_current,
          companies (
            name
          )
        `)
        .eq('guard_id', profile?.id)
        .order('start_date', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map((item: any) => ({
        id: item.id,
        company_name: item.companies?.name || 'Unknown Company',
        role: profile?.role || '',
        start_date: item.start_date,
        end_date: item.end_date,
        reason_for_leaving: item.reason_for_leaving,
        is_current: item.is_current
      })) || [];

      setEmploymentHistory(formattedData);
    } catch (error) {
      console.error('Error loading employment history:', error);
    }
  };

  const calculateHours = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = endDate.getTime() - startDate.getTime();
    return Math.round(diff / (1000 * 60 * 60) * 10) / 10;
  };

  const calculateStats = (data: Assignment[]) => {
    const completedShifts = data.filter(a => a.status === 'completed');
    const totalHours = completedShifts.reduce((sum, a) => sum + a.hours_worked, 0);
    const uniqueSites = new Set(data.map(a => a.site_name)).size;

    setStats({
      totalShifts: completedShifts.length,
      totalHours: Math.round(totalHours * 10) / 10,
      totalSites: uniqueSites,
      avgHoursPerShift: completedShifts.length > 0
        ? Math.round((totalHours / completedShifts.length) * 10) / 10
        : 0
    });
  };

  const filteredAssignments = assignments.filter(a => {
    if (filter === 'completed') return a.status === 'completed';
    if (filter === 'active') return a.status === 'active';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Assignment History</h1>
        <p className="text-gray-600 mt-1">Your work history and performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Shifts</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalShifts}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Briefcase className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Hours</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalHours}h</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sites Worked</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalSites}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <MapPin className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Hours/Shift</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.avgHoursPerShift}h</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <History className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {employmentHistory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Employment History</h2>
          <div className="space-y-4">
            {employmentHistory.map((employment) => (
              <div key={employment.id} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Briefcase className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{employment.company_name}</h3>
                    {employment.is_current && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 capitalize mb-2">{employment.role.replace('_', ' ')}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>{new Date(employment.start_date).toLocaleDateString()}</span>
                    <span>-</span>
                    <span>
                      {employment.end_date
                        ? new Date(employment.end_date).toLocaleDateString()
                        : 'Present'}
                    </span>
                  </div>
                  {employment.reason_for_leaving && (
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-medium">Reason for leaving:</span> {employment.reason_for_leaving}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Shift History</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'completed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredAssignments.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No assignments found</p>
            </div>
          ) : (
            filteredAssignments.map((assignment) => (
              <div key={assignment.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <MapPin className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{assignment.site_name}</h3>
                      <p className="text-sm text-gray-600">{assignment.site_address}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(assignment.status)}`}>
                    {assignment.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(assignment.start_time).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(assignment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(assignment.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm font-semibold text-gray-900">
                    <Clock className="h-4 w-4" />
                    <span>{assignment.hours_worked} hours</span>
                  </div>
                </div>

                {assignment.notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{assignment.notes}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
