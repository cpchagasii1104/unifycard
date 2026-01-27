"use strict";
// backend/src/core/unifybank/transparency-admin.routes.ts
// Rotas administrativas de Transparência Financeira - FASE 6
// Endpoints admin para fundos regionais
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const transparency_service_1 = require("./transparency.service");
// Schema de validação
const adminRegionalFundQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(200).optional().default(100),
    offset: zod_1.z.coerce.number().int().min(0).optional().default(0),
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
});
const transparencyAdminRoutes = async (fastify) => {
    /**
     * GET /admin/bank/regional-fund/:regionId
     * Obtém visão administrativa completa do fundo regional
     *
     * Autenticação: OBRIGATÓRIA (JWT + Admin)
     *
     * Query params:
     * - limit: número de itens (default: 100, max: 200)
     * - offset: paginação (default: 0)
     * - startDate: data inicial (opcional)
     * - endDate: data final (opcional)
     *
     * Respostas:
     * - 200: Fundo regional admin retornado
     * - 401: Não autenticado
     * - 403: Não é admin
     * - 404: Fundo regional não encontrado
     * - 500: Erro inesperado
     */
    fastify.get('/regional-fund/:regionId', {
        preHandler: [fastify.requirePermission(['admin:view_regional_fund'])],
    }, async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const { regionId } = req.params;
        // 2. Validar regionId
        if (!regionId || typeof regionId !== 'string') {
            return reply.status(400).send({ error: 'Invalid region ID' });
        }
        // 3. Validar query params
        const parsed = adminRegionalFundQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: parsed.error.errors,
            });
        }
        try {
            const result = await transparency_service_1.transparencyService.getAdminRegionalFund(tenantId, regionId, {
                limit: parsed.data.limit,
                offset: parsed.data.offset,
                startDate: parsed.data.startDate,
                endDate: parsed.data.endDate,
            });
            if (!result) {
                return reply.status(404).send({
                    error: 'Regional fund not found for this region',
                });
            }
            return reply.status(200).send({
                success: true,
                regionalFund: result,
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error fetching admin regional fund');
            return reply.status(500).send({
                error: err.message || 'Failed to fetch admin regional fund',
            });
        }
    });
};
exports.default = transparencyAdminRoutes;
