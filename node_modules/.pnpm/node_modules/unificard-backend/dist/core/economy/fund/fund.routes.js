"use strict";
// src/core/economy/fund/fund.routes.ts
// Rotas READ-ONLY para visibilidade do Fundo Regional
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fund_visibility_service_1 = require("./fund-visibility.service");
const fund_dashboard_routes_1 = __importDefault(require("./fund-dashboard.routes"));
const fundRoutes = async (fastify) => {
    /**
     * GET /fund/summary
     */
    fastify.get('/summary', async (req, reply) => {
        try {
            const tenantId = req.tenant.id;
            const summary = await fund_visibility_service_1.fundVisibilityService.getSummary(tenantId);
            return reply.send(summary);
        }
        catch (error) {
            const errorMessage = error?.message || 'Erro desconhecido';
            fastify.log.error({ err: error, route: '/fund/summary' }, 'Erro ao buscar resumo do fundo');
            return reply.status(500).send({
                error: 'Erro ao buscar resumo do fundo regional',
                message: errorMessage,
                ...(process.env.NODE_ENV === 'development' ? { stack: error?.stack } : {}),
            });
        }
    });
    /**
     * GET /fund/history?days=30
     */
    fastify.get('/history', async (req, reply) => {
        try {
            const tenantId = req.tenant.id;
            const { days = '30' } = req.query;
            const rangeDays = parseInt(days, 10) || 30;
            const safeRangeDays = Math.min(Math.max(1, rangeDays), 365);
            const history = await fund_visibility_service_1.fundVisibilityService.getHistory(tenantId, safeRangeDays);
            return reply.send(history);
        }
        catch (error) {
            const errorMessage = error?.message || 'Erro desconhecido';
            fastify.log.error({ err: error, route: '/fund/history' }, 'Erro ao buscar histórico do fundo');
            return reply.status(500).send({
                error: 'Erro ao buscar histórico do fundo regional',
                message: errorMessage,
                ...(process.env.NODE_ENV === 'development' ? { stack: error?.stack } : {}),
            });
        }
    });
    /**
     * GET /fund/projection
     */
    fastify.get('/projection', async (req, reply) => {
        try {
            const tenantId = req.tenant.id;
            const projection = await fund_visibility_service_1.fundVisibilityService.getProjection(tenantId);
            return reply.send(projection);
        }
        catch (error) {
            const errorMessage = error?.message || 'Erro desconhecido';
            fastify.log.error({ err: error, route: '/fund/projection' }, 'Erro ao buscar projeção do fundo');
            return reply.status(500).send({
                error: 'Erro ao buscar projeção do fundo regional',
                message: errorMessage,
                ...(process.env.NODE_ENV === 'development' ? { stack: error?.stack } : {}),
            });
        }
    });
    /**
     * GET /fund
     */
    fastify.get('/', async (req, reply) => {
        try {
            const tenantId = req.tenant.id;
            const { days = '30' } = req.query;
            const rangeDays = parseInt(days, 10) || 30;
            const safeRangeDays = Math.min(Math.max(1, rangeDays), 365);
            const view = await fund_visibility_service_1.fundVisibilityService.getCompleteView(tenantId, safeRangeDays);
            return reply.send(view);
        }
        catch (error) {
            const errorMessage = error?.message || 'Erro desconhecido';
            fastify.log.error({ err: error, route: '/fund' }, 'Erro ao buscar visão completa do fundo');
            return reply.status(500).send({
                error: 'Erro ao buscar dados do fundo regional',
                message: errorMessage,
                ...(process.env.NODE_ENV === 'development' ? { stack: error?.stack } : {}),
            });
        }
    });
    // Registrar rotas do dashboard
    await fastify.register(fund_dashboard_routes_1.default);
};
exports.default = fundRoutes;
//# sourceMappingURL=fund.routes.js.map