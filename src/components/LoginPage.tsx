import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Loader, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginPageProps {
  onNavigateToCompanySignup?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToCompanySignup }) => {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('security_officer');
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
    } else if (isSignUp) {
      const { error } = await signUp(email, password, fullName, role);
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Account created! You can now sign in.');
        setIsSignUp(false);
        setEmail('');
        setPassword('');
        setCompanyCode('');
        setFullName('');
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
            <div className="bg-blue-600 p-4 rounded-full">
              <Shield className="h-12 w-12 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
            SecureCommand
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Security Management System
          </p>

          {!isForgotPassword && (
            <div className="flex space-x-2 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  !isSignUp ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  isSignUp ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

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

            {isSignUp && !isForgotPassword && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="John Doe"
                  required
                />
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

            {!isSignUp && !isForgotPassword && (
              <div>
                <label htmlFor="companyCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Code <span className="text-gray-400 font-normal">(optional for admins)</span>
                </label>
                <input
                  id="companyCode"
                  type="text"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                  placeholder="ABC123"
                  maxLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">Enter the 6-character code provided by your company. Admins and managers can leave this blank.</p>
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

            {isSignUp && !isForgotPassword && (
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="security_officer">Security Officer</option>
                  <option value="site_manager">Site Manager</option>
                  <option value="company_admin">Company Admin</option>
                </select>
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
                  {isForgotPassword ? 'Sending...' : isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>

            {!isSignUp && !isForgotPassword && (
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

          {!isSignUp && !isForgotPassword && (
            <div className="mt-8 pt-6 border-t border-gray-200 space-y-4">
              <p className="text-sm text-gray-600 text-center">
                Create test accounts using <span className="font-semibold">Sign Up</span> above
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
