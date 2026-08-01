// src/modules/events/events.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { eventsService } from './events.service';
import { occupancyService } from './occupancy.service';
import { eventMetricsService } from './event-metrics.service';
// ⚠️ event-metrics-dashboard.service e event-organizer-metrics.service NÃO são mais importados:
// as 3 rotas que os alcançavam estão contidas em 501 (F-EVENT-METRICS-DASHBOARD-CONTAINMENT).
// Os services seguem intactos no módulo — sumiu a ARESTA, não o código.
import { eventStateService } from './event-state.service';
import { createEventSchema, addSessionSchema, assignStaffSchema, checkInSchema } from './events.schemas';
import type { CreateEventInput } from './events.types';
import organizersModule from './organizers/organizers.module';

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  // Registrar módulo de organizadores
  await fastify.register(organizersModule, { prefix: '/organizers' });
  /**
   * POST /events/create
   * Cria um novo evento
   */
  fastify.post<{
    Body: {
      title: string;
      description?: string | null;
      startTime: string;
      endTime: string;
      cityId?: string | null;
      stateId?: string | null;
      countryId?: string | null;
    };
  }>(
    '/create',
    {
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
    },
    async (req, reply) => {
      // 🔴 A1c (EVENT-ENGINE-COMPLETION, §2/§4.8): WRITER ÚNICO. Rota legada W2 (POST /api/events/create →
      // eventsService.createEvent, INSERT INTO events paralelo) CONTIDA: 501 honesto como PRIMEIRA instrução,
      // ANTES de qualquer chamada ao writer legado. Criação canônica = POST /api/events/v2/create (guided
      // flow). FE já roteado (A1b/A1c). Corpo original abaixo (dead-code documentado).
      return reply.status(501).send({ error: 'EVENT_LEGACY_WRITER_CONVERGED', code: 'EVENT_LEGACY_WRITER_CONVERGED', message: 'Rota legada de criação de evento contida — use POST /api/events/v2/create (guided flow format-first).' });

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
        const validated = createEventSchema.parse(req.body);

        // Integração com AI Kernel
        let aiSuggestions: any = null;
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
        } catch (error) {
          // Silenciosamente ignora erros do AI Kernel
          fastify.log.warn({ err: error }, 'Erro ao analisar evento com AI Kernel');
        }

        // Garantir que title está presente (Zod já valida, mas TypeScript precisa de cast)
        if (!validated.title) {
          return reply.status(400).send({ error: 'Título é obrigatório' });
        }

        const event = await eventsService.createEvent(
          req.tenant.id,
          validated as CreateEventInput,
          req.user.globalUserId
        );

        return reply.status(201).send({
          event,
          aiSuggestions,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Erro ao criar evento' });
      }
    }
  );

  /**
   * POST /events/:eventId/add-session
   * Adiciona uma sessão a um evento
   */
  fastify.post<{
    Params: { eventId: string };
    Body: {
      name: string;
      startTime: string;
      endTime: string;
    };
  }>(
    '/:eventId/add-session',
    {
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
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      if (!req.user.globalUserId) {
        return reply.status(400).send({ error: 'Global user ID required' });
      }

      try {
        const validated = addSessionSchema.parse(req.body);
        const session = await eventsService.addSession(
          req.tenant.id,
          req.params.eventId,
          validated,
          req.user.globalUserId
        );
        return reply.status(201).send(session);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Erro ao adicionar sessão' });
      }
    }
  );

  /**
   * POST /events/:eventId/assign-staff
   * Designa staff para um evento
   */
  fastify.post<{
    Params: { eventId: string };
    Body: {
      globalUserId: string;
      role: string;
    };
  }>(
    '/:eventId/assign-staff',
    {
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
    },
    async (req, reply) => {
      // 🔴 C2b (EVENT-ENGINE-COMPLETION, §2/§4.8): WRITER ÚNICO do vínculo. Esta ROTA legada user-only
      // (assign-staff, SEM gate de autoridade sobre o dono do evento) fica CONTIDA: entrada única de vínculo
      // = POST /events/:id/v2/commitments (createCommitment, actor-first, gate DUAL). 501 honesto ANTES do
      // sink (eventsService.assignStaff). Corpo original abaixo (dead-code). Não toca createCommitment.
      return reply.status(501).send({
        error: 'EVENT_ASSIGN_STAFF_CONVERGED',
        code: 'EVENT_ASSIGN_STAFF_CONVERGED',
        message: 'Rota legada de designação de staff contida — use POST /events/:id/v2/commitments (createCommitment, actor-first, gate dual).',
      });

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
        const validated = assignStaffSchema.parse(req.body);
        const staff = await eventsService.assignStaff(
          req.tenant.id,
          req.params.eventId,
          validated,
          req.user.globalUserId
        );
        return reply.status(201).send(staff);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Erro ao designar staff' });
      }
    }
  );

  /**
   * POST /events/:eventId/check-in
   * Realiza check-in de um participante
   */
  fastify.post<{
    Params: { eventId: string };
  }>(
    '/:eventId/check-in',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            eventId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
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
        const result = await eventsService.checkIn(
          req.tenant.id,
          req.params.eventId,
          req.user.globalUserId
        );
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Erro ao realizar check-in' });
      }
    }
  );

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
  fastify.get<{
    Params: { eventId: string };
  }>(
    '/:eventId/details',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            eventId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      // 🔵 DECISION-0113 F6.5.6b-CANAL5-B: sub-resource herda canViewEvent do evento-pai (404 não-leak).
      const { canViewEvent } = await import('@core/events/event-visibility.service');
      if (!(await canViewEvent(req.tenant.id, req.params.eventId, (req.user as { userId?: string }).userId))) {
        return reply.status(404).send({ error: 'Evento não encontrado' });
      }

      try {
        // Usar getEvent que agora retorna campos completos (eventType, ticketPrice, etc)
        const event = await eventsService.getEvent(
          req.tenant.id,
          req.params.eventId
        );

        if (!event) {
          return reply.status(404).send({ error: 'Evento não encontrado' });
        }

        // Adicionar informação de estado
        const stateInfo = eventStateService.getEventState(event);

        return {
          ...event,
          state: stateInfo.state,
          stateInfo: {
            state: stateInfo.state,
            message: eventStateService.getStateMessage(stateInfo),
            timeUntilStart: stateInfo.timeUntilStart,
            timeUntilEnd: stateInfo.timeUntilEnd,
            timeSinceEnd: stateInfo.timeSinceEnd,
            isSoon: stateInfo.isSoon,
            isEnding: stateInfo.isEnding,
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar evento');
        return reply.status(500).send({ error: 'Erro ao buscar evento' });
      }
    }
  );

  /**
   * GET /events/:eventId/posts
   * Busca posts relacionados ao evento
   */
  fastify.get<{
    Params: { eventId: string };
    Querystring: { limit?: string };
  }>(
    '/:eventId/posts',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      // 🔵 DECISION-0113 F6.5.6b-CANAL5-B: sub-resource herda canViewEvent do evento-pai (404 não-leak).
      const { canViewEvent } = await import('@core/events/event-visibility.service');
      if (!(await canViewEvent(req.tenant.id, req.params.eventId, (req.user as { userId?: string }).userId))) {
        return reply.status(404).send({ error: 'Evento não encontrado' });
      }

      try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
        const posts = await eventsService.getEventPosts(
          req.tenant.id,
          req.params.eventId,
          limit
        );

        return { posts, totalCents: posts.length };
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar posts do evento');
        return reply.status(500).send({ error: 'Erro ao buscar posts do evento' });
      }
    }
  );

  /**
   * GET /events/:eventId/stats
   * Estatísticas de ingressos vendidos (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   */
  fastify.get<{
    Params: { eventId: string };
  }>(
    '/:eventId/stats',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            eventId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      // 🔵 DECISION-0113 F6.5.6b-CANAL5-B: sub-resource herda canViewEvent do evento-pai (404 não-leak).
      const { canViewEvent } = await import('@core/events/event-visibility.service');
      if (!(await canViewEvent(req.tenant.id, req.params.eventId, (req.user as { userId?: string }).userId))) {
        return reply.status(404).send({ error: 'Evento não encontrado' });
      }

      try {
        // Buscar evento para obter maxCapacity
        const event = await eventsService.getEvent(req.tenant.id, req.params.eventId);
        if (!event) {
          return reply.status(404).send({ error: 'Evento não encontrado' });
        }

        // Contar ingressos vendidos (participantes confirmados)
        // 🔴 FONTE DE VERDADE: event_attendees (não current_occupancy que é cache)
        const { runQueryWithTenant } = await import('@core/database/pool');
        const soldCountRow = await runQueryWithTenant<{ count: string }>(
          req.tenant.id,
          `
          SELECT COUNT(*) as count
          FROM event_attendees
          WHERE event_id = $1
          `,
          [req.params.eventId]
        );

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
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar estatísticas do evento');
        return reply.status(500).send({ error: 'Erro ao buscar estatísticas' });
      }
    }
  );

  /**
   * GET /events/:eventId/participants
   * Busca participantes do evento
   */
  fastify.get<{
    Params: { eventId: string };
    Querystring: { limit?: string };
  }>(
    '/:eventId/participants',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      // 🔵 DECISION-0113 F6.5.6b-CANAL5-B: sub-resource herda canViewEvent do evento-pai (404 não-leak).
      const { canViewEvent } = await import('@core/events/event-visibility.service');
      if (!(await canViewEvent(req.tenant.id, req.params.eventId, (req.user as { userId?: string }).userId))) {
        return reply.status(404).send({ error: 'Evento não encontrado' });
      }

      try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        const participants = await eventsService.getEventParticipants(
          req.tenant.id,
          req.params.eventId,
          limit
        );

        return { participants, totalCents: participants.length };
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar participantes do evento');
        return reply.status(500).send({ error: 'Erro ao buscar participantes do evento' });
      }
    }
  );

  /**
   * POST /events/:eventId/metrics
   * Registra uma métrica de evento
   */
  fastify.post<{
    Params: { eventId: string };
    Body: {
      metricType: 'VIEW' | 'CTA_CLICK' | 'CONVERSION' | 'ABANDONMENT';
      ctaType?: 'ticket' | 'consumption' | 'parking';
      source?: 'feed' | 'event_page' | 'direct';
      metadata?: Record<string, any>;
    };
  }>(
    '/:eventId/metrics',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        await eventMetricsService.trackMetric({
          tenantId: req.tenant.id,
          eventId: req.params.eventId,
          globalUserId: req.user.globalUserId || null,
          metricType: req.body.metricType,
          ctaType: req.body.ctaType,
          source: req.body.source,
          metadata: req.body.metadata,
        });

        return reply.status(201).send({ success: true });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao registrar métrica');
        return reply.status(500).send({ error: 'Erro ao registrar métrica' });
      }
    }
  );

  /**
   * GET /events/:eventId/metrics
   * Busca resumo de métricas de um evento
   */
  fastify.get<{
    Params: { eventId: string };
  }>(
    '/:eventId/metrics',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      // 🔵 DECISION-0113 F6.5.6b-CANAL5-B: sub-resource herda canViewEvent do evento-pai (404 não-leak).
      const { canViewEvent } = await import('@core/events/event-visibility.service');
      if (!(await canViewEvent(req.tenant.id, req.params.eventId, (req.user as { userId?: string }).userId))) {
        return reply.status(404).send({ error: 'Evento não encontrado' });
      }

      try {
        const summary = await eventMetricsService.getEventMetricsSummary(
          req.tenant.id,
          req.params.eventId
        );

        return summary;
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar métricas');
        return reply.status(500).send({ error: 'Erro ao buscar métricas' });
      }
    }
  );

  /**
   * GET /events/:eventId/dashboard
   * Dashboard completo de métricas de um evento
   */
  fastify.get<{
    Params: { eventId: string };
  }>(
    '/:eventId/dashboard',
    // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
    // ║ STATUS:  CONTIDO — F-EVENT-METRICS-DASHBOARD-CONTAINMENT (2026-08-01)
    // ║ NORMA:   decisão de produto: religar código sem consumidor é trabalho morto que envelhece
    // ║ NÃO:     "consertar" as colunas para reviver isto. O handler pedia `starts_at`/`ends_at`,
    // ║          que NÃO EXISTEM em `events` (as reais são `datetime_start`/`datetime_end`), e
    // ║          comparava `status='FINISHED'`, valor que o enum não tem. Resultado: **500 para
    // ║          QUALQUER evento, desde o gênesis** — o try/catch transformava o 42703 num 500
    // ║          genérico, e foi por isso que ninguém rastreou até a coluna.
    // ║          🔴 E NINGUÉM CHAMA: `EventMetricsDashboard.tsx` é o único consumidor e NUNCA é
    // ║          renderizado (zero import, zero rota, zero `<Componente/>`). Não é endpoint sem
    // ║          tráfego — é endpoint SEM CAMINHO ATÉ tráfego, nos dois lados da ponte.
    // ║ EM VEZ:  501 honesto. Reabrir = decisão de produto (existe tela planejada?) + o mapa de
    // ║          renomeação já registrado no cartório (starts_at→datetime_start,
    // ║          ends_at→datetime_end, 'FINISHED'→'ended'). O service segue intacto: sumiu a
    // ║          ARESTA, não o código.
    // ╚════════════════════════════════════════════════════════════════
    async (_req, reply) => {
      return reply.status(501).send({
        ok: false,
        code: 'EVENT_METRICS_DASHBOARD_NOT_WIRED',
        error: 'EVENT_METRICS_DASHBOARD_NOT_WIRED',
        message:
          'Event metrics dashboard is not wired. It queried columns that do not exist (starts_at, ' +
          'ends_at) and a status value the enum never had, so it answered 500 for every event since ' +
          'the genesis. Its only frontend consumer is never rendered. Reopening needs a product ' +
          'decision plus the rename map recorded in REMEDIATION_DT_LOG.md. No money is moved.',
        money_moved: false,
      });
    }
  );

  /**
   * POST /events/compare
   * Compara métricas entre eventos
   */
  fastify.post<{
    Body: { eventIds: string[] };
  }>(
    '/compare',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
      // ║ STATUS:  CONTIDO — F-EVENT-METRICS-DASHBOARD-CONTAINMENT (2026-08-01)
      // ║ NORMA:   mesma dos irmãos `/dashboard` e `/organizer-metrics`
      // ║ NÃO:     tratar como rota sã. `compareEvents` chama `getEventDashboard` POR DENTRO
      // ║          (event-metrics-dashboard.service.ts:288) e herda o MESMO 42703 — `starts_at`
      // ║          não existe. Era o TERCEIRO irmão quebrado, e só apareceu porque a contenção
      // ║          dos outros dois deixou o service parecendo órfão e obrigou a perguntar quem
      // ║          ainda o usava. Sem consumidor no frontend, como os outros dois.
      // ║ EM VEZ:  501 honesto. Reabrir os três é UMA fatia só — o mapa de renomeação está no
      // ║          cartório e vale para todos, porque a quebra é do mesmo `getEventDashboard`.
      // ╚════════════════════════════════════════════════════════════════
      return reply.status(501).send({
        ok: false,
        code: 'EVENT_METRICS_COMPARE_NOT_WIRED',
        error: 'EVENT_METRICS_COMPARE_NOT_WIRED',
        message:
          'Event comparison is not wired. It delegates to the same dashboard query that selects ' +
          'columns which do not exist, so it answered 500 for every request since the genesis. ' +
          'No frontend consumes it. Reopening the three metrics routes is one slice. No money is moved.',
        money_moved: false,
      });
    }
  );

  /**
   * GET /events/:eventId/organizer-metrics
   * Métricas do evento para organizador (versão simplificada)
   */
  fastify.get<{
    Params: { eventId: string };
  }>(
    '/:eventId/organizer-metrics',
    // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
    // ║ STATUS:  CONTIDO — F-EVENT-METRICS-DASHBOARD-CONTAINMENT (2026-08-01)
    // ║ NORMA:   mesma do irmão `/dashboard` logo acima
    // ║ NÃO:     religar trocando coluna. `canViewMetrics` seleciona `created_by_global_user_id`,
    // ║          que NÃO EXISTE em `events` — 500 para qualquer evento desde o gênesis. E
    // ║          `getOrganizerMetrics` chama `getEventDashboard` por dentro, herdando a quebra.
    // ║          🔴 `OrganizerEventMetrics.tsx` é o único consumidor e NUNCA é renderizado.
    // ║ EM VEZ:  501 honesto. ⚠️ Reabrir NÃO é renomeação: `created_by_global_user_id` sustenta
    // ║          AUTORIDADE (quem pode ver métricas), e o modelo migrou de global_user para
    // ║          ACTOR. O mecanismo canônico é `canRepresentActor`, o mesmo que governa
    // ║          availability-owner-authority e audience.routes. Misturar isso com a renomeação
    // ║          do irmão num commit só é como um gate de autorização passa sem ser lido.
    // ╚════════════════════════════════════════════════════════════════
    async (_req, reply) => {
      return reply.status(501).send({
        ok: false,
        code: 'EVENT_ORGANIZER_METRICS_NOT_WIRED',
        error: 'EVENT_ORGANIZER_METRICS_NOT_WIRED',
        message:
          'Organizer metrics are not wired. The permission check selected a column that does not ' +
          'exist, so it answered 500 for every event since the genesis, and its only frontend ' +
          'consumer is never rendered. Reopening is an authorisation change, not a rename: the ' +
          'model moved from global user to Actor and must compose from canRepresentActor. No money is moved.',
        money_moved: false,
      });
    }
  );

  /**
   * GET /events/search
   * Busca eventos com filtros
   */
  fastify.get<{
    Querystring: {
      cityId?: string;
      stateId?: string;
      countryId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>(
    '/search',
    {
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
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        // 🔵 DECISION-0113 F6.5.6b-CANAL5-C: search é discovery → herda o piso B1–B4 (discoveryUserId server-side).
        const events = await eventsService.searchEvents(req.tenant.id, {
          cityId: req.query.cityId,
          stateId: req.query.stateId,
          countryId: req.query.countryId,
          startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
          endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
          limit: req.query.limit,
          offset: req.query.offset,
          discoveryUserId: (req.user as { userId?: string }).userId,
        });

        return { events, totalCents: events.length };
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar eventos');
        return reply.status(500).send({ error: 'Erro ao buscar eventos' });
      }
    }
  );

  /**
   * GET /events/:id/occupancy/stats
   * Estatísticas de ocupação do evento
   */
  fastify.get<{ Params: { id: string } }>('/events/:id/occupancy/stats', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    // 🔵 DECISION-0113 F6.5.6b-CANAL5-B: sub-resource herda canViewEvent do evento-pai (404 não-leak).
    const { canViewEvent } = await import('@core/events/event-visibility.service');
    if (!(await canViewEvent(req.tenant.id, req.params.id, (req.user as { userId?: string }).userId))) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }

    try {
      const stats = await occupancyService.getOccupancyStats(req.tenant.id, req.params.id);
      return reply.send(stats);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar estatísticas de ocupação');
      return reply.status(500).send({ error: 'Erro ao buscar estatísticas' });
    }
  });
};

export default eventsRoutes;


