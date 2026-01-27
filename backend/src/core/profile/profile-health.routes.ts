// src/core/profile/profile-health.routes.ts
// Rotas para autodeclaração de saúde V3 (modelo relacional)
// TODO: DOMÍNIO ESPECIAL -> categories (core) - profileHealthTaxonomyRepository será substituído por adapter sobre categories core

import { FastifyPluginAsync } from 'fastify';
import { profileHealthService } from './profile-health.service';
import { profileHealthTaxonomyRepository } from './profile-health-taxonomy.repository';
import { profileHealthFactsRepository } from './profile-health-facts.repository';
import type { CreateHealthDeclarationInput } from './profile-health.types';
import { socialPortsRegistry } from '@core/social/ports-registry';

const profileHealthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /profile/health/taxonomies
   * Busca taxonomias de saúde disponíveis (por categoria)
   * TODO: DOMÍNIO ESPECIAL -> categories (core) - Migrar para usar categoriesService com filtro por metadata.category
   */
  fastify.get<{ Querystring: { category?: string } }>('/health/taxonomies', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const category = req.query.category as any;
      const validCategories = ['general', 'vision', 'dental', 'medications', 'mobility', 'mental', 'other'];
      
      if (category && !validCategories.includes(category)) {
        return reply.status(400).send({
          ok: false,
          message: `Categoria inválida. Valores permitidos: ${validCategories.join(', ')}`,
        });
      }

      // TODO: DOMÍNIO ESPECIAL -> categories (core) - Substituir profileHealthTaxonomyRepository por categoriesService
      const taxonomies = category
        ? await profileHealthTaxonomyRepository.findByCategory(req.tenant.id, category)
        : await Promise.all(
            validCategories.map((cat) =>
              profileHealthTaxonomyRepository.findByCategory(req.tenant.id, cat as any)
            )
          ).then((results) => results.flat());

      return reply.send({ ok: true, data: taxonomies });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar taxonomias de saúde');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao buscar taxonomias de saúde',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /profile/health/facts
   * Busca fatos de saúde do actor autenticado
   */
  fastify.get<{ Querystring: { category?: string } }>('/health/facts', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const actorUtils = socialPortsRegistry.getActorUtils();
      const currentActor = await actorUtils.resolveActiveActorFromRequest(req, req.tenant.id, {
        allowUserFallback: true,
        userId: req.user.id,
      });

      const category = req.query.category as any;
      const facts = category
        ? await profileHealthFactsRepository.findByCategory(req.tenant.id, currentActor.actor_id, category)
        : await profileHealthFactsRepository.findByActorId(req.tenant.id, currentActor.actor_id);

      // Enriquecer com informações da taxonomia
      // TODO: DOMÍNIO ESPECIAL -> categories (core) - Substituir profileHealthTaxonomyRepository por categoriesService
      const enrichedFacts = await Promise.all(
        facts.map(async (fact) => {
          const taxonomy = await profileHealthTaxonomyRepository.findById(req.tenant.id, fact.taxonomyId);
          return {
            ...fact,
            taxonomy: taxonomy || null,
          };
        })
      );

      return reply.send({ ok: true, data: enrichedFacts });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar fatos de saúde');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao buscar fatos de saúde',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /profile/health/facts
   * Cria ou atualiza fato de saúde estruturado
   */
  fastify.post<{
    Body: {
      taxonomyId: string;
      valueText?: string | null;
      valueNumber?: number | null;
      valueBoolean?: boolean | null;
      valueDate?: string | null;
      notes?: string | null;
    };
  }>('/health/facts', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      let actorId: string;
      const actionContext = (req as any).actionContext;

      if (actionContext?.actingActorId) {
        actorId = actionContext.actingActorId;
      } else {
        const actorUtils = socialPortsRegistry.getActorUtils();
        const currentActor = await actorUtils.resolveActiveActorFromRequest(req, req.tenant.id, {
          allowUserFallback: true,
          userId: req.user.id,
        });
        actorId = currentActor.actor_id;
      }

      const fact = await profileHealthFactsRepository.upsert(req.tenant.id, actorId, {
        taxonomyId: req.body.taxonomyId,
        valueText: req.body.valueText,
        valueNumber: req.body.valueNumber,
        valueBoolean: req.body.valueBoolean,
        valueDate: req.body.valueDate || undefined,
        notes: req.body.notes || null,
      });

      // Enriquecer com taxonomia
      // TODO: DOMÍNIO ESPECIAL -> categories (core) - Substituir profileHealthTaxonomyRepository por categoriesService
      const taxonomy = await profileHealthTaxonomyRepository.findById(req.tenant.id, fact.taxonomyId);

      fastify.log.info({
        tenantId: req.tenant.id,
        actorId: actorId,
        factId: fact.factId,
        taxonomyId: fact.taxonomyId,
      }, 'POST /profile/health/facts - Sucesso');

      return reply.status(201).send({
        ok: true,
        data: {
          ...fact,
          taxonomy: taxonomy || null,
        },
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao criar fato de saúde');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao criar fato de saúde',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /profile/health/facts/:id
   * Remove fato de saúde
   */
  fastify.delete<{ Params: { id: string } }>('/health/facts/:id', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      let actorId: string;
      const actionContext = (req as any).actionContext;

      if (actionContext?.actingActorId) {
        actorId = actionContext.actingActorId;
      } else {
        const actorUtils = socialPortsRegistry.getActorUtils();
        const currentActor = await actorUtils.resolveActiveActorFromRequest(req, req.tenant.id, {
          allowUserFallback: true,
          userId: req.user.id,
        });
        actorId = currentActor.actor_id;
      }

      await profileHealthFactsRepository.delete(req.tenant.id, actorId, req.params.id);

      fastify.log.info({
        tenantId: req.tenant.id,
        actorId: actorId,
        factId: req.params.id,
      }, 'DELETE /profile/health/facts/:id - Sucesso');

      return reply.send({ ok: true, message: 'Fato removido com sucesso' });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao remover fato de saúde');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao remover fato de saúde',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /profile/health/declarations
   * Busca todas as declarações de saúde do actor autenticado
   */
  fastify.get('/health/declarations', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const actorUtils = socialPortsRegistry.getActorUtils();
      const currentActor = await actorUtils.resolveActiveActorFromRequest(req, req.tenant.id, {
        allowUserFallback: true,
        userId: req.user.id,
      });

      const section = (req.query as any)?.section as string | undefined;
      const validSections = ['general', 'vision', 'dental', 'medications', 'mobility', 'mental', 'other'];
      const sectionFilter = section && validSections.includes(section) ? (section as any) : undefined;

      const declarations = await profileHealthService.getDeclarations(
        req.tenant.id,
        currentActor.actor_id,
        sectionFilter
      );

      fastify.log.info({
        tenantId: req.tenant.id,
        actorId: currentActor.actor_id,
        count: declarations.length,
      }, 'GET /profile/health/declarations - Sucesso');

      return reply.send({ ok: true, data: declarations });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar declarações de saúde');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao buscar declarações de saúde',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /profile/health/declarations
   * Cria nova declaração de saúde
   * Valida consentimento obrigatório (consent === true)
   */
  fastify.post<{ Body: CreateHealthDeclarationInput }>('/health/declarations', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      let actorId: string;
      const actionContext = (req as any).actionContext;

      if (actionContext?.actingActorId) {
        actorId = actionContext.actingActorId;
      } else {
        const actorUtils = socialPortsRegistry.getActorUtils();
        const currentActor = await actorUtils.resolveActiveActorFromRequest(req, req.tenant.id, {
          allowUserFallback: true,
          userId: req.user.id,
        });
        actorId = currentActor.actor_id;
      }

      const input = req.body;

      if (input.consent !== true) {
        return reply.status(400).send({
          ok: false,
          message: 'Consentimento é obrigatório e deve ser true',
        });
      }

      const declaration = await profileHealthService.createDeclaration(req.tenant.id, actorId, input);

      fastify.log.info({
        tenantId: req.tenant.id,
        actorId: actorId,
        declarationId: declaration.id,
      }, 'POST /profile/health/declarations - Sucesso');

      return reply.status(201).send({ ok: true, data: declaration });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao criar declaração de saúde');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao criar declaração de saúde',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /profile/health/declarations/:id
   * Remove declaração de saúde
   */
  fastify.delete<{ Params: { id: string } }>('/health/declarations/:id', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      let actorId: string;
      const actionContext = (req as any).actionContext;

      if (actionContext?.actingActorId) {
        actorId = actionContext.actingActorId;
      } else {
        const actorUtils = socialPortsRegistry.getActorUtils();
        const currentActor = await actorUtils.resolveActiveActorFromRequest(req, req.tenant.id, {
          allowUserFallback: true,
          userId: req.user.id,
        });
        actorId = currentActor.actor_id;
      }

      await profileHealthService.deleteDeclaration(req.tenant.id, actorId, req.params.id);

      fastify.log.info({
        tenantId: req.tenant.id,
        actorId: actorId,
        declarationId: req.params.id,
      }, 'DELETE /profile/health/declarations/:id - Sucesso');

      return reply.send({ ok: true, message: 'Declaração removida com sucesso' });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao remover declaração de saúde');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao remover declaração de saúde',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};

export default profileHealthRoutes;
