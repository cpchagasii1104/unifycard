// backend/src/modules/payout/payout.repository.ts
// Repository para Payout Batches e Orders
// 🔴 BLINDAGEM: Append-only onde aplicável

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  PayoutBatch,
  PayoutOrder,
  CreatePayoutBatchInput,
  PayoutBatchFilters,
  PayoutOrderFilters,
} from './payout.types';

interface PayoutBatchRow {
  batch_id: string;
  tenant_id: string;
  status: string;
  total_amount_cents: number;
  currency: string;
  order_count: number;
  executed_count: number;
  failed_count: number;
  blocked_count: number;
  evidence_pack_id: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
  executed_at: Date | null;
}

interface PayoutOrderRow {
  order_id: string;
  tenant_id: string;
  batch_id: string | null;
  actor_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  payout_method: string;
  ledger_entry_ids: string[];
  escrow_id: string | null;
  agreement_id: string | null;
  evidence_pack_id: string;
  block_reason: string | null;
  execution_metadata: any;
  failure_reason: string | null;
  executed_at: Date | null;
  failed_at: Date | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class PayoutRepository {
  private toPayoutBatch(row: PayoutBatchRow): PayoutBatch {
    return {
      batchId: row.batch_id,
      tenantId: row.tenant_id,
      status: row.status as any,
      totalAmountCents: row.total_amount_cents,
      currency: row.currency,
      orderCount: row.order_count,
      executedCount: row.executed_count,
      failedCount: row.failed_count,
      blockedCount: row.blocked_count,
      evidencePackId: row.evidence_pack_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      executedAt: row.executed_at,
    };
  }

  private toPayoutOrder(row: PayoutOrderRow): PayoutOrder {
    return {
      orderId: row.order_id,
      tenantId: row.tenant_id,
      batchId: row.batch_id,
      actorId: row.actor_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      status: row.status as any,
      payoutMethod: row.payout_method as any,
      ledgerEntryIds: row.ledger_entry_ids || [],
      escrowId: row.escrow_id,
      agreementId: row.agreement_id,
      evidencePackId: row.evidence_pack_id,
      blockReason: row.block_reason,
      executionMetadata: row.execution_metadata || {},
      failureReason: row.failure_reason,
      executedAt: row.executed_at,
      failedAt: row.failed_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Cria payout batch
   */
  async createBatch(tenantId: string, evidencePackId: string, metadata?: Record<string, any>): Promise<PayoutBatch> {
    const { randomUUID } = await import('crypto');
    const batchId = randomUUID();

    const rows = await runQueriesWithTenant(
      tenantId,
      [
        {
          text: `
            INSERT INTO payout_batches (
              batch_id, tenant_id, status, evidence_pack_id, metadata
            ) VALUES (
              $1, $2, $3, $4, $5
            ) RETURNING *
          `,
          values: [batchId, tenantId, 'PENDING', evidencePackId, JSON.stringify(metadata || {})],
        },
      ],
      'payout.repository.createBatch'
    );

    return this.toPayoutBatch(rows[0] as PayoutBatchRow);
  }

  /**
   * Cria payout order
   */
  async createOrder(
    tenantId: string,
    input: {
      batchId: string | null;
      actorId: string;
      amountCents: number;
      currency: string;
      payoutMethod: string;
      ledgerEntryIds: string[];
      escrowId: string | null;
      agreementId: string | null;
      evidencePackId: string;
      metadata?: Record<string, any>;
    }
  ): Promise<PayoutOrder> {
    const { randomUUID } = await import('crypto');
    const orderId = randomUUID();

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          INSERT INTO payout_orders (
            order_id, tenant_id, batch_id, actor_id, amount_cents, currency,
            status, payout_method, ledger_entry_ids, escrow_id, agreement_id,
            evidence_pack_id, metadata
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          ) RETURNING *
        `,
        values: [
          orderId,
          tenantId,
          input.batchId,
          input.actorId,
          input.amountCents,
          input.currency,
          'PENDING',
          input.payoutMethod,
          input.ledgerEntryIds,
          input.escrowId,
          input.agreementId,
          input.evidencePackId,
          JSON.stringify(input.metadata || {}),
        ],
      },
      'payout.repository.createOrder'
    );

    return this.toPayoutOrder(rows[0] as PayoutOrderRow);
  }

  /**
   * Atualiza status do payout order
   */
  async updateOrderStatus(
    tenantId: string,
    orderId: string,
    status: string,
    blockReason?: string | null,
    executionMetadata?: Record<string, any> | null,
    failureReason?: string | null
  ): Promise<PayoutOrder> {
    const updates: string[] = [`status = $3`];
    const values: any[] = [tenantId, orderId, status];
    let paramIndex = 4;

    if (status === 'EXECUTED') {
      updates.push(`executed_at = NOW()`);
      if (executionMetadata) {
        updates.push(`execution_metadata = $${paramIndex}`);
        values.push(JSON.stringify(executionMetadata));
        paramIndex++;
      }
    }

    if (status === 'FAILED') {
      updates.push(`failed_at = NOW()`);
      if (failureReason) {
        updates.push(`failure_reason = $${paramIndex}`);
        values.push(failureReason);
        paramIndex++;
      }
    }

    if (status === 'BLOCKED' && blockReason) {
      updates.push(`block_reason = $${paramIndex}`);
      values.push(blockReason);
      paramIndex++;
    }

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE payout_orders
          SET ${updates.join(', ')}, updated_at = NOW()
          WHERE tenant_id = $1 AND order_id = $2
          RETURNING *
        `,
        values,
      },
      'payout.repository.updateOrderStatus'
    );

    return this.toPayoutOrder(rows[0] as PayoutOrderRow);
  }

  /**
   * Atualiza contadores do batch
   */
  async updateBatchCounters(tenantId: string, batchId: string): Promise<PayoutBatch> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE payout_batches
          SET
            order_count = (SELECT COUNT(*) FROM payout_orders WHERE batch_id = $2),
            executed_count = (SELECT COUNT(*) FROM payout_orders WHERE batch_id = $2 AND status = 'EXECUTED'),
            failed_count = (SELECT COUNT(*) FROM payout_orders WHERE batch_id = $2 AND status = 'FAILED'),
            blocked_count = (SELECT COUNT(*) FROM payout_orders WHERE batch_id = $2 AND status = 'BLOCKED'),
            total_amount_cents = (SELECT COALESCE(SUM(amount_cents), 0) FROM payout_orders WHERE batch_id = $2),
            updated_at = NOW()
          WHERE tenant_id = $1 AND batch_id = $2
          RETURNING *
        `,
        values: [tenantId, batchId],
      },
      'payout.repository.updateBatchCounters'
    );

    return this.toPayoutBatch(rows[0] as PayoutBatchRow);
  }

  /**
   * Busca payout batch por ID
   */
  async findBatchById(tenantId: string, batchId: string): Promise<PayoutBatch | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: 'SELECT * FROM payout_batches WHERE tenant_id = $1 AND batch_id = $2',
        values: [tenantId, batchId],
      },
      'payout.repository.findBatchById'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toPayoutBatch(rows[0] as PayoutBatchRow);
  }

  /**
   * Busca payout order por ID
   */
  async findOrderById(tenantId: string, orderId: string): Promise<PayoutOrder | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: 'SELECT * FROM payout_orders WHERE tenant_id = $1 AND order_id = $2',
        values: [tenantId, orderId],
      },
      'payout.repository.findOrderById'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toPayoutOrder(rows[0] as PayoutOrderRow);
  }

  /**
   * Lista payout batches com filtros
   */
  async listBatches(tenantId: string, filters: PayoutBatchFilters = {}): Promise<PayoutBatch[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      values.push(filters.endDate);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM payout_batches
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      },
      'payout.repository.listBatches'
    );

    return rows.map((row) => this.toPayoutBatch(row as PayoutBatchRow));
  }

  /**
   * Lista payout orders com filtros
   */
  async listOrders(tenantId: string, filters: PayoutOrderFilters = {}): Promise<PayoutOrder[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.batchId) {
      conditions.push(`batch_id = $${paramIndex}`);
      values.push(filters.batchId);
      paramIndex++;
    }

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      values.push(filters.actorId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.payoutMethod) {
      conditions.push(`payout_method = $${paramIndex}`);
      values.push(filters.payoutMethod);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      values.push(filters.endDate);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM payout_orders
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      },
      'payout.repository.listOrders'
    );

    return rows.map((row) => this.toPayoutOrder(row as PayoutOrderRow));
  }

  /**
   * Verifica se ledger entry já foi usado em payout
   */
  async isLedgerEntryUsed(tenantId: string, ledgerEntryId: string): Promise<boolean> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT COUNT(*) as count
          FROM payout_orders
          WHERE tenant_id = $1
            AND $2 = ANY(ledger_entry_ids)
            AND status IN ('PENDING', 'READY', 'EXECUTED')
        `,
        values: [tenantId, ledgerEntryId],
      },
      'payout.repository.isLedgerEntryUsed'
    );

    return Number(rows[0]?.count || 0) > 0;
  }
}

export const payoutRepository = new PayoutRepository();




