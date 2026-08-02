// backend/src/modules/escrow/escrow.repository.ts
// Repository para Escrow Accounts, Payment Milestones e Transactions
// 🔴 BLINDAGEM: Append-only em transações, imutável após criação

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  EscrowAccount,
  PaymentMilestoneRecord,
  EscrowTransaction,
  CreateEscrowInput,
  EscrowFilters,
} from './escrow.types';

interface EscrowAccountRow {
  escrow_id: string;
  tenant_id: string;
  agreement_id: string;
  service_order_id: string | null;
  bundle_id: string | null;
  evidence_pack_id: string | null;
  total_amount_cents: number;
  currency: string;
  held_amount_cents: number;
  released_amount_cents: number;
  refunded_amount_cents: number;
  status: string;
  current_milestone: string | null;
  dispute_status: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface PaymentMilestoneRow {
  milestone_id: string;
  escrow_id: string;
  milestone: string;
  amount_cents: number;
  percentage: number;
  status: string;
  authorized_at: Date | null;
  released_at: Date | null;
  authorized_by_actor_id: string | null;
  released_by_actor_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface EscrowTransactionRow {
  transaction_id: string;
  escrow_id: string;
  milestone_id: string | null;
  transaction_type: string;
  amount_cents: number;
  currency: string;
  status: string;
  initiated_by_actor_id: string;
  completed_at: Date | null;
  failure_reason: string | null;
  bank_transaction_id: string | null;
  metadata: any;
  created_at: Date;
}

class EscrowRepository {
  private toEscrowAccount(row: EscrowAccountRow): EscrowAccount {
    return {
      escrowId: row.escrow_id,
      tenantId: row.tenant_id,
      agreementId: row.agreement_id,
      serviceOrderId: row.service_order_id,
      bundleId: row.bundle_id,
      evidencePackId: row.evidence_pack_id,
      totalAmountCents: row.total_amount_cents,
      currency: row.currency,
      heldAmountCents: row.held_amount_cents,
      releasedAmountCents: row.released_amount_cents,
      refundedAmountCents: row.refunded_amount_cents,
      status: row.status as any,
      currentMilestone: row.current_milestone as any,
      disputeStatus: row.dispute_status as any,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toPaymentMilestone(row: PaymentMilestoneRow): PaymentMilestoneRecord {
    return {
      milestoneId: row.milestone_id,
      escrowId: row.escrow_id,
      milestone: row.milestone as any,
      amountCents: row.amount_cents,
      percentage: Number(row.percentage),
      status: row.status as any,
      authorizedAt: row.authorized_at,
      releasedAt: row.released_at,
      authorizedByActorId: row.authorized_by_actor_id,
      releasedByActorId: row.released_by_actor_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toEscrowTransaction(row: EscrowTransactionRow): EscrowTransaction {
    return {
      transactionId: row.transaction_id,
      escrowId: row.escrow_id,
      milestoneId: row.milestone_id,
      transactionType: row.transaction_type as any,
      amountCents: row.amount_cents,
      currency: row.currency,
      status: row.status as any,
      initiatedByActorId: row.initiated_by_actor_id,
      completedAt: row.completed_at,
      failureReason: row.failure_reason,
      bankTransactionId: row.bank_transaction_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Cria escrow account com milestones
   */
  async createEscrowAccount(
    tenantId: string,
    input: CreateEscrowInput,
    evidencePackId: string | null
  ): Promise<EscrowAccount> {
    const { randomUUID } = await import('crypto');
    const escrowId = randomUUID();

    const rows = await runQueriesWithTenant<EscrowAccountRow>(
      tenantId,
      {
        text: `
            INSERT INTO escrow_accounts (
              escrow_id, tenant_id, agreement_id, service_order_id, bundle_id,
              evidence_pack_id, total_amount_cents, currency, status, dispute_status
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            ) RETURNING *
          `,
        values: [
          escrowId,
          tenantId,
          input.agreementId,
          input.serviceOrderId || null,
          input.bundleId || null,
          evidencePackId,
          0,
          'BRL',
          'pending',
          'none',
        ],
      }
    );

    return this.toEscrowAccount(rows[0]);
  }

  /**
   * Atualiza valor total do escrow (vindo do agreement)
   */
  async updateTotalAmount(
    tenantId: string,
    escrowId: string,
    totalAmountCents: number,
    currency: string
  ): Promise<EscrowAccount> {
    const row = await runQueryWithTenant<EscrowAccountRow>(
      tenantId,
      {
        text: `
          UPDATE escrow_accounts
          SET total_amount_cents = $3, currency = $4, updated_at = NOW()
          WHERE tenant_id = $1 AND escrow_id = $2
          RETURNING *
        `,
        values: [tenantId, escrowId, totalAmountCents, currency],
      }
    );

    return row ? this.toEscrowAccount(row) : (null as unknown as EscrowAccount);
  }

  /**
   * Cria payment milestone
   */
  async createMilestone(
    tenantId: string,
    escrowId: string,
    milestone: string,
    amountCents: number,
    percentage: number
  ): Promise<PaymentMilestoneRecord> {
    const { randomUUID } = await import('crypto');
    const milestoneId = randomUUID();

    const row = await runQueryWithTenant<PaymentMilestoneRow>(
      tenantId,
      {
        text: `
          INSERT INTO payment_milestones (
            milestone_id, escrow_id, milestone, amount_cents, percentage, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6
          ) RETURNING *
        `,
        values: [milestoneId, escrowId, milestone, amountCents, percentage, 'pending'],
      }
    );

    if (!row) throw new Error('createMilestone: INSERT did not return row');
    return this.toPaymentMilestone(row);
  }

  /**
   * Busca escrow account por ID
   */
  async findById(tenantId: string, escrowId: string): Promise<EscrowAccount | null> {
    const row = await runQueryWithTenant<EscrowAccountRow>(
      tenantId,
      {
        text: 'SELECT * FROM escrow_accounts WHERE tenant_id = $1 AND escrow_id = $2',
        values: [tenantId, escrowId],
      }
    );

    if (!row) return null;
    return this.toEscrowAccount(row);
  }

  /**
   * Busca escrow account por agreement
   */
  async findByAgreement(tenantId: string, agreementId: string): Promise<EscrowAccount | null> {
    const row = await runQueryWithTenant<EscrowAccountRow>(
      tenantId,
      {
        text: `
          SELECT * FROM escrow_accounts
          WHERE tenant_id = $1 AND agreement_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        `,
        values: [tenantId, agreementId],
      }
    );

    if (!row) return null;

    return this.toEscrowAccount(row);
  }

  /**
   * Lista milestones de um escrow
   */
  async listMilestones(tenantId: string, escrowId: string): Promise<PaymentMilestoneRecord[]> {
    const rows = await runQueriesWithTenant<PaymentMilestoneRow>(
      tenantId,
      {
        text: `
          SELECT pm.* FROM payment_milestones pm
          INNER JOIN escrow_accounts ea ON pm.escrow_id = ea.escrow_id
          WHERE ea.tenant_id = $1 AND pm.escrow_id = $2
          ORDER BY pm.milestone
        `,
        values: [tenantId, escrowId],
      }
    );

    return rows.map((r) => this.toPaymentMilestone(r));
  }

  /**
   * Atualiza status do milestone
   */
  async updateMilestoneStatus(
    tenantId: string,
    milestoneId: string,
    status: string,
    authorizedByActorId?: string | null,
    releasedByActorId?: string | null
  ): Promise<PaymentMilestoneRecord> {
    const updates: string[] = [`status = $3`];
    const values: any[] = [tenantId, milestoneId, status];
    let paramIndex = 4;

    if (status === 'authorized' && authorizedByActorId) {
      updates.push(`authorized_at = NOW()`, `authorized_by_actor_id = $${paramIndex}`);
      values.push(authorizedByActorId);
      paramIndex++;
    }

    if (status === 'released' && releasedByActorId) {
      updates.push(`released_at = NOW()`, `released_by_actor_id = $${paramIndex}`);
      values.push(releasedByActorId);
      paramIndex++;
    }

    const row = await runQueryWithTenant<PaymentMilestoneRow>(
      tenantId,
      {
        text: `
          UPDATE payment_milestones
          SET ${updates.join(', ')}, updated_at = NOW()
          WHERE milestone_id = $2
            AND escrow_id IN (SELECT escrow_id FROM escrow_accounts WHERE tenant_id = $1)
          RETURNING *
        `,
        values,
      }
    );

    if (!row) throw new Error('updateMilestoneStatus: no row updated');
    return this.toPaymentMilestone(row);
  }

  /**
   * Atualiza status e valores do escrow account
   */
  async updateEscrowStatus(
    tenantId: string,
    escrowId: string,
    status: string,
    heldAmountCents?: number,
    releasedAmountCents?: number,
    refundedAmountCents?: number,
    currentMilestone?: string | null,
    disputeStatus?: string
  ): Promise<EscrowAccount> {
    const updates: string[] = [`status = $3`];
    const values: any[] = [tenantId, escrowId, status];
    let paramIndex = 4;

    if (heldAmountCents !== undefined) {
      updates.push(`held_amount_cents = $${paramIndex}`);
      values.push(heldAmountCents);
      paramIndex++;
    }

    if (releasedAmountCents !== undefined) {
      updates.push(`released_amount_cents = $${paramIndex}`);
      values.push(releasedAmountCents);
      paramIndex++;
    }

    if (refundedAmountCents !== undefined) {
      updates.push(`refunded_amount_cents = $${paramIndex}`);
      values.push(refundedAmountCents);
      paramIndex++;
    }

    if (currentMilestone !== undefined) {
      updates.push(`current_milestone = $${paramIndex}`);
      values.push(currentMilestone);
      paramIndex++;
    }

    if (disputeStatus !== undefined) {
      updates.push(`dispute_status = $${paramIndex}`);
      values.push(disputeStatus);
      paramIndex++;
    }

    const row = await runQueryWithTenant<EscrowAccountRow>(
      tenantId,
      {
        text: `
          UPDATE escrow_accounts
          SET ${updates.join(', ')}, updated_at = NOW()
          WHERE tenant_id = $1 AND escrow_id = $2
          RETURNING *
        `,
        values,
      }
    );

    if (!row) throw new Error('updateEscrowStatus: no row updated');
    return this.toEscrowAccount(row);
  }

  /**
   * Busca linha append-only por PK (ex.: idempotência escrow_operation_id).
   */
  async findTransactionById(tenantId: string, transactionId: string): Promise<EscrowTransaction | null> {
    const row = await runQueryWithTenant<EscrowTransactionRow>(
      tenantId,
      {
        text: `
          SELECT et.*
          FROM escrow_transactions et
          INNER JOIN escrow_accounts ea ON et.escrow_id = ea.escrow_id
          WHERE ea.tenant_id = $1 AND et.transaction_id = $2
          LIMIT 1
        `,
        values: [tenantId, transactionId],
      }
    );
    return row ? this.toEscrowTransaction(row) : null;
  }

  /**
   * Cria escrow transaction (append-only)
   */
  async createTransaction(
    tenantId: string,
    escrowId: string,
    milestoneId: string | null,
    transactionType: string,
    amountCents: number,
    currency: string,
    initiatedByActorId: string,
    bankTransactionIdOrOpts?:
      | string
      | null
      | {
          transactionId?: string;
          bankTransactionId?: string | null;
          initialStatus?: string;
        },
    opts?: {
      transactionId?: string;
      bankTransactionId?: string | null;
      initialStatus?: string;
    }
  ): Promise<EscrowTransaction> {
    const { randomUUID } = await import('crypto');
    const normalizedOpts =
      typeof bankTransactionIdOrOpts === 'object' && bankTransactionIdOrOpts !== null
        ? bankTransactionIdOrOpts
        : opts;
    const transactionId = normalizedOpts?.transactionId ?? randomUUID();
    const bankTxId =
      typeof bankTransactionIdOrOpts === 'string'
        ? bankTransactionIdOrOpts
        : normalizedOpts?.bankTransactionId ?? null;
    const status = normalizedOpts?.initialStatus ?? 'pending';

    const row = await runQueryWithTenant<EscrowTransactionRow>(
      tenantId,
      {
        text: `
          INSERT INTO escrow_transactions (
            transaction_id, escrow_id, milestone_id, transaction_type,
            amount_cents, currency, status, initiated_by_actor_id, bank_transaction_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) RETURNING *
        `,
        values: [
          transactionId,
          escrowId,
          milestoneId,
          transactionType,
          amountCents,
          currency,
          status,
          initiatedByActorId,
          bankTxId,
        ],
      }
    );

    if (!row) throw new Error('createTransaction: INSERT did not return row');
    return this.toEscrowTransaction(row);
  }

  /**
   * Lista transações de um escrow
   */
  async listTransactions(tenantId: string, escrowId: string): Promise<EscrowTransaction[]> {
    const rows = await runQueriesWithTenant<EscrowTransactionRow>(
      tenantId,
      {
        text: `
          SELECT et.* FROM escrow_transactions et
          INNER JOIN escrow_accounts ea ON et.escrow_id = ea.escrow_id
          WHERE ea.tenant_id = $1 AND et.escrow_id = $2
          ORDER BY et.created_at DESC
        `,
        values: [tenantId, escrowId],
      }
    );

    return rows.map((r) => this.toEscrowTransaction(r));
  }

  /**
   * Atualiza serviceOrderId do escrow
   */
  async updateServiceOrderId(
    tenantId: string,
    escrowId: string,
    serviceOrderId: string | null
  ): Promise<EscrowAccount> {
    const row = await runQueryWithTenant<EscrowAccountRow>(
      tenantId,
      {
        text: `
          UPDATE escrow_accounts
          SET service_order_id = $3, updated_at = NOW()
          WHERE tenant_id = $1 AND escrow_id = $2
          RETURNING *
        `,
        values: [tenantId, escrowId, serviceOrderId],
      }
    );

    if (!row) throw new Error('updateServiceOrderId: no row updated');
    return this.toEscrowAccount(row);
  }

  /**
   * Lista escrow accounts com filtros
   */
  async list(tenantId: string, filters: EscrowFilters = {}): Promise<EscrowAccount[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.agreementId) {
      conditions.push(`agreement_id = $${paramIndex}`);
      values.push(filters.agreementId);
      paramIndex++;
    }

    if (filters.serviceOrderId) {
      conditions.push(`service_order_id = $${paramIndex}`);
      values.push(filters.serviceOrderId);
      paramIndex++;
    }

    if (filters.bundleId) {
      conditions.push(`bundle_id = $${paramIndex}`);
      values.push(filters.bundleId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.disputeStatus) {
      conditions.push(`dispute_status = $${paramIndex}`);
      values.push(filters.disputeStatus);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<EscrowAccountRow>(
      tenantId,
      {
        text: `
          SELECT * FROM escrow_accounts
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      }
    );

    return rows.map((r) => this.toEscrowAccount(r));
  }
}

export const escrowRepository = new EscrowRepository();



