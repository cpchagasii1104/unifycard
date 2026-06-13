// src/App.tsx
// App funcional com React Router - 3 Layouts: Social, Bank, Admin
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import SocialLedger from './components/social/SocialLedger';
import CompanyValidationBackoffice from './components/CompanyValidationBackoffice';
import KybReviewBackoffice from './admin/KybReviewBackoffice'; // CP2 PJ-B2: backoffice mínimo reviewer KYB
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
import WelcomePage from './pages/WelcomePage';
import SearchPage from './pages/SearchPage';
import EmDesenvolvimentoPage from './pages/EmDesenvolvimentoPage';
import TransparencyPage from './pages/TransparencyPage';
import NotificationsPage from './pages/NotificationsPage';
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
import { isAuthenticated, getTenantId } from './config/auth';
import './App.css';
import './styles/global.css';

// Componente wrapper para Login/Register com navegação
// URL é fonte única do modo (pathname '/register' → Register; demais → Login).
// Sem useState local — evita verdade paralela entre router e estado do componente
// (princípio "Frontend nunca cria verdade", memória 2026-05-19).
function AuthWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentView: 'login' | 'register' =
    location.pathname === '/register' ? 'register' : 'login';

  const handleLoginSuccess = () => navigate('/home');
  // F-REGISTER-PRELAUNCH-BLOCKERS A2: decisão de rota pós-cadastro centralizada aqui
  // (navegação SPA; preserva o bootstrap disparado por auth-changed, sem reload total).
  const handleRegisterSuccess = (opts?: { requiresOnboarding?: boolean }) =>
    navigate(opts?.requiresOnboarding ? '/perfil' : '/home');

  if (currentView === 'register') {
    return (
      <Register
        onRegisterSuccess={handleRegisterSuccess}
        onBackToLogin={() => navigate('/login')}
        onBackToHome={() => navigate('/')}
      />
    );
  }

  return (
    <Login
      onLoginSuccess={handleLoginSuccess}
      onGoToRegister={() => navigate('/register')}
      onBackToHome={() => navigate('/')}
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
  const isPublicRoute = location.pathname === '/' ||
                        location.pathname.startsWith('/marketplace') ||
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
          {/* Start inicial público — antes de login/registro.
              Se autenticado COM tenant, vai direto para /home; senão mostra WelcomePage.
              Check alinhado com ProtectedRoute (par soberano token+tenant) para evitar
              loop /→/home→/login quando há token órfão sem tenant. */}
          <Route
            path="/"
            element={(isAuthenticated() && getTenantId()) ? <Navigate to="/home" replace /> : <WelcomePage />}
          />
          {/* Rotas públicas — mesmo alinhamento do par soberano (token+tenant) */}
          <Route
            path="/login"
            element={(isAuthenticated() && getTenantId()) ? <Navigate to="/home" replace /> : <AuthWrapper />}
          />
          <Route
            path="/register"
            element={(isAuthenticated() && getTenantId()) ? <Navigate to="/home" replace /> : <AuthWrapper />}
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
          {/* DT-PRESSURE-AUTH-CHECK-PARITY-INVARIANT (terceira ocorrência 2026-05-19):
              Route index removido. Pathless parent (<Route> sem path envolvendo
              ProtectedRoute+SocialLayout) + Route index aninhado casava com "/" raiz,
              forçando ProtectedRoute → /login mesmo em aba anônima. O redirect
              /→/home para user autenticado já é coberto por <Route path="/">
              nas linhas 176-179 (par soberano token+tenant). */}
          <Route path="social" element={<SocialPage />} />
          <Route path="grupos" element={<GruposPage />} />
          <Route path="grupos/:id" element={<GrupoDetailPage />} />
          <Route path="convites" element={<InvitesPage />} />
          <Route path="feed" element={<SocialPage />} />
          {/* DT-MODULE-VOTES-FANTASMA (2026-05-16): rotas comentadas — tabelas
              votes/vote_options/vote_responses inexistentes em runtime.
              Restaurar quando migrations + seed criados. */}
          {/* <Route path="votacoes" element={<VotesPage />} /> */}
          {/* <Route path="votes" element={<VotesPage />} /> */}
          <Route path="servicos" element={<ServicosPage />} />
          <Route path="agenda-unificada" element={<UnifiedAgendaPage />} />
          <Route path="unified-calendar" element={<UnifiedAgendaPage />} />
          <Route path="impacto" element={<div style={{ padding: '2rem' }}><h1>Impacto</h1><p>Em breve...</p></div>} />
          {/* Placeholders honestos (DT-UX-GHOST-ROUTE-TRANSPARENCIA / -NOTIFICATIONS): */}
          <Route path="transparencia" element={<TransparencyPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="ledger" element={<SocialLedger />} />
          <Route path="profile/:id" element={<SocialProfilePage />} />
          <Route path="company/:id" element={<SocialCompanyPage />} />
          <Route path="empresa/:companyId" element={<CompanyDashboardPage />} />
          <Route path="eventos" element={<EventosPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="empresas" element={<EmpresasPage />} />
          {/* β.1 (2026-06-05): criação `company-canonical` APOSENTADA — nascimento PJ é fiscal-first
              (CNPJ + KYB) na tela de Empresas. Rotas legadas redirecionam para o fluxo vivo. */}
          <Route path="companies/new" element={<Navigate to="/empresas" replace />} />
          <Route path="empresas/nova" element={<Navigate to="/empresas" replace />} />
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
{/* SPRINT 87: Assinaturas
              DT-MODULE-SUBSCRIPTIONS-FANTASMA (2026-05-16): tabela subscriptions
              ausente em runtime. Rota comentada para evitar HTTP 500 visivel. */}
          {/* <Route path="subscriptions" element={<SubscriptionsPage />} /> */}
          {/* SPRINT 92: Venue (Menu + Tab)
              DT-MODULE-VENUE-FANTASMA (2026-05-16): tabelas tabs/menus/menu_items
              ausentes. Vertical restaurant nao emergiu como prioridade. */}
          {/* <Route path="v/:slug" element={<VenuePublicPage />} /> */}
          {/* <Route path="t/:qrToken" element={<TabPage />} /> */}
          {/* SPRINT 93: Loyalty / Fidelidade
              DT-MODULE-LOYALTY-FANTASMA (2026-05-16): tabelas loyalty_* ausentes. */}
          {/* <Route path="loyalty" element={<LoyaltyPage />} /> */}
          {/* DT-ORGANIZATION-SPRINT78-FROZEN (2026-05-16): 5 rotas Sprint 78 comentadas.
              Tabelas organization_* (4) inexistentes em runtime. Membership consolidado em
              company_users via DECISION-0042. Restaurar se Sprint 78 for descongelada. */}
          {/* <Route path="organization/members" element={<OrganizationMembersPage />} /> */}
          {/* <Route path="organization/invites" element={<OrganizationInvitesPage />} /> */}
          {/* <Route path="organization/invites/new" element={<OrganizationInvitePage />} /> */}
          {/* <Route path="organization/roles" element={<OrganizationRolesPage />} /> */}
          {/* <Route path="organization/units" element={<OrganizationUnitsPage />} /> */}
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
          {/* DT-MODULE-VOTES-FANTASMA (2026-05-16): votes em grupos comentados pelo mesmo motivo
              das rotas votes globais — tabelas inexistentes em runtime. */}
          {/* <Route path="grupos/:id/votes" element={<GroupVotesPage />} /> */}
          {/* <Route path="grupos/:id/votes/:voteId" element={<GroupVoteDetailPage />} /> */}
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
          {/* [MVP-A piloto] /extrato redireciona para a carteira real (saldo + extrato vivem em WalletPage). Sem tela paralela. */}
          <Route path="extrato" element={<Navigate to="/banco" replace />} />
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
          {/* CP2 PJ-B2: backoffice mínimo do reviewer KYB (admin-only no backend; 403 honesto) */}
          <Route path="admin/kyb" element={<KybReviewBackoffice />} />
          {/* SPRINT 13: Observação de Piloto */}
          <Route path="admin/pilot" element={<PilotObserverPage />} />
          {/* Compatibilidade */}
          <Route path="dashboard" element={<DashboardPage />} />
          {/* DT-MODULE-ALERTS-FANTASMA (2026-05-17): SPRINT 50 alertas operacionais.
              AlertsPage chama /automation/alerts → tabela `alerts` ausente em runtime
              (modules/automation já PREMATURO em DT-MODULE-AUTOMATION-PREMATURO).
              Aplicacao DECISION-0041 pattern. */}
          {/* <Route path="alerts" element={<AlertsPage />} /> */}
          {/* DT-MODULE-PAYOUT-FANTASMA (2026-05-17): Payout Management (Finance/Admin).
              Tabelas payout_batches/payout_orders ausentes em runtime. Ecossistema
              settlement/disputes/treasury ainda nao exercitado. Aplicacao DECISION-0041
              pattern (PREMATURO; aguarda ecossistema runtime real). */}
          {/* <Route path="payouts" element={<PayoutDashboardPage />} /> */}
          {/* <Route path="payouts/batches/:batchId" element={<PayoutBatchDetailPage />} /> */}
          {/* DT-MODULE-INVOICING-FANTASMA (2026-05-17): Invoice Management (Finance/Admin).
              Tabelas invoices/invoice_items ausentes em runtime. Ecossistema
              billing/subscription ainda nao exercitado. Aplicacao DECISION-0041 pattern. */}
          {/* <Route path="invoices" element={<InvoiceDashboardPage />} /> */}
          {/* <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} /> */}
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






