// src/modules/groups/groups-closure.routes.ts
// Rotas de fechamento de grupos (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado
// 🔴 BLINDAGEM: Usa apenas dados históricos reais
// 🔴 BLINDAGEM: Nenhuma comparação, nenhuma avaliação, nenhuma projeção futura

import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant } from '@core/database/pool';
import { bankSplitRepository } from '../bank/bank-split.repository';

const groupsClosureRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /groups/:groupId/closure-summary
   * Resumo de fechamento do grupo (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   * 🔴 BLINDAGEM: Usa apenas dados históricos reais
   */
  fastify.get<{
    Params: { groupId: string };
  }>(
    '/:groupId/closure-summary',
    {
      preHandler: fastify.requirePermission(['groups:read']),
    },
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const { groupId } = req.params;

      try {
        // Verificar se grupo existe
        const groupRow = await runQueryWithTenant<{
          group_id: string;
          created_at: Date;
        }>(
          tenantId,
          `SELECT group_id, created_at FROM groups WHERE group_id = $1 AND tenant_id = $2`,
          [groupId, tenantId]
        );

        if (!groupRow) {
          return reply.status(404).send({ error: 'Grupo não encontrado' });
        }

        // Contar eventos do grupo (via group_events)
        const lifetimeEventsRow = await runQueryWithTenant<{ count: string }>(
          tenantId,
          `SELECT COUNT(*) as count FROM group_events WHERE group_id = $1`,
          [groupId]
        );
        const lifetimeEvents = lifetimeEventsRow ? Number(lifetimeEventsRow.count) : 0;

        // FASE 5.3: volume económico via domínio financeiro (splits cuja conta destino = actor do grupo)
        const lifetimeEconomicVolume =
          await bankSplitRepository.sumVolumeCentsForSplitsTargetingAccountActor(tenantId, groupId);

        return reply.send({
          lifetimeEvents,
          lifetimeEconomicVolume,
          createdAt: groupRow.created_at.toISOString(),
        });
      } catch (error) {
        req.log.error({ err: error, groupId }, 'Erro ao buscar resumo de fechamento do grupo');
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );
};

export default groupsClosureRoutes;



