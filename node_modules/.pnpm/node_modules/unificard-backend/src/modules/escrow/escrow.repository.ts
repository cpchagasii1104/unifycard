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
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentMilestoneRow {
  milestone_id: string;
  escrow_id: string;
  milestone: string;
  amount_cents: number;
  percentage: number;
  status: string;
  authorizedAt: Date | null;
  releasedAt: Date | null;
  authorized_by_actor_id: string | null;
  released_by_actor_id: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
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
  completedAt: Date | null;
  failure_reason: string | null;
  bank_transaction_id: string | null;
  metadata: any;
  createdAt: Date;
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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
      authorizedAt: row.authorizedAt,
      releasedAt: row.releasedAt,
      authorizedByActorId: row.authorized_by_actor_id,
      releasedByActorId: row.released_by_actor_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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
      completedAt: row.completedAt,
      failureReason: row.failure_reason,
      bankTransactionId: row.bank_transaction_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
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

    const rows = await runQueriesWithTenant(
      tenantId,
      [
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
            0, // Será atualizado com valor do agreement
            'BRL',
            'pending',
            'none',
          ],
        },
      ],
      'escrow.repository.createEscrowAccount'
    );

    return this.toEscrowAccount(rows[0] as EscrowAccountRow);
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
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE escrow_accounts
          SET total_amount_cents = $3, currency = $4, updatedAt = NOW()
          WHERE tenant_id = $1 AND escrow_id = $2
          RETURNING *
        `,
        values: [tenantId, escrowId, totalAmountCents, currency],
      },
      'escrow.repository.updateTotalAmount'
    );

    return this.toEscrowAccount(rows[0] as EscrowAccountRow);
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

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          INSERT INTO payment_milestones (
            milestone_id, escrow_id, milestone, amount_cents, percentage, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6
          ) RETURNING *
        `,
        values: [milestoneId, escrowId, milestone, amountCents, percentage, 'PENDING'],
      },
      'escrow.repository.createMilestone'
    );

    return this.toPaymentMilestone(rows[0] as PaymentMilestoneRow);
  }

  /**
   * Busca escrow account por ID
   */
  async findById(tenantId: string, escrowId: string): Promise<EscrowAccount | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: 'SELECT * FROM escrow_accounts WHERE tenant_id = $1 AND escrow_id = $2',
        values: [tenantId, escrowId],
      },
      'escrow.repository.findById'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toEscrowAccount(rows[0] as EscrowAccountRow);
  }

  /**
   * Busca escrow account por agreement
   */
  async findByAgreement(tenantId: string, agreementId: string): Promise<EscrowAccount | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM escrow_accounts
          WHERE tenant_id = $1 AND agreement_id = $2
          ORDER BY createdAt DESC
          LIMIT 1
        `,
        values: [tenantId, agreementId],
      },
      'escrow.repository.findByAgreement'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toEscrowAccount(rows[0] as EscrowAccountRow);
  }

  /**
   * Lista milestones de um escrow
   */
  async listMilestones(tenantId: string, escrowId: string): Promise<PaymentMilestoneRecord[]> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT pm.* FROM payment_milestones pm
          INNER JOIN escrow_accounts ea ON pm.escrow_id = ea.escrow_id
          WHERE ea.tenant_id = $1 AND pm.escrow_id = $2
          ORDER BY pm.milestone
        `,
        values: [tenantId, escrowId],
      },
      'escrow.repository.listMilestones'
    );

    return rows.map((row) => this.toPaymentMilestone(row as PaymentMilestoneRow));
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

    if (status === 'AUTHORIZED' && authorizedByActorId) {
      updates.push(`authorizedAt = NOW()`, `authorized_by_actor_id = $${paramIndex}`);
      values.push(authorizedByActorId);
      paramIndex++;
    }

    if (status === 'released' && releasedByActorId) {
      updates.push(`releasedAt = NOW()`, `released_by_actor_id = $${paramIndex}`);
      values.push(releasedByActorId);
      paramIndex++;
    }

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE payment_milestones
          SET ${updates.join(', ')}, updatedAt = NOW()
          WHERE milestone_id = $2
            AND escrow_id IN (SELECT escrow_id FROM escrow_accounts WHERE tenant_id = $1)
          RETURNING *
        `,
        values,
      },
      'escrow.repository.updateMilestoneStatus'
    );

    return this.toPaymentMilestone(rows[0] as PaymentMilestoneRow);
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

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE escrow_accounts
          SET ${updates.join(', ')}, updatedAt = NOW()
          WHERE tenant_id = $1 AND escrow_id = $2
          RETURNING *
        `,
        values,
      },
      'escrow.repository.updateEscrowStatus'
    );

    return this.toEscrowAccount(rows[0] as EscrowAccountRow);
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
    initiatedByActorId: string
  ): Promise<EscrowTransaction> {
    const { randomUUID } = await import('crypto');
    const transactionId = randomUUID();

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          INSERT INTO escrow_transactions (
            transaction_id, escrow_id, milestone_id, transaction_type,
            amount_cents, currency, status, initiated_by_actor_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          ) RETURNING *
        `,
        values: [
          transactionId,
          escrowId,
          milestoneId,
          transactionType,
          amountCents,
          currency,
          'PENDING',
          initiatedByActorId,
        ],
      },
      'escrow.repository.createTransaction'
    );

    return this.toEscrowTransaction(rows[0] as EscrowTransactionRow);
  }

  /**
   * Lista transações de um escrow
   */
  async listTransactions(tenantId: string, escrowId: string): Promise<EscrowTransaction[]> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT et.* FROM escrow_transactions et
          INNER JOIN escrow_accounts ea ON et.escrow_id = ea.escrow_id
          WHERE ea.tenant_id = $1 AND et.escrow_id = $2
          ORDER BY et.createdAt DESC
        `,
        values: [tenantId, escrowId],
      },
      'escrow.repository.listTransactions'
    );

    return rows.map((row) => this.toEscrowTransaction(row as EscrowTransactionRow));
  }

  /**
   * Atualiza serviceOrderId do escrow
   */
  async updateServiceOrderId(
    tenantId: string,
    escrowId: string,
    serviceOrderId: string | null
  ): Promise<EscrowAccount> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE escrow_accounts
          SET service_order_id = $3, updatedAt = NOW()
          WHERE tenant_id = $1 AND escrow_id = $2
          RETURNING *
        `,
        values: [tenantId, escrowId, serviceOrderId],
      },
      'escrow.repository.updateServiceOrderId'
    );

    return this.toEscrowAccount(rows[0] as EscrowAccountRow);
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

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM escrow_accounts
          WHERE ${conditions.join(' AND ')}
          ORDER BY createdAt DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      },
      'escrow.repository.list'
    );

    return rows.map((row) => this.toEscrowAccount(row as EscrowAccountRow));
  }
}

export const escrowRepository = new EscrowRepository();



