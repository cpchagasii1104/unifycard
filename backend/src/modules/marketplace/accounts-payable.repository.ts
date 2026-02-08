// backend/src/modules/marketplace/accounts-payable.repository.ts
// SPRINT 70: Repository para accounts_payable

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  AccountsPayable,
  AccountsPayableFilters,
} from './accounts-payable.types';

interface AccountsPayableRow {
  id: string;
  tenant_id: string;
  supplier_id: string;
  reference_type: string;
  reference_id: string;
  amount_cents: number;
  currency: string;
  due_at: Date;
  status: string;
  scheduled_action_id: string | null;
  paidAt: Date | null;
  paid_by_actor_id: string | null;
  paid_by_user_id: string | null;
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

class AccountsPayableRepository {
  /**
   * Converte row para AccountsPayable
   */
  private toAccountsPayable(row: AccountsPayableRow): AccountsPayable {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      supplierId: row.supplier_id,
      referenceType: row.reference_type as any,
      referenceId: row.reference_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      dueDate: row.due_at,
      status: row.status as any,
      scheduledActionId: row.scheduled_action_id,
      paidAt: row.paidAt,
      paidByActorId: row.paid_by_actor_id,
      paidByUserId: row.paid_by_user_id,
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
   * Cria conta a pagar
   */
  async createPayable(
    tenantId: string,
    input: {
      supplierId: string;
      referenceType: string;
      referenceId: string;
      amountCents: number;
      currency: string;
      dueDate: Date;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<AccountsPayable> {
    const row = await runQueryWithTenant<AccountsPayableRow>(
      tenantId,
      `
      INSERT INTO accounts_payable (
        tenant_id, supplier_id, reference_type, reference_id,
        amount_cents, currency, due_at, status,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING id, tenant_id, supplier_id, reference_type, reference_id,
                amount_cents, currency, due_at, status,
                scheduled_action_id,
                paidAt, paid_by_actor_id, paid_by_user_id,
                cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [
        tenantId,
        input.supplierId,
        input.referenceType,
        input.referenceId,
        input.amountCents,
        input.currency,
        input.dueDate,
        'open',
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar conta a pagar');
    }

    return this.toAccountsPayable(row);
  }

  /**
   * Busca conta por ID
   */
  async getPayableById(tenantId: string, payableId: string): Promise<AccountsPayable | null> {
    const rows = await runQueriesWithTenant<AccountsPayableRow>(
      tenantId,
      `
      SELECT id, tenant_id, supplier_id, reference_type, reference_id,
             amount_cents, currency, due_at, status,
             scheduled_action_id,
             paidAt, paid_by_actor_id, paid_by_user_id,
             cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM accounts_payable
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, payableId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toAccountsPayable(rows[0]);
  }

  /**
   * Lista contas com filtros
   */
  async listPayables(tenantId: string, filters: AccountsPayableFilters = {}): Promise<AccountsPayable[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.supplierId) {
      conditions.push(`supplier_id = $${paramIndex}`);
      params.push(filters.supplierId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.referenceType) {
      conditions.push(`reference_type = $${paramIndex}`);
      params.push(filters.referenceType);
      paramIndex++;
    }

    if (filters.referenceId) {
      conditions.push(`reference_id = $${paramIndex}`);
      params.push(filters.referenceId);
      paramIndex++;
    }

    if (filters.dueDateFrom) {
      const dateFrom = filters.dueDateFrom instanceof Date ? filters.dueDateFrom : new Date(filters.dueDateFrom);
      conditions.push(`due_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (filters.dueDateTo) {
      const dateTo = filters.dueDateTo instanceof Date ? filters.dueDateTo : new Date(filters.dueDateTo);
      conditions.push(`due_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<AccountsPayableRow>(
      tenantId,
      `
      SELECT id, tenant_id, supplier_id, reference_type, reference_id,
             amount_cents, currency, due_at, status,
             scheduled_action_id,
             paidAt, paid_by_actor_id, paid_by_user_id,
             cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM accounts_payable
      WHERE ${conditions.join(' AND ')}
      ORDER BY due_at ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toAccountsPayable(row));
  }

  /**
   * Atualiza status para SCHEDULED e vincula scheduled_action
   */
  async schedulePayment(
    tenantId: string,
    payableId: string,
    scheduledActionId: string
  ): Promise<AccountsPayable> {
    const row = await runQueryWithTenant<AccountsPayableRow>(
      tenantId,
      `
      UPDATE accounts_payable
      SET status = 'scheduled',
          scheduled_action_id = $3,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'open'
      RETURNING id, tenant_id, supplier_id, reference_type, reference_id,
                amount_cents, currency, due_at, status,
                scheduled_action_id,
                paidAt, paid_by_actor_id, paid_by_user_id,
                cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [tenantId, payableId, scheduledActionId]
    );

    if (!row) {
      throw new Error('Conta não encontrada ou não está em OPEN');
    }

    return this.toAccountsPayable(row);
  }

  /**
   * Atualiza status para PAID
   */
  async markAsPaid(
    tenantId: string,
    payableId: string,
    paidByActorId: string,
    paidByUserId: string | null
  ): Promise<AccountsPayable> {
    const row = await runQueryWithTenant<AccountsPayableRow>(
      tenantId,
      `
      UPDATE accounts_payable
      SET status = 'paid',
          paidAt = NOW(),
          paid_by_actor_id = $3,
          paid_by_user_id = $4,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status IN ('open', 'scheduled')
      RETURNING id, tenant_id, supplier_id, reference_type, reference_id,
                amount_cents, currency, due_at, status,
                scheduled_action_id,
                paidAt, paid_by_actor_id, paid_by_user_id,
                cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [tenantId, payableId, paidByActorId, paidByUserId]
    );

    if (!row) {
      throw new Error('Conta não encontrada ou não pode ser marcada como paga');
    }

    return this.toAccountsPayable(row);
  }

  /**
   * Atualiza status para CANCELLED
   */
  async cancelPayable(
    tenantId: string,
    payableId: string,
    cancelledByActorId: string,
    cancelledByUserId: string | null,
    cancellationReason: string | null
  ): Promise<AccountsPayable> {
    const row = await runQueryWithTenant<AccountsPayableRow>(
      tenantId,
      `
      UPDATE accounts_payable
      SET status = 'cancelled',
          cancelledAt = NOW(),
          cancelled_by_actor_id = $3,
          cancelled_by_user_id = $4,
          cancellation_reason = $5,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status IN ('open', 'scheduled')
      RETURNING id, tenant_id, supplier_id, reference_type, reference_id,
                amount_cents, currency, due_at, status,
                scheduled_action_id,
                paidAt, paid_by_actor_id, paid_by_user_id,
                cancelledAt, cancelled_by_actor_id, cancelled_by_user_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [tenantId, payableId, cancelledByActorId, cancelledByUserId, cancellationReason]
    );

    if (!row) {
      throw new Error('Conta não encontrada ou não pode ser cancelada');
    }

    return this.toAccountsPayable(row);
  }
}

export const accountsPayableRepository = new AccountsPayableRepository();









