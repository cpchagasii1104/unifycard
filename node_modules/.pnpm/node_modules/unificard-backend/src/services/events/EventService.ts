// src/services/events/EventService.ts
import { runTenantTransaction } from '@core/db';

export class EventService {
  /**
   * Cancela evento
   *
   * 🔴 POLÍTICA MVP:
   * - Tickets: CANCELLED (sem reembolso automático)
   * - Consumo passado: intocado (ledger imutável)
   * - Parking ativo: encerrado
   */
  async cancelEvent(params: {
    eventId: string;
    tenantId: string;
    reason: string;
  }): Promise<{ success: boolean }> {
    const { eventId, tenantId, reason } = params;

    return runTenantTransaction(tenantId, async (trx) => {
      const now = new Date();

      // 1. Marca evento como cancelado
      await trx.query({
        text: `
          UPDATE events
          SET 
            status = 'CANCELLED',
            metadata = metadata || $1::jsonb
          WHERE id = $2
        `,
        values: [
          JSON.stringify({
            cancellation_reason: reason,
            cancelled_at: now.toISOString(),
          }),
          eventId,
        ],
      });

      // 2. Cancela tickets ativos (SEM reembolso automático)
      await trx.query({
        text: `
          UPDATE event_tickets
          SET 
            status = 'CANCELLED',
            metadata = metadata || $1::jsonb
          WHERE event_id = $2
            AND status = 'ACTIVE'
        `,
        values: [
          JSON.stringify({ cancellation_reason: reason }),
          eventId,
        ],
      });

      // 3. Consumos passados: NÃO tocam (ledger imutável)

      // 4. Parking ativo: encerra cobrança
      await trx.query({
        text: `
          UPDATE event_parking
          SET 
            status = 'EXITED',
            exit_time = $1,
            metadata = metadata || $2::jsonb
          WHERE event_id = $3
            AND status = 'ACTIVE'
        `,
        values: [
          now,
          JSON.stringify({ auto_exited_reason: 'event_cancelled' }),
          eventId,
        ],
      });

      // 5. Slots: libera slots futuros e bloqueia os passados
      const scheduleResult = await trx.query({
        text: `
          SELECT schedule_id
          FROM schedules
          WHERE event_id = $1
        `,
        values: [eventId],
      });

      if (scheduleResult.length > 0) {
        const schedule = scheduleResult[0] as { schedule_id: string };

        // Libera slots futuros (para reutilização)
        await trx.query({
          text: `
            UPDATE schedule_slots
            SET 
              status = 'available',
              reserved_by_global_user_id = NULL,
              metadata = metadata || $1::jsonb
            WHERE schedule_id = $2
              AND start_time > $3
          `,
          values: [
            JSON.stringify({ cancelled_reason: 'event_cancelled' }),
            schedule.schedule_id,
            now,
          ],
        });

        // Bloqueia slots passados (não deleta)
        await trx.query({
          text: `
            UPDATE schedule_slots
            SET status = 'blocked'
            WHERE schedule_id = $1
              AND start_time <= $2
              AND status != 'reserved'
          `,
          values: [schedule.schedule_id, now],
        });
      }

      return { success: true };
    });
  }
}















