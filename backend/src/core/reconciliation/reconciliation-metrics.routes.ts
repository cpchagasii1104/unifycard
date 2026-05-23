// INFRA-3 — rotas só leitura (drift SSOT vs derivado). Prefixo: /metrics/reconciliation

import { FastifyPluginAsync } from 'fastify';
import { reconciliationService } from './reconciliation.service';

function parseTenantQuery(q: unknown): { ok: true; tenantId: string | null } | { ok: false } {
  if (q === undefined || q === null || (typeof q === 'string' && !q.trim())) {
    return { ok: true, tenantId: null };
  }
  if (typeof q !== 'string') {
    return { ok: false };
  }
  const s = q.trim();
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRe.test(s) ? { ok: true, tenantId: s } : { ok: false };
}

const reconciliationMetricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/summary', async (req, reply) => {
    try {
      const parsed = parseTenantQuery(
        (req.query as Record<string, unknown> | undefined)?.tenantId
      );
      if (!parsed.ok) {
        return reply.status(400).send({ error: 'tenantId inválido (UUID esperado)' });
      }
      const tenantId = parsed.tenantId;
      const full = await reconciliationService.runFullReconciliation(tenantId);
      return reply.status(200).send({
        success: true,
        tenantId: tenantId ?? null,
        ranAt: new Date().toISOString(),
        counts: {
          inventory: full.inventory.length,
          ledger: full.ledger.length,
          reservation: full.reservation.length,
          total: full.totalDrifts,
        },
        severity: full.totalDrifts > 0 ? 'critical' : 'low',
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'reconciliation metrics summary');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });

  fastify.get('/drift', async (req, reply) => {
    try {
      const parsed = parseTenantQuery(
        (req.query as Record<string, unknown> | undefined)?.tenantId
      );
      if (!parsed.ok) {
        return reply.status(400).send({ error: 'tenantId inválido (UUID esperado)' });
      }
      const tenantId = parsed.tenantId;
      const full = await reconciliationService.runFullReconciliation(tenantId);
      return reply.status(200).send({
        success: true,
        tenantId: tenantId ?? null,
        ranAt: new Date().toISOString(),
        drifts: [...full.inventory, ...full.ledger, ...full.reservation],
        totalDrifts: full.totalDrifts,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'reconciliation metrics drift');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });
};

export default reconciliationMetricsRoutes;