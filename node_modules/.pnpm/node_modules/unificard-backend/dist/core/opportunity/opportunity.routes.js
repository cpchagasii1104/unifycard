"use strict";
// src/core/opportunity/opportunity.routes.ts
// Rotas para Oportunidades Suaves
Object.defineProperty(exports, "__esModule", { value: true });
const opportunity_service_1 = require("./opportunity.service");
const opportunityRoutes = async (fastify) => {
    /**
     * GET /opportunities/contextual
     * Busca oportunidades contextuais baseadas no estado e progresso
     * REGRA: Só retorna se condições forem atendidas
     */
    fastify.get('/contextual', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const limit = parseInt(req.query.limit || '3', 10);
            const result = await opportunity_service_1.opportunityService.getContextualOpportunities(req.tenant.id, req.user.id, limit);
            return reply.send({ ok: true, data: result });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar oportunidades contextuais');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar oportunidades contextuais',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * POST /opportunities/action
     * Registra ação do usuário sobre uma oportunidade (accept ou dismiss)
     */
    fastify.post('/action', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const { opportunityId, action } = req.body;
            if (!opportunityId || !action || (action !== 'accept' && action !== 'dismiss')) {
                return reply.status(400).send({
                    ok: false,
                    message: 'opportunityId e action (accept|dismiss) são obrigatórios'
                });
            }
            await opportunity_service_1.opportunityService.recordOpportunityAction(req.tenant.id, req.user.id, opportunityId, action);
            return reply.send({ ok: true });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao registrar ação de oportunidade');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao registrar ação',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = opportunityRoutes;
