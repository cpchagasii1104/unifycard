// src/App.tsx
// App funcional com React Router - 3 Layouts: Social, Bank, Admin
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import SocialLedger from './components/social/SocialLedger';
import CompanyValidationBackoffice from './components/CompanyValidationBackoffice';
import RegionalFundUser from './components/RegionalFundUser';
import ProtectedRoute from './components/auth/ProtectedRoute';
import SocialLayout from './components/layout/SocialLayout';
import BankLayout from './components/layout/BankLayout';
import AdminLayout from './components/layout/AdminLayout';
import { SessionProvider, useSession } from './contexts/SessionProvider';
import FullScreenLoading from './components/FullScreenLoading';
import OnboardingWrapper from './components/onboarding/OnboardingWrapper';
import DashboardPage from './pages/DashboardPage';
import PerfilPage from './pages/PerfilPage';
import EmpresasPage from './pages/EmpresasPage';
import GruposPage from './pages/GruposPage';
import GrupoNovoPage from './pages/GrupoNovoPage';
import GrupoDetailPage from './pages/GrupoDetailPage';
import InvitesPage from './pages/InvitesPage';
import WalletPage from './pages/WalletPage';
import TransactionDetailPage from './pages/TransactionDetailPage';
import SocialProfilePage from './pages/SocialProfilePage';
import SocialCompanyPage from './pages/SocialCompanyPage';
import EventDetailPage from './pages/EventDetailPage';
import EventCreationPage from './pages/EventCreationPage';
import EventosPage from './pages/EventosPage';
import SharePage from './pages/SharePage';
import SocialPage from './pages/SocialPage';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import EmDesenvolvimentoPage from './pages/EmDesenvolvimentoPage';
import VotesPage from './pages/VotesPage';
import AssistantPage from './pages/AssistantPage';
import ServicosPage from './pages/ServicosPage';
import MeusCompromissosPage from './pages/MeusCompromissosPage';
import CompanyDashboardPage from './pages/CompanyDashboardPage';
import PilotObserverPage from './pages/PilotObserverPage';
import MarketplacePage from './pages/MarketplacePage';
import MarketplaceStorePage from './pages/MarketplaceStorePage';
import ProviderConsole from './pages/ProviderConsole';
import UserServiceTracker from './pages/UserServiceTracker';
import PdvPage from './pages/PdvPage';
import AlertsPage from './pages/AlertsPage';
import ContactsPage from './pages/ContactsPage';
import PaymentLinkPage from './pages/PaymentLinkPage'; // SPRINT 86
import CrmPage from './pages/CrmPage'; // SPRINT 88
import CrmContactDetailPage from './pages/CrmContactDetailPage'; // SPRINT 88
import ServiceOrdersPage from './pages/ServiceOrdersPage'; // SPRINT 68
import ServiceOrderDetailPage from './pages/ServiceOrderDetailPage'; // SPRINT 68
import CreateServiceOrderPage from './pages/CreateServiceOrderPage'; // SPRINT 68
import CalendarPage from './pages/CalendarPage'; // SPRINT 68
import OrganizationMembersPage from './pages/OrganizationMembersPage'; // Organization MVP
import OrganizationInvitePage from './pages/OrganizationInvitePage'; // Organization MVP
import OrganizationInvitesPage from './pages/OrganizationInvitesPage'; // Organization MVP
import OrganizationRolesPage from './pages/OrganizationRolesPage'; // Organization MVP
import OrganizationUnitsPage from './pages/OrganizationUnitsPage'; // Organization MVP
import ServicesListPage from './pages/ServicesListPage'; // Services MVP
import ServiceDetailPage from './pages/ServiceDetailPage'; // Services MVP
import ServiceAvailabilityPage from './pages/ServiceAvailabilityPage'; // Services MVP
import ServiceBookingsPage from './pages/ServiceBookingsPage'; // Services MVP
import ServiceBookingRequestsPage from './pages/ServiceBookingRequestsPage'; // Visão do Prestador
import GroupTimelinePage from './pages/GroupTimelinePage'; // Groups MVP
import GroupVotesPage from './pages/GroupVotesPage'; // Groups MVP
import GroupVoteDetailPage from './pages/GroupVoteDetailPage'; // Groups MVP
import GroupCampaignsPage from './pages/GroupCampaignsPage'; // Groups MVP
import GroupCampaignDetailPage from './pages/GroupCampaignDetailPage'; // Groups MVP
import ServiceDiscoveryPage from './pages/ServiceDiscoveryPage'; // Service Discovery MVP
import ServiceDiscoveryDetailPage from './pages/ServiceDiscoveryDetailPage'; // Service Discovery MVP
import SubscriptionsPage from './pages/SubscriptionsPage'; // SPRINT 87
import VenuePublicPage from './pages/VenuePublicPage'; // SPRINT 92
import TabPage from './pages/TabPage'; // SPRINT 92
import LoyaltyPage from './pages/LoyaltyPage'; // SPRINT 93
import UnifiedAgendaPage from './pages/UnifiedAgendaPage';
import CompanyOnboardingPage from './pages/CompanyOnboardingPage';
import CompanyCreationPage from './pages/CompanyCreationPage';
import PayoutDashboardPage from './pages/PayoutDashboardPage';
import PayoutBatchDetailPage from './pages/PayoutBatchDetailPage';
import InvoiceDashboardPage from './pages/InvoiceDashboardPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import FinancialDashboardPage from './pages/FinancialDashboardPage';
// CONGELADO via DECISION-0041 (PREMATURO — aguarda ecossistema risk+trust+evidence em runtime real)
// import RiskCommandCenterPage from './pages/RiskCommandCenterPage';
// CONGELADO via DECISION-0041 (PREMATURO — aguarda ecossistema risk+trust+evidence em runtime real)
// import PolicyManagementPage from './pages/PolicyManagementPage';
import MyOrdersPage from './pages/MyOrdersPage';
import MarketplaceHomePage from './pages/MarketplaceHomePage';
import MarketplaceDomainPage from './pages/MarketplaceDomainPage';
import MarketplaceSegmentPage from './pages/MarketplaceSegmentPage';
import CategoryNavigationPage from './pages/CategoryNavigationPage';
import DepartmentPage from './pages/DepartmentPage';
import StoreOnboardingWizard from './pages/StoreOnboardingWizard';
import CheckoutPage from './pages/CheckoutPage';
import { isAuthenticated } from './config/auth';
import './App.css';
import './styles/global.css';

// Componente wrapper para Login/Register com navegação
function AuthWrapper() {
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login');
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    navigate('/home');
  };

  const handleRegisterSuccess = () => {
    navigate('/home');
  };

  if (currentView === 'register') {
    return (
      <Register
        onRegisterSuccess={handleRegisterSuccess}
        onBackToLogin={() => setCurrentView('login')}
      />
    );
  }

  return (
    <Login
      onLoginSuccess={handleLoginSuccess}
      onGoToRegister={() => setCurrentView('register')}
    />
  );
}

// Listener para navegação para banco via evento customizado
function WalletNavigationListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigateToWallet = () => {
      navigate('/banco');
    };

    window.addEventListener('navigate-to-wallet', handleNavigateToWallet);
    return () => {
      window.removeEventListener('navigate-to-wallet', handleNavigateToWallet);
    };
  }, [navigate]);

  return null;
}

// Componente interno que precisa de SessionProvider
function AppContent() {
  const { authHydrated } = useSession();
  const location = useLocation();

  // Rotas públicas não dependem de hidratação de sessão
  const isPublicRoute = location.pathname.startsWith('/marketplace') || 
                        location.pathname === '/login' || 
                        location.pathname === '/register' ||
                        location.pathname.startsWith('/pay/');

  // Aguardar só até o bootstrap terminar; sem actor válido, layouts mostram UI de bloqueio (não loading infinito)
  if (!authHydrated && !isPublicRoute) {
    return <FullScreenLoading />;
  }

  return (
    <>
      <WalletNavigationListener />
      <OnboardingWrapper>
        <Routes>
          {/* Rotas públicas */}
          <Route 
            path="/login" 
            element={isAuthenticated() ? <Navigate to="/home" replace /> : <AuthWrapper />} 
          />
          <Route 
            path="/register" 
            element={isAuthenticated() ? <Navigate to="/home" replace /> : <AuthWrapper />} 
          />
          {/* SPRINT 86: Payment Links (rota pública) */}
          <Route path="/pay/:slug" element={<PaymentLinkPage />} />
          {/* Motor Canônico: Landing do link compartilhável (rota pública) */}
          <Route path="/share/:entityType/:entityId" element={<SharePage />} />
          {/* Marketplace - Rotas públicas (vitrine READ-ONLY) */}
          <Route path="marketplace" element={<MarketplaceHomePage />} />
          <Route path="marketplace/market" element={<MarketplaceDomainPage />} />
          <Route path="marketplace/services" element={<MarketplaceDomainPage />} />
          <Route path="marketplace/events" element={<MarketplaceDomainPage />} />
          <Route path="marketplace/real-estate" element={<MarketplaceDomainPage />} />
          <Route path="marketplace/vehicles" element={<MarketplaceDomainPage />} />
          <Route path="marketplace/jobs" element={<MarketplaceDomainPage />} />
          <Route path="marketplace/:domain/:segment" element={<MarketplaceSegmentPage />} />
          <Route path="marketplace/department/:departmentId" element={<DepartmentPage />} />
          <Route path="marketplace/c/:path" element={<CategoryNavigationPage />} />

          {/* Rota Home (sem layout - menu não aparece) */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />

          {/* Rota Em Desenvolvimento */}
          <Route
            path="/em-desenvolvimento"
            element={
              <ProtectedRoute>
                <EmDesenvolvimentoPage />
              </ProtectedRoute>
            }
          />

          {/* Rota de Observação de Piloto (apenas em modo piloto) */}
          <Route
            path="/admin/pilot"
            element={
              <ProtectedRoute>
                <PilotObserverPage />
              </ProtectedRoute>
            }
          />

          {/* Rota de Busca */}
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />

          {/* Rotas protegidas - Layout Social (DEFAULT) */}
          <Route
            element={
              <ProtectedRoute>
                <SocialLayout />
              </ProtectedRoute>
            }
          >
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="social" element={<SocialPage />} />
          <Route path="grupos" element={<GruposPage />} />
          <Route path="grupos/:id" element={<GrupoDetailPage />} />
          <Route path="convites" element={<InvitesPage />} />
          <Route path="feed" element={<SocialPage />} />
          <Route path="votacoes" element={<VotesPage />} />
          <Route path="votes" element={<VotesPage />} />
          <Route path="servicos" element={<ServicosPage />} />
          <Route path="agenda-unificada" element={<UnifiedAgendaPage />} />
          <Route path="unified-calendar" element={<UnifiedAgendaPage />} />
          <Route path="impacto" element={<div style={{ padding: '2rem' }}><h1>Impacto</h1><p>Em breve...</p></div>} />
          <Route path="ledger" element={<SocialLedger />} />
          <Route path="profile/:id" element={<SocialProfilePage />} />
          <Route path="company/:id" element={<SocialCompanyPage />} />
          <Route path="empresa/:companyId" element={<CompanyDashboardPage />} />
          <Route path="eventos" element={<EventosPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="empresas" element={<EmpresasPage />} />
          <Route path="companies/new" element={<CompanyCreationPage />} />
          <Route path="empresas/nova" element={<CompanyCreationPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="events/new" element={<EventCreationPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="compromissos" element={<MeusCompromissosPage />} />
          <Route path="meus-compromissos" element={<MeusCompromissosPage />} />
          <Route path="meus-pedidos" element={<MyOrdersPage />} />
          <Route path="my-orders" element={<MyOrdersPage />} />
          <Route path="marketplace/store-onboarding" element={<StoreOnboardingWizard />} />
          <Route path="marketplace/store/:storeId" element={<MarketplaceStorePage />} />
          <Route path="checkout/:checkoutId" element={<CheckoutPage />} />
          <Route path="provider" element={<ProviderConsole />} />
          <Route path="services/track/:requestId" element={<UserServiceTracker />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="pdv" element={<PdvPage />} />
          {/* SPRINT 88: CRM Canônico */}
          <Route path="crm" element={<CrmPage />} />
          {/* SPRINT 68: Service Orders + Agenda */}
          <Route path="service-orders" element={<ServiceOrdersPage />} />
          <Route path="service-orders/new" element={<CreateServiceOrderPage />} />
          <Route path="service-orders/:id" element={<ServiceOrderDetailPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="crm/contacts/:id" element={<CrmContactDetailPage />} />
          {/* SPRINT 87: Assinaturas */}
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          {/* SPRINT 92: Venue (Menu + Tab) */}
          <Route path="v/:slug" element={<VenuePublicPage />} />
          <Route path="t/:qrToken" element={<TabPage />} />
          {/* SPRINT 93: Loyalty / Fidelidade */}
          <Route path="loyalty" element={<LoyaltyPage />} />
          {/* Organization MVP */}
          <Route path="organization/members" element={<OrganizationMembersPage />} />
          <Route path="organization/invites" element={<OrganizationInvitesPage />} />
          <Route path="organization/invites/new" element={<OrganizationInvitePage />} />
          <Route path="organization/roles" element={<OrganizationRolesPage />} />
          <Route path="organization/units" element={<OrganizationUnitsPage />} />
          {/* Services MVP */}
          <Route path="services" element={<ServicesListPage />} />
          <Route path="services/:id" element={<ServiceDetailPage />} />
          <Route path="services/:id/availability" element={<ServiceAvailabilityPage />} />
          <Route path="services/:id/bookings" element={<ServiceBookingsPage />} />
          <Route path="booking-requests" element={<ServiceBookingRequestsPage />} />
          {/* Service Discovery MVP */}
          <Route path="discover/services" element={<ServiceDiscoveryPage />} />
          <Route path="discover/services/:id" element={<ServiceDiscoveryDetailPage />} />
          {/* Groups MVP */}
          <Route path="grupos/:id/timeline" element={<GroupTimelinePage />} />
          <Route path="grupos/:id/votes" element={<GroupVotesPage />} />
          <Route path="grupos/:id/votes/:voteId" element={<GroupVoteDetailPage />} />
          <Route path="grupos/:id/campaigns" element={<GroupCampaignsPage />} />
          <Route path="grupos/:id/campaigns/:campaignId" element={<GroupCampaignDetailPage />} />
        </Route>

        {/* Rotas protegidas - Layout Financeiro (Bank) */}
        <Route
          element={
            <ProtectedRoute>
              <BankLayout />
            </ProtectedRoute>
          }
        >
          <Route path="banco" element={<WalletPage />} />
          <Route path="bank" element={<WalletPage />} />
          <Route path="unifycard" element={<WalletPage />} />
          <Route path="extrato" element={<div style={{ padding: '2rem' }}><h1>Extrato</h1><p>Em breve...</p></div>} />
          <Route path="fundo-regional" element={<RegionalFundUser />} />
          {/* Compatibilidade */}
          <Route path="wallet" element={<WalletPage />} />
          <Route path="fund" element={<RegionalFundUser />} />
          <Route path="transaction/:id" element={<TransactionDetailPage />} />
        </Route>

        {/* Rotas protegidas - Layout Administrativo */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="empresas/:companyId/onboarding" element={<CompanyOnboardingPage />} />
          <Route path="grupos/novo" element={<GrupoNovoPage />} />
          <Route path="validation" element={<CompanyValidationBackoffice />} />
          {/* SPRINT 13: Observação de Piloto */}
          <Route path="admin/pilot" element={<PilotObserverPage />} />
          {/* Compatibilidade */}
          <Route path="dashboard" element={<DashboardPage />} />
          {/* SPRINT 50: Alertas Operacionais */}
          <Route path="alerts" element={<AlertsPage />} />
          {/* Payout Management (Finance/Admin) */}
          <Route path="payouts" element={<PayoutDashboardPage />} />
          <Route path="payouts/batches/:batchId" element={<PayoutBatchDetailPage />} />
          {/* Invoice Management (Finance/Admin) */}
          <Route path="invoices" element={<InvoiceDashboardPage />} />
          <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} />
          {/* Financial & Compliance Dashboard (Finance/Admin) */}
          <Route path="financial-dashboard" element={<FinancialDashboardPage />} />
          {/* Risk & Trust Command Center — CONGELADO via DECISION-0041 (PREMATURO; DT-MODULE-POLICY-ENGINE-PREMATURO-AGUARDA-ECOSSISTEMA-RISK) */}
          {/* <Route path="risk-command-center" element={<RiskCommandCenterPage />} /> */}
          {/* Policy & Enforcement Engine — CONGELADO via DECISION-0041 (PREMATURO; DT-MODULE-POLICY-ENGINE-PREMATURO-AGUARDA-ECOSSISTEMA-RISK) */}
          {/* <Route path="policy-management" element={<PolicyManagementPage />} /> */}
        </Route>
      </Routes>
      </OnboardingWrapper>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </BrowserRouter>
  );
}

export default App;






