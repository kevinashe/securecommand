import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, Star, Loader, ArrowRight, Users, MapPin, Shield } from 'lucide-react';

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
}

interface PricingPageProps {
  onNavigate: (page: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [guardCount, setGuardCount] = useState(10);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading pricing plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (plan: PricingPlan) => {
    if (billingCycle === 'monthly') {
      return plan.monthly_license_fee + (plan.per_guard_monthly_fee * guardCount);
    } else {
      return plan.yearly_license_fee + (plan.per_guard_yearly_fee * guardCount);
    }
  };

  const calculateSavings = (plan: PricingPlan) => {
    const monthlyTotal = (plan.monthly_license_fee + (plan.per_guard_monthly_fee * guardCount)) * 12;
    const yearlyTotal = plan.yearly_license_fee + (plan.per_guard_yearly_fee * guardCount);
    return monthlyTotal - yearlyTotal;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Choose the plan that fits your needs. All plans include our core features with no hidden fees.
          </p>

          <div className="inline-flex items-center bg-slate-100 rounded-lg p-1 mb-8">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                Save up to 20%
              </span>
            </button>
          </div>

          <div className="max-w-md mx-auto mb-12">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Number of Guards: {guardCount}
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={guardCount}
              onChange={(e) => setGuardCount(parseInt(e.target.value))}
              className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 guard</span>
              <span>100 guards</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => {
            const total = calculateTotal(plan);
            const savings = billingCycle === 'yearly' ? calculateSavings(plan) : 0;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl shadow-sm transition-all hover:shadow-xl ${
                  plan.is_featured
                    ? 'border-2 border-blue-500 shadow-lg scale-105 relative'
                    : 'border-2 border-gray-200'
                }`}
              >
                {plan.is_featured && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                      <Star className="h-4 w-4" />
                      <span>Most Popular</span>
                    </div>
                  </div>
                )}

                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-6">{plan.description}</p>

                  <div className="mb-6">
                    <div className="flex items-baseline mb-2">
                      <span className="text-5xl font-bold text-gray-900">
                        ${total.toFixed(0)}
                      </span>
                      <span className="text-gray-600 ml-2">
                        /{billingCycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>
                    {billingCycle === 'yearly' && savings > 0 && (
                      <p className="text-green-600 text-sm font-medium">
                        Save ${savings.toFixed(0)} per year
                      </p>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 mb-6">
                    <div className="text-sm text-gray-700 space-y-2">
                      <div className="flex justify-between">
                        <span>License Fee:</span>
                        <span className="font-semibold">
                          ${billingCycle === 'monthly' ? plan.monthly_license_fee : plan.yearly_license_fee}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Per Guard ({guardCount}):</span>
                        <span className="font-semibold">
                          ${((billingCycle === 'monthly' ? plan.per_guard_monthly_fee : plan.per_guard_yearly_fee) * guardCount).toFixed(2)}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                        <span>Total:</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
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

                  <div className="border-t border-gray-200 pt-6 mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Everything included:</h4>
                    <ul className="space-y-3">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                            <Check className="h-3 w-3 text-green-600" />
                          </div>
                          <span className="text-gray-700 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => onNavigate('login')}
                    className={`w-full flex items-center justify-center space-x-2 py-4 rounded-lg font-semibold transition-all ${
                      plan.is_featured
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/30'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>Get Started</span>
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-12 text-center shadow-xl">
          <h2 className="text-3xl font-bold text-white mb-4">
            Enterprise Solutions Available
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Need custom features, dedicated support, or special pricing for large teams?
            Contact our sales team for a tailored solution.
          </p>
          <button
            onClick={() => onNavigate('contact')}
            className="px-8 py-4 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-100 transition-all shadow-lg"
          >
            Contact Sales
          </button>
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
            {[
              {
                q: 'Can I change plans later?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.'
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, debit cards, and ACH transfers for enterprise plans.'
              },
              {
                q: 'Is there a setup fee?',
                a: 'No setup fees. You only pay the monthly or yearly subscription based on your selected plan.'
              },
              {
                q: 'What happens if I exceed my limits?',
                a: 'We\'ll notify you before you reach your limits. You can easily upgrade to a higher plan anytime.'
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">{faq.q}</h4>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
