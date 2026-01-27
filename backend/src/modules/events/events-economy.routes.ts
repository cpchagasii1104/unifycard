// src/modules/events/events-economy.routes.ts
// Rotas de economia de eventos (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado
// 🔴 BLINDAGEM: Não cria split novo, não inferir projeções

import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

const eventsEconomyRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /events/:eventId/economy
   * Economia do evento (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   * 🔴 BLINDAGEM: Usa dados já existentes (ledger / impact / transactions)
   */
  fastify.get<{
    Params: { eventId: string };
  }>(
    '/:eventId/economy',
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
          ticket_price_cents: number | null;
          max_capacity: number | null;
        }>(
          tenantId,
          `SELECT id, ticket_price_cents, max_capacity FROM events WHERE id = $1 AND tenant_id = $2`,
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

        // Calcular total coletado (se houver ticket_price)
        // 🔴 BLINDAGEM: Usar dados reais de transações/checkouts, não inferir
        let totalCollected = 0;
        let expectedTotal: number | null = null;

        if (eventRow.ticket_price_cents && eventRow.ticket_price_cents > 0) {
          // Buscar total real de checkouts/pagamentos relacionados ao evento
          // Tentar buscar de ledger ou transações relacionadas
          const ledgerTotalRow = await runQueryWithTenant<{ total: string }>(
            tenantId,
            `
            SELECT COALESCE(SUM(amount_cents), 0) as total
            FROM ledger
            WHERE tenant_id = $1
              AND metadata->>'event_id' = $2
              AND entry_type = 'CREDIT'
            `,
            [tenantId, eventId]
          );
          totalCollected = ledgerTotalRow ? Number(ledgerTotalRow.total) : 0;

          // Expected total = participantes * ticket_price (apenas se houver capacidade)
          if (eventRow.max_capacity !== null) {
            expectedTotal = participantsCount * eventRow.ticket_price_cents;
          }
        }

        return reply.send({
          totalCollected,
          expectedTotal,
          participantsCount,
          ticketPriceCents: eventRow.ticket_price_cents,
          maxCapacity: eventRow.max_capacity,
          lastUpdate: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar economia do evento');
        return reply.status(500).send({ error: 'Erro ao buscar economia do evento' });
      }
    }
  );
};

export default eventsEconomyRoutes;

