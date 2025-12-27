// src/services/events/ConsumptionService.ts
import { runTenantTransaction } from '@core/db';
import type { CheckoutRequest } from '@unificard/contracts';
import { EventContextBuilder } from '../../types/unifycard-event.types';

interface EventRow {
  id: string;
  event_type: string;
  city_id: string | null;
  accepts_consumption: boolean;
}

interface ConsumptionRow {
  id: string;
  tenant_id: string;
  event_id: string;
  global_user_id: string;
  item_name: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  transaction_id: string | null;
  status: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export class ConsumptionService {
  async registerConsumption(params: {
    eventId: string;
    userId: string;
    tenantId: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    idempotencyKey?: string;
  }): Promise<{ consumptions: ConsumptionRow[]; totalAmount: number; transactionId?: string }> {
    const { eventId, userId, tenantId, items } = params;

    return runTenantTransaction(tenantId, async (trx) => {
      const eventResult = await trx.query({
        text: `
          SELECT id, event_type, city_id, accepts_consumption
          FROM events
          WHERE id = $1
        `,
        values: [eventId],
      });

      if (eventResult.length === 0) {
        throw new Error('Event not found');
      }

      const event = eventResult[0] as EventRow;

      if (!event.accepts_consumption) {
        throw new Error('Event does not accept consumption');
      }

      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
      );

      // 🔴 IDEMPOTÊNCIA: Verificar se consumptions já existem (retry)
      if (params.idempotencyKey) {
        const existingConsumptions = await trx.query({
          text: `
            SELECT id, status, transaction_id
            FROM event_consumptions
            WHERE tenant_id = $1 AND idempotency_key = $2
            ORDER BY created_at ASC
          `,
          values: [tenantId, params.idempotencyKey],
        });

        if (existingConsumptions.length > 0) {
          // Retornar consumptions existentes (idempotência)
          const existing = existingConsumptions.map((row) => row as ConsumptionRow);
          return {
            consumptions: existing,
            totalAmount,
            transactionId: existing[0]?.transaction_id || undefined,
          };
        }
      }

      // Cria registros de consumo com status PENDING (antes do pagamento)
      const consumptions: ConsumptionRow[] = [];

      for (const item of items) {
        const consumptionResult = await trx.query({
          text: `
            INSERT INTO event_consumptions (
              tenant_id, event_id, global_user_id,
              item_name, quantity, unit_price, total_amount, status, idempotency_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
          `,
          values: [
            tenantId,
            eventId,
            userId,
            item.name,
            item.quantity,
            item.price,
            item.quantity * item.price,
            'PENDING', // Status inicial (antes do pagamento)
            params.idempotencyKey || null,
          ],
        });

        if (consumptionResult.length > 0) {
          consumptions.push(consumptionResult[0] as ConsumptionRow);
        }
      }

      // Processa checkout (UnifyCard → UnifyBank)
      if (!event.city_id) {
        throw new Error('Event city_id is required for payment processing');
      }

      // Importação dinâmica para evitar dependência circular
      const { checkoutService } = await import('../../core/checkout/CheckoutService');

      const checkoutRequest: CheckoutRequest = {
        amount: totalAmount,
        currency: 'BRL',
        paymentMethod: 'UNIFYCARD',
        context: {
          module: 'EVENT_CONSUMPTION',
          eventId: eventId,
          eventType: event.event_type,
          cityId: event.city_id,
          globalUserId: userId,
          consumptionIds: consumptions.map((c) => c.id),
        },
        idempotencyKey: params.idempotencyKey, // 🔴 CRÍTICO: Para idempotência no ledger
      };

      const checkoutResult = await checkoutService.processCheckout(tenantId, checkoutRequest);

      if (!checkoutResult.success || !checkoutResult.transactionId) {
        throw new Error('Checkout failed: ' + (checkoutResult.error || 'Unknown error'));
      }

      // Atualiza consumptions para ACTIVE e vincula transaction_id
      for (const consumption of consumptions) {
        await trx.query({
          text: `
            UPDATE event_consumptions
            SET 
              status = 'ACTIVE',
              transaction_id = $1
            WHERE id = $2
          `,
          values: [checkoutResult.transactionId, consumption.id],
        });
      }

      return { 
        consumptions: consumptions.map(c => ({ ...c, status: 'ACTIVE', transaction_id: checkoutResult.transactionId })), 
        totalAmount,
        transactionId: checkoutResult.transactionId,
      };
    });
  }
}















