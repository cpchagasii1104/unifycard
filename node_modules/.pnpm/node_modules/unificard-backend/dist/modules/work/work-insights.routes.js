"use strict";
// src/modules/work/work-insights.routes.ts
//
// Rotas de insights do módulo Work
// Endpoints para acessar análises inteligentes baseadas em Memory Engine
Object.defineProperty(exports, "__esModule", { value: true });
const rbac_service_1 = require("@core/rbac/rbac.service");
const work_insights_service_1 = require("./work-insights.service");
const workInsightsRoutes = async (fastify) => {
    /**
     * Helper para validar acesso aos insights
     * - Usuário pode ver seus próprios insights
     * - OWNER ou ADMIN pode ver insights de qualquer usuário
     */
    async function validateInsightsAccess(req, targetUserId) {
        const tenantId = req.tenant.id;
        const currentUserId = req.user.id;
        const userIdToCheck = targetUserId || currentUserId;
        // Se for o próprio usuário, permitir
        if (userIdToCheck === currentUserId) {
            return;
        }
        // Verificar se é OWNER ou ADMIN usando RBAC
        const hasAdminRole = await rbac_service_1.rbacService.userHasAnyRole(tenantId, currentUserId, ['admin', 'owner']);
        if (!hasAdminRole) {
            throw fastify.httpErrors.forbidden('You can only view your own insights. Admin or Owner role required to view other users\' insights.');
        }
    }
    /**
     * GET /work/insights/summary
     * Retorna resumo das últimas sessões de trabalho do usuário
     */
    fastify.get('/summary', {
        preHandler: fastify.requirePermission(['work:insights:read']),
    }, async (req) => {
        const tenantId = req.tenant.id;
        const targetUserId = req.query.userId || req.user.id;
        // Validar acesso
        await validateInsightsAccess(req, targetUserId);
        const limit = req.query.limit ? parseInt(String(req.query.limit)) : 5;
        const summaries = await work_insights_service_1.workInsightsService.getSummary(tenantId, targetUserId, limit);
        return {
            userId: targetUserId,
            summaries,
            count: summaries.length,
        };
    });
    /**
     * GET /work/insights/history
     * Retorna histórico dos últimos jobs do usuário
     */
    fastify.get('/history', {
        preHandler: fastify.requirePermission(['work:insights:read']),
    }, async (req) => {
        const tenantId = req.tenant.id;
        const targetUserId = req.query.userId || req.user.id;
        // Validar acesso
        await validateInsightsAccess(req, targetUserId);
        const limit = req.query.limit ? parseInt(String(req.query.limit)) : 20;
        const history = await work_insights_service_1.workInsightsService.getHistory(tenantId, targetUserId, limit);
        return {
            userId: targetUserId,
            history,
            count: history.length,
        };
    });
    /**
     * GET /work/insights/performance
     * Retorna score de performance do usuário
     */
    fastify.get('/performance', {
        preHandler: fastify.requirePermission(['work:insights:read']),
    }, async (req) => {
        const tenantId = req.tenant.id;
        const targetUserId = req.query.userId || req.user.id;
        // Validar acesso
        await validateInsightsAccess(req, targetUserId);
        const performance = await work_insights_service_1.workInsightsService.getPerformance(tenantId, targetUserId);
        return {
            userId: targetUserId,
            performance,
        };
    });
    /**
     * GET /work/insights/patterns
     * Retorna padrões detectados do trabalho do usuário
     */
    fastify.get('/patterns', {
        preHandler: fastify.requirePermission(['work:insights:read']),
    }, async (req) => {
        const tenantId = req.tenant.id;
        const targetUserId = req.query.userId || req.user.id;
        // Validar acesso
        await validateInsightsAccess(req, targetUserId);
        const patterns = await work_insights_service_1.workInsightsService.getPatterns(tenantId, targetUserId);
        return {
            userId: targetUserId,
            patterns,
        };
    });
};
exports.default = workInsightsRoutes;
