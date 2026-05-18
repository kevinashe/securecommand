import React, { Suspense, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CompanySignup } from './components/CompanySignup';
import { PasswordReset } from './components/PasswordReset';
import { MarketingLayout } from './components/marketing/MarketingLayout';
import { LandingPage } from './components/marketing/LandingPage';
import { ProductsPage } from './components/marketing/ProductsPage';
import { PricingPage } from './components/marketing/PricingPage';
import { ContactPage } from './components/marketing/ContactPage';

const ShiftsView = React.lazy(() => import('./components/ShiftsView').then(m => ({ default: m.ShiftsView })));
const IncidentsView = React.lazy(() => import('./components/IncidentsView').then(m => ({ default: m.IncidentsView })));
const SOSView = React.lazy(() => import('./components/SOSView').then(m => ({ default: m.SOSView })));
const MessagesView = React.lazy(() => import('./components/MessagesView').then(m => ({ default: m.MessagesView })));
const CompaniesView = React.lazy(() => import('./components/CompaniesView').then(m => ({ default: m.CompaniesView })));
const BillingView = React.lazy(() => import('./components/BillingView').then(m => ({ default: m.BillingView })));
const SitesView = React.lazy(() => import('./components/SitesView').then(m => ({ default: m.SitesView })));
const GuardsView = React.lazy(() => import('./components/GuardsView').then(m => ({ default: m.GuardsView })));
const EquipmentView = React.lazy(() => import('./components/EquipmentView').then(m => ({ default: m.EquipmentView })));
const PatrolView = React.lazy(() => import('./components/PatrolView').then(m => ({ default: m.PatrolView })));
const CheckInView = React.lazy(() => import('./components/CheckInView').then(m => ({ default: m.CheckInView })));
const TrackingView = React.lazy(() => import('./components/TrackingView').then(m => ({ default: m.TrackingView })));
const PaymentsView = React.lazy(() => import('./components/PaymentsView').then(m => ({ default: m.PaymentsView })));
const CompanySettings = React.lazy(() => import('./components/CompanySettings').then(m => ({ default: m.CompanySettings })));
const NotificationsView = React.lazy(() => import('./components/NotificationsView').then(m => ({ default: m.NotificationsView })));
const AnalyticsView = React.lazy(() => import('./components/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const AssignmentHistoryView = React.lazy(() => import('./components/AssignmentHistoryView').then(m => ({ default: m.AssignmentHistoryView })));
const PricingPlansView = React.lazy(() => import('./components/PricingPlansView').then(m => ({ default: m.PricingPlansView })));
const LeadsView = React.lazy(() => import('./components/LeadsView').then(m => ({ default: m.LeadsView })));
const SystemSettings = React.lazy(() => import('./components/SystemSettings').then(m => ({ default: m.SystemSettings })));
const WebsiteCMSSettings = React.lazy(() => import('./components/WebsiteCMSSettings').then(m => ({ default: m.WebsiteCMSSettings })));
const ClientPortalView = React.lazy(() => import('./components/ClientPortalView').then(m => ({ default: m.ClientPortalView })));
const AdvancedScheduling = React.lazy(() => import('./components/AdvancedScheduling').then(m => ({ default: m.AdvancedScheduling })));
const TimeAttendance = React.lazy(() => import('./components/TimeAttendance').then(m => ({ default: m.TimeAttendance })));
const InvoicingView = React.lazy(() => import('./components/InvoicingView').then(m => ({ default: m.InvoicingView })));
const LogbookView = React.lazy(() => import('./components/LogbookView').then(m => ({ default: m.LogbookView })));
const BusManagementView = React.lazy(() => import('./components/BusManagementView'));
const BusCheckInView = React.lazy(() => import('./components/BusCheckInView'));
const BusTrackingView = React.lazy(() => import('./components/BusTrackingView'));
const ProfileSettings = React.lazy(() => import('./components/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
const SuperAdminDashboard = React.lazy(() => import('./components/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const GuardHubView = React.lazy(() => import('./components/GuardHubView').then(m => ({ default: m.GuardHubView })));
const VisitorManagementView = React.lazy(() => import('./components/VisitorManagementView').then(m => ({ default: m.VisitorManagementView })));
const CertificationTrackingView = React.lazy(() => import('./components/CertificationTrackingView').then(m => ({ default: m.CertificationTrackingView })));
const ReportGeneratorView = React.lazy(() => import('./components/ReportGeneratorView').then(m => ({ default: m.ReportGeneratorView })));
const NotificationPreferencesView = React.lazy(() => import('./components/NotificationPreferencesView').then(m => ({ default: m.NotificationPreferencesView })));

const ViewSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
  </div>
);

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
      case 'logbook':
        return <LogbookView onBack={() => setCurrentView('dashboard')} />;
      case 'bus-management':
        return <BusManagementView onBack={() => setCurrentView('dashboard')} />;
      case 'bus-checkin':
        return <BusCheckInView onBack={() => setCurrentView('dashboard')} />;
      case 'bus-tracking':
        return <BusTrackingView onBack={() => setCurrentView('dashboard')} />;
      case 'guard-hub':
        return <GuardHubView onViewChange={setCurrentView} onBack={() => setCurrentView('dashboard')} />;
      case 'visitors':
        return <VisitorManagementView onBack={() => setCurrentView('dashboard')} />;
      case 'certifications':
        return <CertificationTrackingView onBack={() => setCurrentView('dashboard')} />;
      case 'reports':
        return <ReportGeneratorView onBack={() => setCurrentView('dashboard')} />;
      case 'notification-preferences':
        return <NotificationPreferencesView onBack={() => setCurrentView('dashboard')} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      <ErrorBoundary>
        <Suspense fallback={<ViewSpinner />}>
          {renderView()}
        </Suspense>
      </ErrorBoundary>
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
    <ErrorBoundary fallbackTitle="Application Error">
      <AuthProvider>
        <OfflineProvider>
          <ToastContainer />
          <RootApp />
        </OfflineProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
