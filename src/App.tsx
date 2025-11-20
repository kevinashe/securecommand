import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
import { ProfileSettings } from './components/ProfileSettings';
import { NotificationsView } from './components/NotificationsView';
import { AuditLogsView } from './components/AuditLogsView';
import { AnalyticsView } from './components/AnalyticsView';
import { AssignmentHistoryView } from './components/AssignmentHistoryView';
import { PricingPlansView } from './components/PricingPlansView';
import { LeadsView } from './components/LeadsView';
import { MarketingLayout } from './components/marketing/MarketingLayout';
import { LandingPage } from './components/marketing/LandingPage';
import { ProductsPage } from './components/marketing/ProductsPage';
import { PricingPage } from './components/marketing/PricingPage';
import { ContactPage } from './components/marketing/ContactPage';
import { CompanySignup } from './components/CompanySignup';
import { PasswordReset } from './components/PasswordReset';

const AppContent: React.FC = () => {
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
        return <Dashboard />;
      case 'shifts':
        return <ShiftsView />;
      case 'incidents':
        return <IncidentsView />;
      case 'sos-alerts':
      case 'sos':
        return <SOSView />;
      case 'messages':
        return <MessagesView />;
      case 'companies':
        return <CompaniesView />;
      case 'sites':
        return <SitesView />;
      case 'guards':
        return <GuardsView />;
      case 'patrol':
        return <PatrolView />;
      case 'checkin':
        return <CheckInView />;
      case 'equipment':
        return <EquipmentView />;
      case 'billing':
        return <BillingView />;
      case 'payments':
        return <PaymentsView />;
      case 'tracking':
        return <TrackingView />;
      case 'settings':
        return <CompanySettings />;
      case 'profile':
        return <ProfileSettings />;
      case 'notifications':
        return <NotificationsView />;
      case 'audit-logs':
        return <AuditLogsView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'history':
        return <AssignmentHistoryView />;
      case 'pricing-plans':
        return <PricingPlansView />;
      case 'leads':
        return <LeadsView />;
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
  return (
    <AuthProvider>
      <RootApp />
    </AuthProvider>
  );
}

export default App;
