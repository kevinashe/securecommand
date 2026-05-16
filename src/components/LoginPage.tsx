import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginPageProps {
  onNavigateToCompanySignup?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToCompanySignup }) => {
  const { signIn } = useAuth();
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isForgotPassword) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess('Password reset email sent! Check your inbox.');
        setTimeout(() => {
          setIsForgotPassword(false);
          setEmail('');
        }, 3000);
      }
    } else {
      const { error } = await signIn(email, password, companyCode || undefined);
      if (error) {
        setError(error.message);
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center mb-8">
            <img
              src="/icon.svg"
              alt="SecureCommand Logo"
              className="h-20 w-20"
            />
          </div>

          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
            SecureCommand
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Security Management System
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isForgotPassword && (
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset Password</h2>
                <p className="text-sm text-gray-600">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="your@email.com"
                required
              />
            </div>

            {!isForgotPassword && (
              <div>
                <label htmlFor="companyCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Code <span className="text-gray-400 font-normal">(optional for returning users)</span>
                </label>
                <input
                  id="companyCode"
                  type="text"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                  placeholder="CC-XXXXXX"
                  maxLength={9}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the code provided by your company admin. Not needed after your first login.
                </p>
              </div>
            )}

            {!isForgotPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  {isForgotPassword ? 'Sending...' : 'Signing In...'}
                </>
              ) : (
                isForgotPassword ? 'Send Reset Link' : 'Sign In'
              )}
            </button>

            {!isForgotPassword && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Forgot your password?
                </button>
              </div>
            )}

            {isForgotPassword && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </form>

          {!isForgotPassword && (
            <div className="mt-8 pt-6 border-t border-gray-200 space-y-4">
              <p className="text-sm text-gray-600 text-center">
                Your company admin will create your account and provide your login credentials.
              </p>
              {onNavigateToCompanySignup && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={onNavigateToCompanySignup}
                    className="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Register Your Company</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
