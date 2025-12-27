"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const residence_service_1 = require("./residence.service");
const residence_schemas_1 = require("./residence.schemas");
const residenceRoutes = async (fastify) => {
    /**
     * GET /identity/residence
     * Retorna a residência digital atual do usuário autenticado
     */
    fastify.get('/', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(404).send({ error: 'Identidade global não encontrada' });
        }
        try {
            const residence = await residence_service_1.residenceService.getResidenceWithDetails(req.user.globalUserId);
            if (!residence) {
                // Se não tem residência, criar automaticamente a partir do root-config
                await residence_service_1.residenceService.autoSetFromRootConfig(req.user.globalUserId);
                const newResidence = await residence_service_1.residenceService.getResidenceWithDetails(req.user.globalUserId);
                return newResidence;
            }
            return residence;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar residência');
            return reply.status(500).send({ error: 'Erro ao buscar residência' });
        }
    });
    /**
     * POST /identity/residence/set
     * Define ou atualiza a região da residência digital (país, estado, cidade)
     */
    fastify.post('/set', {
        schema: {
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
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(404).send({ error: 'Identidade global não encontrada' });
        }
        try {
            const validated = residence_schemas_1.setResidenceSchema.parse(req.body);
            const residence = await residence_service_1.residenceService.setUserResidence(req.user.globalUserId, validated);
            const residenceWithDetails = await residence_service_1.residenceService.getResidenceWithDetails(req.user.globalUserId);
            return reply.status(200).send(residenceWithDetails);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao definir residência' });
        }
    });
    /**
     * POST /identity/residence/set-preferences
     * Define apenas preferências (timezone, currency, languages)
     */
    fastify.post('/set-preferences', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    timezone: { type: ['string', 'null'] },
                    currency: { type: 'string' },
                    languages: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(404).send({ error: 'Identidade global não encontrada' });
        }
        try {
            const validated = residence_schemas_1.setResidencePreferencesSchema.parse(req.body);
            await residence_service_1.residenceService.setResidencePreferences(req.user.globalUserId, validated);
            const residenceWithDetails = await residence_service_1.residenceService.getResidenceWithDetails(req.user.globalUserId);
            return reply.status(200).send(residenceWithDetails);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao definir preferências' });
        }
    });
};
exports.default = residenceRoutes;
//# sourceMappingURL=residence.routes.js.map