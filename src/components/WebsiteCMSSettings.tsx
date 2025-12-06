import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileText, Save, Loader, Globe, AlertCircle, ArrowLeft } from 'lucide-react';

interface WebsiteContent {
  id: string;
  section: string;
  key: string;
  value: any;
  type: string;
}

interface WebsiteCMSSettingsProps {
  onBack: () => void;
}

export const WebsiteCMSSettings: React.FC<WebsiteCMSSettingsProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [content, setContent] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('website_content')
        .select('*')
        .order('section', { ascending: true });

      if (fetchError) throw fetchError;

      const organizedContent: Record<string, Record<string, string>> = {};
      data?.forEach((item: WebsiteContent) => {
        if (!organizedContent[item.section]) {
          organizedContent[item.section] = {};
        }
        // JSONB values come back as native JS types, no parsing needed
        const value = item.value;

        // Convert to string for the text inputs
        // If it's an array or object, stringify it for editing
        if (typeof value === 'string') {
          organizedContent[item.section][item.key] = value;
        } else {
          organizedContent[item.section][item.key] = JSON.stringify(value, null, 2);
        }
      });

      setContent(organizedContent);
    } catch (err: any) {
      console.error('Error loading content:', err);
      setError('Failed to load website content');
    }
  };

  const handleUpdateSection = async (section: string) => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const sectionContent = content[section];

      for (const [key, value] of Object.entries(sectionContent)) {
        let processedValue = value;

        try {
          const parsed = JSON.parse(value);
          processedValue = JSON.stringify(parsed);
        } catch {
          processedValue = JSON.stringify(value);
        }

        const { error: upsertError } = await supabase
          .from('website_content')
          .update({
            value: processedValue,
            updated_by: profile?.id,
            updated_at: new Date().toISOString()
          })
          .eq('section', section)
          .eq('key', key);

        if (upsertError) throw upsertError;
      }

      await supabase.from('audit_logs').insert({
        user_id: profile?.id,
        action: 'update',
        entity_type: 'website_content',
        changes: { section, content: sectionContent }
      });

      setMessage(`${section.charAt(0).toUpperCase() + section.slice(1)} section updated successfully!`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update content');
    } finally {
      setLoading(false);
    }
  };

  const updateContent = (section: string, key: string, value: string) => {
    setContent(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="max-w-6xl">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Access denied. Only super administrators can access website content management.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Dashboard</span>
      </button>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Website Content Management</h1>
        <p className="text-gray-600 mt-1">Edit your landing page content, features, and marketing copy</p>
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-blue-900 mb-1">About Website Content</h3>
          <p className="text-sm text-blue-800">
            The content you edit here will be displayed on your public landing page at <strong>securecommands.com</strong>.
            For JSON arrays (like features), maintain proper JSON formatting. Changes take effect immediately.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Globe className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Hero Section</h2>
            <p className="text-sm text-gray-600">Main headline and call-to-action area</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Badge Text</label>
            <input
              type="text"
              value={content.hero?.badge_text || ''}
              onChange={(e) => updateContent('hero', 'badge_text', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Main Heading</label>
            <input
              type="text"
              value={content.hero?.main_heading || ''}
              onChange={(e) => updateContent('hero', 'main_heading', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sub Heading</label>
            <input
              type="text"
              value={content.hero?.sub_heading || ''}
              onChange={(e) => updateContent('hero', 'sub_heading', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={content.hero?.description || ''}
              onChange={(e) => updateContent('hero', 'description', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Button Text</label>
              <input
                type="text"
                value={content.hero?.primary_cta_text || ''}
                onChange={(e) => updateContent('hero', 'primary_cta_text', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Button Text</label>
              <input
                type="text"
                value={content.hero?.secondary_cta_text || ''}
                onChange={(e) => updateContent('hero', 'secondary_cta_text', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={() => handleUpdateSection('hero')}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            <span>Save Hero Section</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-green-100 p-3 rounded-lg">
            <FileText className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Features Section</h2>
            <p className="text-sm text-gray-600">Highlight your key features</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Section Heading</label>
            <input
              type="text"
              value={content.features?.heading || ''}
              onChange={(e) => updateContent('features', 'heading', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subheading</label>
            <input
              type="text"
              value={content.features?.subheading || ''}
              onChange={(e) => updateContent('features', 'subheading', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Feature List (JSON Array)</label>
            <textarea
              value={content.features?.feature_list || ''}
              onChange={(e) => updateContent('features', 'feature_list', e.target.value)}
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder='[{"icon": "Shield", "title": "Feature Name", "description": "Feature description"}]'
            />
            <p className="text-xs text-gray-500 mt-1">
              Edit as JSON array. Each feature should have: icon (Lucide icon name), title, and description.
            </p>
          </div>

          <button
            onClick={() => handleUpdateSection('features')}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            <span>Save Features Section</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-orange-100 p-3 rounded-lg">
            <FileText className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Contact Information</h2>
            <p className="text-sm text-gray-600">Update contact details</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Section Heading</label>
            <input
              type="text"
              value={content.contact?.heading || ''}
              onChange={(e) => updateContent('contact', 'heading', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subheading</label>
            <input
              type="text"
              value={content.contact?.subheading || ''}
              onChange={(e) => updateContent('contact', 'subheading', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={content.contact?.email || ''}
                onChange={(e) => updateContent('contact', 'email', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={content.contact?.phone || ''}
                onChange={(e) => updateContent('contact', 'phone', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <input
                type="text"
                value={content.contact?.address || ''}
                onChange={(e) => updateContent('contact', 'address', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={() => handleUpdateSection('contact')}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            <span>Save Contact Section</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-gray-100 p-3 rounded-lg">
            <FileText className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Footer Content</h2>
            <p className="text-sm text-gray-600">Footer tagline and copyright</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tagline</label>
            <input
              type="text"
              value={content.footer?.tagline || ''}
              onChange={(e) => updateContent('footer', 'tagline', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Copyright Text</label>
            <input
              type="text"
              value={content.footer?.copyright || ''}
              onChange={(e) => updateContent('footer', 'copyright', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => handleUpdateSection('footer')}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            <span>Save Footer Section</span>
          </button>
        </div>
      </div>
    </div>
  );
};
