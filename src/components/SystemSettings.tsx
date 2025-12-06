import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings, Save, Loader, Image, Type, Palette, ArrowLeft } from 'lucide-react';

interface SystemSettingsProps {
  onBack: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [settingsData, setSettingsData] = useState({
    app_name: 'SecureCommand',
    app_icon_url: '/icon.svg',
    primary_color: '#2563eb'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('system_settings')
        .select('*')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setSettingsData({
          app_name: data.app_name || 'SecureCommand',
          app_icon_url: data.app_icon_url || '/icon.svg',
          primary_color: data.primary_color || '#2563eb'
        });
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from('system_settings')
          .update({
            app_name: settingsData.app_name,
            app_icon_url: settingsData.app_icon_url,
            primary_color: settingsData.primary_color,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('system_settings')
          .insert([{
            app_name: settingsData.app_name,
            app_icon_url: settingsData.app_icon_url,
            primary_color: settingsData.primary_color
          }]);

        if (insertError) throw insertError;
      }

      await supabase.from('audit_logs').insert([{
        user_id: profile?.id,
        action: 'update',
        entity_type: 'system_settings',
        entity_id: existing?.id,
        changes: settingsData
      }]);

      setMessage('System settings updated successfully! Refresh the page to see changes.');
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to update system settings');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="max-w-4xl">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Access denied. Only super administrators can access system settings.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Dashboard</span>
      </button>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-1">Customize your application branding and appearance</p>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Settings className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Branding Settings</h2>
            <p className="text-sm text-gray-600">Customize your application logo and colors</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <Type className="h-4 w-4" />
                <span>Application Name</span>
              </div>
            </label>
            <input
              type="text"
              value={settingsData.app_name}
              onChange={(e) => setSettingsData({ ...settingsData, app_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">The name displayed throughout the application</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <Image className="h-4 w-4" />
                <span>Logo/Icon URL</span>
              </div>
            </label>
            <input
              type="text"
              value={settingsData.app_icon_url}
              onChange={(e) => setSettingsData({ ...settingsData, app_icon_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="/icon.svg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter a URL or path to your custom logo (e.g., /icon.svg, /logo.png, or https://...)
            </p>
            {settingsData.app_icon_url && (
              <div className="mt-3 flex items-center space-x-3">
                <span className="text-sm text-gray-600">Preview:</span>
                <img
                  src={settingsData.app_icon_url}
                  alt="Logo preview"
                  className="h-12 w-12 object-contain border border-gray-200 rounded-lg p-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <Palette className="h-4 w-4" />
                <span>Primary Brand Color</span>
              </div>
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={settingsData.primary_color}
                onChange={(e) => setSettingsData({ ...settingsData, primary_color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={settingsData.primary_color}
                onChange={(e) => setSettingsData({ ...settingsData, primary_color: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="#2563eb"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The primary color used for buttons, highlights, and branding elements
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200">
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
                  <Save className="h-5 w-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Note</h3>
        <p className="text-sm text-blue-800">
          After updating the logo or colors, you may need to refresh the page to see the changes take effect.
          The logo will be displayed in the sidebar, login page, and marketing pages.
        </p>
      </div>
    </div>
  );
};
