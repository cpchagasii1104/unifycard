/**
 * Fastify app wiring only (no listen, workers, or dotenv).
 * Extracted from BOOT.ts — PLANO FASE T.
 */

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import * as path from 'path';

// Plugins
import { tenantPlugin } from './plugins/tenant.plugin';
import authPlugin from './core/auth/auth.plugin';
import { errorHandlerPlugin } from './plugins/error-handler.plugin';
import { rbacPlugin } from './plugins/rbac.plugin';
import { actionContextPlugin } from './plugins/action-context.plugin';

// Módulos públicos
import { authModule } from './core/auth/auth.module';
import { healthModule } from './core/health/health.module';

export async function buildApp(): Promise<FastifyInstance> {
  console.log('[BOOT] Iniciando buildApp()...');
  
  // ─────────────────────────────────────────────────────────────
  // VALIDAÇÃO DE PERMISSÕES CANÔNICAS (FASE 1: ANTES DE TUDO)
  // ─────────────────────────────────────────────────────────────
  try {
    const { validateCanonicalPermissions } = await import('./core/authorization/validate-permissions');
    validateCanonicalPermissions();
  } catch (err) {
    console.error('[BOOT] ❌ ERRO FATAL: Validação de permissões canônicas falhou');
    console.error(err);
    throw err; // builder: no process.exit
  }

  // ─────────────────────────────────────────────────────────────
  // INJEÇÃO DE DEPENDÊNCIAS (FASE 2.1: @modules/social)
  // ─────────────────────────────────────────────────────────────
  try {
    const { socialPortsRegistry } = await import('./core/social/ports-registry');
    const {
      actorRepositoryAdapter,
      actorUtilsAdapter,
      socialRepositoryAdapter,
      socialServiceAdapter,
      eventFeedHandlersAdapter,
    } = await import('./modules/social/adapters');

    // Injetar adapters no registry do core
    socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
    socialPortsRegistry.setActorUtils(actorUtilsAdapter);
    socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
    socialPortsRegistry.setSocialService(socialServiceAdapter);
    socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);

    console.log('[BOOT] ✅ Dependências de @modules/social injetadas no core');
  } catch (err) {
    console.error('[BOOT] ❌ ERRO ao injetar dependências de @modules/social:', err);
    throw err;
  }

  // ─────────────────────────────────────────────────────────────
  // INJEÇÃO DE DEPENDÊNCIAS (FASE 3: @modules/bank)
  // ─────────────────────────────────────────────────────────────
  try {
    const { bankPortsRegistry } = await import('./core/bank/ports-registry');
    const {
      bankAccountAdapter,
      bankTransactionAdapter,
      bankTransactionReadAdapter,
      bankIntegrationAdapter,
      bankLimitAdapter,
    } = await import('./modules/bank/adapters');

    // Injetar adapters no registry do core
    bankPortsRegistry.setBankAccount(bankAccountAdapter);
    bankPortsRegistry.setBankTransaction(bankTransactionAdapter);
    bankPortsRegistry.setBankTransactionRead(bankTransactionReadAdapter);
    bankPortsRegistry.setBankIntegration(bankIntegrationAdapter);
    bankPortsRegistry.setBankLimit(bankLimitAdapter);

    console.log('[BOOT] ✅ Dependências de @modules/bank injetadas no core');
  } catch (err) {
    console.error('[BOOT] ❌ ERRO ao injetar dependências de @modules/bank:', err);
    throw err;
  }

  // ─────────────────────────────────────────────────────────────
  // INJEÇÃO DE DEPENDÊNCIAS (FASE 4: @modules/groups)
  // ─────────────────────────────────────────────────────────────
  try {
    const { groupsPortsRegistry } = await import('./core/groups/ports-registry');
    const { groupsRepositoryAdapter } = await import('./modules/groups/adapters');

    // Injetar adapters no registry do core
    groupsPortsRegistry.setGroupsRepository(groupsRepositoryAdapter);

    console.log('[BOOT] ✅ Dependências de @modules/groups injetadas no core');
  } catch (err) {
    console.error('[BOOT] ❌ ERRO ao injetar dependências de @modules/groups:', err);
    throw err;
  }

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Plugins globais
  await app.register(sensible);
  await app.register(errorHandlerPlugin);
  
  // CORS: Permitir frontend local em desenvolvimento
  const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : true);
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });
  console.log(`[BOOT] CORS configurado: origin=${corsOrigin === true ? 'true (todos)' : corsOrigin}`);
  
  await app.register(helmet);
  
  // Rate limit: mais permissivo em desenvolvimento
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
  await app.register(rateLimit as any, {
    max: isDevelopment ? 5000 : 100, // 5000 requests/min em DEV, 100 em produção
    timeWindow: '1 minute',
    // Em desenvolvimento, permitir mais requisições para facilitar debug
    skipOnError: isDevelopment, // Não bloquear se houver erro no rate limit em DEV
    // Desabilitar rate limit para rotas de bootstrap em DEV
    skip: (req: any) => {
      if (isDevelopment) {
        const path = req.url;
        // Rotas de bootstrap que podem ser chamadas múltiplas vezes
        const bootstrapRoutes = [
          '/dashboard',
          '/identity/wallet',
          '/plan',
          '/referral/code',
          '/social/actors/available',
          '/core/profile',
        ];
        return bootstrapRoutes.some(route => path.startsWith(route));
      }
      return false;
    },
  });

  // Rotas públicas
  await app.register(authModule, { prefix: '/auth' });
  console.log('[BOOT] Rotas de autenticação registradas: /auth/login, /auth/register');
  
  await app.register(healthModule, { prefix: '/health' });
  console.log('[BOOT] Health check registrado: /health');

  // Financial Observability — painel interno (metrics/health/transactions/ledger/audit) + simulador/dashboard/audit export/etc.
  // Nota: financial-observability e financial-health não são registrados aqui — mesmas rotas em financial-operations-panel (evita FST_ERR_DUPLICATED_ROUTE).
  try {
    const financialSimulatorController = (await import('./modules/observability/financial-simulator.controller')).default;
    await app.register(financialSimulatorController, { prefix: '/internal' });
    const financialDashboardController = (await import('./modules/observability/financial-dashboard.controller')).default;
    await app.register(financialDashboardController, { prefix: '/internal' });
    const financialOperationsPanelController = (await import('./modules/observability/financial-operations-panel.controller')).default;
    await app.register(financialOperationsPanelController, { prefix: '/internal' });
    const financialAuditExportController = (await import('./modules/audit/financial-audit-export.controller')).default;
    await app.register(financialAuditExportController, { prefix: '/internal' });
    const financialDisputeController = (await import('./modules/disputes/financial-dispute.controller')).default;
    await app.register(financialDisputeController, { prefix: '/internal' });
    const financialFreezeController = (await import('./modules/freezes/financial-freeze.controller')).default;
    await app.register(financialFreezeController, { prefix: '/internal' });
    const governanceProposalController = (await import('./modules/governance/governance-proposal.controller')).default;
    await app.register(governanceProposalController, { prefix: '/internal' });
    const treasuryAccountController = (await import('./modules/treasury/treasury-account.controller')).default;
    await app.register(treasuryAccountController, { prefix: '/internal' });
    console.log('[BOOT] Treasury Engine registrado');
    console.log('[BOOT] Financial observability registrado: GET /internal/financial/metrics, GET /internal/financial/health, POST /internal/financial/simulate-payment, GET /internal/financial/dashboard, GET /internal/financial/transactions, GET /internal/financial/ledger, GET /internal/financial/audit');
    console.log('[BOOT] Financial Audit Export endpoint registrado');
    console.log('[BOOT] Financial Dispute Engine registrado: POST/GET/PATCH /internal/financial/disputes');
    console.log('[BOOT] Financial Freeze Engine registrado: POST/GET/PATCH /internal/financial/freezes');
  } catch (err) {
    console.warn('[BOOT] Aviso: Erro ao registrar Financial Observability (não bloqueante):', err);
  }

  // Gateway — webhook PIX simulado (adapter → fila)
  try {
    const pixWebhookController = (await import('./modules/gateway/pix-webhook.controller')).default;
    await app.register(pixWebhookController, { prefix: '/gateway' });
    console.log('[BOOT] Gateway PIX webhook simulado: POST /gateway/pix/webhook');
  } catch (err) {
    console.warn('[BOOT] Aviso: Erro ao registrar Gateway PIX (não bloqueante):', err);
  }

  // SPRINT 85 webhook PIX (/webhooks/pix/:provider) — DESCARTADO (DECISION-0154 / F-CAMADA-1-GATE-IDEMPOTENCIA-OUTBOX-G1 / D1).
  // Caminho GHOST/DEAD: dependia da tabela `pix_webhook_events`, que NUNCA foi criada em migrations → quebrava em runtime.
  // Caminho canônico vivo de webhook PIX = `/gateway/pix/webhook` (pix-webhook.controller, acima): HMAC-SHA256 fail-closed
  // + idempotência de ingestão por `gateway_webhook_events` ON CONFLICT (provider, reference_id). Anti-revival:
  // guard `audit-webhook-resolver-idempotency`. NÃO reviver sem migration + decisão.

  // SPRINT 86: Payment Links (rotas públicas)
  try {
    const publicPaymentLinkRoutes = await import('./modules/payments/payment-link.routes');
    await app.register(publicPaymentLinkRoutes.default);
    // SPRINT 92: Venue Public Routes
    const { venuePublicRoutes } = await import('./modules/venue/venue.routes');
    await app.register(venuePublicRoutes);
    console.log('[BOOT] Payment Links públicos registrados: /pay/:slug');
  } catch (err) {
    console.warn('[BOOT] Aviso: Erro ao registrar payment links públicos (não bloqueante):', err);
  }

  // Servir arquivos estáticos de uploads
  const uploadsDir = path.join(process.cwd(), 'uploads');
  await app.register(staticFiles, {
    root: uploadsDir,
    prefix: '/uploads/',
  });
  console.log('[BOOT] Arquivos estáticos de uploads registrados: /uploads/');

  // Marketplace Public Routes (read-only, estático, sem tenant)
  // ORDEM: Após RBAC Guards, antes de rotas protegidas
  try {
    const marketplacePublicRoutes = await import('./modules/marketplace/marketplace-public.routes');
    await app.register(marketplacePublicRoutes.default, { prefix: '/marketplace' });
    const { logMarketplaceLegacyMemoryOrderRoutesBootState } = await import(
      './modules/marketplace/marketplace-legacy-memory-order-flag'
    );
    logMarketplaceLegacyMemoryOrderRoutesBootState();
    console.log('[BOOT] ✅ Marketplace rotas públicas registradas: /marketplace (health, home, templates, categories, stores, regions)');
  } catch (err) {
    console.error('[BOOT] ❌ ERRO FATAL: Falha ao registrar Marketplace rotas públicas');
    console.error(err);
    throw err; // Fail fast - Marketplace é crítico
  }

  // Location Core (read-only, público)
  try {
    const locationRoutes = await import('./core/location/location.routes');
    await app.register(locationRoutes.default, { prefix: '/locations' });
    console.log('[BOOT] Location Core registrado: /locations');
  } catch (err) {
    console.warn('[BOOT] Aviso: Erro ao registrar Location Core (não bloqueante):', err);
  }

  // Reporting Core (denúncias)
  try {
    const reportingRoutes = await import('./core/reporting/reporting.routes');
    await app.register(reportingRoutes.default, { prefix: '/reports' });

    // β.1 (2026-06-05): fluxo `company-canonical` APOSENTADO (DECISION-0081/0085 + decisão de produto
    // de Clayton). Nascimento PJ é fiscal-first (CPF responsável → fiscal_identity/CNPJ → KYB → page-actor),
    // via createCompany (`POST /companies`). NÃO há mais `POST /api/companies/canonical` (CPF-como-empresa
    // não é suportado). Rotas/service `company-canonical.*` removidos; frontend redireciona p/ `/empresas`.
    console.log('[BOOT] Reporting Core registrado: /reports');
  } catch (err) {
    console.warn('[BOOT] Aviso: Erro ao registrar Reporting Core (não bloqueante):', err);
  }

  // Módulo obsoleto src/core/category foi removido - usar src/core/categories (canônico)
  // try {
  //   const categoryRoutes = await import('./core/category/category.routes');
  //   await app.register(categoryRoutes.default, { prefix: '/categories' });
  //   console.log('[BOOT] Category Core registrado: /categories');
  // } catch (err) {
  //   console.warn('[BOOT] Aviso: Erro ao registrar Category Core (não bloqueante):', err);
  // }

  // Location (import dinâmico - legado, se existir)
  try {
    const locationModule = await import('./services/location/location.module');
    await app.register(locationModule.default, { prefix: '/api' });
    console.log('[BOOT] Módulo de localização legado registrado');
  } catch (err) {
    // Ignorar se não existir
  }

  // Escopo protegido
  console.log('[BOOT] Registrando escopo protegido e módulos...');
  await app.register(async (protectedScope) => {
    await protectedScope.register(authPlugin);
    await protectedScope.register(tenantPlugin);
    await protectedScope.register(actionContextPlugin);
    await protectedScope.register(rbacPlugin);
    console.log('[BOOT] Plugins de auth, tenant, action-context e rbac registrados');

    // ── IMPORTS DINÂMICOS (DOMÍNIO) ──
    // Imports individuais para evitar problemas de ordem no Promise.all
    const availabilityImport = await import('./core/availability/availability.module');
    const calendarImport = await import('./core/calendar/unified-calendar.module');
    
    const [
      { economyModule },
      { rbacModule },
      { configModule },
      { notifyModule },
      { reviewModule },
      { reputationModule },
      { coreModule },
      { dashboardModule },
      // { fundModule }, // LEGACY: core/economy/fund desabilitado conforme SSOT_EXCLUSIVE_BANK_RULE.md
      { fundModule },
      { categoriesModule },
      { profileModule },
      { companiesModule },
      { publicationEngineModule },
      { referralModule },
      { planModule },
      { assistantModule },
      { socialActionsModule },
      { workModule },
      { ridesModule },
      { socialModule },
      { mediaModule },
      { culturalModule },
      { votesModule },
      // Feed e Eventos (reintroduzidos)
      { feedContextualModule },
      { feedLegacyModule },
      eventLifecycleRoutes,
      // Módulos faltantes (reintroduzidos)
      { identityModule },
      { matchingModule },
      { opportunityModule },
      { unifybankModule },
      { categoryReviewModule },
      { canonicalProductModule },
      { checkoutModule },
      { eventsModule },
      { eventModule },
      { aiModule },
      // Trust Dashboard (FASE 10)
      trustModule,
      // Grupos
      { groupsModule },
      // Serviços
      { servicesModule },
      // Dashboard Econômico (READ-ONLY)
      { economyOverviewModule },
      // Dispatch de Oportunidades
      { dispatchModule },
      // Inbox Social
      { inboxModule },
    ] = await Promise.all([
      import('./core/economy/economy.module'),
      import('./core/rbac/rbac.module'),
      import('./core/config/config.module'),
      import('./core/notify/notify.module'),
      import('./core/reviews/review.module'),
      import('./core/reputation/reputation.module'),
      import('./core/core.module'),
      import('./core/dashboard/dashboard.module'),
      // import('./core/economy/fund/fund.module'), // LEGACY: desabilitado
      Promise.resolve({ fundModule: async () => {} }),
      import('./core/categories/categories.module'),
      import('./core/profile/profile.module'),
      import('./core/companies/companies.module'),
      import('./core/publication/publication-engine.module'),
      import('./core/referral/referral.module'),
      import('./core/plan/plan.module'),
      import('./modules/assistant/assistant.module'),
      import('./modules/social-actions/social-actions.module'),
      import('./modules/work/work.module'),
      import('./modules/rides/rides.module'),
      import('./modules/social/social.module'),
      import('./modules/media/media.module'),
      import('./modules/cultural/cultural.module'),
      import('./modules/votes/votes.module'),
      // Feed contextual (core)
      import('./core/feed/feed.module'),
      // Feed legado (services)
      import('./services/feed/feed.module'),
      // Event lifecycle (services)
      import('./modules/events/event-lifecycle.routes'),
      // Módulos faltantes (reintroduzidos)
      import('./core/identity/identity.module'),
      import('./core/matching/matching.module'),
      import('./core/opportunity/opportunity.module'),
      import('./core/unifybank/unifybank.module'),
      import('./core/catalog/category-review.module'),
      import('./core/catalog/canonical/canonical-product.module'),
      import('./core/checkout/checkout.module'),
      import('./modules/events/events.module'),
      import('./core/events/event.module'),
      import('./core/ai/ai.module'),
      // Trust Dashboard (FASE 10)
      import('./core/reputation/trust.routes'),
      // Grupos
      import('./modules/groups/groups.module'),
      // Serviços
      import('./modules/services/services.module'),
      // Dashboard Econômico (READ-ONLY)
      import('./modules/economy/economy.module'),
      // Dispatch de Oportunidades
      import('./modules/dispatch/dispatch.module'),
      // Inbox Social
      import('./modules/inbox/inbox.module'),
    ]);
    
    // Extrair módulos dos imports individuais
    const availabilityModule = availabilityImport.availabilityModule;
    const unifiedCalendarModule = calendarImport.unifiedCalendarModule;

    await protectedScope.register(economyModule, { prefix: '/economy' });
    await protectedScope.register(rbacModule, { prefix: '/rbac' });
    // F-ACTOR-CAPABILITY-GRANTS-ENDPOINTS-SLICE-1B (DECISION-0136): gestão de grants por actor. SÓ
    // criar/listar/revogar; ZERO enforcement em rota de negócio. Autoridade = canRepresentActor(scope).
    await protectedScope.register(
      (await import('./modules/authority/actor-capability-grant.routes')).default,
      { prefix: '/authority' }
    );
    await protectedScope.register(configModule, { prefix: '/config' });
    await protectedScope.register(notifyModule, { prefix: '/notify' });
    await protectedScope.register(reviewModule, { prefix: '/reviews' });
    await protectedScope.register(reputationModule, { prefix: '/reputation' });
    await protectedScope.register(coreModule, { prefix: '/core' });
    await protectedScope.register(dashboardModule, { prefix: '/dashboard' });
    await protectedScope.register(fundModule, { prefix: '/fund' });
    await protectedScope.register(categoriesModule, { prefix: '/categories' });
    const { default: navigationRoutes } = await import('./core/navigation/navigation.routes');
    await protectedScope.register(navigationRoutes, { prefix: '/navigation' });
    const { default: intentDraftRoutes } = await import('./core/intent/intent-draft.routes');
    await protectedScope.register(intentDraftRoutes, { prefix: '/intent' });
    const { default: intentExecuteRoutes } = await import('./core/intent/intent-execute.routes');
    await protectedScope.register(intentExecuteRoutes, { prefix: '/intent' });
    await protectedScope.register(profileModule, { prefix: '/profile' });
    await protectedScope.register(companiesModule, { prefix: '/companies' });
    await protectedScope.register(publicationEngineModule);
    await protectedScope.register(referralModule, { prefix: '/referral' });
    await protectedScope.register(planModule, { prefix: '/plan' });
    await protectedScope.register(assistantModule, { prefix: '/assistant' });
    await protectedScope.register(socialActionsModule, { prefix: '/social-actions' });
    await protectedScope.register(workModule, { prefix: '/work' });
    await protectedScope.register(ridesModule, { prefix: '/rides' });
    await protectedScope.register(socialModule, { prefix: '/social' });
    
    // Rotas de relacionamentos sociais e grupos leves
    const { socialRelationshipsRoutes } = await import('./modules/social/social-relationships.routes');
    const { socialGroupsLightRoutes } = await import('./modules/social/social-groups-light.routes');
    await protectedScope.register(socialRelationshipsRoutes, { prefix: '/social' });
    await protectedScope.register(socialGroupsLightRoutes, { prefix: '/social/groups-light' });

    // 2026-05-18 P1 — Capability Resolver MVP (read-only aggregation)
    // GET /actors/:actorId/capabilities
    // Vinculado a memória project_home_contextual_modelo_2026-05-18.md (P1).
    const actorCapabilitiesRoutes = (await import('./core/actor-capabilities/actor-capabilities.routes')).default;
    await protectedScope.register(actorCapabilitiesRoutes, { prefix: '/actors' });

    // 2026-05-18 P2 — Índice de Coordenação Humana (semente)
    // GET /actors/:actorId/recent-counterparts (read-only, agrega bank_splits)
    // Vinculado a memória project_home_contextual_modelo_2026-05-18.md (P2 item 1).
    const recentCounterpartsRoutes = (await import('./core/actor-coordination/recent-counterparts.routes')).default;
    await protectedScope.register(recentCounterpartsRoutes, { prefix: '/actors' });

    // 2026-05-18 P2 — Home Feed multi-vetor v1 (composer)
    // GET /actors/:actorId/home-feed (read-only, 3 vetores: Compromisso + Convite + Recorrência)
    // Vinculado a memória project_home_contextual_modelo_2026-05-18.md (P2 itens 2 e 6).
    const homeFeedRoutes = (await import('./core/home-feed/home-feed.routes')).default;
    await protectedScope.register(homeFeedRoutes, { prefix: '/actors' });

    // 2026-05-18 P2 — Profile Inference MVP (interesses inferidos)
    // GET /actors/:actorId/inferred-profile (read-only, event affinities + communities)
    // Vinculado a memória project_home_contextual_modelo_2026-05-18.md (P2 item 3, §C).
    const profileInferenceRoutes = (await import('./core/profile-inference/profile-inference.routes')).default;
    await protectedScope.register(profileInferenceRoutes, { prefix: '/actors' });

    // 2026-05-19 — DECISION-0030 (F4): localização ativa do actor (user-facing).
    // POST/DELETE/GET /me/active-location — set/clear/read da localização contextual.
    // Vinculado a memória project_localizacao_pilar_soberano.md + plano feed geo.
    const meActiveLocationRoutes = (await import('./core/location/me-active-location.routes')).default;
    await protectedScope.register(meActiveLocationRoutes, { prefix: '/me' });

    await protectedScope.register(mediaModule, { prefix: '/media' });
    await protectedScope.register(culturalModule, { prefix: '/cultural' });
    await protectedScope.register(votesModule, { prefix: '/api' });
    await protectedScope.register(aiModule, { prefix: '/ai' });
    
    // Feed e Eventos (reintroduzidos)
    await protectedScope.register(feedContextualModule, { prefix: '/feed' });
    await protectedScope.register(feedLegacyModule, { prefix: '/api/feed' });
    // 🔴 NOTA: eventLifecycleRoutes e eventsModule ambos usam /api/events
    // eventLifecycleRoutes: rotas de lifecycle (publish, schedule, tickets)
    // eventsModule: rotas principais de CRUD de eventos
    // Ambos podem coexistir se rotas não conflitarem
    await protectedScope.register(eventLifecycleRoutes.default, { prefix: '/api/events' });
    
    // Módulos faltantes (reintroduzidos)
    await protectedScope.register(identityModule, { prefix: '/identity' });
    await protectedScope.register(matchingModule, { prefix: '/matching' });
    await protectedScope.register(opportunityModule, { prefix: '/opportunities' });
    await protectedScope.register(unifybankModule, { prefix: '/bank' });
    await protectedScope.register(unifybankModule, { prefix: '/admin' });
    await protectedScope.register(categoryReviewModule, { prefix: '/admin' });
    await protectedScope.register(canonicalProductModule, { prefix: '/catalog/products' });

    // DECISION-0117 — sugestão empresarial + curadoria humana do catálogo canônico
    const { default: catalogGovernanceRoutes } = await import('./core/catalog/catalog-governance.routes');
    await protectedScope.register(catalogGovernanceRoutes, { prefix: '/catalog/governance' });

    // DECISION-0117 C — mídia canônica content-addressed (assets + relações + complemento empresarial)
    const { default: mediaAssetsRoutes } = await import('./core/media-assets/media-assets.routes');
    await protectedScope.register(mediaAssetsRoutes, { prefix: '/catalog/media' });

    // 2026-07-07 (Clayton) — catálogo GOVERNADO marca/modelo de veículo (capacidade transversal:
    // rides + locação + venda + peças automotivas reutilizam a MESMA fonte, sem texto livre).
    const { default: vehicleCatalogRoutes } = await import('./core/catalog/vehicle-catalog.routes');
    await protectedScope.register(vehicleCatalogRoutes, { prefix: '/catalog/vehicles' });

    // DECISION-0117 E — templates empresariais versionados (aplicação manual-assistida)
    const { default: companyTemplatesRoutes } = await import('./core/companies/company-templates.routes');
    await protectedScope.register(companyTemplatesRoutes, { prefix: '/companies' });

    // DECISION-0117 A/D (CP4) — ativação de variante canônica + ofertas empresariais
    const { default: marketplaceOfferingsRoutes } = await import('./modules/marketplace/marketplace-offerings.routes');
    await protectedScope.register(marketplaceOfferingsRoutes, { prefix: '/marketplace' });
    const { default: serviceOfferingsRoutes } = await import('./modules/services/service-offerings.routes');
    await protectedScope.register(serviceOfferingsRoutes, { prefix: '/services' });

    // DECISION-0117 F (CP5) — projeção do menu de módulos + busca agrupada por identidade canônica
    const { default: moduleProjectionRoutes } = await import('./core/navigation/module-projection.routes');
    await protectedScope.register(moduleProjectionRoutes, { prefix: '/navigation' });
    const { default: marketplaceCanonicalSearchRoutes } = await import('./modules/marketplace/marketplace-canonical-search.routes');
    await protectedScope.register(marketplaceCanonicalSearchRoutes, { prefix: '/marketplace' });


    const { featureFlagsService } = await import('./core/config/feature-flags.service');
    if (featureFlagsService.isProcurementCampaignEnabled()) {
      const { procurementCampaignModule } = await import(
        './core/procurement-campaign/procurement-campaign.module'
      );
      await protectedScope.register(procurementCampaignModule, { prefix: '/procurement' });
      protectedScope.log.info('[BOOT] Procurement campaign (fase neutra): /procurement');
    }

    // Distribuição canónica: economy.module já regista distribution em /economy/distribution (evitar duplicar /distribution).

    // Rotas admin SSOT (observabilidade)
    const { default: ssotAdminRoutes } = await import('./core/categories/ssot-admin.routes');
    await protectedScope.register(ssotAdminRoutes, { prefix: '/admin/ssot' });
    await protectedScope.register(checkoutModule, { prefix: '/api/checkout' });
    // 🔴 NOTA: eventsModule registrado em /api/events (pode conflitar com eventLifecycleRoutes)
    // Verificar se há rotas duplicadas e consolidar se necessário
    await protectedScope.register(eventsModule, { prefix: '/api/events' });
    await protectedScope.register(eventModule, { prefix: '/api/events' });
    // Trust Dashboard (FASE 10)
    await protectedScope.register(trustModule.default, { prefix: '/api/trust' });
    // Grupos
    await protectedScope.register(groupsModule, { prefix: '/groups' });
    // Serviços
    await protectedScope.register(servicesModule, { prefix: '/services' });
    // Human MVP
    const { default: humanMvpRoutes } = await import('./modules/human-mvp/human-mvp.routes');
    await protectedScope.register(humanMvpRoutes, { prefix: '/human-mvp' });
    protectedScope.log.info('[BOOT] Human MVP Routes registrado: /human-mvp');
    
    // Mensageria Contextual
    const contextualMessagingModule = await import('./modules/contextual-messaging/contextual-messaging.module');
    await protectedScope.register(contextualMessagingModule.default);

    // Negociação Assistida e Registro de Acordos
    const agreementsModule = await import('./modules/agreements/agreements.module');
    await protectedScope.register(agreementsModule.default);

    // Evidências & Resolução de Disputas
    const evidenceModule = await import('./modules/evidence/evidence.module');
    await protectedScope.register(evidenceModule.default);

    // Pagamentos com Escrow e Marcos de Execução
    const escrowModule = await import('./modules/escrow/escrow.module');
    await protectedScope.register(escrowModule.default);

    // Trust & Integrity Engine
    // trustModule já foi importado e registrado anteriormente na linha 455 com prefixo '/api/trust'

    // Ledger Contábil Canônico
    const ledgerModule = await import('./modules/ledger/ledger.module');
    await protectedScope.register(ledgerModule.default);

    // Payout Engine
    const payoutModule = await import('./modules/payout/payout.module');
    await protectedScope.register(payoutModule.default);

    // Invoice Engine
    const invoiceModule = await import('./modules/invoicing/invoice.module');
    await protectedScope.register(invoiceModule.default);

    // Reporting Institucional
    const reportingModule = await import('./modules/reporting/reporting.module');
    await protectedScope.register(reportingModule.default);

    // Risk & Trust Command Center
    const riskCommandCenterModule = await import('./modules/risk-command-center/risk-command-center.module');
    await protectedScope.register(riskCommandCenterModule.default);

    // Policy & Enforcement Engine
    const policyEngineModule = await import('./modules/policy-engine/policy-engine.module');
    await protectedScope.register(policyEngineModule.default);

    // My Orders & Purchases Hub
    const myOrdersModule = await import('./modules/my-orders/my-orders.module');
    await protectedScope.register(myOrdersModule.default);

    // 🔵 F-GLOBAL-SEARCH-OMNI — busca federada (omnibox): GET /search?q= (§9.3 nomenclatura).
    // READ-ONLY; federa readers canônicos existentes (Lei de Coerência — zero verdade paralela).
    const searchModule = await import('./modules/search/search.module');
    await protectedScope.register(searchModule.default, { prefix: '/search' });

    // 🔵 F-RENTAL-RESOURCE-SURFACE-SLICE-A (DECISION-0151/0159) — registro de recurso alugável.
    // Availability/booking/confirm já são genéricos por owner_type='rentable_resource' (sem
    // mudança); esta é a única peça HTTP que faltava. Money-free (DECISION-0151 §D).
    const rentalsModule = await import('./modules/rentals/rentals.module');
    await protectedScope.register(rentalsModule.default);

    // 🔵 F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3 — VENDA asset-first (bem durável individual, PF e PJ via
    // canRepresentActor; NÃO products/product_offers). Δbank=0 (preço=anúncio). Módulo próprio (D-ζ).
    const assetSaleModule = await import('./modules/asset-sale/asset-sale.module');
    await protectedScope.register(assetSaleModule.default);

    // 🔵 F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B — SERVICE_USE / uso operacional, substrato mínimo (adendo
    // RFC_ASSET_SERVICE_USE_OPERATIONAL_ADENDO). v1 = dono-operador; terceiro-operador = Fatia 4C (fora).
    const assetServiceUseModule = await import('./modules/asset-service-use/asset-service-use.module');
    await protectedScope.register(assetServiceUseModule.default);
    console.log('[BOOT] Contextual Messaging module registered');
    
    // Notificações In-App
    const systemNotificationsModule = await import('./modules/system-notifications/system-notifications.module');
    await protectedScope.register(systemNotificationsModule.default);
    console.log('[BOOT] System Notifications module registered');
    
    // Auditoria de Negócio
    const businessAuditModule = await import('./modules/business-audit/business-audit.module');
    await protectedScope.register(businessAuditModule.default);
    console.log('[BOOT] Business Audit module registered');
    
    // Autorização de Negócio
    const businessAuthorizationModule = await import('./core/authorization/business-authorization.module');
    await protectedScope.register(businessAuthorizationModule.default);
    console.log('[BOOT] Business Authorization module registered');
    // Dashboard Econômico (READ-ONLY)
    await protectedScope.register(economyOverviewModule, { prefix: '/economy' });
    // Dispatch de Oportunidades
    await protectedScope.register(dispatchModule, { prefix: '/dispatch' });
    // Inbox Social
    await protectedScope.register(inboxModule, { prefix: '/inbox' });
    // Unified Availability Core
    await protectedScope.register(availabilityModule, { prefix: '/availability' });
    // Unified Calendar
    await protectedScope.register(unifiedCalendarModule);
    // Compatibility Engine
    const compatibilityModule = await import('./core/compatibility/compatibility.module');
    await protectedScope.register(compatibilityModule.default);
    console.log('[BOOT] Compatibility module registered');
    // SPRINT 13: Piloto Controlado & Observação Silenciosa
    const pilotEventsModule = await import('./core/pilot/pilot-events.routes');
    await protectedScope.register(pilotEventsModule.default, { prefix: '/admin/pilot' });
    // SPRINT 14: Piloto Humano Controlado - Convites
    const pilotInvitesModule = await import('./core/pilot/pilot-invites.routes');
    await protectedScope.register(pilotInvitesModule.default, { prefix: '/admin/pilot' });
    // SPRINT 15: Piloto Vivo - Observação Humana
    const pilotHumanObservationModule = await import('./core/pilot/pilot-human-observation.routes');
    await protectedScope.register(pilotHumanObservationModule.default, { prefix: '/admin/pilot' });
    // SPRINT 26: Memória Institucional Declarativa
    const institutionalMemoryModule = await import('./core/pilot/institutional-memory.routes');
    await protectedScope.register(institutionalMemoryModule.default, { prefix: '/admin/pilot' });
    // SPRINT 41.1: Marketplace Operável
    // ORDEM: Após RBAC Guards (linha 277), após rotas públicas (linha 224)
    try {
      const marketplaceModule = await import('./modules/marketplace/marketplace.routes');
      await protectedScope.register(marketplaceModule.default, { prefix: '/marketplace' });
      
      // Marketplace Categories (canônico, consome CORE)
      const marketplaceCategoriesRoutes = await import('./modules/marketplace/marketplace-categories.routes');
      await protectedScope.register(marketplaceCategoriesRoutes.default);
      
      // Marketplace Search (ranking determinístico)
      const marketplaceSearchRoutes = await import('./modules/marketplace/marketplace-search.routes');
      await protectedScope.register(marketplaceSearchRoutes.default);

      const marketplaceContextualRoutes = await import('./modules/marketplace/marketplace-contextual.routes');
      await protectedScope.register(marketplaceContextualRoutes.default);
      
      // Marketplace Store Onboarding
      const storeOnboardingRoutes = await import('./modules/marketplace/store-onboarding.routes');
      await protectedScope.register(storeOnboardingRoutes.default);
      console.log('[BOOT] ✅ Marketplace rotas protegidas registradas: /marketplace (orders, payments, delivery, …); PDV canónico: /pdv');
    } catch (err) {
      console.error('[BOOT] ❌ ERRO FATAL: Falha ao registrar Marketplace rotas protegidas');
      console.error(err);
      throw err; // Fail fast - Marketplace é crítico
    }
    // SPRINT 42.1: PDV Core
    const pdvModule = await import('./modules/pdv/pdv.routes');
    await protectedScope.register(pdvModule.default, { prefix: '/pdv' });
    console.log('[BOOT] PDV module registered: /pdv');
    // SPRINT 46: Relatórios Operacionais
    const reportsModule = await import('./modules/reports/reports.routes');
    await protectedScope.register(reportsModule.default, { prefix: '/reports' });
    console.log('[BOOT] Reports module registered: /reports');
    const reconciliationDisputeRoutes = await import(
      './modules/reconciliation/reconciliation-dispute.routes'
    );
    await protectedScope.register(reconciliationDisputeRoutes.default, { prefix: '/reconciliation' });
    console.log('[BOOT] Reconciliation disputes registered: /reconciliation/disputes/*');
    // SPRINT 50: Automações Operacionais
    const automationModule = await import('./modules/automation/automation.routes');
    await protectedScope.register(automationModule.default, { prefix: '/automation' });
    console.log('[BOOT] Automation module registered: /automation');
    // SPRINT 51: Multi-empresa, Filiais e Consolidação
    const organizationModule = await import('./modules/organization/organization.routes');
    await protectedScope.register(organizationModule.default, { prefix: '/organization' });
    console.log('[BOOT] Organization module registered: /organization');
    // SPRINT 79: Páginas Públicas
    const publicProfileModule = await import('./modules/public-profiles/public-profile.routes');
    await protectedScope.register(publicProfileModule.default);
    console.log('[BOOT] Public Profiles module registered: /public-profiles');
    // F-ACTOR-RELATIONSHIP-TYPED-EDGE-SLICE-1: aresta de relação tipada (social+CRM+B2B; relação≠autoridade)
    const actorRelationshipModule = await import('./modules/relationships/actor-relationship.routes');
    await protectedScope.register(actorRelationshipModule.default);
    console.log('[BOOT] Actor Relationships module registered: /relationships');
    // DECISION-0164 (fatia A): DEMANDA de serviço — motor de orquestração (Δbank=0; catraca 0113)
    const demandModule = await import('./modules/demands/demand.routes');
    await protectedScope.register(demandModule.default);
    console.log('[BOOT] Service Demands module registered: /demands');
    // F-ACTOR-RELATIONSHIP-MEMBERSHIP-BRIDGE-SLICE-2: ponte colaborador→autoridade (grant = ato do dono
    // canManageCompany, roteado pro fluxo vivo de membros/company_users — aceite social não concede poder)
    const relationshipBridgeModule = await import('./modules/relationships/actor-relationship-membership-bridge.routes');
    await protectedScope.register(relationshipBridgeModule.default);
    console.log('[BOOT] Relationship membership bridge registered: /relationships/:id/grant-membership');
    // F-ACTOR-PAGE-SHELL-SLICE-3: contrato server-driven da página do actor (casca universal + blocos)
    const actorPageModule = await import('./modules/actor-page/actor-page.routes');
    await protectedScope.register(actorPageModule.default);
    console.log('[BOOT] Actor Page contract registered: /actor-page/:actorId');
    // F-COMPOSER-CONTRACT-C1: contrato server-driven do COMPOSITOR (write-side; enumera atos criáveis)
    const composerModule = await import('./modules/composer/composer.routes');
    await protectedScope.register(composerModule.default);
    console.log('[BOOT] Composer contract registered: /composer/contract');
    // F-VISIBILITY-CAPABILITY: fonte ÚNICA de opções de plateia (Clayton 2026-07-07) — deriva de
    // PAIR_ALLOWED_LABELS por actor_type; consumido por posts/demanda/evento/locação (mata os hardcodes).
    const audienceModule = await import('./core/audience/audience.routes');
    await protectedScope.register(audienceModule.default);
    console.log('[BOOT] Audience options (transversal) registered: /audience-options');
    // F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6): Chamado gated por fato de negócio real
    const supportTicketModule = await import('./modules/support-tickets/support-ticket.routes');
    await protectedScope.register(supportTicketModule.default);
    console.log('[BOOT] Support Tickets (Chamado) registered: /support-tickets');

    console.log('[BOOT] Todos os módulos protegidos registrados');
  });
  
  console.log('[BOOT] buildApp() concluído com sucesso');
  return app;
}