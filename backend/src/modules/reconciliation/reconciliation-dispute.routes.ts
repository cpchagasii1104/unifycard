/**
 * Mutações explícitas de disputa (reconciliation_ledger_discrepancies → reconciliation_disputes).
 * Sem criação automática; actor obrigatório no body.
 */

import type { FastifyPluginAsync } from 'fastify';
import { reconciliationDisputeService } from './reconciliation-dispute.service';
import type { ReconciliationDisputeActor } from './reconciliation-dispute.types';

function parseOptionalReason(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const r = (body as Record<string, unknown>).reason;
  if (typeof r !== 'string') return undefined;
  const t = r.trim();
  return t === '' ? undefined : t;
}

function parseActor(body: unknown): ReconciliationDisputeActor {
  if (!body || typeof body !== 'object') {
    throw new Error('UNAUTHORIZED_DISPUTE_CREATION');
  }
  const o = body as Record<string, unknown>;
  const kind = o.kind;
  if (typeof kind !== 'string' || kind.trim() === '') {
    throw new Error('UNAUTHORIZED_DISPUTE_CREATION');
  }
  const actorId = o.actor_id;
  return {
    kind: kind.trim().toLowerCase() as ReconciliationDisputeActor['kind'],
    actorId:
      actorId != null && String(actorId).trim() !== ''
        ? String(actorId).trim()
        : null,
  };
}

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
  }>('/disputes/from-discrepancy', async (req, reply) => {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    }
    const id = req.body?.ledger_discrepancy_id;
    if (!id || String(id).trim() === '') {
      return reply.status(400).send({ ok: false, code: 'LEDGER_DISCREPANCY_ID_REQUIRED' });
    }
    let actor: ReconciliationDisputeActor;
    try {
      actor = parseActor(req.body?.actor);
    } catch {
      return reply.status(403).send({ ok: false, code: 'UNAUTHORIZED_DISPUTE_CREATION' });
    }
    try {
      const result = await reconciliationDisputeService.createDisputeFromDiscrepancy(
        tenantId,
        String(id).trim(),
        actor,
        { reason: parseOptionalReason(req.body) }
      );
      return reply.status(result.created ? 201 : 200).send({
        ok: true,
        created: result.created,
        dispute: result.dispute,
        discrepancy: {
          id: result.discrepancy.id,
          type: result.discrepancy.type,
          reference_id: result.discrepancy.referenceId,
          resolved: result.discrepancy.resolved,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'UNAUTHORIZED_DISPUTE_CREATION') {
        return reply.status(403).send({ ok: false, code: msg });
      }
      if (msg === 'LEDGER_DISCREPANCY_NOT_FOUND') {
        return reply.status(404).send({ ok: false, code: msg });
      }
      if (msg === 'DISCREPANCY_ALREADY_RESOLVED') {
        return reply.status(409).send({ ok: false, code: msg });
      }
      if (msg === 'INVALID_LEDGER_DISCREPANCY_TYPE') {
        return reply.status(400).send({ ok: false, code: msg });
      }
      fastify.log.error(e);
      return reply.status(500).send({ ok: false, code: 'DISPUTE_CREATE_FAILED', message: msg });
    }
  });

  fastify.post<{
    Params: { id: string };
    Body: { actor?: unknown; reason?: string };
  }>('/disputes/:id/to-review', async (req, reply) => {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    }
    let actor: ReconciliationDisputeActor;
    try {
      actor = parseActor(req.body?.actor);
    } catch {
      return reply.status(403).send({ ok: false, code: 'UNAUTHORIZED_DISPUTE_CREATION' });
    }
    try {
      const dispute = await reconciliationDisputeService.moveDisputeToUnderReview(
        tenantId,
        req.params.id,
        actor,
        { reason: parseOptionalReason(req.body) }
      );
      return reply.send({ ok: true, dispute });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'UNAUTHORIZED_DISPUTE_CREATION') {
        return reply.status(403).send({ ok: false, code: msg });
      }
      if (msg === 'DISPUTE_NOT_FOUND' || msg === 'LEDGER_DISCREPANCY_NOT_FOUND') {
        return reply.status(404).send({ ok: false, code: msg });
      }
      if (msg.startsWith('INVALID_DISPUTE_TRANSITION')) {
        return reply.status(409).send({ ok: false, code: msg });
      }
      return reply.status(500).send({ ok: false, code: msg });
    }
  });

  fastify.post<{
    Params: { id: string };
    Body: { actor?: unknown; reason?: string };
  }>('/disputes/:id/resolve', async (req, reply) => {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return reply.status(400).send({ ok: false, code: 'TENANT_REQUIRED' });
    }
    let actor: ReconciliationDisputeActor;
    try {
      actor = parseActor(req.body?.actor);
    } catch {
      return reply.status(403).send({ ok: false, code: 'UNAUTHORIZED_DISPUTE_CREATION' });
    }
    try {
      const dispute = await reconciliationDisputeService.resolveDispute(
        tenantId,
        req.params.id,
        actor,
        { reason: parseOptionalReason(req.body) }
      );
      return reply.send({ ok: true, dispute });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'UNAUTHORIZED_DISPUTE_CREATION') {
        return reply.status(403).send({ ok: false, code: msg });
      }
      if (msg === 'DISPUTE_NOT_FOUND' || msg === 'LEDGER_DISCREPANCY_NOT_FOUND') {
        return reply.status(404).send({ ok: false, code: msg });
      }
      if (msg.startsWith('INVALID_DISPUTE_TRANSITION')) {
        return reply.status(409).send({ ok: false, code: msg });
      }
      return reply.status(500).send({ ok: false, code: msg });
    }
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