// backend/src/modules/marketplace/payment-intent.repository.ts
// SPRINT 39.1: MARKETPLACE EXECUÇÃO - Payment Intent
// Repository para intenções de pagamento

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  PaymentIntent,
  CreatePaymentIntentInput,
  UpdatePaymentIntentInput,
} from './payment-intent.types';

interface PaymentIntentRow {
  id: string;
  tenant_id: string;
  order_id: string;
  amount: string;
  currency: string;
  status: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class PaymentIntentRepository {
  /**
   * Converte row para PaymentIntent
   */
  private toIntent(row: PaymentIntentRow): PaymentIntent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      orderId: row.order_id,
      amount: parseFloat(row.amount),
      currency: row.currency as any,
      status: row.status as any,
      metadata: row.metadata || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Cria payment intent
   */
  async createIntent(
    tenantId: string,
    input: CreatePaymentIntentInput
  ): Promise<PaymentIntent> {
    const row = await runQueryWithTenant<PaymentIntentRow>(
      tenantId,
      `
      INSERT INTO payment_intents (
        tenant_id, order_id, amount, currency, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, tenant_id, order_id, amount, currency, status,
                metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.orderId,
        input.amount,
        input.currency || 'BRL',
        'CREATED',
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar payment intent');
    }

    return this.toIntent(row);
  }

  /**
   * Busca payment intent por ID
   */
  async getIntentById(
    tenantId: string,
    intentId: string
  ): Promise<PaymentIntent | null> {
    const row = await runQueryWithTenant<PaymentIntentRow>(
      tenantId,
      `
      SELECT id, tenant_id, order_id, amount, currency, status,
             metadata, created_at, updated_at
      FROM payment_intents
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, intentId]
    );

    return row ? this.toIntent(row) : null;
  }

  /**
   * Lista payment intents de um pedido
   */
  async listIntentsByOrder(
    tenantId: string,
    orderId: string
  ): Promise<PaymentIntent[]> {
    const rows = await runQueriesWithTenant<PaymentIntentRow>(
      tenantId,
      `
      SELECT id, tenant_id, order_id, amount, currency, status,
             metadata, created_at, updated_at
      FROM payment_intents
      WHERE tenant_id = $1 AND order_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, orderId]
    );

    return rows.map((row) => this.toIntent(row));
  }

  /**
   * Atualiza payment intent
   */
  async updateIntent(
    tenantId: string,
    intentId: string,
    input: UpdatePaymentIntentInput
  ): Promise<PaymentIntent> {
    const updates: string[] = [];
    const params: any[] = [tenantId, intentId];
    let paramIndex = 3;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      // Nenhuma atualização, retornar intent atual
      const intent = await this.getIntentById(tenantId, intentId);
      if (!intent) {
        throw new Error('Payment intent não encontrado');
      }
      return intent;
    }

    const setClause = updates.join(', ');

    const row = await runQueryWithTenant<PaymentIntentRow>(
      tenantId,
      `
      UPDATE payment_intents
      SET ${setClause}
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, order_id, amount, currency, status,
                metadata, created_at, updated_at
      `,
      params
    );

    if (!row) {
      throw new Error('Payment intent não encontrado');
    }

    return this.toIntent(row);
  }
}

export const paymentIntentRepository = new PaymentIntentRepository();







