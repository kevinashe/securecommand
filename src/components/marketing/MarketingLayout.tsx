import React, { useState } from 'react';
import { Shield, Menu, X } from 'lucide-react';

interface MarketingLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children, currentPage, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { id: 'home', label: 'Home' },
    { id: 'products', label: 'Products' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'contact', label: 'Contact' }
  ];

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center space-x-3 group"
            >
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2 rounded-lg group-hover:shadow-lg transition-shadow">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">SecureCommand</span>
            </button>

            <div className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    currentPage === item.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center space-x-3">
              <button
                onClick={() => onNavigate('login')}
                className="px-4 py-2 text-gray-700 font-medium hover:text-blue-600 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => onNavigate('login')}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg shadow-blue-500/30"
              >
                Get Started
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4 space-y-2">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${
                    currentPage === item.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    onNavigate('login');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 rounded-lg"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    onNavigate('login');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <div className="pt-16">
        {children}
      </div>

      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2 rounded-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold">SecureCommand</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Professional software solutions built for excellence across multiple industries.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Products</h3>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <button onClick={() => onNavigate('products')} className="hover:text-white transition-colors">
                    SecureCommand
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('products')} className="hover:text-white transition-colors">
                    WorkForce Pro
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('products')} className="hover:text-white transition-colors">
                    SiteCommand
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('products')} className="hover:text-white transition-colors">
                    EventMaster
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                    About Us
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                    Contact
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('pricing')} className="hover:text-white transition-colors">
                    Pricing
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                    Careers
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                    Help Center
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                    Documentation
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                    API Reference
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                    Status Page
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <p className="text-slate-400 text-sm mb-4 md:mb-0">
                © 2024 SecureCommand. All rights reserved.
              </p>
              <div className="flex items-center space-x-6 text-sm text-slate-400">
                <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                  Privacy Policy
                </button>
                <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                  Terms of Service
                </button>
                <button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">
                  Cookie Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
