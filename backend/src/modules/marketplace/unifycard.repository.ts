// backend/src/modules/marketplace/unifycard.repository.ts
// SPRINT 73: Repository para unifycard_transactions

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  UnifyCardTransaction,
  UnifyCardTransactionFilters,
} from './unifycard.types';

interface UnifyCardTransactionRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  payment_intent_id: string;
  payment_method_id: string | null;
  transaction_type: string;
  status: string;
  gross_amount_cents: number;
  fee_amount_cents: number;
  net_amount_cents: number;
  regional_account_id: string | null;
  authorizedAt: Date;
  capturedAt: Date | null;
  settledAt: Date | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class UnifyCardRepository {
  /**
   * Converte row para UnifyCardTransaction
   */
  private toUnifyCardTransaction(row: UnifyCardTransactionRow): UnifyCardTransaction {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      paymentIntentId: row.payment_intent_id,
      paymentMethodId: row.payment_method_id,
      transactionType: row.transaction_type as any,
      status: row.status as any,
      grossAmountCents: row.gross_amount_cents,
      feeAmountCents: row.fee_amount_cents,
      netAmountCents: row.net_amount_cents,
      regionalAccountId: row.regional_account_id,
      authorizedAt: row.authorizedAt,
      capturedAt: row.capturedAt,
      settledAt: row.settledAt,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria transação autorizada
   */
  async createAuthorizedTransaction(
    tenantId: string,
    input: {
      actorId: string;
      paymentIntentId: string;
      paymentMethodId: string | null;
      transactionType: string;
      grossAmountCents: number;
      feeAmountCents: number;
      netAmountCents: number;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<UnifyCardTransaction> {
    const row = await runQueryWithTenant<UnifyCardTransactionRow>(
      tenantId,
      `
      INSERT INTO unifycard_transactions (
        tenant_id, actor_id, payment_intent_id, payment_method_id,
        transaction_type, status,
        gross_amount_cents, fee_amount_cents, net_amount_cents,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      RETURNING id, tenant_id, actor_id, payment_intent_id, payment_method_id,
                transaction_type, status,
                gross_amount_cents, fee_amount_cents, net_amount_cents,
                regional_account_id,
                authorizedAt, capturedAt, settledAt,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [
        tenantId,
        input.actorId,
        input.paymentIntentId,
        input.paymentMethodId,
        input.transactionType,
        'AUTHORIZED',
        input.grossAmountCents,
        input.feeAmountCents,
        input.netAmountCents,
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar transação UnifyCard');
    }

    return this.toUnifyCardTransaction(row);
  }

  /**
   * Busca transação por ID
   */
  async getTransactionById(tenantId: string, transactionId: string): Promise<UnifyCardTransaction | null> {
    const rows = await runQueriesWithTenant<UnifyCardTransactionRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, payment_intent_id, payment_method_id,
             transaction_type, status,
             gross_amount_cents, fee_amount_cents, net_amount_cents,
             regional_account_id,
             authorizedAt, capturedAt, settledAt,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM unifycard_transactions
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, transactionId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toUnifyCardTransaction(rows[0]);
  }

  /**
   * Lista transações com filtros
   */
  async listTransactions(tenantId: string, filters: UnifyCardTransactionFilters = {}): Promise<UnifyCardTransaction[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(filters.actorId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.transactionType) {
      conditions.push(`transaction_type = $${paramIndex}`);
      params.push(filters.transactionType);
      paramIndex++;
    }

    if (filters.paymentIntentId) {
      conditions.push(`payment_intent_id = $${paramIndex}`);
      params.push(filters.paymentIntentId);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<UnifyCardTransactionRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, payment_intent_id, payment_method_id,
             transaction_type, status,
             gross_amount_cents, fee_amount_cents, net_amount_cents,
             regional_account_id,
             authorizedAt, capturedAt, settledAt,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM unifycard_transactions
      WHERE ${conditions.join(' AND ')}
      ORDER BY createdAt DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toUnifyCardTransaction(row));
  }

  /**
   * Atualiza status para CAPTURED
   */
  async markAsCaptured(tenantId: string, transactionId: string): Promise<UnifyCardTransaction> {
    const row = await runQueryWithTenant<UnifyCardTransactionRow>(
      tenantId,
      `
      UPDATE unifycard_transactions
      SET status = 'CAPTURED',
          capturedAt = NOW(),
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'AUTHORIZED'
      RETURNING id, tenant_id, actor_id, payment_intent_id, payment_method_id,
                transaction_type, status,
                gross_amount_cents, fee_amount_cents, net_amount_cents,
                regional_account_id,
                authorizedAt, capturedAt, settledAt,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [tenantId, transactionId]
    );

    if (!row) {
      throw new Error('Transação não encontrada ou não está em AUTHORIZED');
    }

    return this.toUnifyCardTransaction(row);
  }

  /**
   * Atualiza status para SETTLED
   */
  async markAsSettled(
    tenantId: string,
    transactionId: string,
    regionalAccountId: string
  ): Promise<UnifyCardTransaction> {
    const row = await runQueryWithTenant<UnifyCardTransactionRow>(
      tenantId,
      `
      UPDATE unifycard_transactions
      SET status = 'SETTLED',
          settledAt = NOW(),
          regional_account_id = $3,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'CAPTURED'
      RETURNING id, tenant_id, actor_id, payment_intent_id, payment_method_id,
                transaction_type, status,
                gross_amount_cents, fee_amount_cents, net_amount_cents,
                regional_account_id,
                authorizedAt, capturedAt, settledAt,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [tenantId, transactionId, regionalAccountId]
    );

    if (!row) {
      throw new Error('Transação não encontrada ou não está em CAPTURED');
    }

    return this.toUnifyCardTransaction(row);
  }
}

export const unifyCardRepository = new UnifyCardRepository();








