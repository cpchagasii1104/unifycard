// src/server.ts
import 'dotenv/config';

// ─────────────────────────────────────────────────────────────
// MARCA D'ÁGUA DE DIAGNÓSTICO
// ─────────────────────────────────────────────────────────────
console.log(
  'RUN TAG:',
  process.env.UNIFICARD_RUN || 'SEM_TAG',
  'PID:',
  process.pid
);
console.log('🔵 [BOOT] server.ts carregado');

// ─────────────────────────────────────────────────────────────
// IMPORTS LEVES (NENHUM DOMÍNIO / DB / EVENTOS AQUI)
// ─────────────────────────────────────────────────────────────
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

// Plugins
import tenantPlugin from './plugins/tenant.plugin';
import authPlugin from '@core/auth/auth.plugin';
import errorHandlerPlugin from './plugins/error-handler.plugin';
import rbacPlugin from './plugins/rbac.plugin';

// Módulos públicos
import authModule from './core/auth/auth.module';
import healthModule from './core/health/health.module';

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

// ─────────────────────────────────────────────────────────────
// BUILD APP (APENAS HTTP + ROTAS)
// ─────────────────────────────────────────────────────────────
export async function buildApp(): Promise<FastifyInstance> {
  console.log('🔵 [BOOT] buildApp()');

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
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });
  await app.register(helmet);
  
  // Rate limit: mais permissivo em desenvolvimento
  const isDevelopment = process.env.NODE_ENV === 'development';
  await app.register(rateLimit, {
    max: isDevelopment ? 1000 : 100, // 1000 requests/min em DEV, 100 em produção
    timeWindow: '1 minute',
    // Em desenvolvimento, permitir mais requisições para facilitar debug
    skipOnError: isDevelopment, // Não bloquear se houver erro no rate limit em DEV
  });

  // Rotas públicas
  await app.register(authModule, { prefix: '/auth' });
  await app.register(healthModule, { prefix: '/health' });

  // Location (import dinâmico)
  const locationModule = await import('./services/location/location.module');
  await app.register(locationModule.default, { prefix: '/api' });

  // Escopo protegido
  await app.register(async (protectedScope) => {
    await protectedScope.register(tenantPlugin);
    await protectedScope.register(authPlugin);
    await protectedScope.register(rbacPlugin);

    // ── IMPORTS DINÂMICOS (DOMÍNIO) ──
    const [
      economyModule,
      rbacModule,
      configModule,
      notifyModule,
      reviewModule,
      reputationModule,
      coreModule,
      dashboardModule,
      fundModule,
      categoriesModule,
      profileModule,
      companiesModule,
      referralModule,
      planModule,
      assistantModule,
      socialActionsModule,
      workModule,
      ridesModule,
      socialModule,
      mediaModule,
      culturalModule,
      votesModule,
      // Feed e Eventos (reintroduzidos)
      feedContextualModule,
      feedLegacyModule,
      eventLifecycleRoutes,
      // Módulos faltantes (reintroduzidos)
      identityModule,
      matchingModule,
      opportunityModule,
      unifybankModule,
      categoryReviewModule,
      checkoutModule,
      eventsModule,
      aiModule,
    ] = await Promise.all([
      import('./core/economy/economy.module'),
      import('./core/rbac/rbac.module'),
      import('./core/config/config.module'),
      import('./core/notify/notify.module'),
      import('./core/reviews/review.module'),
      import('./core/reputation/reputation.module'),
      import('./core/core.module'),
      import('./core/dashboard/dashboard.module'),
      import('./core/economy/fund/fund.module'),
      import('./core/categories/categories.module'),
      import('./core/profile/profile.module'),
      import('./core/companies/companies.module'),
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
      import('./services/events/event-lifecycle.routes'),
      // Módulos faltantes (reintroduzidos)
      import('./core/identity/identity.module'),
      import('./core/matching/matching.module'),
      import('./core/opportunity/opportunity.module'),
      import('./core/unifybank/unifybank.module'),
      import('./core/catalog/category-review.module'),
      import('./core/checkout/checkout.module'),
      import('./modules/events/events.module'),
      import('./core/ai/ai.module'),
    ]);

    await protectedScope.register(economyModule.default, { prefix: '/economy' });
    await protectedScope.register(rbacModule.default, { prefix: '/rbac' });
    await protectedScope.register(configModule.default, { prefix: '/config' });
    await protectedScope.register(notifyModule.default, { prefix: '/notify' });
    await protectedScope.register(reviewModule.default, { prefix: '/reviews' });
    await protectedScope.register(reputationModule.default, { prefix: '/reputation' });
    await protectedScope.register(coreModule.default, { prefix: '/core' });
    await protectedScope.register(dashboardModule.default, { prefix: '/dashboard' });
    await protectedScope.register(fundModule.default, { prefix: '/fund' });
    await protectedScope.register(categoriesModule.default, { prefix: '/categories' });
    await protectedScope.register(profileModule.default, { prefix: '/profile' });
    await protectedScope.register(companiesModule.default, { prefix: '/companies' });
    await protectedScope.register(referralModule.default, { prefix: '/referral' });
    await protectedScope.register(planModule.default, { prefix: '/plan' });
    await protectedScope.register(assistantModule.default, { prefix: '/assistant' });
    await protectedScope.register(socialActionsModule.default, { prefix: '/social-actions' });
    await protectedScope.register(workModule.default, { prefix: '/work' });
    await protectedScope.register(ridesModule.default, { prefix: '/rides' });
    await protectedScope.register(socialModule.default, { prefix: '/social' });
    await protectedScope.register(mediaModule.default, { prefix: '/media' });
    await protectedScope.register(culturalModule.default, { prefix: '/cultural' });
    await protectedScope.register(votesModule.default, { prefix: '/api' });
    await protectedScope.register(aiModule.default, { prefix: '/ai' });
    
    // Feed e Eventos (reintroduzidos)
    await protectedScope.register(feedContextualModule.default, { prefix: '/feed' });
    await protectedScope.register(feedLegacyModule.default, { prefix: '/api/feed' });
    await protectedScope.register(eventLifecycleRoutes.default, { prefix: '/api/events' });
    
    // Módulos faltantes (reintroduzidos)
    await protectedScope.register(identityModule.default, { prefix: '/identity' });
    await protectedScope.register(matchingModule.default, { prefix: '/matching' });
    await protectedScope.register(opportunityModule.default, { prefix: '/opportunities' });
    await protectedScope.register(unifybankModule.default, { prefix: '/bank' });
    await protectedScope.register(unifybankModule.default, { prefix: '/admin' });
    await protectedScope.register(categoryReviewModule.default, { prefix: '/admin' });
    await protectedScope.register(checkoutModule.default, { prefix: '/api/checkout' });
    await protectedScope.register(eventsModule.default, { prefix: '/api/events' });
  });

  return app;
}

// ─────────────────────────────────────────────────────────────
// START SERVER (BOOTSTRAP LINEAR E SEGURO)
// ─────────────────────────────────────────────────────────────
export async function startServer(): Promise<void> {
  console.log('🚀 [BOOT] starting server');

  // Schema Guard: Valida schema mínimo ANTES de iniciar servidor
  const { validateSchemaOrDie } = await import('./core/db/schema-guard');
  await validateSchemaOrDie();

  // Import dinâmico do DB (NUNCA no topo)
  const { getDatabaseInfo, logDatabaseConnectionInfo } =
    await import('./core/database/pool');

  logDatabaseConnectionInfo();

  try {
    await Promise.race([
      getDatabaseInfo(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout (5s)')), 5000)
      ),
    ]);
  } catch (err) {
    console.warn('⚠️ [BOOT] DB indisponível (não bloqueante):', err);
  }

  const app = await buildApp();

  // Registrar handlers de eventos SOMENTE AGORA
  const { registerCoreHandlers } =
    await import('./core/events/register-handlers');
  registerCoreHandlers();

  const address = await app.listen({ port: PORT, host: HOST });

  console.log('='.repeat(60));
  console.log('✅ SERVIDOR INICIADO');
  console.log('='.repeat(60));
  console.log(`[BOOT] PID: ${process.pid}`);
  console.log(`[BOOT] URL: http://localhost:${PORT}`);
  console.log(`[BOOT] HEALTH: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
}

// ─────────────────────────────────────────────────────────────
// ENTRYPOINT
// ─────────────────────────────────────────────────────────────
if (require.main === module) {
  startServer().catch((err) => {
    console.error('❌ [BOOT] erro fatal:', err);
    process.exit(1);
  });
}
