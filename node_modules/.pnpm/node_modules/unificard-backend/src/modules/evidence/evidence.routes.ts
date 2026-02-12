// backend/src/modules/evidence/evidence.routes.ts
// Rotas para Evidências & Resolução de Disputas
// 🔴 BLINDAGEM: Append-only, imutável, sem decisões automáticas

import type { FastifyInstance } from 'fastify';
import { evidenceService } from './evidence.service';
import type {
  CreateEvidencePackInput,
  OpenDisputeInput,
  ResolveDisputeInput,
} from './evidence.types';

const evidenceRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /evidence/context/:contextType/:contextId
   * Busca ou cria evidence pack para um contexto
   */
  fastify.get<{
    Params: { contextType: string; contextId: string };
  }>('/evidence/context/:contextType/:contextId', async (req, reply) => {
    const tenantId = req.tenant.id;
    const pack = await evidenceService.getOrCreatePack(tenantId, {
      contextType: req.params.contextType as any,
      contextId: req.params.contextId,
    });

    return reply.send({ pack });
  });

  /**
   * GET /evidence/:packId
   * Busca evidence pack por ID
   */
  fastify.get<{ Params: { packId: string } }>('/evidence/:packId', async (req, reply) => {
    const tenantId = req.tenant.id;
    const pack = await evidenceService.getPack(tenantId, req.params.packId);

    return reply.send({ pack });
  });

  /**
   * GET /evidence
   * Lista evidence packs com filtros
   */
  fastify.get<{
    Querystring: {
      contextType?: string;
      contextId?: string;
      disputeStatus?: string;
      limit?: number;
      offset?: number;
    };
  }>('/evidence', async (req, reply) => {
    const tenantId = req.tenant.id;
    const filters = {
      contextType: req.query.contextType as any,
      contextId: req.query.contextId,
      disputeStatus: req.query.disputeStatus as any,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const packs = await evidenceService.listPacks(tenantId, filters);

    return reply.send({ packs, totalCents: packs.length });
  });

  /**
   * POST /evidence/:packId/open-dispute
   * Abre disputa
   */
  fastify.post<{ Params: { packId: string }; Body: OpenDisputeInput }>(
    '/evidence/:packId/open-dispute',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const pack = await evidenceService.openDispute(tenantId, req.params.packId, {
        ...req.body,
        openedByUserId: userId,
      });

      return reply.send({ pack });
    }
  );

  /**
   * POST /evidence/:packId/resolve-dispute
   * Resolve disputa
   */
  fastify.post<{ Params: { packId: string }; Body: ResolveDisputeInput }>(
    '/evidence/:packId/resolve-dispute',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const pack = await evidenceService.resolveDispute(tenantId, req.params.packId, {
        ...req.body,
        resolvedByUserId: userId,
      });

      return reply.send({ pack });
    }
  );

  /**
   * GET /evidence/:packId/export
   * Exporta evidence pack (JSON por enquanto, PDF futuro)
   */
  fastify.get<{
    Params: { packId: string };
    Querystring: { format?: string };
  }>('/evidence/:packId/export', async (req, reply) => {
    const tenantId = req.tenant.id;
    const format = (req.query.format || 'json') as 'json' | 'pdf';

    const pack = await evidenceService.getPack(tenantId, req.params.packId);

    if (format === 'json') {
      return reply
        .type('application/json')
        .header('Content-Disposition', `attachment; filename="evidence-${pack.packId}.json"`)
        .send(pack);
    }

    // TODO: Implementar exportação PDF
    return reply.status(501).send({ error: 'Exportação PDF ainda não implementada' });
  });

  /**
   * POST /evidence/consolidate/:contextType/:contextId
   * Consolida evidências de um contexto (busca chat, agreements, audit logs)
   */
  fastify.post<{
    Params: { contextType: string; contextId: string };
  }>('/evidence/consolidate/:contextType/:contextId', async (req, reply) => {
    const tenantId = req.tenant.id;
    const pack = await evidenceService.consolidateEvidence(
      tenantId,
      req.params.contextType,
      req.params.contextId
    );

    return reply.send({ pack });
  });
};

export default evidenceRoutes;





