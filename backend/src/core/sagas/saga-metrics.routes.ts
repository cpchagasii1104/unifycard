// INFRA-4 — métricas só leitura sobre order_sagas. Prefixo: /metrics/sagas

import { FastifyPluginAsync } from 'fastify';
import {
  sagaCountsByStatus,
  listRecentSagas,
  getByOrderId,
} from '@modules/orders/order-saga.repository';

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

const sagaMetricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/summary', async (req, reply) => {
    try {
      const counts = await sagaCountsByStatus();
      return reply.status(200).send({
        success: true,
        at: new Date().toISOString(),
        countsByStatus: counts,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'saga metrics summary');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });

  fastify.get('/state', async (req, reply) => {
    try {
      const q = req.query as Record<string, unknown> | undefined;
      const parsedT = parseTenantQuery(q?.tenantId);
      if (!parsedT.ok) {
        return reply.status(400).send({ error: 'tenantId inválido (UUID esperado)' });
      }
      const orderIdRaw = q?.orderId;
      if (
        orderIdRaw !== undefined &&
        orderIdRaw !== null &&
        String(orderIdRaw).trim() !== ''
      ) {
        const oid = String(orderIdRaw).trim();
        const uuidRe =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRe.test(oid)) {
          return reply.status(400).send({ error: 'orderId inválido (UUID esperado)' });
        }
        if (!parsedT.tenantId) {
          return reply.status(400).send({ error: 'tenantId obrigatório com orderId' });
        }
        const one = await getByOrderId(parsedT.tenantId, oid);
        return reply.status(200).send({
          success: true,
          at: new Date().toISOString(),
          saga: one ?? null,
        });
      }

      const limitRaw = q?.limit;
      const limit =
        typeof limitRaw === 'string' && /^\d+$/.test(limitRaw)
          ? Math.min(200, Math.max(1, parseInt(limitRaw, 10)))
          : 50;
      const recent = await listRecentSagas(limit);
      const filtered =
        parsedT.tenantId === null
          ? recent
          : recent.filter((r) => r.tenant_id === parsedT.tenantId);
      return reply.status(200).send({
        success: true,
        at: new Date().toISOString(),
        tenantId: parsedT.tenantId,
        sagas: filtered,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'saga metrics state');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });
};

export default sagaMetricsRoutes;