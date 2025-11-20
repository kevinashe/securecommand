import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Plus, Edit, Trash2, X, Shield, Mail, Phone, MapPin, History, Building2 } from 'lucide-react';

interface Guard {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  company_id: string;
  staff_code: string;
  is_active: boolean;
  employment_status: string;
  created_at: string;
}

interface EmploymentHistory {
  id: string;
  company_id: string;
  company_name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
}

interface Site {
  id: string;
  name: string;
}

export const GuardsView: React.FC = () => {
  const { profile } = useAuth();
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const [employmentHistory, setEmploymentHistory] = useState<EmploymentHistory[]>([]);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'security_officer',
  });

  useEffect(() => {
    loadGuards();
    loadSites();
  }, [profile]);

  const loadGuards = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, role, company_id, avatar_url, phone, staff_code, is_active, employment_status, created_at, updated_at')
        .order('created_at', { ascending: false });

      // Super admins can see all users including other super admins and company admins
      if (profile?.role === 'super_admin') {
        query = query.in('role', ['security_officer', 'site_manager', 'company_admin', 'super_admin']);
      } else if (profile?.role === 'company_admin' || profile?.role === 'site_manager') {
        // Company admins and site managers only see their company's guards
        query = query.eq('company_id', profile.company_id).in('role', ['security_officer', 'site_manager']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setGuards(data || []);
    } catch (error) {
      console.error('Error loading guards:', error);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let newStaffCode = null;

      // Only generate staff code for roles that need it (not super_admin or company_admin without company)
      if (formData.role === 'security_officer' || formData.role === 'site_manager' || (formData.role === 'company_admin' && profile?.company_id)) {
        const { data: staffCodeData, error: staffCodeError } = await supabase
          .rpc('generate_staff_code', {
            p_company_id: profile?.company_id,
            p_role: formData.role
          });

        if (staffCodeError) throw staffCodeError;
        newStaffCode = staffCodeData;
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const profileData: any = {
          id: authData.user.id,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          is_active: true,
          employment_status: 'active'
        };

        // Only set company_id and staff_code for non-super-admin roles
        if (formData.role !== 'super_admin') {
          profileData.company_id = profile?.company_id;
          profileData.staff_code = newStaffCode;
        }

        const { error: profileError } = await supabase.from('profiles').insert([profileData]);

        if (profileError) throw profileError;

        await loadGuards();
        setShowCreateModal(false);
        setFormData({
          full_name: '',
          email: '',
          phone: '',
          password: '',
          role: 'security_officer',
        });

        const successMessage = newStaffCode
          ? `User created successfully! Staff Code: ${newStaffCode}`
          : `${formData.role === 'super_admin' ? 'Super Admin' : 'User'} created successfully!`;
        alert(successMessage);
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(error.message || 'Failed to create user');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuard) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
        })
        .eq('id', selectedGuard.id);

      if (!error) {
        setShowEditModal(false);
        setSelectedGuard(null);
        loadGuards();
      }
    } catch (error) {
      console.error('Error updating guard:', error);
    }
  };

  const toggleGuardStatus = async (guardId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('profiles')
        .update({
          is_active: newStatus,
          employment_status: newStatus ? 'active' : 'inactive'
        })
        .eq('id', guardId);

      if (!error) {
        loadGuards();
      }
    } catch (error) {
      console.error('Error toggling guard status:', error);
    }
  };

  const loadEmploymentHistory = async (guardId: string) => {
    try {
      const { data, error } = await supabase
        .from('employment_history')
        .select(`
          id,
          company_id,
          start_date,
          end_date,
          status,
          notes,
          companies!inner(name)
        `)
        .eq('officer_id', guardId)
        .order('start_date', { ascending: false });

      if (error) throw error;

      const formattedHistory = (data || []).map((record: any) => ({
        id: record.id,
        company_id: record.company_id,
        company_name: record.companies.name,
        start_date: record.start_date,
        end_date: record.end_date,
        status: record.status,
        notes: record.notes,
      }));

      setEmploymentHistory(formattedHistory);
    } catch (error) {
      console.error('Error loading employment history:', error);
    }
  };

  const openHistoryModal = async (guard: Guard) => {
    setSelectedGuard(guard);
    await loadEmploymentHistory(guard.id);
    setShowHistoryModal(true);
  };

  const openEditModal = (guard: Guard) => {
    setSelectedGuard(guard);
    setFormData({
      full_name: guard.full_name,
      email: guard.email,
      phone: guard.phone,
      password: '',
      role: guard.role,
    });
    setShowEditModal(true);
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
          <h1 className="text-3xl font-bold text-gray-900">
            {profile?.role === 'super_admin' ? 'User Management' : 'Security Guards'}
          </h1>
          <p className="text-gray-600 mt-1">
            {profile?.role === 'super_admin'
              ? 'Manage all users including admins'
              : 'Manage security officers and site managers'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>{profile?.role === 'super_admin' ? 'Add User' : 'Add Guard'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {guards.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {profile?.role === 'super_admin' ? 'No Users Yet' : 'No Guards Yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {profile?.role === 'super_admin'
                ? 'Get started by adding your first user.'
                : 'Get started by adding your first security guard.'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>{profile?.role === 'super_admin' ? 'Add User' : 'Add Guard'}</span>
            </button>
          </div>
        ) : (
          guards.map((guard) => (
            <div
              key={guard.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Shield className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{guard.full_name}</h3>
                    <span className="text-xs text-gray-500 capitalize">
                      {guard.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {guard.staff_code && (
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {guard.staff_code}
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{guard.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{guard.phone || 'No phone'}</span>
                </div>
              </div>

              <div className="mb-4">
                <button
                  onClick={() => toggleGuardStatus(guard.id, guard.is_active)}
                  className={`w-full px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    guard.is_active
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {guard.is_active ? '● Active' : '● Inactive'}
                </button>
              </div>

              <div className="flex space-x-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => openEditModal(guard)}
                  className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  <span className="text-sm font-medium">Edit</span>
                </button>
                <button
                  onClick={() => openHistoryModal(guard)}
                  className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <History className="h-4 w-4" />
                  <span className="text-sm font-medium">History</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {profile?.role === 'super_admin' ? 'Add User' : 'Add Guard'}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="security_officer">Security Officer</option>
                  <option value="site_manager">Site Manager</option>
                  {profile?.role === 'super_admin' && (
                    <>
                      <option value="company_admin">Company Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </>
                  )}
                </select>
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
                  {profile?.role === 'super_admin' ? 'Add User' : 'Add Guard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && selectedGuard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Employment History</h2>
                <p className="text-gray-600 text-sm mt-1">{selectedGuard.full_name}</p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedGuard(null);
                  setEmploymentHistory([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {employmentHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No employment history available</p>
                </div>
              ) : (
                employmentHistory.map((record) => (
                  <div
                    key={record.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{record.company_name}</h3>
                          <span
                            className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                              record.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : record.status === 'transferred'
                                ? 'bg-blue-100 text-blue-700'
                                : record.status === 'resigned'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 mb-1">Start Date</p>
                        <p className="font-medium text-gray-900">
                          {new Date(record.start_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">End Date</p>
                        <p className="font-medium text-gray-900">
                          {record.end_date
                            ? new Date(record.end_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Present'}
                        </p>
                      </div>
                    </div>

                    {record.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-600">{record.notes}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedGuard(null);
                  setEmploymentHistory([]);
                }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedGuard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Guard</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedGuard(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="security_officer">Security Officer</option>
                  <option value="site_manager">Site Manager</option>
                  {profile?.role === 'super_admin' && (
                    <>
                      <option value="company_admin">Company Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedGuard(null);
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
};
