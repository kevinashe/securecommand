import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Company } from '../lib/supabase';
import { Building, Plus, X, Mail, Phone, MapPin, Edit2, Trash2, Key, Copy, Check, Upload, Image } from 'lucide-react';

export const CompaniesView: React.FC = () => {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    subscription_tier: 'basic',
    logo_url: '',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        setCompanies(data);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Generate unique company code
      let companyCode = '';
      let isUnique = false;

      while (!isUnique) {
        companyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data } = await supabase
          .from('companies')
          .select('id')
          .eq('company_code', companyCode)
          .maybeSingle();

        if (!data) isUnique = true;
      }

      const { data: newCompany, error } = await supabase.from('companies').insert([
        {
          ...formData,
          company_code: companyCode,
          is_active: true,
        },
      ]).select();

      if (!error && newCompany) {
        setShowCreateModal(false);
        setFormData({
          name: '',
          address: '',
          phone: '',
          email: '',
          subscription_tier: 'basic',
          logo_url: '',
        });
        loadCompanies();
        alert(`Company created successfully!\n\nCompany Code: ${companyCode}\n\nShare this code with employees for login.`);
      }
    } catch (error) {
      console.error('Error creating company:', error);
    }
  };

  const handleEditCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          subscription_tier: formData.subscription_tier,
          logo_url: formData.logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedCompany.id);

      if (!error) {
        setShowEditModal(false);
        setSelectedCompany(null);
        setFormData({
          name: '',
          address: '',
          phone: '',
          email: '',
          subscription_tier: 'basic',
          logo_url: '',
        });
        loadCompanies();
      }
    } catch (error) {
      console.error('Error updating company:', error);
    }
  };

  const openEditModal = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || '',
      subscription_tier: company.subscription_tier,
      logo_url: company.logo_url || '',
    });
    setShowEditModal(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, companyId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        if (companyId) {
          const { error } = await supabase
            .from('companies')
            .update({ logo_url: base64String, updated_at: new Date().toISOString() })
            .eq('id', companyId);

          if (!error) {
            loadCompanies();
          }
        } else {
          setFormData({ ...formData, logo_url: base64String });
        }
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading logo:', error);
      setUploadingLogo(false);
    }
  };

  const toggleCompanyStatus = async (companyId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (!error) {
        loadCompanies();
      }
    } catch (error) {
      console.error('Error toggling company status:', error);
    }
  };

  const copyToClipboard = (text: string, companyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(companyId);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const canManageCompanies = profile?.role === 'super_admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!canManageCompanies) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-600 mt-1">Manage client companies and organizations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Add Company</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No companies found</p>
          </div>
        ) : (
          companies.map((company) => (
            <div
              key={company.id}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="relative">
                    {company.logo_url ? (
                      <img
                        src={company.logo_url}
                        alt={company.name}
                        className="h-12 w-12 object-contain rounded-lg"
                      />
                    ) : (
                      <div className="bg-blue-100 p-3 rounded-lg">
                        <Building className="h-6 w-6 text-blue-600" />
                      </div>
                    )}
                    <label className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                      <Upload className="h-3 w-3" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e, company.id)}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{company.name}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                        company.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {company.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Key className="h-4 w-4 text-gray-500" />
                    <span className="text-xs text-gray-500">Company Code:</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(company.company_code, company.id)}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 transition-colors"
                    title="Copy code"
                  >
                    {copiedCode === company.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="mt-1 font-mono font-bold text-lg text-gray-900">
                  {company.company_code}
                </div>
              </div>

              <div className="space-y-2">
                {company.email && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>{company.email}</span>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{company.phone}</span>
                  </div>
                )}
                {company.address && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span className="line-clamp-2">{company.address}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <span className="text-xs text-gray-500 capitalize">
                  {company.subscription_tier} Plan
                </span>
                <div className="flex gap-2 sm:ml-auto">
                  <button
                    onClick={() => openEditModal(company)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-medium"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => toggleCompanyStatus(company.id, company.is_active)}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                      company.is_active
                        ? 'text-red-600 bg-red-50 hover:bg-red-100'
                        : 'text-green-600 bg-green-50 hover:bg-green-100'
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{company.is_active ? 'Deactivate' : 'Activate'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Company</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Acme Security Corp"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="contact@acme.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="123 Main St, City, State 12345"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription Tier
                </label>
                <select
                  value={formData.subscription_tier}
                  onChange={(e) => setFormData({ ...formData, subscription_tier: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
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
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Company</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedCompany(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleEditCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Logo
                </label>
                <div className="flex items-center space-x-4">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded-lg border border-gray-200" />
                  ) : (
                    <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Image className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <label className="flex-1 cursor-pointer">
                    <div className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center">
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e)}
                      className="hidden"
                      disabled={uploadingLogo}
                    />
                  </label>
                  {formData.logo_url && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logo_url: '' })}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Max size: 2MB. Supported: JPG, PNG, SVG</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription Tier
                </label>
                <select
                  value={formData.subscription_tier}
                  onChange={(e) => setFormData({ ...formData, subscription_tier: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedCompany(null);
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
