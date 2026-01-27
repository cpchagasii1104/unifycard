"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_service_1 = require("./events.service");
const occupancy_service_1 = require("./occupancy.service");
const event_metrics_service_1 = require("./event-metrics.service");
const event_state_service_1 = require("./event-state.service");
const event_metrics_dashboard_service_1 = require("./event-metrics-dashboard.service");
const event_organizer_metrics_service_1 = require("./event-organizer-metrics.service");
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
            // Garantir que title está presente (Zod já valida, mas TypeScript precisa de cast)
            if (!validated.title) {
                return reply.status(400).send({ error: 'Título é obrigatório' });
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
     * GET /events/:eventId/details
     * Busca um evento por ID com detalhes completos (stateInfo, etc)
     *
     * 🔴 ROTA ALTERADA - DUPLICADA COM GET /:id
     * Esta rota foi alterada de GET /:eventId para GET /:eventId/details
     * para evitar conflito com a rota canônica GET /:id em event.routes.ts
     *
     * Use GET /api/events/:id para a versão canônica simples
     * Use GET /api/events/:eventId/details para a versão com stateInfo
     */
    fastify.get('/:eventId/details', {
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
            // Adicionar informação de estado
            const stateInfo = event_state_service_1.eventStateService.getEventState(event);
            return {
                ...event,
                state: stateInfo.state,
                stateInfo: {
                    state: stateInfo.state,
                    message: event_state_service_1.eventStateService.getStateMessage(stateInfo),
                    timeUntilStart: stateInfo.timeUntilStart,
                    timeUntilEnd: stateInfo.timeUntilEnd,
                    timeSinceEnd: stateInfo.timeSinceEnd,
                    isSoon: stateInfo.isSoon,
                    isEnding: stateInfo.isEnding,
                },
            };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar evento');
            return reply.status(500).send({ error: 'Erro ao buscar evento' });
        }
    });
    /**
     * GET /events/:eventId/posts
     * Busca posts relacionados ao evento
     */
    fastify.get('/:eventId/posts', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
            const posts = await events_service_1.eventsService.getEventPosts(req.tenant.id, req.params.eventId, limit);
            return { posts, total: posts.length };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar posts do evento');
            return reply.status(500).send({ error: 'Erro ao buscar posts do evento' });
        }
    });
    /**
     * GET /events/:eventId/stats
     * Estatísticas de ingressos vendidos (read-only)
     * 🔴 BLINDAGEM: Apenas leitura, não altera estado
     */
    fastify.get('/:eventId/stats', {
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
            // Buscar evento para obter maxCapacity
            const event = await events_service_1.eventsService.getEvent(req.tenant.id, req.params.eventId);
            if (!event) {
                return reply.status(404).send({ error: 'Evento não encontrado' });
            }
            // Contar ingressos vendidos (participantes confirmados)
            // 🔴 FONTE DE VERDADE: event_attendees (não current_occupancy que é cache)
            const { runQueryWithTenant } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
            const soldCountRow = await runQueryWithTenant(req.tenant.id, `
          SELECT COUNT(*) as count
          FROM event_attendees
          WHERE event_id = $1
          `, [req.params.eventId]);
            const soldCount = soldCountRow ? Number(soldCountRow.count) : 0;
            const maxCapacity = event.maxCapacity || null;
            const remaining = maxCapacity !== null ? Math.max(0, maxCapacity - soldCount) : null;
            const occupancyPercent = maxCapacity !== null && maxCapacity > 0
                ? Math.round((soldCount / maxCapacity) * 100)
                : null;
            return reply.send({
                soldCount,
                maxCapacity,
                remaining,
                occupancyPercent,
                updatedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar estatísticas do evento');
            return reply.status(500).send({ error: 'Erro ao buscar estatísticas' });
        }
    });
    /**
     * GET /events/:eventId/participants
     * Busca participantes do evento
     */
    fastify.get('/:eventId/participants', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
            const participants = await events_service_1.eventsService.getEventParticipants(req.tenant.id, req.params.eventId, limit);
            return { participants, total: participants.length };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar participantes do evento');
            return reply.status(500).send({ error: 'Erro ao buscar participantes do evento' });
        }
    });
    /**
     * POST /events/:eventId/metrics
     * Registra uma métrica de evento
     */
    fastify.post('/:eventId/metrics', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            await event_metrics_service_1.eventMetricsService.trackMetric({
                tenantId: req.tenant.id,
                eventId: req.params.eventId,
                globalUserId: req.user.globalUserId || null,
                metricType: req.body.metricType,
                ctaType: req.body.ctaType,
                source: req.body.source,
                metadata: req.body.metadata,
            });
            return reply.status(201).send({ success: true });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao registrar métrica');
            return reply.status(500).send({ error: 'Erro ao registrar métrica' });
        }
    });
    /**
     * GET /events/:eventId/metrics
     * Busca resumo de métricas de um evento
     */
    fastify.get('/:eventId/metrics', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const summary = await event_metrics_service_1.eventMetricsService.getEventMetricsSummary(req.tenant.id, req.params.eventId);
            return summary;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar métricas');
            return reply.status(500).send({ error: 'Erro ao buscar métricas' });
        }
    });
    /**
     * GET /events/:eventId/dashboard
     * Dashboard completo de métricas de um evento
     */
    fastify.get('/:eventId/dashboard', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const dashboard = await event_metrics_dashboard_service_1.eventMetricsDashboardService.getEventDashboard(req.tenant.id, req.params.eventId);
            if (!dashboard) {
                return reply.status(404).send({ error: 'Evento não encontrado' });
            }
            return dashboard;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar dashboard');
            return reply.status(500).send({ error: 'Erro ao buscar dashboard' });
        }
    });
    /**
     * POST /events/compare
     * Compara métricas entre eventos
     */
    fastify.post('/compare', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const comparison = await event_metrics_dashboard_service_1.eventMetricsDashboardService.compareEvents(req.tenant.id, req.body.eventIds || []);
            return comparison;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao comparar eventos');
            return reply.status(500).send({ error: 'Erro ao comparar eventos' });
        }
    });
    /**
     * GET /events/:eventId/organizer-metrics
     * Métricas do evento para organizador (versão simplificada)
     */
    fastify.get('/:eventId/organizer-metrics', async (req, reply) => {
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
            const metrics = await event_organizer_metrics_service_1.eventOrganizerMetricsService.getOrganizerMetrics(req.tenant.id, req.params.eventId, req.user.globalUserId);
            if (!metrics) {
                return reply.status(403).send({ error: 'Sem permissão para ver métricas deste evento' });
            }
            return metrics;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar métricas do organizador');
            return reply.status(500).send({ error: 'Erro ao buscar métricas' });
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
    /**
     * GET /events/:id/occupancy/stats
     * Estatísticas de ocupação do evento
     */
    fastify.get('/events/:id/occupancy/stats', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const stats = await occupancy_service_1.occupancyService.getOccupancyStats(req.tenant.id, req.params.id);
            return reply.send(stats);
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar estatísticas de ocupação');
            return reply.status(500).send({ error: 'Erro ao buscar estatísticas' });
        }
    });
};
exports.default = eventsRoutes;
