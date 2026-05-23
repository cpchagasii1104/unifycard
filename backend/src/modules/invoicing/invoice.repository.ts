// backend/src/modules/invoicing/invoice.repository.ts
// Repository para Invoices
// 🔴 BLINDAGEM: Append-only após ISSUED

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Invoice,
  InvoiceItem,
  InvoiceFilters,
} from './invoice.types';

interface InvoiceRow {
  invoice_id: string;
  tenant_id: string;
  actor_id: string;
  recipient_actor_id: string;
  invoice_type: string;
  service_order_id: string | null;
  payout_order_id: string;
  ledger_entry_ids: string[];
  evidence_pack_id: string;
  items: any;
  subtotal_cents: number;
  taxes_cents: number;
  total_cents: number;
  currency: string;
  status: string;
  fiscal_metadata: any;
  issued_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class InvoiceRepository {
  private toInvoice(row: InvoiceRow): Invoice {
    return {
      invoiceId: row.invoice_id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      recipientActorId: row.recipient_actor_id,
      invoiceType: row.invoice_type as any,
      serviceOrderId: row.service_order_id,
      payoutOrderId: row.payout_order_id,
      ledgerEntryIds: row.ledger_entry_ids || [],
      evidencePackId: row.evidence_pack_id,
      items: (row.items || []) as InvoiceItem[],
      subtotalCents: row.subtotal_cents,
      taxesCents: row.taxes_cents,
      totalCents: row.total_cents,
      currency: row.currency,
      status: row.status as any,
      fiscalMetadata: row.fiscal_metadata || null,
      issuedAt: row.issued_at,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Cria invoice
   */
  async create(tenantId: string, input: {
    actorId: string;
    recipientActorId: string;
    invoiceType: string;
    serviceOrderId: string | null;
    payoutOrderId: string;
    ledgerEntryIds: string[];
    evidencePackId: string;
    items: InvoiceItem[];
    subtotalCents: number;
    taxesCents: number;
    totalCents: number;
    currency: string;
    fiscalMetadata: any;
    metadata?: Record<string, any>;
  }): Promise<Invoice> {
    const { randomUUID } = await import('crypto');
    const invoiceId = randomUUID();

    const row = await runQueryWithTenant<InvoiceRow>(tenantId, {
      text: `
        INSERT INTO invoices (
          invoice_id, tenant_id, actor_id, recipient_actor_id, invoice_type,
          service_order_id, payout_order_id, ledger_entry_ids, evidence_pack_id,
          items, subtotal_cents, taxes_cents, total_cents, currency,
          fiscal_metadata, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *
      `,
      values: [
        invoiceId,
        tenantId,
        input.actorId,
        input.recipientActorId,
        input.invoiceType,
        input.serviceOrderId,
        input.payoutOrderId,
        input.ledgerEntryIds,
        input.evidencePackId,
        JSON.stringify(input.items),
        input.subtotalCents,
        input.taxesCents,
        input.totalCents,
        input.currency,
        JSON.stringify(input.fiscalMetadata || {}),
        JSON.stringify(input.metadata || {}),
      ],
    });

    if (!row) throw new Error('Falha ao criar invoice');
    return this.toInvoice(row);
  }

  /**
   * Atualiza status do invoice
   */
  async updateStatus(
    tenantId: string,
    invoiceId: string,
    status: string,
    issuedAt?: Date | null,
    cancelledAt?: Date | null,
    cancellationReason?: string | null
  ): Promise<Invoice> {
    const updates: string[] = [`status = $3`];
    const values: any[] = [tenantId, invoiceId, status];
    let paramIndex = 4;

    if (status === 'issued' && issuedAt) {
      updates.push(`issued_at = $${paramIndex}`);
      values.push(issuedAt);
      paramIndex++;
    }

    if (status === 'cancelled') {
      updates.push(`cancelled_at = NOW()`);
      if (cancellationReason) {
        updates.push(`cancellation_reason = $${paramIndex}`);
        values.push(cancellationReason);
        paramIndex++;
      }
    }

    const row = await runQueryWithTenant<InvoiceRow>(tenantId, {
      text: `
        UPDATE invoices
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE tenant_id = $1 AND invoice_id = $2
        RETURNING *
      `,
      values,
    });

    if (!row) throw new Error('Invoice não encontrado');
    return this.toInvoice(row);
  }

  /**
   * Busca invoice por ID
   */
  async findById(tenantId: string, invoiceId: string): Promise<Invoice | null> {
    const row = await runQueryWithTenant<InvoiceRow>(tenantId, {
      text: 'SELECT * FROM invoices WHERE tenant_id = $1 AND invoice_id = $2',
      values: [tenantId, invoiceId],
    });

    if (!row) return null;
    return this.toInvoice(row);
  }

  /**
   * Busca invoice por payoutOrderId
   */
  async findByPayoutOrderId(tenantId: string, payoutOrderId: string): Promise<Invoice | null> {
    const row = await runQueryWithTenant<InvoiceRow>(tenantId, {
      text: 'SELECT * FROM invoices WHERE tenant_id = $1 AND payout_order_id = $2',
      values: [tenantId, payoutOrderId],
    });

    if (!row) return null;
    return this.toInvoice(row);
  }

  /**
   * Lista invoices com filtros
   */
  async list(tenantId: string, filters: InvoiceFilters = {}): Promise<Invoice[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      values.push(filters.actorId);
      paramIndex++;
    }

    if (filters.recipientActorId) {
      conditions.push(`recipient_actor_id = $${paramIndex}`);
      values.push(filters.recipientActorId);
      paramIndex++;
    }

    if (filters.payoutOrderId) {
      conditions.push(`payout_order_id = $${paramIndex}`);
      values.push(filters.payoutOrderId);
      paramIndex++;
    }

    if (filters.serviceOrderId) {
      conditions.push(`service_order_id = $${paramIndex}`);
      values.push(filters.serviceOrderId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    if (filters.invoiceType) {
      conditions.push(`invoice_type = $${paramIndex}`);
      values.push(filters.invoiceType);
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

    const rows = await runQueriesWithTenant<InvoiceRow>(tenantId, {
      text: `
        SELECT * FROM invoices
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      values: [...values, limit, offset],
    });

    return rows.map((row) => this.toInvoice(row));
  }
}

export const invoiceRepository = new InvoiceRepository();






