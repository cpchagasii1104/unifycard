// src/modules/economy/economic-overview.routes.ts
// Rotas do Dashboard Econômico (READ-ONLY)
// 🔴 BLINDAGEM: Endpoints READ-ONLY (apenas visualização)
// 🔴 BLINDAGEM: NÃO cria dinheiro, NÃO executa pagamento, NÃO decide nada
// 🔴 BLINDAGEM: Apenas EXIBE o que já aconteceu

import { FastifyPluginAsync } from 'fastify';
import { economicOverviewService } from './economic-overview.service';

const economicOverviewRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /economy/actors/:actorId/overview
   * Buscar overview econômico de um actor
   * 🔴 BLINDAGEM: READ-ONLY - apenas visualização histórica
   * 🔴 BLINDAGEM: NÃO é banco, NÃO é carteira, NÃO é saldo
   */
  fastify.get<{ Params: { actorId: string } }>(
    '/actors/:actorId/overview',
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // 🔴 DECISION-0113 canal-5 (params): `actorId` em params é endereço, não autoridade. Overview ECONÔMICO
      // do actor exige REPRESENTAR o actor (mesmo actorId que dirige a leitura). Fail-closed → 403.
      let canRepresent = false;
      try {
        const { authorizationService } = await import('@core/authorization/authorization.service');
        canRepresent = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.params.actorId);
      } catch {
        canRepresent = false;
      }
      if (!canRepresent) {
        return reply.status(403).send({ error: 'Sem autoridade sobre o actor (canRepresentActor)' });
      }

      try {
        const overview = await economicOverviewService.getActorEconomicOverview(
          req.tenant.id,
          req.params.actorId
        );

        return reply.send({ ok: true, data: overview });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar overview econômico do actor');
        return reply.status(500).send({
          error: 'Erro ao buscar overview econômico do actor',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /economy/groups/:groupId/overview
   * Buscar overview econômico de um grupo
   * 🔴 BLINDAGEM: READ-ONLY - apenas visualização histórica
   * 🔴 BLINDAGEM: NÃO é banco, NÃO é carteira, NÃO é saldo
   */
  fastify.get<{ Params: { groupId: string } }>(
    '/groups/:groupId/overview',
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      try {
        const overview = await economicOverviewService.getGroupEconomicOverview(
          req.tenant.id,
          req.params.groupId
        );

        return reply.send({ ok: true, data: overview });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar overview econômico do grupo');
        return reply.status(500).send({
          error: 'Erro ao buscar overview econômico do grupo',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
};

export default economicOverviewRoutes;

