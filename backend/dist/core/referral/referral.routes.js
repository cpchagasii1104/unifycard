"use strict";
// src/core/referral/referral.routes.ts
// Rotas de código de indicação/afiliado
Object.defineProperty(exports, "__esModule", { value: true });
const referral_service_1 = require("./referral.service");
const pool_1 = require("@core/database/pool");
const referralRoutes = async (fastify) => {
    /**
     * GET /referral/code
     * Obtém ou gera código de indicação do usuário autenticado
     */
    fastify.get('/code', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const code = await referral_service_1.referralService.getOrCreateReferralCode(req.tenant.id, req.user.id);
            return { referralCode: code };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar código de indicação');
            return reply.status(500).send({ error: 'Erro ao buscar código de indicação' });
        }
    });
    /**
     * POST /referral/apply
     * Aplica código de indicação (usado no registro)
     */
    fastify.post('/apply', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const result = await referral_service_1.referralService.applyReferralCode(req.tenant.id, req.user.id, req.body.referralCode);
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao aplicar código de indicação');
            return reply.status(500).send({ error: 'Erro ao aplicar código de indicação' });
        }
    });
    /**
     * GET /referral/validate
     * 🔧 FIX: Valida se um código de indicação existe (para UX em tempo real)
     * Não aplica o código, apenas verifica existência
     */
    fastify.get('/validate', async (req, reply) => {
        const { code, tenantId: queryTenantId } = req.query;
        // Validação: código ausente ou vazio
        if (!code || code.trim() === '') {
            return reply.status(400).send({ error: 'Código de indicação é obrigatório' });
        }
        // Validação: formato do código (alfanumérico, 4-32 caracteres)
        const codeRegex = /^[A-Za-z0-9]{4,32}$/;
        if (!codeRegex.test(code.trim())) {
            return reply.status(400).send({ error: 'Formato de código de indicação inválido' });
        }
        // 🔧 FIX (tenant resolution): Resolver tenantId automaticamente nesta ordem
        const tenantId = req.tenant?.id || req.headers['x-tenant-id'] || queryTenantId;
        if (!tenantId) {
            return reply.status(400).send({ error: 'Tenant ID é obrigatório para validação' });
        }
        try {
            // Reutilizar lógica existente do applyReferralCode (busca sem aplicar)
            const referrer = await (0, pool_1.runQueryWithTenant)(tenantId, `
          SELECT user_id
          FROM users
          WHERE tenant_id = $1 AND UPPER(referral_code) = UPPER($2)
          LIMIT 1
        `, [tenantId, code.trim()]);
            if (!referrer || !referrer.user_id) {
                return reply.status(404).send({ error: 'Código de indicação não encontrado' });
            }
            return reply.status(200).send({ valid: true });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao validar código de indicação');
            return reply.status(500).send({ error: 'Erro ao validar código de indicação' });
        }
    });
};
exports.default = referralRoutes;
