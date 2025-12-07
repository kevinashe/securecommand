console.log('[APP] App.tsx module loading...');

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ShiftsView } from './components/ShiftsView';
import { IncidentsView } from './components/IncidentsView';
import { SOSView } from './components/SOSView';
import { MessagesView } from './components/MessagesView';
import { CompaniesView } from './components/CompaniesView';
import { BillingView } from './components/BillingView';
import { SitesView } from './components/SitesView';
import { GuardsView } from './components/GuardsView';
import { EquipmentView } from './components/EquipmentView';
import { PatrolView } from './components/PatrolView';
import { CheckInView } from './components/CheckInView';
import { TrackingView } from './components/TrackingView';
import { PaymentsView } from './components/PaymentsView';
import { CompanySettings } from './components/CompanySettings';
import { NotificationsView } from './components/NotificationsView';
import { AnalyticsView } from './components/AnalyticsView';
import { AssignmentHistoryView } from './components/AssignmentHistoryView';
import { PricingPlansView } from './components/PricingPlansView';
import { LeadsView } from './components/LeadsView';
import { SystemSettings } from './components/SystemSettings';
import { WebsiteCMSSettings } from './components/WebsiteCMSSettings';
import { ClientPortalView } from './components/ClientPortalView';
import { MarketingLayout } from './components/marketing/MarketingLayout';
import { LandingPage } from './components/marketing/LandingPage';
import { ProductsPage } from './components/marketing/ProductsPage';
import { PricingPage } from './components/marketing/PricingPage';
import { ContactPage } from './components/marketing/ContactPage';
import { CompanySignup } from './components/CompanySignup';
import { PasswordReset } from './components/PasswordReset';
import { AdvancedScheduling } from './components/AdvancedScheduling';
import { TimeAttendance } from './components/TimeAttendance';
import { InvoicingView } from './components/InvoicingView';
import BusManagementView from './components/BusManagementView';
import BusCheckInView from './components/BusCheckInView';
import BusTrackingView from './components/BusTrackingView';

const AppContent: React.FC = () => {
  console.log('[APP] AppContent component rendering');
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewChange={setCurrentView} />;
      case 'shifts':
        return <ShiftsView onBack={() => setCurrentView('dashboard')} />;
      case 'incidents':
        return <IncidentsView onBack={() => setCurrentView('dashboard')} />;
      case 'sos-alerts':
      case 'sos':
        return <SOSView onBack={() => setCurrentView('dashboard')} />;
      case 'messages':
        return <MessagesView onBack={() => setCurrentView('dashboard')} />;
      case 'companies':
        return <CompaniesView onBack={() => setCurrentView('dashboard')} />;
      case 'sites':
        return <SitesView onBack={() => setCurrentView('dashboard')} />;
      case 'guards':
        return <GuardsView onBack={() => setCurrentView('dashboard')} />;
      case 'patrol':
        return <PatrolView onBack={() => setCurrentView('dashboard')} />;
      case 'checkin':
        return <CheckInView onBack={() => setCurrentView('dashboard')} />;
      case 'equipment':
        return <EquipmentView onBack={() => setCurrentView('dashboard')} />;
      case 'billing':
        return <BillingView onBack={() => setCurrentView('dashboard')} />;
      case 'payments':
        return <PaymentsView onBack={() => setCurrentView('dashboard')} />;
      case 'tracking':
        return <TrackingView onBack={() => setCurrentView('dashboard')} />;
      case 'settings':
        return <CompanySettings onBack={() => setCurrentView('dashboard')} />;
      case 'notifications':
        return <NotificationsView onBack={() => setCurrentView('dashboard')} />;
      case 'analytics':
        return <AnalyticsView onBack={() => setCurrentView('dashboard')} />;
      case 'history':
        return <AssignmentHistoryView onBack={() => setCurrentView('dashboard')} />;
      case 'pricing-plans':
        return <PricingPlansView onBack={() => setCurrentView('dashboard')} />;
      case 'leads':
        return <LeadsView onBack={() => setCurrentView('dashboard')} />;
      case 'system-settings':
        return <SystemSettings onBack={() => setCurrentView('dashboard')} />;
      case 'website-cms':
        return <WebsiteCMSSettings onBack={() => setCurrentView('dashboard')} />;
      case 'client-portal':
        return <ClientPortalView onBack={() => setCurrentView('dashboard')} />;
      case 'advanced-scheduling':
        return <AdvancedScheduling onBack={() => setCurrentView('dashboard')} />;
      case 'time-attendance':
        return <TimeAttendance onBack={() => setCurrentView('dashboard')} />;
      case 'invoicing':
        return <InvoicingView onBack={() => setCurrentView('dashboard')} />;
      case 'bus-management':
        return <BusManagementView onBack={() => setCurrentView('dashboard')} />;
      case 'bus-checkin':
        return <BusCheckInView onBack={() => setCurrentView('dashboard')} />;
      case 'bus-tracking':
        return <BusTrackingView onBack={() => setCurrentView('dashboard')} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {renderView()}
    </Layout>
  );
};

const MarketingContent: React.FC<{ onNavigate: (page: string) => void; currentPage: string }> = ({ onNavigate, currentPage }) => {
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <LandingPage onNavigate={onNavigate} />;
      case 'products':
        return <ProductsPage onNavigate={onNavigate} />;
      case 'pricing':
        return <PricingPage onNavigate={onNavigate} />;
      case 'contact':
        return <ContactPage onNavigate={onNavigate} />;
      default:
        return <LandingPage onNavigate={onNavigate} />;
    }
  };

  return (
    <MarketingLayout currentPage={currentPage} onNavigate={onNavigate}>
      {renderPage()}
    </MarketingLayout>
  );
};

const RootApp: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [marketingPage, setMarketingPage] = useState(() => {
    if (window.location.pathname === '/reset-password' || window.location.hash.includes('type=recovery')) {
      return 'reset-password';
    }
    return 'home';
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const handleMarketingNavigate = (page: string) => {
    setMarketingPage(page);
  };

  if (!user || !profile) {
    if (marketingPage === 'reset-password') {
      return <PasswordReset />;
    }
    if (marketingPage === 'company-signup') {
      return <CompanySignup onBack={() => setMarketingPage('login')} />;
    }
    if (marketingPage === 'login') {
      return <LoginPage onNavigateToCompanySignup={() => setMarketingPage('company-signup')} />;
    }
    return <MarketingContent onNavigate={handleMarketingNavigate} currentPage={marketingPage} />;
  }

  return <AppContent />;
};

function App() {
  console.log('App component rendering');
  try {
    return (
      <AuthProvider>
        <OfflineProvider>
          <RootApp />
        </OfflineProvider>
      </AuthProvider>
    );
  } catch (error) {
    console.error('Error in App component:', error);
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Application Error</h1>
          <p className="text-gray-700 mb-4">Failed to load the application. Please check the console for details.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}

export default App;
