// backend/src/modules/events/events-spec.routes.ts
// Rotas para EventSpec - Especificação Declarativa de Evento
// ⚠️ REGRA INSTITUCIONAL: EventSpec NÃO decide nada. É apenas especificação declarada pelo usuário.
// FASE 5: Escrita incremental e fechamento

import { FastifyPluginAsync } from 'fastify';
import { eventSpecService } from '@core/events/specs/event-spec.service';
import type { CreateEventSpecInput } from '@core/events/specs/event-spec.types';

const eventsSpecRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /event-specs
   * Cria um novo EventSpec
   */
  fastify.post<{
    Body: CreateEventSpecInput;
  }>('/event-specs', async (request, reply) => {
    const tenantId = (request as any).tenant_id;
    const userId = (request as any).user_id;

    if (!tenantId || !userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const spec = await eventSpecService.createEventSpec(
        tenantId,
        userId,
        request.body
      );

      return reply.code(201).send({ spec });
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao criar EventSpec' });
    }
  });

  /**
   * GET /event-specs/:specId
   * Busca EventSpec por ID
   */
  fastify.get<{
    Params: { specId: string };
  }>('/event-specs/:specId', async (request, reply) => {
    const tenantId = (request as any).tenant_id;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const spec = await eventSpecService.getEventSpecById(
        tenantId,
        request.params.specId
      );

      return reply.code(200).send({ spec });
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao buscar EventSpec' });
    }
  });

  /**
   * PATCH /event-specs/:specId/incremental
   * Atualiza incrementalmente o EventSpec durante FASE 5 (INTENT_DRAFT)
   * 
   * 🔴 REGRA CANÔNICA (FASE_5_EVENTSPEC_IMMUTABILITY_AND_VERSIONING.md):
   * - Permitido apenas quando EventSpec está em construção (não fechado)
   * - Event associado deve estar em status 'draft'
   * - Merge superficial de partialSpec com answers existente
   */
  fastify.patch<{
    Params: { specId: string };
    Body: {
      partialSpec: Record<string, any>;
    };
  }>('/event-specs/:specId/incremental', {
    schema: {
      body: {
        type: 'object',
        required: ['partialSpec'],
        properties: {
          partialSpec: {
            type: 'object',
            description: 'Fragmento de answers para mesclar com EventSpec existente',
          },
        },
      },
    },
  }, async (request, reply) => {
    const tenantId = (request as any).tenant_id;
    const userId = (request as any).user_id;

    if (!tenantId || !userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const spec = await eventSpecService.updateEventSpecIncremental(
        tenantId,
        request.params.specId,
        request.body.partialSpec,
        userId
      );

      return reply.code(200).send({ spec });
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao atualizar EventSpec' });
    }
  });

  /**
   * POST /event-specs/:specId/close
   * Fecha o EventSpec (torna imutável)
   * 
   * 🔴 REGRA CANÔNICA (FASE_5_EVENTSPEC_IMMUTABILITY_AND_VERSIONING.md):
   * - Executado mediante ação humana explícita "Salvar planejamento"
   * - Após fechamento, EventSpec torna-se imutável
   * - Qualquer alteração futura exige novo snapshot
   */
  fastify.post<{
    Params: { specId: string };
  }>('/event-specs/:specId/close', async (request, reply) => {
    const tenantId = (request as any).tenant_id;
    const userId = (request as any).user_id;

    if (!tenantId || !userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const spec = await eventSpecService.closeEventSpec(
        tenantId,
        request.params.specId,
        userId
      );

      return reply.code(200).send({ spec });
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao fechar EventSpec' });
    }
  });

  /**
   * GET /event-specs?event_id=...
   * Busca EventSpecs por query (suporta event_id)
   */
  fastify.get<{
    Querystring: {
      event_id?: string;
      actor_id?: string;
      macro_intention?: string;
      subflow?: string;
      limit?: number;
      offset?: number;
    };
  }>('/event-specs', async (request, reply) => {
    const tenantId = (request as any).tenant_id;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // 🔴 DECISION-0113 (canal 3): actor_id da query é HINT, não autoridade. EventSpec é planning/intention
    // PRIVADO do actor (macro_intention/answers/metadata). Quando o filtro é por actor_id, prova que o usuário
    // autenticado pode REPRESENTAR esse actor ANTES de consultar (fail-closed → 403 não-leak). O caminho por
    // event_id (sem actor_id) NÃO é tocado aqui — depende do modelo de visibility de evento (canal 5 / F6.5.6b-B).
    const actorIdFilter = request.query.actor_id ?? (request.query as { actorId?: string }).actorId;
    if (actorIdFilter) {
      const userId = (request as any).user_id;
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      let canRepresent = false;
      try {
        const { authorizationService } = await import('@core/authorization/authorization.service');
        canRepresent = await authorizationService.canRepresentActor(tenantId, userId, actorIdFilter);
      } catch { canRepresent = false; }
      if (!canRepresent) {
        return reply.code(403).send({ error: 'Actor não representável pelo usuário autenticado' });
      }
    }

    try {
      const specs = await eventSpecService.queryEventSpecs(tenantId, {
        eventId: request.query.event_id ?? (request.query as { eventId?: string }).eventId,
        actorId: actorIdFilter,
        macroIntention: request.query.macro_intention as any,
        subflow: request.query.subflow as any,
        limit: request.query.limit || 100,
        offset: request.query.offset || 0,
      });

      return reply.code(200).send({ specs });
    } catch (error: any) {
      if (error.status) {
        return reply.code(error.status).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Erro ao buscar EventSpecs' });
    }
  });
};

export { eventsSpecRoutes };


