/**
 * Mutações explícitas de disputa (reconciliation_ledger_discrepancies → reconciliation_disputes).
 *
 * CONTENÇÃO P1 (F-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY-CONTAINMENT): as mutações HTTP
 * (from-discrepancy / to-review / resolve) liam `actor` do BODY (system/admin/support) sem
 * binding server-side — actor declarado pelo cliente é HINT, nunca autoridade (DECISION-0113,
 * 6º canal). Estão DESABILITADAS fail-closed (403 DISPUTE_MUTATION_HTTP_DISABLED) até existir
 * authority binding verificada. O helper `parseActor`/`parseOptionalReason` foi REMOVIDO junto
 * (sem caller restante). GET /disputes/:id/events (leitura) permanece. /reversal segue contido
 * em separado (403 DISPUTE_REVERSAL_HTTP_DISABLED). Ver DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY.
 */

import type { FastifyPluginAsync } from 'fastify';
import { reconciliationDisputeService } from './reconciliation-dispute.service';

const reconciliationDisputeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/disputes/:id/events', async (req, reply) => {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    }
    try {
      const events = await reconciliationDisputeService.listDisputeAuditEvents(tenantId, req.params.id);
      return reply.send({ ok: true, events });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'DISPUTE_NOT_FOUND') {
        return reply.status(404).send({ ok: false, code: msg });
      }
      return reply.status(500).send({ ok: false, code: msg });
    }
  });

  fastify.post<{
    Body: { ledger_discrepancy_id?: string; actor?: unknown; reason?: string };
  }>('/disputes/from-discrepancy', async (_req, reply) => {
    // 🔴 CONTENÇÃO P1 — F-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY-CONTAINMENT (fail-closed).
    // Esta rota LIA actor.kind/actorId do BODY (system/admin/support) e mutava estado de
    // disputa via reconciliationDisputeService — actor declarado pelo cliente é HINT, nunca
    // autoridade (DECISION-0113, 6º canal). Reduzida ao 403 fail-closed: NÃO há caminho
    // (alcançável ou morto) que chame parseActor / o service de mutação. Reabilitação só com
    // authority binding verificada (frente futura). Ver DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY.
    return reply.status(403).send({
      ok: false,
      code: 'DISPUTE_MUTATION_HTTP_DISABLED',
      message: 'Manual dispute mutation through HTTP is disabled until authority binding is implemented.',
    });
  });

  fastify.post<{
    Params: { id: string };
    Body: { actor?: unknown; reason?: string };
  }>('/disputes/:id/to-review', async (_req, reply) => {
    // 🔴 CONTENÇÃO P1 — F-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY-CONTAINMENT (fail-closed).
    // /to-review preparava o estado UNDER_REVIEW que antes habilitava o reversal. Lia actor do
    // BODY sem binding (6º canal, DECISION-0113). Reduzida ao 403 fail-closed: sem caminho que
    // chame parseActor / o service de mutação. Ver DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY.
    return reply.status(403).send({
      ok: false,
      code: 'DISPUTE_MUTATION_HTTP_DISABLED',
      message: 'Manual dispute mutation through HTTP is disabled until authority binding is implemented.',
    });
  });

  fastify.post<{
    Params: { id: string };
    Body: { actor?: unknown; reason?: string };
  }>('/disputes/:id/resolve', async (_req, reply) => {
    // 🔴 CONTENÇÃO P1 — F-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY-CONTAINMENT (fail-closed).
    // /resolve mutava o estado final da disputa lendo actor do BODY sem binding (6º canal,
    // DECISION-0113). Reduzida ao 403 fail-closed: sem caminho que chame parseActor / o service
    // de mutação. Ver DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY.
    return reply.status(403).send({
      ok: false,
      code: 'DISPUTE_MUTATION_HTTP_DISABLED',
      message: 'Manual dispute mutation through HTTP is disabled until authority binding is implemented.',
    });
  });

  fastify.post<{
    Params: { id: string };
    Body: { actor?: unknown; reason?: string };
  }>('/disputes/:id/reversal', async (_req, reply) => {
    // 🔴 CONTENÇÃO P0 — F-DISPUTE-REVERSAL-HTTP-AUTHORITY-CONTAINMENT (fail-closed).
    // Esta rota LIA actor.kind/actorId do BODY (system/admin/support) e disparava reversal
    // financeiro REAL via reconciliationDisputeService.executeDisputeFinancialReversal —
    // actorId declarado pelo cliente NÃO é autoridade (DECISION-0113); `system`/external_reversal
    // não é ação humana via HTTP (CORE_ESTORNOS_FINANCEIROS_CANONICO / DECISION-0052).
    // O handler foi REDUZIDO a este 403 fail-closed: NÃO há mais caminho (alcançável ou morto)
    // que chame parseActor / executeDisputeFinancialReversal / requestAndExecuteReversalSync.
    // Reabilitação só com authority binding verificada (frente futura) —
    // ver DT-DISPUTE-REVERSAL-AUTHORITY-CLIENT-DECLARED. Motor financeiro intacto.
    return reply.status(403).send({
      ok: false,
      code: 'DISPUTE_REVERSAL_HTTP_DISABLED',
      message: 'Manual dispute reversal through HTTP is disabled until authority binding is implemented.',
    });
  });
};

export default reconciliationDisputeRoutes;