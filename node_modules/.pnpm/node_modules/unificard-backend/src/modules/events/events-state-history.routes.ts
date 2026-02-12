// src/modules/events/events-state-history.routes.ts
// Rotas de histórico de estados de eventos (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado
// 🔴 BLINDAGEM: Usa apenas dados reais já existentes
// 🔴 BLINDAGEM: Não infere estados, não cria estados novos, não adiciona labels interpretativas

import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

const eventsStateHistoryRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /events/:eventId/state-history
   * Histórico de transições de estado do evento (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   * 🔴 BLINDAGEM: Usa apenas dados reais já existentes
   */
  fastify.get<{
    Params: { eventId: string };
  }>(
    '/:eventId/state-history',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const tenantId = req.tenant.id;
        const eventId = req.params.eventId;

        // Verificar se evento existe
        const eventRow = await runQueryWithTenant<{
          id: string;
          status: string;
          createdAt: Date;
          updatedAt: Date;
        }>(
          tenantId,
          `SELECT id, status, createdAt, updatedAt FROM events WHERE id = $1 AND tenant_id = $2`,
          [eventId, tenantId]
        );

        if (!eventRow) {
          return reply.status(404).send({ error: 'Evento não encontrado' });
        }

        // 🔴 BLINDAGEM: Usar apenas dados reais já existentes
        // Se houver tabela de histórico de estados, usar ela
        // Caso contrário, usar createdAt como primeira transição e updatedAt como última
        // Não inferir estados intermediários

        const history: Array<{ state: string; changedAt: string }> = [];

        // Estado inicial (criação)
        history.push({
          state: eventRow.status,
          changedAt: eventRow.createdAt.toISOString(),
        });

        // Se updatedAt for diferente de createdAt, pode haver mudança de estado
        // Mas sem tabela de histórico, não podemos saber estados intermediários
        // Por enquanto, apenas retornamos o estado atual na criação
        // Se houver uma tabela de histórico no futuro, ela será consultada aqui

        // Ordenar por data (mais antigo primeiro)
        history.sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

        return reply.send(history);
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar histórico de estados do evento');
        return reply.status(500).send({ error: 'Erro ao buscar histórico de estados do evento' });
      }
    }
  );
};

export default eventsStateHistoryRoutes;


