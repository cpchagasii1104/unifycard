"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tenant_service_1 = require("./tenant.service");
const tenant_schemas_1 = require("./tenant.schemas");
const tenantRoutes = async (fastify) => {
    /**
     * POST /tenants/:tenantId/set-region
     * Define a região do tenant (país, estado, cidade)
     * Usa root-config como fallback se algum campo não for fornecido
     */
    fastify.post('/:tenantId/set-region', {
        schema: {
            params: {
                type: 'object',
                required: ['tenantId'],
                properties: {
                    tenantId: { type: 'string' },
                },
            },
            body: {
                type: 'object',
                properties: {
                    countryId: { type: ['string', 'null'] },
                    stateId: { type: ['string', 'null'] },
                    cityId: { type: ['string', 'null'] },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const { tenantId } = req.params;
            const validated = tenant_schemas_1.setTenantRegionSchema.parse(req.body);
            const tenant = await tenant_service_1.tenantService.setTenantRegion(tenantId, validated);
            return reply.status(200).send(tenant);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao definir região do tenant' });
        }
    });
};
exports.default = tenantRoutes;
//# sourceMappingURL=tenant.routes.js.map