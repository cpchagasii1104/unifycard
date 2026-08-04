// src/App.tsx
// App funcional com React Router - 3 Layouts: Social, Bank, Admin
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import SocialLedger from './components/social/SocialLedger';
import CompanyValidationBackoffice from './components/CompanyValidationBackoffice';
import KybReviewBackoffice from './admin/KybReviewBackoffice'; // CP2 PJ-B2: backoffice mínimo reviewer KYB
import ServiceCurationQueue from './admin/ServiceCurationQueue'; // F-SERVICE-CURATION-HEAD: fila de curadoria de servico (admin-gated no backend)
import EconomicPoliciesPage from './admin/EconomicPoliciesPage'; // F-ECONOMIC-POLICY-ADMIN-FRONT FATIA 3: tela admin de split economico (admin-gated no backend)
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
import ActorPage from './pages/ActorPage';
import MyPageRedirect from './pages/MyPageRedirect';
import VitrineProfilePage from './pages/VitrineProfilePage';
import EventDetailPage from './pages/EventDetailPage';
import EventCreationPage from './pages/EventCreationPage';
import MeusEventosPage from './pages/MeusEventosPage';
import SupplierRedirect from './pages/SupplierRedirect';
import EventosPage from './pages/EventosPage';
import SharePage from './pages/SharePage';
import SocialPage from './pages/SocialPage';
import HomePage from './pages/HomePage';
import WelcomePage from './pages/WelcomePage';
// Site público pré-login (multi-página, antes do login/cadastro)
import PropostaPage from './pages/public/PropostaPage';
import InvitationAcceptPage from './pages/InvitationAcceptPage';
import SistemaPage from './pages/public/SistemaPage';
import ParaVocePage from './pages/public/ParaVocePage';
import AutogestaoPage from './pages/public/AutogestaoPage';
import ParticiparPage from './pages/public/ParticiparPage';
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
import CrmPage from './pages/CrmPage'; // F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION (Fatia 7)
import ServiceOrdersPage from './pages/ServiceOrdersPage'; // SPRINT 68
import ServiceOrderDetailPage from './pages/ServiceOrderDetailPage'; // SPRINT 68
import OperatorOrdersPage from './pages/OperatorOrdersPage'; // F-MVP-SERVICE-CHAIN-SLICE-1 (GAP-C)
import ServiceLegacyQuarantinePage from './pages/ServiceLegacyQuarantinePage'; // F-MVP-SERVICE-CHAIN-UX-DEAD-END-SWEEP (substitui CreateServiceOrderPage como rota viva)
import CalendarPage from './pages/CalendarPage'; // SPRINT 68
import OrganizationMembersPage from './pages/OrganizationMembersPage'; // Organization MVP
import OrganizationInvitePage from './pages/OrganizationInvitePage'; // Organization MVP
import OrganizationInvitesPage from './pages/OrganizationInvitesPage'; // Organization MVP
import OrganizationRolesPage from './pages/OrganizationRolesPage'; // Organization MVP
import OrganizationUnitsPage from './pages/OrganizationUnitsPage'; // Organization MVP
// F-MVP-SERVICE-CHAIN-PROVIDER-SURFACE-CONSOLIDATION (2026-06-26, opção B): ServicesListPage
// deixou de ser a renderização da rota /services (agora é o hub). Arquivo preservado órfão em
// disco (compatibilidade interna), import removido para manter o typecheck limpo (noUnusedLocals).
import ServiceDetailPage from './pages/ServiceDetailPage'; // Services MVP
// F-MVP-SERVICE-OFFERING-MANAGEMENT-SURFACE-SLICE-A (2026-06-27): porta VIVA de gestão da oferta
// pós-publicação (editar preço/duração + adicionar janela da OFERTA, owner_type='service_offering').
import ServiceOfferingManagePage from './pages/ServiceOfferingManagePage';
// F-MVP-SERVICE-CHAIN-W1-OFFERING-AVAILABILITY-UX-CONTAINMENT (2026-06-27): ServiceAvailabilityPage
// (agenda SERVICE-level via POST /services/:id/availability, owner=service) deixou de ser roteada.
// No MVP a disponibilidade reservável = availability da OFERTA (owner_type='service_offering', lida pelo
// ServiceOfferingSelector). A rota /services/:id/availability vira terminal honesto (Lei da Rota, não do
// botão): contém de uma vez os DOIS vetores que apontavam para a agenda invisível ao consumer
// (ServiceDetailPage "Disponibilidade" + ServiceDiscoveryDetailPage "Ver Disponibilidade Completa").
// ServiceAvailabilityPage fica órfã em disco (compila, não roteada); import removido (noUnusedLocals).
// F-SERVICE-BOOKING-ORPHAN-SURFACE-QUARANTINE (2026-06-26): ServiceBookingsPage deixou de
// renderizar /services/:id/bookings (superfície órfã/oca: chamava PUT /services/:serviceId/
// bookings/:bookingId, rota inexistente → 404). Rota passa a render terminal honesto
// (ServiceLegacyQuarantinePage variant="bookings-manage"). Arquivo preservado órfão em disco;
// client api/service-bookings.ts preservado (usado por modais de eventos/RFQ). Import removido
// para manter o typecheck limpo (noUnusedLocals).
import GroupTimelinePage from './pages/GroupTimelinePage'; // Groups MVP
import GroupVotesPage from './pages/GroupVotesPage'; // Groups MVP
import GroupVoteDetailPage from './pages/GroupVoteDetailPage'; // Groups MVP
import GroupCampaignsPage from './pages/GroupCampaignsPage'; // Groups MVP
import GroupCampaignDetailPage from './pages/GroupCampaignDetailPage'; // Groups MVP
import ServiceDiscoveryPage from './pages/ServiceDiscoveryPage'; // Service Discovery MVP
import ServiceDiscoveryDetailPage from './pages/ServiceDiscoveryDetailPage'; // Service Discovery MVP
import ServiceCreatePage from './pages/ServiceCreatePage'; // F-MVP-SERVICE-CHAIN GAP-1
import ServiceBookingDecisionPage from './pages/ServiceBookingDecisionPage'; // F-MVP-SERVICE-CHAIN GAP-2
import ProviderServiceHubPage from './pages/ProviderServiceHubPage'; // F-MVP-SERVICE-CHAIN GAP-2/3/4 hub
import RentalResourceListPage from './pages/RentalResourceListPage'; // F-RENTAL-RESOURCE-SURFACE-SLICE-B
import OpportunitiesPage from './pages/OpportunitiesPage'; // DECISION-0164 fatia B — motor de demanda
import RentalResourceDetailPage from './pages/RentalResourceDetailPage'; // F-RENTAL-RESOURCE-SURFACE-SLICE-B
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
  const PUBLIC_SITE_PATHS = ['/proposta', '/o-que-da-pra-fazer', '/para-voce', '/autogestao', '/participar'];
  const isPublicRoute = location.pathname === '/' ||
                        location.pathname.startsWith('/marketplace') ||
                        location.pathname === '/login' ||
                        location.pathname === '/register' ||
                        location.pathname.startsWith('/pay/') ||
                        PUBLIC_SITE_PATHS.includes(location.pathname);

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
          {/* Site público pré-login (multi-página). Acessível sem conta; não gate de auth.
              CTAs internos apontam para /login e /register (fluxos existentes, intocados). */}
          <Route path="/proposta" element={<PropostaPage />} />
          <Route path="/o-que-da-pra-fazer" element={<SistemaPage />} />
          <Route path="/para-voce" element={<ParaVocePage />} />
          <Route path="/autogestao" element={<AutogestaoPage />} />
          <Route path="/participar" element={<ParticiparPage />} />
          {/* Marketplace — dentro do shell autenticado (pedido Clayton 2026-07-07; vitrine pública real = /share e vitrine de perfil) */}
          <Route path="marketplace" element={<ProtectedRoute><MarketplaceHomePage /></ProtectedRoute>} />
          <Route path="marketplace/market" element={<ProtectedRoute><MarketplaceDomainPage /></ProtectedRoute>} />
          <Route path="marketplace/services" element={<ProtectedRoute><MarketplaceDomainPage /></ProtectedRoute>} />
          <Route path="marketplace/events" element={<ProtectedRoute><MarketplaceDomainPage /></ProtectedRoute>} />
          <Route path="marketplace/real-estate" element={<ProtectedRoute><MarketplaceDomainPage /></ProtectedRoute>} />
          <Route path="marketplace/vehicles" element={<ProtectedRoute><MarketplaceDomainPage /></ProtectedRoute>} />
          <Route path="marketplace/jobs" element={<ProtectedRoute><MarketplaceDomainPage /></ProtectedRoute>} />
          <Route path="marketplace/:domain/:segment" element={<ProtectedRoute><MarketplaceSegmentPage /></ProtectedRoute>} />
          <Route path="marketplace/department/:departmentId" element={<ProtectedRoute><DepartmentPage /></ProtectedRoute>} />
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
          {/* F-ACTOR-PAGE-SHELL-SLICE-3: casca universal — /profile e /company convergem (Lei §2,
              anti-página-paralela). /vitrine segue à parte (fonte cross-tenant; converge quando o
              contrato ganhar source=global). */}
          <Route path="profile/:id" element={<ActorPage />} />
          <Route path="vitrine/:actorId" element={<VitrineProfilePage />} />
          <Route path="company/:id" element={<ActorPage />} />
          {/* "Minha Página" (menu Conta): resolve o actor ativo → casca */}
          <Route path="minha-pagina" element={<MyPageRedirect />} />
          <Route path="empresa/:companyId" element={<CompanyDashboardPage />} />
          <Route path="eventos" element={<EventosPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="empresas" element={<EmpresasPage />} />
          {/* DECISION-0189 (F5): aceite/recusa de convite de acesso a empresa (token pessoal) */}
          <Route path="convites" element={<InvitationAcceptPage />} />
          {/* β.1 (2026-06-05): criação `company-canonical` APOSENTADA — nascimento PJ é fiscal-first
              (CNPJ + KYB) na tela de Empresas. Rotas legadas redirecionam para o fluxo vivo. */}
          <Route path="companies/new" element={<Navigate to="/empresas" replace />} />
          <Route path="empresas/nova" element={<Navigate to="/empresas" replace />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="events/new" element={<EventCreationPage />} />
          {/* Gestão do organizador (F-EVENT-ORGANIZER-DASHBOARD). Rota SEPARADA de /eventos, que é
              descoberta pública — misturar as duas foi o que fez o organizador não ter onde ver os
              próprios rascunhos. */}
          <Route path="meus-eventos" element={<MeusEventosPage />} />
          {/* 🔴 ABSORVIDA EM 2026-08-04.  era uma página de fornecedor PARALELA —
              a sexta superfície de vendedor do repositório — contra a cláusula anti-página-paralela
              que o próprio ActorPage declara (ele já absorveu as duas telas de perfil/empresa que
              existiam antes; "adicionar vertical = registrar bloco, NUNCA página nova"). Clayton
              apontou o risco antes de eu perceber: "para no MVP a gente não ter uma infinidade de
              páginas para corrigir". ⚠️ Não cite aqui o nome das telas absorvidas: o guard
              `audit-actor-page-contract` proíbe essas strings neste arquivo, e ele está certo —
              nome de página morta em App.tsx é como elas voltam.
              A rota vira REDIRECT em vez de sumir: links já compartilhados continuam chegando ao
              lugar certo — a casca universal, que serve PF, empresa, grupo e banda igualmente. */}
          <Route path="fornecedores/:providerActorId" element={<SupplierRedirect />} />
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
          {/* F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION (Fatia 7): CRM = projeção da aresta de
              relação tipada (clientes/fornecedores/colaboradores) + suppliers reconciliado.
              O antigo módulo crm.* (SPRINT 88, tabelas fantasma) foi removido. */}
          <Route path="crm" element={<CrmPage />} />
          {/* SPRINT 68: Service Orders + Agenda */}
          <Route path="service-orders" element={<ServiceOrdersPage />} />
          {/* F-MVP-SERVICE-CHAIN-UX-DEAD-END-SWEEP (2026-06-26): criação direta de ordem ENCERRADA.
              A ordem nasce só pelo fluxo canônico (reserva → aceite → confirmBookingFromDecision).
              Rota legada vira terminal honesto (quarentena), NÃO formulário de criação direta. */}
          <Route path="service-orders/new" element={<ServiceLegacyQuarantinePage variant="order-create" />} />
          <Route path="service-orders/:id" element={<ServiceOrderDetailPage />} />
          {/* F-MVP-SERVICE-CHAIN-FRONTEND-WIRING-SLICE-1 (GAP-C): operador NÃO-party vê ordens de um
              prestador que lhe concedeu service_order:view (DECISION-0136). Read-only, money-free;
              o backend autoriza por grant (canViewOrderForParty). Detalhe reusa /service-orders/:id. */}
          <Route path="operator/service-orders" element={<OperatorOrdersPage />} />
          <Route path="calendar" element={<CalendarPage />} />
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
          {/* F-MVP-SERVICE-CHAIN-PROVIDER-SURFACE-CONSOLIDATION (2026-06-26, opção B):
              /services é a rota GOVERNADA pelo menu (module-registry 'services') e pelos
              catálogos de projeção — logo ELA absorve o hub operacional. /services passa a
              renderizar a Central do prestador (ProviderServiceHubPage); /provider/services
              vira alias/redirect compatível (abaixo). ServicesListPage fica órfã em disco.
              NÃO tocamos menu/registry backend nem a árvore de gestão /services/:id/*. */}
          <Route path="services" element={<ProviderServiceHubPage />} />
          {/* DECISION-0164 fatia B: motor de demanda — Ver oportunidades / publicar demanda */}
          <Route path="oportunidades" element={<OpportunitiesPage />} />
          {/* F-RENTAL-RESOURCE-SURFACE-SLICE-B: locações deixa de ser STUB (module-registry atualizado) */}
          <Route path="locacoes" element={<RentalResourceListPage />} />
          <Route path="locacoes/:id" element={<RentalResourceDetailPage />} />
          {/* F-MVP-SERVICE-CHAIN GAP-1: publicar serviço/oferta/agenda (estática antes de :id) */}
          <Route path="services/new" element={<ServiceCreatePage />} />
          <Route path="services/:id" element={<ServiceDetailPage />} />
          {/* F-MVP-SERVICE-OFFERING-MANAGEMENT-SURFACE-SLICE-A (2026-06-27): gestão VIVA da oferta
              (preço/duração + janela da OFERTA owner_type='service_offering'). NÃO ressuscita agenda
              service-level; a rota /availability abaixo segue terminal honesto. */}
          <Route path="services/:id/offering" element={<ServiceOfferingManagePage />} />
          {/* F-MVP-SERVICE-CHAIN-W1-OFFERING-AVAILABILITY-UX-CONTAINMENT (2026-06-27): a agenda
              SERVICE-level (owner=service) é invisível ao consumer (que lê owner='service_offering' no
              ServiceOfferingSelector). Decisão de produto soberana (Clayton): no MVP a disponibilidade
              operacional reservável = availability da OFERTA, definida ao publicar o serviço. Esta rota
              vira terminal honesto — NÃO leva mais à criação de availability service-level divergente. */}
          <Route path="services/:id/availability" element={<ServiceLegacyQuarantinePage variant="availability-offering-managed" />} />
          {/* F-SERVICE-BOOKING-ORPHAN-SURFACE-QUARANTINE (2026-06-26): /services/:id/bookings era
              uma superfície ÓRFÃ/OCA — listava e "cancelava" reservas via rota backend inexistente
              (PUT /services/:serviceId/bookings/:bookingId → 404). NÃO é writer vivo concorrente.
              Vira terminal honesto: orienta para /services (Central do prestador) e o fluxo canônico
              de decisão. O cancel canônico vive no core (/availability/bookings/:id) — intocado. */}
          <Route path="services/:id/bookings" element={<ServiceLegacyQuarantinePage variant="bookings-manage" />} />
          {/* F-MVP-SERVICE-CHAIN-UX-DEAD-END-SWEEP (2026-06-26): lista System-A unificada na
              Central do prestador (/provider/services). Rota legada vira terminal honesto. */}
          <Route path="booking-requests" element={<ServiceLegacyQuarantinePage variant="booking-requests" />} />
          {/* F-MVP-SERVICE-CHAIN GAP-2/3/4: decisão canônica da reserva + central do prestador (member-as-company) */}
          <Route path="service-bookings/:bookingId/decision" element={<ServiceBookingDecisionPage />} />
          {/* F-MVP-SERVICE-CHAIN-PROVIDER-SURFACE-CONSOLIDATION (2026-06-26): /provider/services
              vira ALIAS/redirect compatível para /services (superfície soberana). Sem experiência
              divergente, sem lógica duplicada; links antigos continuam funcionando. */}
          <Route path="provider/services" element={<Navigate to="/services" replace />} />
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
          <Route path="admin/curadoria-servicos" element={<ServiceCurationQueue />} />
          {/* F-ECONOMIC-POLICY-ADMIN-FRONT FATIA 3: ajustar split percentages por CIDADE e
              CATEGORIA. Backend completo/selado (Fatias 0/1/2); admin-gated (requireRole+
              economic_policy:manage, 403 honesto se não-admin). */}
          <Route path="admin/economic-policies" element={<EconomicPoliciesPage />} />
          {/* SPRINT 13: Observação de Piloto */}
          <Route path="admin/pilot" element={<PilotObserverPage />} />
          {/* Compatibilidade */}
          <Route path="dashboard" element={<DashboardPage />} />
          {/* DT-MODULE-ALERTS-FANTASMA — ATUALIZADO 2026-07-31 (a razão original morreu neste
              arco; CLAUDE.md §4 manda reverificar bloqueio quando a justificativa vence).
              A tabela `alerts` EXISTE (migration 20260731120000_alerts_substrate.sql, commit
              27c71eb09; unificard_dev em 550 migrations, 9 valores de alert_type vivos) — NÃO
              é mais a causa. O bloqueio HOJE é outro: automation.routes.ts:27-31 devolve 501
              AUTOMATION_SCHEMA_GHOST_CONTAINED em TODA rota /automation/alerts* antes de
              qualquer service (contenção deliberada, F-AUTHORITY-Z2-R8N). AlertsPage abriria e
              quebraria em runtime enquanto isso não mudar. Religar exige: (1) decisão de
              descontingenciar as rotas de alerts especificamente (scheduled_actions segue
              schema-ghost de verdade, contenção continua valendo para essas); (2) reconectar
              automation.routes.ts aos handlers de alertService (hoje só devolvem 501, nunca
              chamam o service); (3) então sim, religar esta rota do frontend. Ato da direção —
              não descomentada por conta própria. */}
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






