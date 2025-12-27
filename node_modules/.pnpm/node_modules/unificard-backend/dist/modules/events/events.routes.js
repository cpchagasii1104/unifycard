"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_service_1 = require("./events.service");
const events_schemas_1 = require("./events.schemas");
const organizers_module_1 = __importDefault(require("./organizers/organizers.module"));
const eventsRoutes = async (fastify) => {
    // Registrar módulo de organizadores
    await fastify.register(organizers_module_1.default, { prefix: '/organizers' });
    /**
     * POST /events/create
     * Cria um novo evento
     */
    fastify.post('/create', {
        schema: {
            body: {
                type: 'object',
                required: ['title', 'startTime', 'endTime'],
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    startTime: { type: 'string' },
                    endTime: { type: 'string' },
                    cityId: { type: ['string', 'null'] },
                    stateId: { type: ['string', 'null'] },
                    countryId: { type: ['string', 'null'] },
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
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const validated = events_schemas_1.createEventSchema.parse(req.body);
            // Integração com AI Kernel
            let aiSuggestions = null;
            try {
                const ai = req.server.ai;
                const analysis = await ai.run('analyze new event', {
                    title: validated.title,
                    description: validated.description,
                    startTime: validated.startTime,
                    endTime: validated.endTime,
                });
                if (analysis && analysis.result) {
                    aiSuggestions = analysis.result;
                }
            }
            catch (error) {
                // Silenciosamente ignora erros do AI Kernel
                fastify.log.warn({ err: error }, 'Erro ao analisar evento com AI Kernel');
            }
            const event = await events_service_1.eventsService.createEvent(req.tenant.id, validated, req.user.globalUserId);
            return reply.status(201).send({
                event,
                aiSuggestions,
            });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao criar evento' });
        }
    });
    /**
     * POST /events/:eventId/add-session
     * Adiciona uma sessão a um evento
     */
    fastify.post('/:eventId/add-session', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    eventId: { type: 'string' },
                },
            },
            body: {
                type: 'object',
                required: ['name', 'startTime', 'endTime'],
                properties: {
                    name: { type: 'string' },
                    startTime: { type: 'string' },
                    endTime: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const validated = events_schemas_1.addSessionSchema.parse(req.body);
            const session = await events_service_1.eventsService.addSession(req.tenant.id, req.params.eventId, validated);
            return reply.status(201).send(session);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao adicionar sessão' });
        }
    });
    /**
     * POST /events/:eventId/assign-staff
     * Designa staff para um evento
     */
    fastify.post('/:eventId/assign-staff', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    eventId: { type: 'string' },
                },
            },
            body: {
                type: 'object',
                required: ['globalUserId', 'role'],
                properties: {
                    globalUserId: { type: 'string' },
                    role: { type: 'string' },
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
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const validated = events_schemas_1.assignStaffSchema.parse(req.body);
            const staff = await events_service_1.eventsService.assignStaff(req.tenant.id, req.params.eventId, validated, req.user.globalUserId);
            return reply.status(201).send(staff);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao designar staff' });
        }
    });
    /**
     * POST /events/:eventId/check-in
     * Realiza check-in de um participante
     */
    fastify.post('/:eventId/check-in', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    eventId: { type: 'string' },
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
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const result = await events_service_1.eventsService.checkIn(req.tenant.id, req.params.eventId, req.user.globalUserId);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao realizar check-in' });
        }
    });
    /**
     * GET /events/:eventId
     * Busca um evento por ID com detalhes completos
     */
    fastify.get('/:eventId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    eventId: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            // Usar getEvent que agora retorna campos completos (eventType, ticketPrice, etc)
            const event = await events_service_1.eventsService.getEvent(req.tenant.id, req.params.eventId);
            if (!event) {
                return reply.status(404).send({ error: 'Evento não encontrado' });
            }
            return event;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar evento');
            return reply.status(500).send({ error: 'Erro ao buscar evento' });
        }
    });
    /**
     * GET /events/search
     * Busca eventos com filtros
     */
    fastify.get('/search', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    cityId: { type: 'string' },
                    stateId: { type: 'string' },
                    countryId: { type: 'string' },
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    limit: { type: 'number' },
                    offset: { type: 'number' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const events = await events_service_1.eventsService.searchEvents(req.tenant.id, {
                cityId: req.query.cityId,
                stateId: req.query.stateId,
                countryId: req.query.countryId,
                startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
                limit: req.query.limit,
                offset: req.query.offset,
            });
            return { events, total: events.length };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar eventos');
            return reply.status(500).send({ error: 'Erro ao buscar eventos' });
        }
    });
};
exports.default = eventsRoutes;
//# sourceMappingURL=events.routes.js.map