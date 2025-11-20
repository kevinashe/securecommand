import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield, LogOut, Menu, X, LayoutDashboard, MapPin, Users,
  Calendar, AlertTriangle, Package, MessageSquare, CreditCard,
  Building, Bell, Radio, Wallet, Settings, BarChart3, History,
  FileText, User, DollarSign, UserPlus
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  const { profile, companyLogo, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getMenuItems = () => {
    const baseItems = [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'shifts', icon: Calendar, label: 'Shifts' },
      { id: 'incidents', icon: AlertTriangle, label: 'Incidents' },
      { id: 'messages', icon: MessageSquare, label: 'Messages' },
    ];

    if (profile?.role === 'super_admin') {
      return [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'companies', icon: Building, label: 'Companies' },
        { id: 'guards', icon: Users, label: 'User Management' },
        { id: 'leads', icon: UserPlus, label: 'Leads' },
        { id: 'pricing-plans', icon: DollarSign, label: 'Pricing Plans' },
        { id: 'analytics', icon: BarChart3, label: 'Analytics' },
        { id: 'audit-logs', icon: FileText, label: 'Audit Logs' },
        { id: 'notifications', icon: Bell, label: 'Notifications' },
        { id: 'billing', icon: CreditCard, label: 'Billing' },
        { id: 'payments', icon: Wallet, label: 'Payments' },
        { id: 'profile', icon: User, label: 'Profile Settings' },
      ];
    }

    if (profile?.role === 'company_admin') {
      return [
        ...baseItems,
        { id: 'sites', icon: MapPin, label: 'Sites' },
        { id: 'guards', icon: Users, label: 'Guards' },
        { id: 'patrol', icon: MapPin, label: 'Patrol Routes' },
        { id: 'equipment', icon: Package, label: 'Equipment' },
        { id: 'sos-alerts', icon: Bell, label: 'SOS Alerts' },
        { id: 'tracking', icon: Radio, label: 'GPS Tracking' },
        { id: 'analytics', icon: BarChart3, label: 'Analytics' },
        { id: 'audit-logs', icon: FileText, label: 'Audit Logs' },
        { id: 'notifications', icon: Bell, label: 'Notifications' },
        { id: 'settings', icon: Settings, label: 'Settings' },
        { id: 'profile', icon: User, label: 'Profile Settings' },
      ];
    }

    if (profile?.role === 'site_manager') {
      return [
        { id: 'sites', icon: MapPin, label: 'Sites' },
        { id: 'shifts', icon: Calendar, label: 'Shifts' },
        { id: 'patrol', icon: MapPin, label: 'Patrol Routes' },
        { id: 'guards', icon: Users, label: 'Guards' },
        { id: 'messages', icon: MessageSquare, label: 'Messages' },
        { id: 'incidents', icon: AlertTriangle, label: 'Incidents' },
        { id: 'sos-alerts', icon: Bell, label: 'SOS Alerts' },
        { id: 'tracking', icon: Radio, label: 'GPS Tracking' },
        { id: 'equipment', icon: Package, label: 'Equipment' },
        { id: 'analytics', icon: BarChart3, label: 'Analytics' },
        { id: 'notifications', icon: Bell, label: 'Notifications' },
        { id: 'profile', icon: User, label: 'Profile Settings' },
      ];
    }

    return [
      ...baseItems,
      { id: 'patrol', icon: MapPin, label: 'Patrol' },
      { id: 'checkin', icon: Radio, label: 'Check In' },
      { id: 'sos', icon: Bell, label: 'SOS' },
      { id: 'history', icon: History, label: 'My History' },
      { id: 'notifications', icon: Bell, label: 'Notifications' },
      { id: 'profile', icon: User, label: 'Profile Settings' },
    ];
  };

  const menuItems = getMenuItems();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt="Company Logo"
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">SecureCommand</h1>
                <p className="text-xs text-gray-500 capitalize">{profile?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;

                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        onViewChange(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 px-4 py-3 bg-gray-50 rounded-lg mb-3">
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold">
                  {profile?.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile?.full_name}
                </p>
                <p className="text-xs text-gray-500 truncate">{profile?.phone || 'No phone'}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            <div className="flex items-center space-x-4 ml-auto">
              {companyLogo && (
                <img
                  src={companyLogo}
                  alt="Company Logo"
                  className="h-8 w-8 object-contain hidden lg:block"
                />
              )}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {profile?.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
        />
      )}
    </div>
  );
};
