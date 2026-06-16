// src/modules/votes/votes.routes.ts
// Rotas para o sistema de votações

import { FastifyPluginAsync } from 'fastify';
import { votesService } from './votes.service';

// 🔴 F-VOTES-WRITES-EXPLICIT-FAIL-CLOSED-CONTAINMENT (DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING):
// Os 4 writes deste módulo (create/publish/vote/close) derivam a autoria de `req.activeActor`, que
// **nenhum** hook/middleware popula no backend (verificado: único LEITOR é este arquivo; ZERO escritor
// em todo `backend/src`). Em runtime as escritas caíam num **401 "Actor não encontrado" ENGANOSO**
// (wiring fantasma — convergência interrompida), nunca passando do check de `activeActor`. Logo, o
// write-authorship-spoof descrito na frente NÃO era alcançável: as rotas estão MORTAS.
//
// Decisão IA Diretora (2026-06-16): NÃO religar agora (resolver active actor + ativar votação = mudança
// de produto + exige política fina de elegibilidade). Substituir o 401 enganoso por uma contenção
// **fail-closed HONESTA**: 501 nomeado, ZERO chamada ao `votesService`, ZERO escrita. Reads intocados.
// Religação canônica (resolveActiveActorFromRequest + canRepresentActor + userId REAL) = frente própria
// (DT-VOTES-WRITE-AUTHORSHIP-BINDING-LATENT) após a decisão de elegibilidade (DT-VOTES-FINE-GRAINED-
// ELIGIBILITY-POLICY). Enquanto isso, o binding mecânico fica REGISTRADO como dívida, não aplicado a
// uma rota morta.
const VOTES_WRITES_CONTAINED = {
  ok: false,
  code: 'VOTES_ACTIVE_ACTOR_WIRING_MISSING',
  message:
    'Escritas de votação estão indisponíveis: a resolução canônica do actor ativo (req.activeActor) ' +
    'nunca é materializada e a política de elegibilidade de votação não foi decidida. ' +
    'Religação é frente própria (DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING / DT-VOTES-WRITE-AUTHORSHIP-BINDING-LATENT).',
};

const votesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /votes
   * Cria uma nova votação (status = draft)
   */
  fastify.post('/', async (_req, reply) => {
    // 🔴 CONTIDO fail-closed (DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING): ZERO chamada ao votesService, ZERO escrita.
    return reply.status(501).send(VOTES_WRITES_CONTAINED);
  });

  /**
   * POST /votes/:id/publish
   * Publica uma votação (muda status para active)
   */
  fastify.post<{
    Params: { id: string };
  }>('/:id/publish', async (_req, reply) => {
    // 🔴 CONTIDO fail-closed (DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING): ZERO chamada ao votesService, status inalterado.
    return reply.status(501).send(VOTES_WRITES_CONTAINED);
  });

  /**
   * POST /votes/:id/vote
   * Registra voto do actor ativo
   */
  fastify.post<{
    Params: { id: string };
  }>('/:id/vote', async (_req, reply) => {
    // 🔴 CONTIDO fail-closed (DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING): ZERO chamada ao votesService, ZERO voto criado.
    return reply.status(501).send(VOTES_WRITES_CONTAINED);
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
  }>('/:id/close', async (_req, reply) => {
    // 🔴 CONTIDO fail-closed (DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING): ZERO chamada ao votesService, status inalterado.
    // (4º write do módulo — mesmo wiring fantasma `req.activeActor`; o GO nomeou 3, mas a contenção cobre
    //  todos os writes que dependem do campo não-populado, senão restaria um sibling spoof latente.)
    return reply.status(501).send(VOTES_WRITES_CONTAINED);
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








