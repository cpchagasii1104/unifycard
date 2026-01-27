"use strict";
// src/core/economy/fund/fund-dashboard.routes.ts
// Rotas para dashboard detalhado do Fundo Regional
Object.defineProperty(exports, "__esModule", { value: true });
const fund_dashboard_service_1 = require("./fund-dashboard.service");
const fundDashboardRoutes = async (fastify) => {
    /**
     * GET /fund/dashboard
     * Retorna dados completos do dashboard do Fundo Regional
     * Inclui: receitas por módulo, custos operacionais, estatísticas
     */
    fastify.get('/dashboard', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { days = '30' } = req.query;
        // Parse days (ex: "30" -> 30)
        const rangeDays = parseInt(days, 10) || 30;
        // Limitar a 365 dias para evitar queries muito pesadas
        const safeRangeDays = Math.min(Math.max(7, rangeDays), 365);
        try {
            const dashboardData = await fund_dashboard_service_1.fundDashboardService.getDashboardData(tenantId, safeRangeDays);
            return reply.send(dashboardData);
        }
        catch (error) {
            const errorMessage = error?.message || error?.originalError?.message || 'Erro desconhecido';
            const errorStack = error?.stack || error?.originalError?.stack;
            fastify.log.error({
                err: error,
                tenantId,
                stack: errorStack,
                message: errorMessage,
                originalError: error?.originalError
            }, 'Erro ao buscar dados do dashboard');
            return reply.status(500).send({
                error: 'Erro ao buscar dados do dashboard do Fundo Regional',
                message: errorMessage,
                ...(process.env.NODE_ENV === 'development' && errorStack ? {
                    stack: errorStack,
                    details: error?.originalError
                } : {}),
            });
        }
    });
};
exports.default = fundDashboardRoutes;
