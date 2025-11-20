import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, MapPin, Users, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [companyData, setCompanyData] = useState({
    name: '',
    address: '',
    phone: '',
    email: ''
  });

  const [siteData, setSiteData] = useState({
    name: '',
    address: '',
    contact_name: '',
    contact_phone: ''
  });

  const [guardData, setGuardData] = useState({
    email: '',
    full_name: '',
    phone: ''
  });

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          name: companyData.name,
          address: companyData.address,
          phone: companyData.phone,
          email: companyData.email
        })
        .eq('id', profile?.company_id);

      if (updateError) throw updateError;

      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to update company information');
    } finally {
      setLoading(false);
    }
  };

  const handleSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('sites')
        .insert([
          {
            company_id: profile?.company_id,
            name: siteData.name,
            address: siteData.address,
            contact_name: siteData.contact_name,
            contact_phone: siteData.contact_phone,
            is_active: true
          }
        ]);

      if (insertError) throw insertError;

      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  const handleGuardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: guardData.email,
        password: Math.random().toString(36).slice(-12),
        options: {
          data: {
            full_name: guardData.full_name,
            phone: guardData.phone,
            role: 'guard',
            company_id: profile?.company_id
          }
        }
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              full_name: guardData.full_name,
              phone: guardData.phone,
              role: 'guard',
              company_id: profile?.company_id,
              is_active: true
            }
          ]);
      }

      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Failed to create guard account');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Company Info', icon: Building2 },
    { number: 2, title: 'First Site', icon: MapPin },
    { number: 3, title: 'First Guard', icon: Users },
    { number: 4, title: 'Complete', icon: CheckCircle }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome to SecureCommand</h1>
          <p className="text-gray-600">Let's get your account set up in just a few steps</p>
        </div>

        <div className="flex items-center justify-center mb-8">
          {steps.map((s, index) => (
            <React.Fragment key={s.number}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    step > s.number
                      ? 'bg-green-600'
                      : step === s.number
                      ? 'bg-blue-600'
                      : 'bg-gray-300'
                  } text-white transition-colors`}
                >
                  {step > s.number ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    <s.icon className="h-6 w-6" />
                  )}
                </div>
                <p className="text-xs mt-2 text-gray-600">{s.title}</p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-16 h-1 ${
                    step > s.number ? 'bg-green-600' : 'bg-gray-300'
                  } mx-2 transition-colors`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleCompanySubmit} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Company Information</h2>
                <p className="text-gray-600 mb-6">Tell us about your security company</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyData.name}
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Address *
                </label>
                <input
                  type="text"
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <span>Continue</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSiteSubmit} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Your First Site</h2>
                <p className="text-gray-600 mb-6">Create a location where your guards will be assigned</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Name *
                </label>
                <input
                  type="text"
                  value={siteData.name}
                  onChange={(e) => setSiteData({ ...siteData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Address *
                </label>
                <input
                  type="text"
                  value={siteData.address}
                  onChange={(e) => setSiteData({ ...siteData, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={siteData.contact_name}
                    onChange={(e) => setSiteData({ ...siteData, contact_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={siteData.contact_phone}
                    onChange={(e) => setSiteData({ ...siteData, contact_phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleGuardSubmit} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Your First Guard</h2>
                <p className="text-gray-600 mb-6">Create an account for your first security guard</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={guardData.full_name}
                  onChange={(e) => setGuardData({ ...guardData, full_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={guardData.email}
                  onChange={(e) => setGuardData({ ...guardData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={guardData.phone}
                  onChange={(e) => setGuardData({ ...guardData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  A temporary password will be generated and sent to the guard's email address.
                  They can change it upon first login.
                </p>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </form>
          )}

          {step === 4 && (
            <div className="text-center py-8">
              <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-4">All Set!</h2>
              <p className="text-gray-600 mb-8">
                Your account is now configured and ready to use. You can add more sites, guards,
                and customize settings from your dashboard.
              </p>

              <button
                onClick={onComplete}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
