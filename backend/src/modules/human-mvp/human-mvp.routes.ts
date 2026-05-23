// backend/src/modules/human-mvp/human-mvp.routes.ts
// Rotas do Human MVP
// COMMIT 1: Endpoint criar Skill
// COMMIT 2: Endpoint criar ServiceOffer
// COMMIT 3: Endpoint publicar Opportunity

import { FastifyPluginAsync } from 'fastify';
import { humanMvpSkillService } from './human-mvp-skill.service';
import { humanMvpServiceOfferService } from './human-mvp-service-offer.service';
import { humanMvpOpportunityService } from './human-mvp-opportunity.service';
import { humanMvpEventInstanceService } from './human-mvp-event-instance.service';
import { humanMvpActivityExecutionService } from './human-mvp-activity-execution.service';
import type { CategoryContext } from '@unificard/contracts';

/** Contexto de categoria aceito na API Human MVP (inclui 'person' além do canon) */
export type HumanCategoryContext = CategoryContext | 'person';

const humanMvpRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /human-mvp/skills
   * Cria uma Skill vinculada a uma categoria
   * 
   * Validações obrigatórias:
   * - Categoria existe
   * - Context é permitido (person ou professional)
   * - Tenant tem permissão de write no context
   * 
   * Evento gerado: SKILL_CREATED
   */
  fastify.post<{
    Body: {
      categoryId: string;
      context: CategoryContext;
      personId: string;
    };
  }>(
    '/skills',
    {
      schema: {
        body: {
          type: 'object',
          required: ['categoryId', 'context', 'personId'],
          properties: {
            categoryId: { type: 'string' },
            context: { type: 'string', enum: ['person', 'professional'] },
            personId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        // GUARD: Tenant obrigatório
        if (!req.tenant) {
          return reply.status(401).send({
            ok: false,
            error: 'TENANT_REQUIRED',
          });
        }

        const tenantId = req.tenant.id;

        // GUARD: ActionContext obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return reply.status(400).send({
            ok: false,
            error: 'ACTION_CONTEXT_REQUIRED',
            message: 'ActionContext é obrigatório',
          });
        }

        // Resolver globalUserId a partir do actorId (temporário, até services migrarem para actorId)
        const { socialPortsRegistry } = await import('@core/social/ports-registry');
        const actorRepository = socialPortsRegistry.getActorRepository();
        const actor = await actorRepository.findById(tenantId, req.actionContext.actorId);
        if (!actor || !actor.user_id) {
          return reply.status(404).send({ ok: false, message: 'Actor não encontrado ou não é do tipo user' });
        }
        const { resolveGlobalUserId } = await import('@core/identity/identity.utils');
        const globalUserId = await resolveGlobalUserId(actor.user_id, tenantId);

        // Validar input
        const { categoryId, context, personId } = req.body;

        if (!categoryId || !context || !personId) {
          return reply.status(400).send({
            ok: false,
            error: 'MISSING_REQUIRED_FIELDS',
            message: 'categoryId, context e personId são obrigatórios',
          });
        }

        // Validar context permitido (person e professional aceitos neste endpoint)
        if ((context as string) !== 'person' && (context as string) !== 'professional') {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_CONTEXT',
            message: 'Context deve ser "person" ou "professional"',
          });
        }

        // Criar Skill (context pode ser 'person' ou 'professional')
        const result = await humanMvpSkillService.createSkill(
          { categoryId, context: context as HumanCategoryContext, personId },
          tenantId,
          globalUserId
        );

        return reply.send({
          ok: true,
          data: {
            skillId: result.skillId,
          },
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao criar Skill');

        // Erros específicos
        if (error.message === 'Categoria não encontrada') {
          return reply.status(404).send({
            ok: false,
            error: 'CATEGORY_NOT_FOUND',
            message: error.message,
          });
        }

        if (error.message.includes('CONTEXT_ACCESS_DENIED')) {
          return reply.status(403).send({
            ok: false,
            error: 'CONTEXT_ACCESS_DENIED',
            message: error.message,
          });
        }

        if (error.message.includes('Context inválido')) {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_CONTEXT',
            message: error.message,
          });
        }

        if (error.message.includes('não existe no context')) {
          return reply.status(400).send({
            ok: false,
            error: 'CATEGORY_NOT_IN_CONTEXT',
            message: error.message,
          });
        }

        // Erro genérico
        return reply.status(500).send({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: error.message || 'Erro ao criar Skill',
        });
      }
    }
  );

  /**
   * POST /human-mvp/service-offers
   * Cria uma ServiceOffer vinculada a uma Skill existente
   * 
   * Validações obrigatórias:
   * - Skill existe
   * - Skill é válida
   * - Context é obrigatoriamente professional
   * - Tenant tem permissão de write no context professional
   * - Categoria é herdada da Skill (não redefinível)
   * 
   * Evento gerado: SERVICE_OFFER_CREATED
   */
  fastify.post<{
    Body: {
      skillId: string;
      personId: string;
    };
  }>(
    '/service-offers',
    {
      schema: {
        body: {
          type: 'object',
          required: ['skillId', 'personId'],
          properties: {
            skillId: { type: 'string' },
            personId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        // GUARD: Tenant obrigatório
        if (!req.tenant) {
          return reply.status(401).send({
            ok: false,
            error: 'TENANT_REQUIRED',
          });
        }

        const tenantId = req.tenant.id;

        // Validar input
        const { skillId, personId } = req.body;

        if (!skillId || !personId) {
          return reply.status(400).send({
            ok: false,
            error: 'MISSING_REQUIRED_FIELDS',
            message: 'skillId e personId são obrigatórios',
          });
        }

        // Criar ServiceOffer
        const result = await humanMvpServiceOfferService.createServiceOffer(
          { skillId, personId },
          tenantId
        );

        return reply.send({
          ok: true,
          data: {
            serviceOfferId: result.serviceOfferId,
          },
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao criar ServiceOffer');

        // Erros específicos
        if (error.message === 'Skill não encontrada') {
          return reply.status(404).send({
            ok: false,
            error: 'SKILL_NOT_FOUND',
            message: error.message,
          });
        }

        if (error.message === 'Skill não pertence à pessoa especificada') {
          return reply.status(403).send({
            ok: false,
            error: 'SKILL_OWNERSHIP_MISMATCH',
            message: error.message,
          });
        }

        if (error.message.includes('CONTEXT_ACCESS_DENIED')) {
          return reply.status(403).send({
            ok: false,
            error: 'CONTEXT_ACCESS_DENIED',
            message: error.message,
          });
        }

        // Erro genérico
        return reply.status(500).send({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: error.message || 'Erro ao criar ServiceOffer',
        });
      }
    }
  );

  /**
   * POST /human-mvp/opportunities
   * Publica uma Opportunity vinculada a uma categoria existente
   * 
   * Validações obrigatórias:
   * - Categoria existe
   * - Context é permitido (professional, person ou interest)
   * - Tenant tem permissão de write no context
   * - Opportunity não depende de Skill nem ServiceOffer
   * 
   * Evento gerado: OPPORTUNITY_PUBLISHED
   */
  fastify.post<{
    Body: {
      categoryId: string;
      context: HumanCategoryContext;
      originType: 'person' | 'system' | 'government';
    };
  }>(
    '/opportunities',
    {
      schema: {
        body: {
          type: 'object',
          required: ['categoryId', 'context', 'originType'],
          properties: {
            categoryId: { type: 'string' },
            context: { type: 'string', enum: ['professional', 'person', 'interest'] },
            originType: { type: 'string', enum: ['person', 'system', 'government'] },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        // GUARD: Tenant obrigatório
        if (!req.tenant) {
          return reply.status(401).send({
            ok: false,
            error: 'TENANT_REQUIRED',
          });
        }

        const tenantId = req.tenant.id;

        // Validar input
        const { categoryId, context, originType } = req.body;

        if (!categoryId || !context || !originType) {
          return reply.status(400).send({
            ok: false,
            error: 'MISSING_REQUIRED_FIELDS',
            message: 'categoryId, context e originType são obrigatórios',
          });
        }

        // Validar context permitido
        const allowedContexts: HumanCategoryContext[] = ['professional', 'person', 'interest'];
        if (!allowedContexts.includes(context as HumanCategoryContext)) {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_CONTEXT',
            message: 'Context deve ser "professional", "person" ou "interest"',
          });
        }

        // Validar originType permitido
        const allowedOriginTypes = ['person', 'system', 'government'];
        if (!allowedOriginTypes.includes(originType)) {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_ORIGIN_TYPE',
            message: 'OriginType deve ser "person", "system" ou "government"',
          });
        }

        // Publicar Opportunity (context pode ser person; core aceita CategoryContext)
        const result = await humanMvpOpportunityService.publishOpportunity(
          { categoryId, context: context as CategoryContext, originType },
          tenantId
        );

        return reply.send({
          ok: true,
          data: {
            opportunityId: result.opportunityId,
          },
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao publicar Opportunity');

        // Erros específicos
        if (error.message === 'Categoria não encontrada') {
          return reply.status(404).send({
            ok: false,
            error: 'CATEGORY_NOT_FOUND',
            message: error.message,
          });
        }

        if (error.message.includes('CONTEXT_ACCESS_DENIED')) {
          return reply.status(403).send({
            ok: false,
            error: 'CONTEXT_ACCESS_DENIED',
            message: error.message,
          });
        }

        if (error.message.includes('Context inválido')) {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_CONTEXT',
            message: error.message,
          });
        }

        if (error.message.includes('OriginType inválido')) {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_ORIGIN_TYPE',
            message: error.message,
          });
        }

        if (error.message.includes('não existe no context')) {
          return reply.status(400).send({
            ok: false,
            error: 'CATEGORY_NOT_IN_CONTEXT',
            message: error.message,
          });
        }

        // Erro genérico
        return reply.status(500).send({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: error.message || 'Erro ao publicar Opportunity',
        });
      }
    }
  );

  /**
   * POST /human-mvp/event-instances
   * Cria um EventInstance após MATCH_FOUND aceito
   * 
   * Validações obrigatórias:
   * - MATCH_FOUND existe
   * - matchedPersonId está na lista de matches
   * - Data/hora é válida e futura
   * - Context é válido
   * - Tenant tem permissão de write no context
   * 
   * Evento gerado: EVENT_SCHEDULED
   */
  fastify.post<{
    Body: {
      matchFoundEventId: string;
      matchedPersonId: string;
      scheduledAt: string; // ISO 8601 timestamp
    };
  }>(
    '/event-instances',
    {
      schema: {
        body: {
          type: 'object',
          required: ['matchFoundEventId', 'matchedPersonId', 'scheduledAt'],
          properties: {
            matchFoundEventId: { type: 'string' },
            matchedPersonId: { type: 'string' },
            scheduledAt: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        // GUARD: Tenant obrigatório
        if (!req.tenant) {
          return reply.status(401).send({
            ok: false,
            error: 'TENANT_REQUIRED',
          });
        }

        const tenantId = req.tenant.id;
        const { matchFoundEventId, matchedPersonId, scheduledAt } = req.body;

        // VALIDAÇÃO: Campos obrigatórios
        if (!matchFoundEventId || !matchedPersonId || !scheduledAt) {
          return reply.status(400).send({
            ok: false,
            error: 'MISSING_REQUIRED_FIELDS',
            message: 'matchFoundEventId, matchedPersonId e scheduledAt são obrigatórios',
          });
        }

        const result = await humanMvpEventInstanceService.createEventInstance(
          { matchFoundEventId, matchedPersonId, scheduledAt },
          tenantId
        );

        return reply.send({ ok: true, data: { eventInstanceId: result.eventInstanceId } });
      } catch (error: any) {
        // Erros específicos
        if (error.message === 'MATCH_FOUND não encontrado') {
          return reply.status(404).send({
            ok: false,
            error: 'MATCH_FOUND_NOT_FOUND',
            message: error.message,
          });
        }

        if (error.message === 'matchedPersonId não está na lista de matches') {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_MATCHED_PERSON_ID',
            message: error.message,
          });
        }

        if (error.message === 'Data/hora inválida' || error.message === 'Data/hora deve ser futura') {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_SCHEDULEDAt',
            message: error.message,
          });
        }

        if (error.message?.includes('CONTEXT_ACCESS_DENIED')) {
          return reply.status(403).send({
            ok: false,
            error: 'CONTEXT_ACCESS_DENIED',
            message: error.message,
          });
        }

        if (error.message === 'Context inválido') {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_CONTEXT',
            message: error.message,
          });
        }

        if (error.message === 'Opportunity não encontrada') {
          return reply.status(404).send({
            ok: false,
            error: 'OPPORTUNITY_NOT_FOUND',
            message: error.message,
          });
        }

        // Erro genérico
        return reply.status(500).send({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: error.message || 'Erro ao criar EventInstance',
        });
      }
    }
  );

  /**
   * POST /human-mvp/activity-executions
   * Registra a execução de uma atividade vinculada a um EventInstance
   * 
   * Validações obrigatórias:
   * - EventInstance existe
   * - EventInstance ainda não foi executado
   * - Context é válido
   * - Tenant tem permissão de write no context
   * - Execução só pode ocorrer UMA vez por EventInstance
   * 
   * Evento gerado: ACTIVITY_EXECUTED
   */
  fastify.post<{
    Body: {
      eventInstanceId: string;
    };
  }>(
    '/activity-executions',
    {
      schema: {
        body: {
          type: 'object',
          required: ['eventInstanceId'],
          properties: {
            eventInstanceId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        // GUARD: Tenant obrigatório
        if (!req.tenant) {
          return reply.status(401).send({
            ok: false,
            error: 'TENANT_REQUIRED',
          });
        }

        const tenantId = req.tenant.id;
        const { eventInstanceId } = req.body;

        // VALIDAÇÃO: Campo obrigatório
        if (!eventInstanceId) {
          return reply.status(400).send({
            ok: false,
            error: 'MISSING_REQUIRED_FIELDS',
            message: 'eventInstanceId é obrigatório',
          });
        }

        const result = await humanMvpActivityExecutionService.registerExecution(
          { eventInstanceId },
          tenantId
        );

        return reply.send({ ok: true, data: { executionId: result.executionId } });
      } catch (error: any) {
        // Erros específicos
        if (error.message === 'EventInstance não encontrado') {
          return reply.status(404).send({
            ok: false,
            error: 'EVENT_INSTANCE_NOT_FOUND',
            message: error.message,
          });
        }

        if (error.message === 'EventInstance já foi executado') {
          return reply.status(400).send({
            ok: false,
            error: 'EVENT_INSTANCE_ALREADY_EXECUTED',
            message: error.message,
          });
        }

        if (error.message?.includes('CONTEXT_ACCESS_DENIED')) {
          return reply.status(403).send({
            ok: false,
            error: 'CONTEXT_ACCESS_DENIED',
            message: error.message,
          });
        }

        if (error.message === 'Context inválido') {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_CONTEXT',
            message: error.message,
          });
        }

        // Erro genérico
        return reply.status(500).send({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: error.message || 'Erro ao registrar execução de atividade',
        });
      }
    }
  );
};

export default humanMvpRoutes;


