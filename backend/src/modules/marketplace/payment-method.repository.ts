// backend/src/modules/marketplace/payment-method.repository.ts
// SPRINT 72: Repository para payment_methods

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  PaymentMethod,
  PaymentMethodFilters,
} from './payment-method.types';

interface PaymentMethodRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  type: string;
  provider: string;
  fee_percentage: number;
  settlement_days: number;
  is_default: boolean;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  createdAt: Date;
}

class PaymentMethodRepository {
  /**
   * Converte row para PaymentMethod
   */
  private toPaymentMethod(row: PaymentMethodRow): PaymentMethod {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      type: row.type as any,
      provider: row.provider as any,
      feePercentage: parseFloat(row.fee_percentage.toString()),
      settlementDays: row.settlement_days,
      isDefault: row.is_default,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Cria método de pagamento
   */
  async createMethod(
    tenantId: string,
    input: {
      actorId: string;
      type: string;
      provider: string;
      feePercentage: number;
      settlementDays: number;
      isDefault: boolean;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<PaymentMethod> {
    const row = await runQueryWithTenant<PaymentMethodRow>(
      tenantId,
      `
      INSERT INTO payment_methods (
        tenant_id, actor_id, type, provider,
        fee_percentage, settlement_days, is_default,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING id, tenant_id, actor_id, type, provider,
                fee_percentage, settlement_days, is_default,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt
      `,
      [
        tenantId,
        input.actorId,
        input.type,
        input.provider,
        input.feePercentage,
        input.settlementDays,
        input.isDefault,
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar método de pagamento');
    }

    return this.toPaymentMethod(row);
  }

  /**
   * Busca método por ID
   */
  async getMethodById(tenantId: string, methodId: string): Promise<PaymentMethod | null> {
    const rows = await runQueriesWithTenant<PaymentMethodRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, type, provider,
             fee_percentage, settlement_days, is_default,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt
      FROM payment_methods
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, methodId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toPaymentMethod(rows[0]);
  }

  /**
   * Lista métodos com filtros
   */
  async listMethods(tenantId: string, filters: PaymentMethodFilters = {}): Promise<PaymentMethod[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(filters.actorId);
      paramIndex++;
    }

    if (filters.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.provider) {
      conditions.push(`provider = $${paramIndex}`);
      params.push(filters.provider);
      paramIndex++;
    }

    if (filters.isDefault !== undefined) {
      conditions.push(`is_default = $${paramIndex}`);
      params.push(filters.isDefault);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<PaymentMethodRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, type, provider,
             fee_percentage, settlement_days, is_default,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt
      FROM payment_methods
      WHERE ${conditions.join(' AND ')}
      ORDER BY is_default DESC, createdAt DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toPaymentMethod(row));
  }

  /**
   * Busca método default do actor
   */
  async getDefaultMethod(tenantId: string, actorId: string): Promise<PaymentMethod | null> {
    const rows = await runQueriesWithTenant<PaymentMethodRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, type, provider,
             fee_percentage, settlement_days, is_default,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt
      FROM payment_methods
      WHERE tenant_id = $1 AND actor_id = $2 AND is_default = true
      LIMIT 1
      `,
      [tenantId, actorId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toPaymentMethod(rows[0]);
  }

  /**
   * Remove default de todos os métodos do actor
   */
  async unsetDefaultForActor(tenantId: string, actorId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE payment_methods
      SET is_default = false
      WHERE tenant_id = $1 AND actor_id = $2 AND is_default = true
      `,
      [tenantId, actorId]
    );
  }
}

export const paymentMethodRepository = new PaymentMethodRepository();








