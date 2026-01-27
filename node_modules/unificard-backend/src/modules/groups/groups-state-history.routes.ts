// src/modules/groups/groups-state-history.routes.ts
// Rotas de histórico de estados de grupos (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado
// 🔴 BLINDAGEM: Usa apenas dados reais já existentes
// 🔴 BLINDAGEM: Não infere estados, não cria estados novos, não adiciona labels interpretativas

import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant } from '@core/database/pool';

const groupsStateHistoryRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /groups/:groupId/state-history
   * Histórico de transições de estado do grupo (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   * 🔴 BLINDAGEM: Usa apenas dados reais já existentes
   */
  fastify.get<{
    Params: { groupId: string };
  }>(
    '/:groupId/state-history',
    {
      preHandler: fastify.requirePermission(['groups:read']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { groupId } = req.params;

      try {
        // Verificar se grupo existe
        const groupRow = await runQueryWithTenant<{
          group_id: string;
          is_active: boolean;
          created_at: Date;
          updated_at: Date;
        }>(
          tenantId,
          `SELECT group_id, is_active, created_at, updated_at FROM groups WHERE group_id = $1 AND tenant_id = $2`,
          [groupId, tenantId]
        );

        if (!groupRow) {
          return reply.status(404).send({ error: 'Grupo não encontrado' });
        }

        // 🔴 BLINDAGEM: Usar apenas dados reais já existentes
        // Estado do grupo é baseado em is_active (true/false)
        // Sem tabela de histórico, retornamos apenas o estado atual na criação

        const history: Array<{ state: string; changedAt: string }> = [];

        // Estado inicial (criação)
        history.push({
          state: groupRow.is_active ? 'active' : 'inactive',
          changedAt: groupRow.created_at.toISOString(),
        });

        // Se updated_at for diferente de created_at, pode haver mudança de estado
        // Mas sem tabela de histórico, não podemos saber estados intermediários
        // Por enquanto, apenas retornamos o estado atual na criação
        // Se houver uma tabela de histórico no futuro, ela será consultada aqui

        // Ordenar por data (mais antigo primeiro)
        history.sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

        return reply.send(history);
      } catch (error) {
        req.log.error({ err: error, groupId }, 'Erro ao buscar histórico de estados do grupo');
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );
};

export default groupsStateHistoryRoutes;

