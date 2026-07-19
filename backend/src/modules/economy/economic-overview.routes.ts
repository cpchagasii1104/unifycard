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
      //
      // 🔒 DECISION-0189B D6: (1) verifica disponibilidade das dependências ANTES da consulta;
      // (2) qualquer erro de infra na consulta OU falha de audit → 503 CONTROLADO e SANITIZADO
      // (nunca error.message/SQLSTATE/SQL/nome de tabela no corpo; detalhe só no log com req.id);
      // (3) no-store sempre; (4) audit ANTES do disclosure — falha de audit IMPEDE a resposta.
      const { overviewDependenciesAvailable, OVERVIEW_UNAVAILABLE_BODY } = await import('./economic-overview.availability');
      reply.header('Cache-Control', 'no-store');

      const deps = await overviewDependenciesAvailable();
      if (!deps.available) {
        fastify.log.warn({ reqId: req.id, missing: deps.missing }, 'economic overview: dependências indisponíveis');
        return reply.status(503).send(OVERVIEW_UNAVAILABLE_BODY);
      }

      const { authorizeActorFinancialRead } = await import('@core/authorization/financial-read-authority');
      let outcome;
      try {
        outcome = await authorizeActorFinancialRead(
          req.tenant.id,
          req.user.userId,
          req.params.actorId,
          () => economicOverviewService.getActorEconomicOverview(req.tenant.id, req.params.actorId)
        );
      } catch (error) {
        fastify.log.error({ reqId: req.id, err: error }, 'economic overview: falha na consulta financeira (sanitizado)');
        return reply.status(503).send(OVERVIEW_UNAVAILABLE_BODY);
      }
      if (!outcome.allowed) {
        return reply.status(403).send({ error: 'Sem autoridade financeira exata (view_financial) sobre o actor', code: 'VIEW_FINANCIAL_REQUIRED' });
      }

      // Audit ANTES do disclosure — falha de audit IMPEDE a resposta financeira (503 sanitizado).
      const { recordFinancialAudit } = await import('@core/observability/financial-audit');
      try {
        await recordFinancialAudit({
          tenant_id: req.tenant.id,
          event_type: 'financial_read_economic_overview',
          actor_id: req.params.actorId,
          metadata: { readBy: req.user.userId, role: outcome.role, route: 'GET /economy/actors/:actorId/overview' },
        });
      } catch (error) {
        fastify.log.error({ reqId: req.id, err: error }, 'economic overview: falha de audit — disclosure BLOQUEADO (sanitizado)');
        return reply.status(503).send(OVERVIEW_UNAVAILABLE_BODY);
      }
      return reply.send({ ok: true, data: outcome.result });
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
      // 🔒 DECISION-0189B D6: no-store sempre; erro de infra → 503 SANITIZADO (sem message/SQL/tabela).
      reply.header('Cache-Control', 'no-store');
      const { OVERVIEW_UNAVAILABLE_BODY } = await import('./economic-overview.availability');
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
        return reply.send({ ok: true, data: overview });
      } catch (error) {
        fastify.log.error({ reqId: req.id, err: error }, 'economic overview grupo: falha na consulta (sanitizado)');
        return reply.status(503).send(OVERVIEW_UNAVAILABLE_BODY);
      }
    }
  );
};

export default economicOverviewRoutes;

