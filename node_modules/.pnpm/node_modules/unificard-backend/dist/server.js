"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
exports.startServer = startServer;
// src/server.ts
const fastify_1 = __importDefault(require("fastify"));
const sensible_1 = __importDefault(require("@fastify/sensible"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
// Plugins
const tenant_plugin_1 = __importDefault(require("./plugins/tenant.plugin"));
const auth_plugin_1 = __importDefault(require("@core/auth/auth.plugin"));
const error_handler_plugin_1 = __importDefault(require("./plugins/error-handler.plugin"));
const rbac_plugin_1 = __importDefault(require("./plugins/rbac.plugin"));
// Módulos públicos
const auth_module_1 = __importDefault(require("./core/auth/auth.module"));
const health_module_1 = __importDefault(require("./core/health/health.module"));
// Módulos protegidos - Core
const economy_module_1 = __importDefault(require("./core/economy/economy.module"));
const rbac_module_1 = __importDefault(require("./core/rbac/rbac.module"));
const config_module_1 = __importDefault(require("./core/config/config.module"));
const notify_module_1 = __importDefault(require("./core/notify/notify.module"));
const review_module_1 = __importDefault(require("./core/reviews/review.module"));
const reputation_module_1 = __importDefault(require("./core/reputation/reputation.module"));
const identity_module_1 = __importDefault(require("./core/identity/identity.module"));
const core_module_1 = __importDefault(require("./core/core.module"));
const dashboard_module_1 = __importDefault(require("./core/dashboard/dashboard.module"));
const fund_module_1 = __importDefault(require("./core/economy/fund/fund.module"));
const categories_module_1 = __importDefault(require("./core/categories/categories.module"));
const profile_module_1 = __importDefault(require("./core/profile/profile.module"));
const companies_module_1 = __importDefault(require("./core/companies/companies.module"));
const referral_module_1 = __importDefault(require("./core/referral/referral.module"));
const plan_module_1 = __importDefault(require("./core/plan/plan.module"));
const assistant_module_1 = __importDefault(require("./modules/assistant/assistant.module"));
const social_actions_module_1 = __importDefault(require("./modules/social-actions/social-actions.module"));
// Módulos protegidos - Business
const work_module_1 = __importDefault(require("./modules/work/work.module"));
const rides_module_1 = __importDefault(require("./modules/rides/rides.module"));
const social_module_1 = __importDefault(require("./modules/social/social.module"));
const media_module_1 = __importDefault(require("./modules/media/media.module"));
dotenv_1.default.config();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
async function buildApp() {
    const app = (0, fastify_1.default)({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
            transport: process.env.NODE_ENV !== 'production'
                ? { target: 'pino-pretty', options: { colorize: true } }
                : undefined,
        },
    });
    // ─────────────────────────────────────
    // Plugins globais (todos os escopos)
    // ─────────────────────────────────────
    await app.register(sensible_1.default);
    await app.register(error_handler_plugin_1.default);
    await app.register(cors_1.default, {
        origin: process.env.CORS_ORIGIN || true,
        credentials: true,
    });
    await app.register(helmet_1.default);
    await app.register(rate_limit_1.default, {
        max: 100,
        timeWindow: '1 minute',
    });
    // ─────────────────────────────────────
    // Rotas públicas (sem auth/tenant)
    // ─────────────────────────────────────
    await app.register(auth_module_1.default, { prefix: '/auth' });
    await app.register(health_module_1.default, { prefix: '/health' });
    // Location Module (CEP lookup - público)
    const locationModule = await Promise.resolve().then(() => __importStar(require('./services/location/location.module')));
    await app.register(locationModule.default, { prefix: '/api' });
    // ─────────────────────────────────────
    // Escopo protegido (com auth/tenant)
    // ─────────────────────────────────────
    await app.register(async (protectedScope) => {
        await protectedScope.register(tenant_plugin_1.default);
        await protectedScope.register(auth_plugin_1.default);
        await protectedScope.register(rbac_plugin_1.default);
        // Módulos Core
        await protectedScope.register(economy_module_1.default, { prefix: '/economy' });
        await protectedScope.register(rbac_module_1.default, { prefix: '/rbac' });
        await protectedScope.register(config_module_1.default, { prefix: '/config' });
        await protectedScope.register(notify_module_1.default, { prefix: '/notify' });
        await protectedScope.register(review_module_1.default, { prefix: '/reviews' });
        await protectedScope.register(reputation_module_1.default, { prefix: '/reputation' });
        await protectedScope.register(identity_module_1.default, { prefix: '/identity' });
        await protectedScope.register(core_module_1.default, { prefix: '/core' }); // CORE - fonte única de dados
        await protectedScope.register(dashboard_module_1.default, { prefix: '/dashboard' });
        await protectedScope.register(fund_module_1.default, { prefix: '/fund' });
        await protectedScope.register(categories_module_1.default, { prefix: '/categories' });
        await protectedScope.register(profile_module_1.default, { prefix: '/profile' });
        await protectedScope.register(companies_module_1.default, { prefix: '/companies' });
        await protectedScope.register(plan_module_1.default, { prefix: '/plan' });
        // Matching Humano
        const matchingModule = await Promise.resolve().then(() => __importStar(require('./core/matching/matching.module')));
        await protectedScope.register(matchingModule.default, { prefix: '/matching' });
        // Oportunidades Suaves
        const opportunityModule = await Promise.resolve().then(() => __importStar(require('./core/opportunity/opportunity.module')));
        await protectedScope.register(opportunityModule.default, { prefix: '/opportunities' });
        // UnifyBank - Moeda fictícia de teste e transferências P2P
        const { default: unifybankModule } = await Promise.resolve().then(() => __importStar(require('./core/unifybank/unifybank.module')));
        await protectedScope.register(unifybankModule, { prefix: '/admin' });
        // Registrar também em /bank para endpoints P2P
        await protectedScope.register(unifybankModule, { prefix: '/bank' });
        // Category Review - Revisão de categorias criadas por IA
        const { default: categoryReviewModule } = await Promise.resolve().then(() => __importStar(require('./core/catalog/category-review.module')));
        await protectedScope.register(categoryReviewModule, { prefix: '/admin' });
        await protectedScope.register(referral_module_1.default, { prefix: '/referral' });
        await protectedScope.register(assistant_module_1.default, { prefix: '/assistant' });
        await protectedScope.register(social_actions_module_1.default, { prefix: '/social-actions' });
        await protectedScope.register(media_module_1.default, { prefix: '/media' });
        // Módulos Business
        await protectedScope.register(work_module_1.default, { prefix: '/work' });
        await protectedScope.register(rides_module_1.default, { prefix: '/rides' });
        await protectedScope.register(social_module_1.default, { prefix: '/social' });
        // Feed Contextual (baseado em inferência)
        const contextualFeedModule = await Promise.resolve().then(() => __importStar(require('./core/feed/feed.module')));
        await protectedScope.register(contextualFeedModule.default, { prefix: '/feed' });
        // Feed (read-only) - mantido para compatibilidade
        const feedModule = await Promise.resolve().then(() => __importStar(require('./services/feed/feed.module')));
        await protectedScope.register(feedModule.default, { prefix: '/api/feed' });
        // Event Lifecycle
        const eventsLifecycleModule = await Promise.resolve().then(() => __importStar(require('./services/events/event-lifecycle.routes')));
        await protectedScope.register(eventsLifecycleModule.default, { prefix: '/api/events' });
        // Events Module (CRUD básico)
        const eventsModule = await Promise.resolve().then(() => __importStar(require('./modules/events/events.module')));
        await protectedScope.register(eventsModule.default, { prefix: '/api/events' });
        // Checkout (UnifyCard → UnifyBank)
        const checkoutModule = await Promise.resolve().then(() => __importStar(require('./core/checkout/checkout.module')));
        await protectedScope.register(checkoutModule.default, { prefix: '/api/checkout' });
        // Placeholder para teste
        protectedScope.get('/protected/test', async (req) => {
            return {
                message: 'Protected route working',
                tenant: req.tenant,
                user: req.user,
            };
        });
    });
    return app;
}
async function startServer() {
    // 🔴 INSTRUMENTAÇÃO DE RUNTIME: Logar informações críticas do processo
    console.log('='.repeat(60));
    console.log('🚀 INICIANDO SERVIDOR UNIFICARD');
    console.log('='.repeat(60));
    console.log(`[BOOT] PID: ${process.pid}`);
    console.log(`[BOOT] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[BOOT] HOST: ${HOST}`);
    console.log(`[BOOT] PORT: ${PORT}`);
    console.log(`[BOOT] NODE_VERSION: ${process.version}`);
    console.log(`[BOOT] PLATFORM: ${process.platform}`);
    console.log(`[BOOT] ARCH: ${process.arch}`);
    // 🔴 DIAGNÓSTICO: Logar informações do banco de dados
    const { logDatabaseConnectionInfo, getDatabaseInfo } = await Promise.resolve().then(() => __importStar(require('./core/database/pool')));
    logDatabaseConnectionInfo();
    // Verificar conexão e obter informações detalhadas
    let dbInfo = null;
    try {
        dbInfo = await getDatabaseInfo();
        if (dbInfo) {
            console.log('🔍 INFORMAÇÕES DO BANCO (conectado):');
            console.log(`   Host: ${dbInfo.host}`);
            console.log(`   Porta: ${dbInfo.port}`);
            console.log(`   Database: ${dbInfo.database}`);
            console.log(`   Schema atual: ${dbInfo.currentSchema}`);
            console.log(`   User atual: ${dbInfo.currentUser}`);
            console.log(`   Conexões ativas: ${dbInfo.connectionCount}`);
        }
        else {
            console.warn('⚠️ Não foi possível obter informações do banco de dados');
        }
    }
    catch (error) {
        console.error('❌ Erro ao verificar conexão do banco:', error);
    }
    const app = await buildApp();
    try {
        const address = await app.listen({ port: PORT, host: HOST });
        const actualPort = typeof address === 'string' ? PORT : address.port;
        // 🔴 INSTRUMENTAÇÃO: Logar porta real em uso
        console.log('='.repeat(60));
        console.log('✅ SERVIDOR INICIADO COM SUCESSO');
        console.log('='.repeat(60));
        console.log(`[BOOT] PID: ${process.pid}`);
        console.log(`[BOOT] PORT (real): ${actualPort}`);
        console.log(`[BOOT] URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${actualPort}`);
        console.log(`[BOOT] Health: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${actualPort}/health`);
        if (dbInfo) {
            console.log(`[BOOT] Database: ${dbInfo.host}:${dbInfo.port}/${dbInfo.database}`);
        }
        console.log('='.repeat(60));
        app.log.info(`✅ Servidor iniciado com sucesso!`);
        app.log.info(`🌐 Servidor rodando em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${actualPort}`);
        app.log.info(`💚 Health check disponível em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${actualPort}/health`);
    }
    catch (err) {
        console.error('❌ Erro fatal ao iniciar servidor:');
        if (err instanceof Error) {
            console.error('Mensagem:', err.message);
            console.error('Stack trace:', err.stack);
        }
        else {
            console.error(err);
        }
        process.exit(1);
    }
}
// Executa se chamado diretamente
// 🔴 PROTEÇÃO CONTRA MÚLTIPLAS INSTÂNCIAS
if (require.main === module) {
    // 🔴 INSTRUMENTAÇÃO: Verificar se já existe processo rodando na mesma porta
    const checkPort = async (port) => {
        try {
            const net = await Promise.resolve().then(() => __importStar(require('net')));
            return new Promise((resolve) => {
                const server = net.createServer();
                server.once('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        console.error(`❌ [BOOT] Porta ${port} já está em uso!`);
                        console.error(`   Isso pode indicar múltiplas instâncias do backend rodando.`);
                        console.error(`   PID atual: ${process.pid}`);
                        console.error(`   Execute: Get-Process | Where-Object { $_.Id -eq <PID> }`);
                        resolve(false);
                    }
                    else {
                        resolve(true);
                    }
                });
                server.once('listening', () => {
                    server.close();
                    resolve(true);
                });
                server.listen(port);
            });
        }
        catch {
            return true; // Se não conseguir verificar, continuar
        }
    };
    // Verificar porta antes de iniciar
    checkPort(PORT).then((portAvailable) => {
        if (!portAvailable) {
            console.error('❌ [BOOT] Porta não disponível. Encerrando...');
            process.exit(1);
        }
    });
    // Tratamento de sinais para shutdown limpo
    process.on('SIGTERM', () => {
        console.log(`🛑 [BOOT] SIGTERM recebido (PID: ${process.pid}), encerrando servidor...`);
        process.exit(0);
    });
    process.on('SIGINT', () => {
        console.log(`🛑 [BOOT] SIGINT recebido (PID: ${process.pid}), encerrando servidor...`);
        process.exit(0);
    });
    // Tratamento de erros não capturados
    process.on('uncaughtException', (error) => {
        console.error(`❌ [BOOT] Erro não capturado (PID: ${process.pid}):`, error);
        process.exit(1);
    });
    process.on('unhandledRejection', (reason, promise) => {
        console.error(`❌ [BOOT] Promise rejeitada não tratada (PID: ${process.pid}):`, reason);
        process.exit(1);
    });
    // Iniciar servidor
    startServer().catch((error) => {
        console.error(`❌ [BOOT] Erro fatal ao iniciar servidor (PID: ${process.pid}):`, error);
        process.exit(1);
    });
}
//# sourceMappingURL=server.js.map