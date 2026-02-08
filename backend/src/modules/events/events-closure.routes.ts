// src/modules/events/events-closure.routes.ts
// Rotas de fechamento de eventos (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado
// 🔴 BLINDAGEM: Usa apenas dados históricos reais
// 🔴 BLINDAGEM: Nenhuma comparação, nenhuma avaliação, nenhuma projeção futura

import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant } from '@core/database/pool';

const eventsClosureRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /events/:eventId/closure-summary
   * Resumo de fechamento do evento (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   * 🔴 BLINDAGEM: Usa apenas dados históricos reais
   */
  fastify.get<{
    Params: { eventId: string };
  }>(
    '/:eventId/closure-summary',
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
          starts_at: Date;
          ends_at: Date;
        }>(
          tenantId,
          `SELECT id, starts_at, ends_at FROM events WHERE id = $1 AND tenant_id = $2`,
          [eventId, tenantId]
        );

        if (!eventRow) {
          return reply.status(404).send({ error: 'Evento não encontrado' });
        }

        // Contar participantes confirmados
        const participantsCountRow = await runQueryWithTenant<{ count: string }>(
          tenantId,
          `SELECT COUNT(*) as count FROM event_attendees WHERE event_id = $1`,
          [eventId]
        );
        const participantsCount = participantsCountRow ? Number(participantsCountRow.count) : 0;

        // Total coletado (se houver ticket_price)
        let totalCollected = 0;
        const ledgerTotalRow = await runQueryWithTenant<{ totalCents: string }>(
          tenantId,
          `
          SELECT COALESCE(SUM(amount_cents), 0) as total
          FROM ledger
          WHERE tenant_id = $1
            AND metadata->>'event_id' = $2
            AND entry_type = 'credit'
          `,
          [tenantId, eventId]
        );
        totalCollected = ledgerTotalRow ? Number(ledgerTotalRow.total) : 0;

        return reply.send({
          participantsCount,
          totalCollected,
          startedAt: eventRow.starts_at.toISOString(),
          endedAt: eventRow.ends_at.toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar resumo de fechamento do evento');
        return reply.status(500).send({ error: 'Erro ao buscar resumo de fechamento do evento' });
      }
    }
  );
};

export default eventsClosureRoutes;



