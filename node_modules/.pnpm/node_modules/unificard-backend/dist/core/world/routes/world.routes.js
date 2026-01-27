"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const world_service_1 = require("../services/world.service");
const world_schemas_1 = require("../world.schemas");
const worldRoutes = async (fastify) => {
    /**
     * GET /world/countries
     * Lista todos os países
     */
    fastify.get('/countries', async () => {
        return world_service_1.worldService.getCountries();
    });
    /**
     * GET /world/countries/:countryId
     * Busca país por ID
     */
    fastify.get('/countries/:countryId', async (req, reply) => {
        const { countryId } = req.params;
        const country = await world_service_1.worldService.getCountryById(countryId);
        if (!country) {
            return reply.notFound('País não encontrado');
        }
        return country;
    });
    /**
     * GET /world/countries/:countryId/states
     * Lista estados de um país
     */
    fastify.get('/countries/:countryId/states', async (req, reply) => {
        const { countryId } = req.params;
        // Validar countryId
        const country = await world_service_1.worldService.getCountryById(countryId);
        if (!country) {
            return reply.notFound('País não encontrado');
        }
        const states = await world_service_1.worldService.getStatesByCountry(countryId);
        return states;
    });
    /**
     * GET /world/states/:stateId
     * Busca estado por ID
     */
    fastify.get('/states/:stateId', async (req, reply) => {
        const { stateId } = req.params;
        const state = await world_service_1.worldService.getStateById(stateId);
        if (!state) {
            return reply.notFound('Estado não encontrado');
        }
        return state;
    });
    /**
     * GET /world/states/:stateId/cities
     * Lista cidades de um estado
     */
    fastify.get('/states/:stateId/cities', async (req, reply) => {
        const { stateId } = req.params;
        // Validar stateId
        const state = await world_service_1.worldService.getStateById(stateId);
        if (!state) {
            return reply.notFound('Estado não encontrado');
        }
        const cities = await world_service_1.worldService.getCitiesByState(stateId);
        return cities;
    });
    /**
     * GET /world/cities/:cityId
     * Busca cidade por ID
     */
    fastify.get('/cities/:cityId', async (req, reply) => {
        const { cityId } = req.params;
        const city = await world_service_1.worldService.getCityById(cityId);
        if (!city) {
            return reply.notFound('Cidade não encontrada');
        }
        return city;
    });
    /**
     * GET /world/cities/search?term=...
     * Busca cidades por termo
     */
    fastify.get('/cities/search', {
        schema: {
            querystring: {
                type: 'object',
                required: ['term'],
                properties: {
                    term: { type: 'string' },
                    countryId: { type: 'string' },
                    stateId: { type: 'string' },
                    limit: { type: 'number' },
                    offset: { type: 'number' },
                },
            },
        },
    }, async (req) => {
        const validated = world_schemas_1.searchCitiesQuerySchema.parse(req.query);
        const cities = await world_service_1.worldService.searchCities(validated.term, {
            countryId: validated.countryId,
            stateId: validated.stateId,
            limit: validated.limit,
            offset: validated.offset,
        });
        return cities;
    });
};
exports.default = worldRoutes;
