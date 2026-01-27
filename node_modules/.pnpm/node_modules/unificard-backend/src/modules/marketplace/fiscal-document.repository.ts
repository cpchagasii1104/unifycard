// backend/src/modules/marketplace/fiscal-document.repository.ts
// SPRINT 44: Repository para documentos fiscais

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  FiscalDocument,
  FiscalDocumentItem,
  CreateFiscalDocumentInput,
  FiscalDocumentStatus,
} from './fiscal-document.types';

interface FiscalDocumentRow {
  id: string;
  tenant_id: string;
  order_id: string;
  payment_intent_id: string | null;
  document_type: string;
  status: string;
  total_amount: string;
  metadata: any;
  issued_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface FiscalDocumentItemRow {
  id: string;
  fiscal_document_id: string;
  product_variant_id: string;
  quantity: string;
  unit: string;
  metadata: any;
  created_at: Date;
}

class FiscalDocumentRepository {
  /**
   * Converte row para FiscalDocument
   */
  private toDocument(row: FiscalDocumentRow): FiscalDocument {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      orderId: row.order_id,
      paymentIntentId: row.payment_intent_id,
      documentType: row.document_type as any,
      status: row.status as any,
      totalAmount: parseFloat(row.total_amount),
      metadata: row.metadata || null,
      issuedAt: row.issued_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Converte row para FiscalDocumentItem
   */
  private toItem(row: FiscalDocumentItemRow): FiscalDocumentItem {
    return {
      id: row.id,
      fiscalDocumentId: row.fiscal_document_id,
      productVariantId: row.product_variant_id,
      quantity: parseFloat(row.quantity),
      unit: row.unit,
      metadata: row.metadata || null,
      createdAt: row.created_at,
    };
  }

  /**
   * Cria documento fiscal
   */
  async createDocument(
    tenantId: string,
    input: CreateFiscalDocumentInput
  ): Promise<FiscalDocument> {
    const row = await runQueryWithTenant<FiscalDocumentRow>(
      tenantId,
      `
      INSERT INTO fiscal_documents (
        tenant_id, order_id, payment_intent_id, document_type, status, total_amount, metadata
      )
      VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6)
      RETURNING id, tenant_id, order_id, payment_intent_id, document_type, status,
                total_amount, metadata, issued_at, created_at, updated_at
      `,
      [
        tenantId,
        input.orderId,
        input.paymentIntentId || null,
        input.documentType,
        input.totalAmount,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar documento fiscal');
    }

    return this.toDocument(row);
  }

  /**
   * Busca documento por ID
   */
  async getDocumentById(
    tenantId: string,
    documentId: string
  ): Promise<FiscalDocument | null> {
    const row = await runQueryWithTenant<FiscalDocumentRow>(
      tenantId,
      `
      SELECT id, tenant_id, order_id, payment_intent_id, document_type, status,
             total_amount, metadata, issued_at, created_at, updated_at
      FROM fiscal_documents
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, documentId]
    );

    return row ? this.toDocument(row) : null;
  }

  /**
   * Busca documento por pedido
   */
  async getDocumentByOrder(
    tenantId: string,
    orderId: string
  ): Promise<FiscalDocument | null> {
    const row = await runQueryWithTenant<FiscalDocumentRow>(
      tenantId,
      `
      SELECT id, tenant_id, order_id, payment_intent_id, document_type, status,
             total_amount, metadata, issued_at, created_at, updated_at
      FROM fiscal_documents
      WHERE tenant_id = $1 AND order_id = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [tenantId, orderId]
    );

    return row ? this.toDocument(row) : null;
  }

  /**
   * Lista documentos por pedido
   */
  async listDocumentsByOrder(
    tenantId: string,
    orderId: string
  ): Promise<FiscalDocument[]> {
    const rows = await runQueriesWithTenant<FiscalDocumentRow>(
      tenantId,
      `
      SELECT id, tenant_id, order_id, payment_intent_id, document_type, status,
             total_amount, metadata, issued_at, created_at, updated_at
      FROM fiscal_documents
      WHERE tenant_id = $1 AND order_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, orderId]
    );

    return rows.map((row) => this.toDocument(row));
  }

  /**
   * Atualiza status do documento
   */
  async updateDocumentStatus(
    tenantId: string,
    documentId: string,
    status: FiscalDocumentStatus,
    metadata?: Record<string, any>
  ): Promise<FiscalDocument> {
    const updateMetadata = metadata
      ? `metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,`
      : '';
    const updateIssuedAt = status === 'ISSUED' ? `issued_at = NOW(),` : '';

    const params: any[] = [];
    let paramIndex = 1;

    if (metadata) {
      params.push(JSON.stringify(metadata));
      paramIndex++;
    }
    params.push(status, tenantId, documentId);

    const row = await runQueryWithTenant<FiscalDocumentRow>(
      tenantId,
      `
      UPDATE fiscal_documents
      SET status = $${paramIndex - 1},
          ${updateIssuedAt}
          ${updateMetadata}
          updated_at = NOW()
      WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1}
      RETURNING id, tenant_id, order_id, payment_intent_id, document_type, status,
                total_amount, metadata, issued_at, created_at, updated_at
      `,
      params
    );

    if (!row) {
      throw new Error(`Documento fiscal não encontrado: ${documentId}`);
    }

    return this.toDocument(row);
  }

  /**
   * Cria item do documento fiscal
   */
  async createItem(
    tenantId: string,
    fiscalDocumentId: string,
    productVariantId: string,
    quantity: number,
    unit: string,
    metadata?: Record<string, any>
  ): Promise<FiscalDocumentItem> {
    const row = await runQueryWithTenant<FiscalDocumentItemRow>(
      tenantId,
      `
      INSERT INTO fiscal_document_items (
        fiscal_document_id, product_variant_id, quantity, unit, metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, fiscal_document_id, product_variant_id, quantity, unit, metadata, created_at
      `,
      [
        fiscalDocumentId,
        productVariantId,
        quantity,
        unit,
        JSON.stringify(metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar item do documento fiscal');
    }

    return this.toItem(row);
  }

  /**
   * Lista itens de um documento
   */
  async listItemsByDocument(
    tenantId: string,
    fiscalDocumentId: string
  ): Promise<FiscalDocumentItem[]> {
    const rows = await runQueriesWithTenant<FiscalDocumentItemRow>(
      tenantId,
      `
      SELECT fi.id, fi.fiscal_document_id, fi.product_variant_id, fi.quantity, fi.unit,
             fi.metadata, fi.created_at
      FROM fiscal_document_items fi
      INNER JOIN fiscal_documents fd ON fi.fiscal_document_id = fd.id
      WHERE fd.tenant_id = $1 AND fi.fiscal_document_id = $2
      ORDER BY fi.created_at ASC
      `,
      [tenantId, fiscalDocumentId]
    );

    return rows.map((row) => this.toItem(row));
  }
}

export const fiscalDocumentRepository = new FiscalDocumentRepository();







