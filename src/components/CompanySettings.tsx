import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Company } from '../lib/supabase';
import { Building, Upload, Save, CreditCard, Plus, X, Wallet } from 'lucide-react';

interface PaymentGateway {
  id: string;
  name: string;
  display_name: string;
  is_enabled: boolean;
}

interface PaymentMethod {
  id: string;
  company_id: string;
  gateway_id: string;
  type: string;
  details: any;
  is_default: boolean;
  is_active: boolean;
  gateway_name?: string;
  gateway_display_name?: string;
}

export const CompanySettings: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
  });

  const [newMethod, setNewMethod] = useState({
    gateway_id: '',
    type: 'card',
    card_number: '',
    card_holder: '',
    expiry: '',
    cvv: '',
    bank_name: '',
    account_number: '',
    routing_number: '',
  });

  useEffect(() => {
    loadData();
  }, [profile?.company_id]);

  const loadData = async () => {
    await Promise.all([loadCompany(), loadGateways(), loadPaymentMethods()]);
    setLoading(false);
  };

  const loadCompany = async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .maybeSingle();

      if (!error && data) {
        setCompany(data);
        setFormData({
          name: data.name,
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          logo_url: data.logo_url || '',
        });
      }
    } catch (error) {
      console.error('Error loading company:', error);
    }
  };

  const loadGateways = async () => {
    try {
      const { data } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('is_enabled', true)
        .order('display_name');

      setGateways(data || []);
    } catch (error) {
      console.error('Error loading gateways:', error);
    }
  };

  const loadPaymentMethods = async () => {
    if (!profile?.company_id) return;

    try {
      const { data } = await supabase
        .from('payment_methods')
        .select('*, payment_gateways(name, display_name)')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      const formatted = data?.map((item: any) => ({
        ...item,
        gateway_name: item.payment_gateways?.name,
        gateway_display_name: item.payment_gateways?.display_name,
      }));

      setPaymentMethods(formatted || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please upload an image file' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size should be less than 2MB' });
      return;
    }

    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData({ ...formData, logo_url: base64String });
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading logo:', error);
      setUploadingLogo(false);
      setMessage({ type: 'error', text: 'Failed to upload logo' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          logo_url: formData.logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', company.id);

      if (error) {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      } else {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        await refreshProfile();
        loadCompany();
      }
    } catch (error) {
      console.error('Error saving company:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const addPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const gateway = gateways.find((g) => g.id === newMethod.gateway_id);
      if (!gateway) return;

      let details: any = {};

      if (newMethod.type === 'card') {
        details = {
          last4: newMethod.card_number.slice(-4),
          holder_name: newMethod.card_holder,
          expiry: newMethod.expiry,
          brand: 'visa',
        };
      } else if (newMethod.type === 'bank_account') {
        details = {
          bank_name: newMethod.bank_name,
          last4: newMethod.account_number.slice(-4),
          routing_number: newMethod.routing_number,
        };
      }

      const { error } = await supabase.from('payment_methods').insert([
        {
          company_id: profile?.company_id,
          gateway_id: newMethod.gateway_id,
          type: newMethod.type,
          details,
          is_default: paymentMethods.length === 0,
        },
      ]);

      if (!error) {
        setShowAddMethodModal(false);
        loadPaymentMethods();
        setNewMethod({
          gateway_id: '',
          type: 'card',
          card_number: '',
          card_holder: '',
          expiry: '',
          cvv: '',
          bank_name: '',
          account_number: '',
          routing_number: '',
        });
        setMessage({ type: 'success', text: 'Payment method added successfully!' });
      }
    } catch (error) {
      console.error('Error adding payment method:', error);
      setMessage({ type: 'error', text: 'Failed to add payment method' });
    }
  };

  const removePaymentMethod = async (methodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_active: false })
        .eq('id', methodId);

      if (!error) {
        loadPaymentMethods();
        setMessage({ type: 'success', text: 'Payment method removed successfully!' });
      }
    } catch (error) {
      console.error('Error removing payment method:', error);
      setMessage({ type: 'error', text: 'Failed to remove payment method' });
    }
  };

  const setDefaultPaymentMethod = async (methodId: string) => {
    try {
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('company_id', profile?.company_id);

      const { error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', methodId);

      if (!error) {
        loadPaymentMethods();
        setMessage({ type: 'success', text: 'Default payment method updated!' });
      }
    } catch (error) {
      console.error('Error setting default payment method:', error);
      setMessage({ type: 'error', text: 'Failed to set default payment method' });
    }
  };

  const canManageSettings = profile?.role === 'company_admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600">You do not have permission to view this page.</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-gray-600">No company found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-gray-600 mt-1">Manage your company profile and branding</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Company Logo</h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex items-center justify-center">
              {formData.logo_url ? (
                <img
                  src={formData.logo_url}
                  alt="Company Logo"
                  className="h-32 w-32 object-contain rounded-lg border-2 border-gray-200"
                />
              ) : (
                <div className="h-32 w-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-gray-200">
                  <Building className="h-16 w-16 text-gray-400" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <label className="block">
                <div className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer font-medium">
                  <Upload className="h-5 w-5" />
                  <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </label>

              {formData.logo_url && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, logo_url: '' })}
                  className="w-full px-6 py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium"
                >
                  Remove Logo
                </button>
              )}

              <p className="text-sm text-gray-500">
                Recommended: Square image, at least 200x200px
                <br />
                Max size: 2MB. Supported: JPG, PNG, SVG
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Company Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="123 Main St, City, State 12345"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Company Code</p>
              <p className="text-lg font-mono font-bold text-gray-900">{company.company_code}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Subscription Plan</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">{company.subscription_tier}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Payment Methods</h2>
            <p className="text-sm text-gray-600 mt-1">Manage your payment methods for invoices</p>
          </div>
          <button
            onClick={() => setShowAddMethodModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="h-5 w-5" />
            <span>Add Method</span>
          </button>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
            <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No payment methods added yet</p>
            <button
              onClick={() => setShowAddMethodModal(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first payment method
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {method.gateway_display_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {method.type === 'card'
                        ? `${method.details.holder_name} •••• ${method.details.last4}`
                        : `${method.details.bank_name} ••••${method.details.last4}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {method.is_default ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full font-medium">
                      Default
                    </span>
                  ) : (
                    <button
                      onClick={() => setDefaultPaymentMethod(method.id)}
                      className="px-3 py-1 text-blue-600 hover:bg-blue-50 text-sm rounded-lg transition-colors font-medium"
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    onClick={() => removePaymentMethod(method.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove payment method"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddMethodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Payment Method</h2>
              <button
                onClick={() => setShowAddMethodModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={addPaymentMethod} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Gateway
                </label>
                <select
                  value={newMethod.gateway_id}
                  onChange={(e) => setNewMethod({ ...newMethod, gateway_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Gateway</option>
                  {gateways.map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>
                      {gateway.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={newMethod.type}
                  onChange={(e) => setNewMethod({ ...newMethod, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="card">Credit/Debit Card</option>
                  <option value="bank_account">Bank Account</option>
                </select>
              </div>

              {newMethod.type === 'card' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Holder Name
                    </label>
                    <input
                      type="text"
                      value={newMethod.card_holder}
                      onChange={(e) => setNewMethod({ ...newMethod, card_holder: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={newMethod.card_number}
                      onChange={(e) => setNewMethod({ ...newMethod, card_number: e.target.value })}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiry
                      </label>
                      <input
                        type="text"
                        value={newMethod.expiry}
                        onChange={(e) => setNewMethod({ ...newMethod, expiry: e.target.value })}
                        placeholder="MM/YY"
                        maxLength={5}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                      <input
                        type="text"
                        value={newMethod.cvv}
                        onChange={(e) => setNewMethod({ ...newMethod, cvv: e.target.value })}
                        placeholder="123"
                        maxLength={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={newMethod.bank_name}
                      onChange={(e) => setNewMethod({ ...newMethod, bank_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={newMethod.account_number}
                      onChange={(e) =>
                        setNewMethod({ ...newMethod, account_number: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Routing Number
                    </label>
                    <input
                      type="text"
                      value={newMethod.routing_number}
                      onChange={(e) =>
                        setNewMethod({ ...newMethod, routing_number: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMethodModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Method
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
