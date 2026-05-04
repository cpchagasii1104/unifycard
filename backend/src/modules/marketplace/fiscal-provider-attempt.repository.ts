// backend/src/modules/marketplace/fiscal-provider-attempt.repository.ts
// SPRINT 53: Repository para tentativas de providers fiscais

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  FiscalProviderAttempt,
  CreateFiscalProviderAttemptInput,
} from './fiscal-provider-attempt.types';

interface FiscalProviderAttemptRow {
  id: string;
  tenant_id: string;
  fiscal_document_id: string;
  provider: string;
  action: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  metadata: any;
  created_at: Date;
}

class FiscalProviderAttemptRepository {
  /**
   * Converte row para FiscalProviderAttempt
   */
  private toAttempt(row: FiscalProviderAttemptRow): FiscalProviderAttempt {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      fiscalDocumentId: row.fiscal_document_id,
      provider: row.provider as any,
      action: row.action as any,
      status: row.status as any,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Cria tentativa (append-only)
   */
  async createAttempt(
    tenantId: string,
    input: CreateFiscalProviderAttemptInput
  ): Promise<FiscalProviderAttempt> {
    const row = await runQueryWithTenant<FiscalProviderAttemptRow>(
      tenantId,
      `
      INSERT INTO fiscal_provider_attempts (
        tenant_id, fiscal_document_id, provider, action, status,
        error_code, error_message, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, tenant_id, fiscal_document_id, provider, action, status,
                error_code, error_message, metadata, created_at
      `,
      [
        tenantId,
        input.fiscalDocumentId,
        input.provider,
        input.action,
        input.status,
        input.errorCode || null,
        input.errorMessage || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar tentativa de provider fiscal');
    }

    return this.toAttempt(row);
  }

  /**
   * Lista tentativas por documento fiscal
   */
  async listAttemptsByDocument(
    tenantId: string,
    fiscalDocumentId: string
  ): Promise<FiscalProviderAttempt[]> {
    const rows = await runQueriesWithTenant<FiscalProviderAttemptRow>(
      tenantId,
      `
      SELECT id, tenant_id, fiscal_document_id, provider, action, status,
             error_code, error_message, metadata, created_at
      FROM fiscal_provider_attempts
      WHERE tenant_id = $1 AND fiscal_document_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, fiscalDocumentId]
    );

    return rows.map((row) => this.toAttempt(row));
  }

  /**
   * Lista tentativas por provider e status
   */
  async listAttemptsByProviderAndStatus(
    tenantId: string,
    provider: 'mock' | 'sefaz',
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED'
  ): Promise<FiscalProviderAttempt[]> {
    const rows = await runQueriesWithTenant<FiscalProviderAttemptRow>(
      tenantId,
      `
      SELECT id, tenant_id, fiscal_document_id, provider, action, status,
             error_code, error_message, metadata, created_at
      FROM fiscal_provider_attempts
      WHERE tenant_id = $1 AND provider = $2 AND status = $3
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [tenantId, provider, status]
    );

    return rows.map((row) => this.toAttempt(row));
  }
}

export const fiscalProviderAttemptRepository = new FiscalProviderAttemptRepository();









