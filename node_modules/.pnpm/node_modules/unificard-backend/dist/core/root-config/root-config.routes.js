"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const root_config_service_1 = require("./root-config.service");
const root_config_schemas_1 = require("./root-config.schemas");
const rootConfigRoutes = async (fastify) => {
    /**
     * GET /root-config
     * Busca a configuração-raiz atual
     */
    fastify.get('/', async () => {
        const config = await root_config_service_1.rootConfigService.getConfig();
        return config || {
            id: null,
            countryId: null,
            stateId: null,
            cityId: null,
            timezone: null,
            currency: null,
            languages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    });
    /**
     * POST /root-config/update
     * Atualiza a configuração-raiz
     */
    fastify.post('/update', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    countryId: { type: ['string', 'null'] },
                    stateId: { type: ['string', 'null'] },
                    cityId: { type: ['string', 'null'] },
                    timezone: { type: ['string', 'null'] },
                    currency: { type: ['string', 'null'] },
                    languages: { type: 'array', items: { type: 'string' } },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const validated = root_config_schemas_1.updateRootConfigSchema.parse(req.body);
            const config = await root_config_service_1.rootConfigService.updateConfig(validated);
            return reply.status(200).send(config);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao atualizar configuração' });
        }
    });
    /**
     * POST /root-config/set-region
     * Define a região (país, estado, cidade)
     */
    fastify.post('/set-region', {
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
        try {
            const validated = root_config_schemas_1.setRegionSchema.parse(req.body);
            const config = await root_config_service_1.rootConfigService.setRegion(validated.countryId, validated.stateId, validated.cityId);
            return reply.status(200).send(config);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao definir região' });
        }
    });
    /**
     * POST /root-config/set-timezone
     * Define o timezone
     */
    fastify.post('/set-timezone', {
        schema: {
            body: {
                type: 'object',
                required: ['timezone'],
                properties: {
                    timezone: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const validated = root_config_schemas_1.setTimezoneSchema.parse(req.body);
            const config = await root_config_service_1.rootConfigService.setTimezone(validated.timezone);
            return reply.status(200).send(config);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao definir timezone' });
        }
    });
    /**
     * POST /root-config/set-currency
     * Define a moeda
     */
    fastify.post('/set-currency', {
        schema: {
            body: {
                type: 'object',
                required: ['currency'],
                properties: {
                    currency: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const validated = root_config_schemas_1.setCurrencySchema.parse(req.body);
            const config = await root_config_service_1.rootConfigService.setCurrency(validated.currency);
            return reply.status(200).send(config);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao definir moeda' });
        }
    });
    /**
     * POST /root-config/set-languages
     * Define os idiomas
     */
    fastify.post('/set-languages', {
        schema: {
            body: {
                type: 'object',
                required: ['languages'],
                properties: {
                    languages: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const validated = root_config_schemas_1.setLanguagesSchema.parse(req.body);
            const config = await root_config_service_1.rootConfigService.setLanguages(validated.languages);
            return reply.status(200).send(config);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao definir idiomas' });
        }
    });
};
exports.default = rootConfigRoutes;
