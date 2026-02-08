// backend/src/modules/marketplace/accounts-receivable.repository.ts
// SPRINT 71: Repository para accounts_receivable

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  AccountsReceivable,
  AccountsReceivableFilters,
} from './accounts-receivable.types';

interface AccountsReceivableRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  source_type: string;
  source_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  expectedAt: Date;
  receivedAt: Date | null;
  payment_method: string | null;
  received_by_actor_id: string | null;
  received_by_user_id: string | null;
  cancelledAt: Date | null;
  cancelled_by_actor_id: string | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class AccountsReceivableRepository {
  /**
   * Converte row para AccountsReceivable
   */
  private toAccountsReceivable(row: AccountsReceivableRow): AccountsReceivable {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      sourceType: row.source_type as any,
      sourceId: row.source_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      status: row.status as any,
      expectedAt: row.expectedAt,
      receivedAt: row.receivedAt,
      paymentMethod: row.payment_method,
      receivedByActorId: row.received_by_actor_id,
      receivedByUserId: row.received_by_user_id,
      cancelledAt: row.cancelledAt,
      cancelledByActorId: row.cancelled_by_actor_id,
      cancelledByUserId: row.cancelled_by_user_id,
      cancellationReason: row.cancellation_reason,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria conta a receber
   */
  async createReceivable(
    tenantId: string,
    input: {
      actorId: string;
      sourceType: string;
      sourceId: string;
      amountCents: number;
      currency: string;
      expectedAt: Date;
      paymentMethod: string | null;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<AccountsReceivable> {
    const row = await runQueryWithTenant<AccountsReceivableRow>(
      tenantId,
      `
      INSERT INTO accounts_receivable (
        tenant_id, actor_id, source_type, source_id,
        amount_cents, currency, status, expectedAt,
        payment_method,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      RETURNING id, tenant_id, actor_id, source_type, source_id,
                amount_cents, currency, status, expectedAt, receivedAt,
                payment_method,
                received_by_actor_id, received_by_user_id,
                cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [
        tenantId,
        input.actorId,
        input.sourceType,
        input.sourceId,
        input.amountCents,
        input.currency,
        'PENDING',
        input.expectedAt,
        input.paymentMethod,
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar conta a receber');
    }

    return this.toAccountsReceivable(row);
  }

  /**
   * Busca conta por ID
   */
  async getReceivableById(tenantId: string, receivableId: string): Promise<AccountsReceivable | null> {
    const rows = await runQueriesWithTenant<AccountsReceivableRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, source_type, source_id,
             amount_cents, currency, status, expectedAt, receivedAt,
             payment_method,
             received_by_actor_id, received_by_user_id,
             cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM accounts_receivable
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, receivableId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toAccountsReceivable(rows[0]);
  }

  /**
   * Lista contas com filtros
   */
  async listReceivables(tenantId: string, filters: AccountsReceivableFilters = {}): Promise<AccountsReceivable[]> {
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

    if (filters.sourceType) {
      conditions.push(`source_type = $${paramIndex}`);
      params.push(filters.sourceType);
      paramIndex++;
    }

    if (filters.sourceId) {
      conditions.push(`source_id = $${paramIndex}`);
      params.push(filters.sourceId);
      paramIndex++;
    }

    if (filters.expectedAtFrom) {
      const dateFrom = filters.expectedAtFrom instanceof Date ? filters.expectedAtFrom : new Date(filters.expectedAtFrom);
      conditions.push(`expectedAt >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (filters.expectedAtTo) {
      const dateTo = filters.expectedAtTo instanceof Date ? filters.expectedAtTo : new Date(filters.expectedAtTo);
      conditions.push(`expectedAt <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<AccountsReceivableRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, source_type, source_id,
             amount_cents, currency, status, expectedAt, receivedAt,
             payment_method,
             received_by_actor_id, received_by_user_id,
             cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM accounts_receivable
      WHERE ${conditions.join(' AND ')}
      ORDER BY expectedAt ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toAccountsReceivable(row));
  }

  /**
   * Atualiza status para RECEIVED
   */
  async markAsReceived(
    tenantId: string,
    receivableId: string,
    receivedByActorId: string,
    receivedByUserId: string | null
  ): Promise<AccountsReceivable> {
    const row = await runQueryWithTenant<AccountsReceivableRow>(
      tenantId,
      `
      UPDATE accounts_receivable
      SET status = 'RECEIVED',
          receivedAt = NOW(),
          received_by_actor_id = $3,
          received_by_user_id = $4,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
      RETURNING id, tenant_id, actor_id, source_type, source_id,
                amount_cents, currency, status, expectedAt, receivedAt,
                payment_method,
                received_by_actor_id, received_by_user_id,
                cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [tenantId, receivableId, receivedByActorId, receivedByUserId]
    );

    if (!row) {
      throw new Error('Conta não encontrada ou não está em PENDING');
    }

    return this.toAccountsReceivable(row);
  }

  /**
   * Atualiza status para CANCELLED
   */
  async cancelReceivable(
    tenantId: string,
    receivableId: string,
    cancelledByActorId: string,
    cancelledByUserId: string | null,
    cancellationReason: string | null
  ): Promise<AccountsReceivable> {
    const row = await runQueryWithTenant<AccountsReceivableRow>(
      tenantId,
      `
      UPDATE accounts_receivable
      SET status = 'CANCELLED',
          cancelledAt = NOW(),
          cancelled_by_actor_id = $3,
          cancelled_by_user_id = $4,
          cancellation_reason = $5,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
      RETURNING id, tenant_id, actor_id, source_type, source_id,
                amount_cents, currency, status, expectedAt, receivedAt,
                payment_method,
                received_by_actor_id, received_by_user_id,
                cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [tenantId, receivableId, cancelledByActorId, cancelledByUserId, cancellationReason]
    );

    if (!row) {
      throw new Error('Conta não encontrada ou não pode ser cancelada');
    }

    return this.toAccountsReceivable(row);
  }
}

export const accountsReceivableRepository = new AccountsReceivableRepository();








