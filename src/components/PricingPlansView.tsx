import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, Plus, Edit, Trash2, Check, X, Loader, Star, Users, MapPin, Shield } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthly_license_fee: number;
  yearly_license_fee: number;
  per_guard_monthly_fee: number;
  per_guard_yearly_fee: number;
  currency: string;
  features: string[];
  max_users: number;
  max_sites: number;
  max_guards: number;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  stripe_monthly_price_id: string | null;
  stripe_yearly_price_id: string | null;
  created_at: string;
  updated_at: string;
}

export const PricingPlansView: React.FC = () => {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    monthly_license_fee: '',
    yearly_license_fee: '',
    per_guard_monthly_fee: '',
    per_guard_yearly_fee: '',
    currency: 'USD',
    features: [''],
    max_users: '',
    max_sites: '',
    max_guards: '',
    is_active: true,
    is_featured: false,
    display_order: '0',
    stripe_monthly_price_id: '',
    stripe_yearly_price_id: ''
  });

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      loadPlans();
    }
  }, [profile]);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading pricing plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const planData = {
        name: formData.name,
        description: formData.description,
        monthly_license_fee: parseFloat(formData.monthly_license_fee),
        yearly_license_fee: parseFloat(formData.yearly_license_fee),
        per_guard_monthly_fee: parseFloat(formData.per_guard_monthly_fee),
        per_guard_yearly_fee: parseFloat(formData.per_guard_yearly_fee),
        currency: formData.currency,
        features: formData.features.filter(f => f.trim() !== ''),
        max_users: parseInt(formData.max_users) || -1,
        max_sites: parseInt(formData.max_sites) || -1,
        max_guards: parseInt(formData.max_guards) || -1,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        display_order: parseInt(formData.display_order) || 0,
        stripe_monthly_price_id: formData.stripe_monthly_price_id || null,
        stripe_yearly_price_id: formData.stripe_yearly_price_id || null,
        updated_at: new Date().toISOString()
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('pricing_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;

        await supabase.from('audit_logs').insert([{
          user_id: profile?.id,
          action: 'update',
          entity_type: 'pricing_plan',
          entity_id: editingPlan.id,
          changes: planData
        }]);

        setMessage({ type: 'success', text: 'Pricing plan updated successfully!' });
      } else {
        const { error } = await supabase
          .from('pricing_plans')
          .insert([planData]);

        if (error) throw error;

        await supabase.from('audit_logs').insert([{
          user_id: profile?.id,
          action: 'create',
          entity_type: 'pricing_plan',
          changes: planData
        }]);

        setMessage({ type: 'success', text: 'Pricing plan created successfully!' });
      }

      resetForm();
      await loadPlans();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save pricing plan' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      monthly_license_fee: plan.monthly_license_fee.toString(),
      yearly_license_fee: plan.yearly_license_fee.toString(),
      per_guard_monthly_fee: plan.per_guard_monthly_fee.toString(),
      per_guard_yearly_fee: plan.per_guard_yearly_fee.toString(),
      currency: plan.currency,
      features: plan.features.length > 0 ? plan.features : [''],
      max_users: plan.max_users.toString(),
      max_sites: plan.max_sites.toString(),
      max_guards: plan.max_guards.toString(),
      is_active: plan.is_active,
      is_featured: plan.is_featured,
      display_order: plan.display_order.toString(),
      stripe_monthly_price_id: plan.stripe_monthly_price_id || '',
      stripe_yearly_price_id: plan.stripe_yearly_price_id || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this pricing plan? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('pricing_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      await supabase.from('audit_logs').insert([{
        user_id: profile?.id,
        action: 'delete',
        entity_type: 'pricing_plan',
        entity_id: planId
      }]);

      setMessage({ type: 'success', text: 'Pricing plan deleted successfully!' });
      await loadPlans();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete pricing plan' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      monthly_license_fee: '',
      yearly_license_fee: '',
      per_guard_monthly_fee: '',
      per_guard_yearly_fee: '',
      currency: 'USD',
      features: [''],
      max_users: '',
      max_sites: '',
      max_guards: '',
      is_active: true,
      is_featured: false,
      display_order: '0',
      stripe_monthly_price_id: '',
      stripe_yearly_price_id: ''
    });
    setEditingPlan(null);
    setShowForm(false);
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const removeFeature = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData({ ...formData, features: newFeatures });
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const calculateMonthlyTotal = (licenseFee: number, perGuardFee: number, numGuards: number = 10) => {
    return licenseFee + (perGuardFee * numGuards);
  };

  const calculateYearlyTotal = (licenseFee: number, perGuardFee: number, numGuards: number = 10) => {
    return licenseFee + (perGuardFee * numGuards);
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">Access denied. Only super admins can manage pricing plans.</p>
      </div>
    );
  }

  if (loading && plans.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pricing Plans</h1>
          <p className="text-gray-600 mt-1">Manage subscription plans with license + per-guard fees</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Plan</span>
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingPlan ? 'Edit Pricing Plan' : 'Create New Pricing Plan'}
            </h2>
            <button
              onClick={resetForm}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Plan Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Basic, Professional, Enterprise"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Display Order</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Brief description of the plan"
                required
              />
            </div>

            <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">License Fees (Base Platform Fee)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monthly License Fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monthly_license_fee}
                      onChange={(e) => setFormData({ ...formData, monthly_license_fee: e.target.value })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="29.99"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Base monthly fee for the platform</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Yearly License Fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.yearly_license_fee}
                      onChange={(e) => setFormData({ ...formData, yearly_license_fee: e.target.value })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="299.99"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Base yearly fee for the platform</p>
                </div>
              </div>
            </div>

            <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Per-Guard Fees (Additional Cost)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Per Guard Monthly Fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.per_guard_monthly_fee}
                      onChange={(e) => setFormData({ ...formData, per_guard_monthly_fee: e.target.value })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="5.00"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Charged per active guard per month</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Per Guard Yearly Fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.per_guard_yearly_fee}
                      onChange={(e) => setFormData({ ...formData, per_guard_yearly_fee: e.target.value })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="50.00"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Charged per active guard per year</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Users</label>
                <input
                  type="number"
                  value={formData.max_users}
                  onChange={(e) => setFormData({ ...formData, max_users: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="-1 for unlimited"
                />
                <p className="text-xs text-gray-500 mt-1">-1 for unlimited</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Sites</label>
                <input
                  type="number"
                  value={formData.max_sites}
                  onChange={(e) => setFormData({ ...formData, max_sites: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="-1 for unlimited"
                />
                <p className="text-xs text-gray-500 mt-1">-1 for unlimited</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Guards</label>
                <input
                  type="number"
                  value={formData.max_guards}
                  onChange={(e) => setFormData({ ...formData, max_guards: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="-1 for unlimited"
                />
                <p className="text-xs text-gray-500 mt-1">-1 for unlimited</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
              <div className="space-y-2">
                {formData.features.map((feature, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => updateFeature(index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter feature"
                    />
                    {formData.features.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFeature(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFeature}
                  className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>Add Feature</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stripe Monthly Price ID</label>
                <input
                  type="text"
                  value={formData.stripe_monthly_price_id}
                  onChange={(e) => setFormData({ ...formData, stripe_monthly_price_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="price_xxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stripe Yearly Price ID</label>
                <input
                  type="text"
                  value={formData.stripe_yearly_price_id}
                  onChange={(e) => setFormData({ ...formData, stripe_yearly_price_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="price_xxxxx"
                />
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_featured}
                  onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Featured</span>
              </label>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    <span>{editingPlan ? 'Update Plan' : 'Create Plan'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
              plan.is_featured ? 'border-blue-500 shadow-lg' : 'border-gray-200'
            }`}
          >
            {plan.is_featured && (
              <div className="bg-blue-600 text-white text-center py-2 rounded-t-xl">
                <div className="flex items-center justify-center space-x-2">
                  <Star className="h-4 w-4" />
                  <span className="text-sm font-semibold">Most Popular</span>
                </div>
              </div>
            )}

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                {!plan.is_active && (
                  <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs font-semibold rounded">
                    Inactive
                  </span>
                )}
              </div>

              <p className="text-gray-600 mb-6 text-sm">{plan.description}</p>

              <div className="mb-6 bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">License Fee</h4>
                <div className="flex items-baseline space-x-2 mb-2">
                  <span className="text-3xl font-bold text-gray-900">
                    ${plan.monthly_license_fee}
                  </span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-sm text-gray-600">
                  or ${plan.yearly_license_fee}/year
                </p>
              </div>

              <div className="mb-6 bg-green-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Per Guard Fee</h4>
                <div className="flex items-baseline space-x-2 mb-2">
                  <span className="text-3xl font-bold text-gray-900">
                    ${plan.per_guard_monthly_fee}
                  </span>
                  <span className="text-gray-600">/guard/month</span>
                </div>
                <p className="text-sm text-gray-600">
                  or ${plan.per_guard_yearly_fee}/guard/year
                </p>
              </div>

              <div className="mb-6 border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">Example: With 10 guards</p>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>Monthly: ${calculateMonthlyTotal(plan.monthly_license_fee, plan.per_guard_monthly_fee, 10).toFixed(2)}</p>
                  <p>Yearly: ${calculateYearlyTotal(plan.yearly_license_fee, plan.per_guard_yearly_fee, 10).toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span>{plan.max_users === -1 ? 'Unlimited' : `Up to ${plan.max_users}`} users</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span>{plan.max_sites === -1 ? 'Unlimited' : `Up to ${plan.max_sites}`} sites</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span>{plan.max_guards === -1 ? 'Unlimited' : `Up to ${plan.max_guards}`} guards</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Features:</h4>
                <ul className="space-y-2">
                  {plan.features.slice(0, 5).map((feature, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {plan.features.length > 5 && (
                    <li className="text-sm text-gray-500 italic">
                      +{plan.features.length - 5} more features
                    </li>
                  )}
                </ul>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEdit(plan)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && !showForm && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pricing Plans</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first pricing plan</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Plan</span>
          </button>
        </div>
      )}
    </div>
  );
};
