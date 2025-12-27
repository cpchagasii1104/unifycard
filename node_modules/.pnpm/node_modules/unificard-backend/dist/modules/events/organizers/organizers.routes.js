"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const organizers_service_1 = require("./organizers.service");
const organizers_schemas_1 = require("./organizers.schemas");
const organizersRoutes = async (fastify) => {
    /**
     * POST /events/organizers/create
     * Cria um novo organizador
     */
    fastify.post('/create', {
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    logoUrl: { type: 'string' },
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
            const validated = organizers_schemas_1.createOrganizerSchema.parse(req.body);
            // Integração com AI Kernel
            let aiSuggestions = null;
            try {
                const ai = req.server.ai;
                const analysis = await ai.run('analyze organizer', {
                    name: validated.name,
                    description: validated.description,
                });
                if (analysis && analysis.result) {
                    aiSuggestions = analysis.result;
                }
            }
            catch (error) {
                // Silenciosamente ignora erros do AI Kernel
                fastify.log.warn({ err: error }, 'Erro ao analisar organizador com AI Kernel');
            }
            const organizer = await organizers_service_1.organizersService.createOrganizer(req.tenant.id, validated, req.user.globalUserId);
            return reply.status(201).send({
                organizer,
                aiSuggestions,
            });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao criar organizador' });
        }
    });
    /**
     * POST /events/organizers/:id/add-member
     * Adiciona membro a um organizador
     */
    fastify.post('/:id/add-member', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
            },
            body: {
                type: 'object',
                required: ['globalUserId', 'role'],
                properties: {
                    globalUserId: { type: 'string' },
                    role: { type: 'string', enum: ['owner', 'admin', 'editor', 'viewer'] },
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
            const validated = organizers_schemas_1.addMemberSchema.parse(req.body);
            const member = await organizers_service_1.organizersService.addMember(req.tenant.id, req.params.id, validated, req.user.globalUserId);
            return reply.status(201).send(member);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao adicionar membro' });
        }
    });
    /**
     * POST /events/organizers/link-event/:eventId
     * Vincula evento a um organizador
     * Rota: POST /events/organizers/link-event/:eventId
     */
    fastify.post('/link-event/:eventId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    eventId: { type: 'string' },
                },
            },
            body: {
                type: 'object',
                required: ['organizerId'],
                properties: {
                    organizerId: { type: 'string' },
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
            const validated = organizers_schemas_1.linkEventSchema.parse(req.body);
            await organizers_service_1.organizersService.linkEvent(req.tenant.id, req.params.eventId, validated.organizerId, req.user.globalUserId);
            return reply.status(200).send({ success: true, message: 'Evento vinculado ao organizador' });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao vincular evento' });
        }
    });
    /**
     * GET /events/organizers
     * Lista organizadores
     */
    fastify.get('/', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
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
            const organizers = await organizers_service_1.organizersService.listOrganizers(req.tenant.id, {
                limit: req.query.limit,
                offset: req.query.offset,
            });
            return { organizers, total: organizers.length };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao listar organizadores');
            return reply.status(500).send({ error: 'Erro ao listar organizadores' });
        }
    });
    /**
     * GET /events/organizers/:id
     * Busca organizador por ID com detalhes
     */
    fastify.get('/:id', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
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
            const organizer = await organizers_service_1.organizersService.getOrganizerWithDetails(req.tenant.id, req.params.id);
            if (!organizer) {
                return reply.status(404).send({ error: 'Organizador não encontrado' });
            }
            return organizer;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar organizador');
            return reply.status(500).send({ error: 'Erro ao buscar organizador' });
        }
    });
};
exports.default = organizersRoutes;
//# sourceMappingURL=organizers.routes.js.map