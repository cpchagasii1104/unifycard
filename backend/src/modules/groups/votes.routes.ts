// src/modules/groups/votes.routes.ts

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { votesService } from './votes.service';
import { votesRepository } from './votes.repository';
import { groupsRepository } from './groups.repository';
import { groupsService } from './groups.service';
import type { CreateVoteInput } from './votes.types';

const createVoteSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(200, 'Título deve ter no máximo 200 caracteres'),
  description: z.string().max(2000, 'Descrição deve ter no máximo 2000 caracteres').nullable().optional(),
  options: z.array(z.string().min(1, 'Opção não pode estar vazia').max(500, 'Opção deve ter no máximo 500 caracteres')).min(2, 'Votação deve ter pelo menos 2 opções').max(20, 'Votação deve ter no máximo 20 opções'),
  closesAt: z.string().datetime().nullable().optional(),
});

const voteSchema = z.object({
  option_id: z.string().uuid('ID da opção inválido'),
});

const votesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/groups/:groupId/votes
   * Cria uma nova votação
   * Auth: admin/owner do grupo
   */
  fastify.post<{
    Params: { groupId: string };
    Body: {
      title: string;
      description?: string | null;
      options: string[];
      closesAt?: string | null;
    };
  }>('/:groupId/votes', async (req, reply) => {
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
      const { groupId } = req.params;
      const userId = req.user.id;

      // D9.2-B (DECISION-0188 D11/D16): gestao do grupo = canRepresentActor (nunca role)
      const isAdminOrOwner = await groupsService.userCanGovernGroup(
        req.tenant.id,
        groupId,
        userId
      );

      if (!isAdminOrOwner) {
        return reply.status(403).send({
          error: 'Apenas representantes do grupo (canRepresentActor) podem criar votações',
        });
      }

      // Validar payload
      const validated = createVoteSchema.parse(req.body);

      // Criar votação (transação atômica: votação + opções + post no feed).
      // userId (req.user.id) → ensureUserActor resolve created_by_actor_id server-side;
      // globalUserId só alimenta o post do feed.
      const vote = await votesService.createVote(
        req.tenant.id,
        groupId,
        validated as CreateVoteInput,
        userId
      );

      // Buscar opções criadas
      const options = await votesRepository.getVoteOptions(req.tenant.id, vote.voteId);

      return reply.status(201).send({
        vote: {
          ...vote,
          options: options.map((opt) => ({
            optionId: opt.optionId,
            text: opt.text,
            displayOrder: opt.displayOrder,
          })),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
      }
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao criar votação');
      return reply.status(500).send({ error: 'Erro ao criar votação' });
    }
  });

  /**
   * GET /api/groups/:groupId/votes
   * Lista votações do grupo
   * Auth: membro do grupo
   */
  fastify.get<{
    Params: { groupId: string };
    Querystring: { status?: 'open' | 'closed' };
  }>('/:groupId/votes', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const { groupId } = req.params;
      const userId = req.user.id;
      const tenantId = req.tenant.id;

      // Validar: usuário é membro do grupo
      const members = await groupsRepository.getMembers(tenantId, groupId);
      const isMember = members.some((m) => m.userId === userId);

      if (!isMember) {
        return reply.status(403).send({
          error: 'Apenas membros do grupo podem visualizar votações',
        });
      }

      // Buscar votações (status opcional: open | closed)
      const status = req.query.status;
      const votes = await votesService.getGroupVotes(tenantId, groupId, status);

      // Adicionar contagem de votos para cada votação
      const votesWithCounts = await Promise.all(
        votes.map(async (vote) => {
          const totalVotes = await votesRepository.getVoteResponseCount(tenantId, vote.voteId);
          return {
            ...vote,
            totalVotes,
          };
        })
      );

      return reply.send({ votes: votesWithCounts });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar votações');
      return reply.status(500).send({ error: 'Erro ao listar votações' });
    }
  });

  /**
   * GET /api/groups/:groupId/votes/:voteId
   * Busca detalhes de uma votação
   * Auth: membro do grupo
   * Se admin/owner: inclui lista de votantes
   */
  fastify.get<{
    Params: { groupId: string; voteId: string };
  }>('/:groupId/votes/:voteId', async (req, reply) => {
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
      const { groupId, voteId } = req.params;
      const userId = req.user.id;

      // Validar: usuário é membro do grupo
      const members = await groupsRepository.getMembers(req.tenant.id, groupId);
      const isMember = members.some((m) => m.userId === userId);

      if (!isMember) {
        return reply.status(403).send({
          error: 'Apenas membros do grupo podem visualizar votações',
        });
      }

      // Verificar se é admin/owner
      const isAdminOrOwner = await groupsService.userCanGovernGroup(
        req.tenant.id,
        groupId,
        userId
      );

      // Buscar votação com opções e contagem (identidade operacional = req.user.id → actor)
      const vote = await votesService.getVoteWithOptions(
        req.tenant.id,
        voteId,
        userId,
        isAdminOrOwner
      );

      return reply.send({ vote });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao buscar votação');
      return reply.status(500).send({ error: 'Erro ao buscar votação' });
    }
  });

  /**
   * POST /api/groups/:groupId/votes/:voteId/vote
   * Registra voto do usuário
   * Auth: membro do grupo
   */
  fastify.post<{
    Params: { groupId: string; voteId: string };
    Body: { option_id: string };
  }>('/:groupId/votes/:voteId/vote', async (req, reply) => {
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
      const { groupId, voteId } = req.params;
      const userId = req.user.id;

      // Validar: usuário é membro do grupo
      const members = await groupsRepository.getMembers(req.tenant.id, groupId);
      const isMember = members.some((m) => m.userId === userId);

      if (!isMember) {
        return reply.status(403).send({
          error: 'Apenas membros do grupo podem votar',
        });
      }

      // Validar payload
      const validated = voteSchema.parse(req.body);

      // Registrar voto (identidade operacional = req.user.id → actor server-side)
      await votesService.vote(
        req.tenant.id,
        groupId,
        voteId,
        validated.option_id,
        userId
      );

      // Retornar votação atualizada
      const isAdminOrOwner = await groupsService.userCanGovernGroup(
        req.tenant.id,
        groupId,
        userId
      );

      const vote = await votesService.getVoteWithOptions(
        req.tenant.id,
        voteId,
        userId,
        isAdminOrOwner
      );

      return reply.send({ vote });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
      }
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao registrar voto');
      return reply.status(500).send({ error: 'Erro ao registrar voto' });
    }
  });

  /**
   * PATCH /api/groups/:groupId/votes/:voteId/close
   * Fecha uma votação
   * Auth: admin/owner do grupo
   */
  fastify.patch<{
    Params: { groupId: string; voteId: string };
  }>('/:groupId/votes/:voteId/close', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const { groupId, voteId } = req.params;
      const userId = req.user.id;

      // D9.2-B (DECISION-0188 D11/D16): gestao do grupo = canRepresentActor (nunca role)
      const isAdminOrOwner = await groupsService.userCanGovernGroup(
        req.tenant.id,
        groupId,
        userId
      );

      if (!isAdminOrOwner) {
        return reply.status(403).send({
          error: 'Apenas representantes do grupo (canRepresentActor) podem fechar votações',
        });
      }

      // Fechar votação (admin/owner já validado; quarentena checada server-side no service via ensureUserActor)
      const vote = await votesService.closeVote(req.tenant.id, groupId, voteId, userId);

      return reply.send({ vote });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao fechar votação');
      return reply.status(500).send({ error: 'Erro ao fechar votação' });
    }
  });
};

export default votesRoutes;
