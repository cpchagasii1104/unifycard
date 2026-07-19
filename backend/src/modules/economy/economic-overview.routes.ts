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

      // 🔒 DECISION-0189A §5 (D7.A — R19): o payload é AGREGADO ECONÔMICO PRIVADO
      // (totalReceived/totalPaid/fluxo/lastTransactions com amountCents) — o rótulo "não é
      // saldo" não muda a natureza. Autoridade EXATA e TERMINAL: self OU can_view_financial
      // de membership ativa (representação/gestão NÃO leem dinheiro). Leitura sob lock
      // (linearização contra revogação), no-store e AUDIT antes do disclosure.
      const { authorizeActorFinancialRead } = await import('@core/authorization/financial-read-authority');
      try {
        const outcome = await authorizeActorFinancialRead(
          req.tenant.id,
          req.user.userId,
          req.params.actorId,
          () => economicOverviewService.getActorEconomicOverview(req.tenant.id, req.params.actorId)
        );
        if (!outcome.allowed) {
          return reply.status(403).send({ error: 'Sem autoridade financeira exata (view_financial) sobre o actor', code: 'VIEW_FINANCIAL_REQUIRED' });
        }
        const { recordFinancialAudit } = await import('@core/observability/financial-audit');
        await recordFinancialAudit({
          tenant_id: req.tenant.id,
          event_type: 'financial_read_economic_overview',
          actor_id: req.params.actorId,
          metadata: { readBy: req.user.userId, role: outcome.role, route: 'GET /economy/actors/:actorId/overview' },
        });
        reply.header('Cache-Control', 'no-store');
        return reply.send({ ok: true, data: outcome.result });
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

      // 🔒 DECISION-0189A §5 (D7.A): esta rota era ABERTA a qualquer autenticado do tenant
      // (agregado econômico privado do grupo sem gate). Leitura financeira de GRUPO não tem
      // substrato de autorização promulgado → FAIL-CLOSED (mesma fachada terminal: grupos
      // negam). Religar = substrato próprio de grupos (fora desta campanha).
      const { hasActorFinancialReadAuthority } = await import('@core/authorization/financial-read-authority');
      const gate = await hasActorFinancialReadAuthority(req.tenant.id, req.user.userId, req.params.groupId);
      if (!gate.allowed) {
        return reply.status(403).send({ error: 'Leitura financeira de grupo sem substrato de autorização — fail-closed (DECISION-0189A)', code: 'GROUP_FINANCIAL_READ_HELD' });
      }
      try {
        const overview = await economicOverviewService.getGroupEconomicOverview(
          req.tenant.id,
          req.params.groupId
        );
        reply.header('Cache-Control', 'no-store');
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

