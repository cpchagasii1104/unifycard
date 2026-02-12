// src/modules/votes/votes.routes.ts
// Rotas para o sistema de votações

import { FastifyPluginAsync } from 'fastify';
import { votesService } from './votes.service';
import type { CreateVoteInput } from '../groups/votes.types';
import { z } from 'zod';

const createVoteSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  options: z.array(z.string().min(1).max(255)).min(2),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

const voteSchema = z.object({
  option_id: z.string().uuid(),
});

const votesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /votes
   * Cria uma nova votação (status = draft)
   */
  fastify.post<{
    Body: z.infer<typeof createVoteSchema>;
  }>('/', async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const parsed = createVoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: parsed.error.errors,
        });
      }

      const { activeActor } = req as any;
      if (!activeActor) {
        return reply.status(401).send({ error: 'Actor não encontrado' });
      }

      const vote = await votesService.createVote(
        req.tenant.id,
        req.actionContext.actorId,
        req.actionContext.actorId,
        activeActor.actor_id,
        parsed.data as CreateVoteInput
      );

      return reply.status(201).send(vote);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao criar votação');
      return reply.status(400).send({ error: error.message || 'Erro ao criar votação' });
    }
  });

  /**
   * POST /votes/:id/publish
   * Publica uma votação (muda status para active)
   */
  fastify.post<{
    Params: { id: string };
  }>('/:id/publish', async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const { activeActor } = req as any;
      if (!activeActor) {
        return reply.status(401).send({ error: 'Actor não encontrado' });
      }

      const vote = await votesService.publishVote(
        req.tenant.id,
        req.actionContext.actorId,
        req.actionContext.actorId,
        req.params.id,
        activeActor.actor_id
      );

      return reply.send(vote);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao publicar votação');
      return reply.status(400).send({ error: error.message || 'Erro ao publicar votação' });
    }
  });

  /**
   * POST /votes/:id/vote
   * Registra voto do actor ativo
   */
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof voteSchema>;
  }>('/:id/vote', async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      const parsed = voteSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: parsed.error.errors,
        });
      }

      const { activeActor } = req as any;
      if (!activeActor) {
        return reply.status(401).send({ error: 'Actor não encontrado' });
      }

      await votesService.vote(
        req.tenant.id,
        req.params.id,
        parsed.data.option_id,
        activeActor.actor_id
      );

      return reply.status(200).send({ success: true });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao votar');
      return reply.status(400).send({ error: error.message || 'Erro ao votar' });
    }
  });

  /**
   * GET /votes
   * Lista votações (ativas e encerradas)
   */
  fastify.get<{
    Querystring: {
      status?: 'draft' | 'active' | 'closed';
      limit?: string;
      offset?: string;
    };
  }>('/', async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset, 10) : undefined;

      const result = await votesService.listVotes(req.tenant.id, {
        status: req.query.status,
        limit,
        offset,
      });

      return reply.send(result);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar votações');
      return reply.status(500).send({ error: 'Erro ao listar votações' });
    }
  });

  /**
   * GET /votes/:id
   * Busca detalhes de uma votação
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id', async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      const { activeActor } = req as any;
      const actorId = activeActor?.actor_id;

      const vote = await votesService.getVote(
        req.tenant.id,
        req.params.id,
        actorId
      );

      if (!vote) {
        return reply.status(404).send({ error: 'Votação não encontrada' });
      }

      return reply.send(vote);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao buscar votação');
      return reply.status(500).send({ error: 'Erro ao buscar votação' });
    }
  });

  /**
   * POST /votes/:id/close
   * Encerra uma votação (muda status para closed)
   */
  fastify.post<{
    Params: { id: string };
  }>('/:id/close', async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const { activeActor } = req as any;
      if (!activeActor) {
        return reply.status(401).send({ error: 'Actor não encontrado' });
      }

      const vote = await votesService.closeVote(
        req.tenant.id,
        req.actionContext.actorId,
        req.actionContext.actorId,
        req.params.id,
        activeActor.actor_id
      );

      return reply.send(vote);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao encerrar votação');
      return reply.status(400).send({ error: error.message || 'Erro ao encerrar votação' });
    }
  });

  /**
   * GET /votes/:id/audit
   * Retorna dados de auditoria (sem nomes individuais)
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id/audit', async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      const vote = await votesService.getVote(req.tenant.id, req.params.id);
      
      if (!vote) {
        return reply.status(404).send({ error: 'Votação não encontrada' });
      }

      return reply.send({
        vote_id: vote.vote_id,
        title: vote.title,
        status: vote.status,
        total_votes: vote.total_votes || 0,
        results: vote.results || [],
        createdAt: vote.createdAt,
        startsAt: vote.startsAt,
        endsAt: vote.endsAt,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao buscar auditoria');
      return reply.status(500).send({ error: 'Erro ao buscar auditoria' });
    }
  });
};

export default votesRoutes;








