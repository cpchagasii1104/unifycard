// backend/src/modules/bank/bank-reconciliation-history.repository.ts
// READ-MODEL: Repository para Histórico de Conciliações Bancárias
// Status: READ-MODEL PURO (não CORE, não fonte de verdade, não decisório)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { BankCurrency } from './bank-account.types';

/**
 * Entrada de histórico de reconciliação
 */
export interface ReconciliationHistoryEntry {
  reconciliationId: string;
  tenantId: string;
  internalBalance: number;
  externalBalance: number;
  difference: number;
  currency: string;
  filtersApplied?: Record<string, any>;
  notes?: string;
  metadata?: Record<string, any>;
  performedByUserId?: string;
  createdAt: Date;
}

/**
 * Input para criar entrada de histórico
 */
export interface CreateReconciliationHistoryInput {
  internalBalance: number;
  externalBalance: number;
  difference: number;
  currency: BankCurrency;
  filtersApplied?: Record<string, any>;
  notes?: string;
  metadata?: Record<string, any>;
  performedByUserId?: string;
}

/**
 * Filtros para buscar histórico
 */
export interface ReconciliationHistoryFilters {
  currency?: BankCurrency;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Repository para histórico de reconciliações bancárias (READ-MODEL)
 * 
 * REGRAS ABSOLUTAS:
 * - Append-only (sem UPDATE/DELETE)
 * - externalBalance é INPUT MANUAL
 * - NÃO integra com banco externo
 * - NÃO aciona decisões automáticas
 */
class BankReconciliationHistoryRepository {
  /**
   * Cria entrada de histórico (append-only)
   * 
   * @param tenantId - ID do tenant
   * @param input - Dados da reconciliação
   * @returns Entrada criada
   */
  async create(
    tenantId: string,
    input: CreateReconciliationHistoryInput
  ): Promise<ReconciliationHistoryEntry> {
    const row = await runQueryWithTenant<{
      reconciliation_id: string;
      tenant_id: string;
      internal_balance: string;
      external_balance: string;
      difference: string;
      currency: string;
      filters_applied: any;
      notes: string | null;
      metadata: any;
      performed_by_user_id: string | null;
      createdAt: Date;
    }>(
      tenantId,
      `
      INSERT INTO bank_reconciliation_history (
        tenant_id,
        internal_balance,
        external_balance,
        difference,
        currency,
        filters_applied,
        notes,
        metadata,
        performed_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        tenantId,
        input.internalBalance,
        input.externalBalance,
        input.difference,
        input.currency,
        input.filtersApplied || {},
        input.notes || null,
        input.metadata || {},
        input.performedByUserId || null,
      ]
    );

    return this.toReconciliationHistoryEntry(row);
  }

  /**
   * Busca entrada por ID
   * 
   * @param tenantId - ID do tenant
   * @param reconciliationId - ID da reconciliação
   * @returns Entrada ou null
   */
  async findById(
    tenantId: string,
    reconciliationId: string
  ): Promise<ReconciliationHistoryEntry | null> {
    const row = await runQueryWithTenant<{
      reconciliation_id: string;
      tenant_id: string;
      internal_balance: string;
      external_balance: string;
      difference: string;
      currency: string;
      filters_applied: any;
      notes: string | null;
      metadata: any;
      performed_by_user_id: string | null;
      createdAt: Date;
    }>(
      tenantId,
      `
      SELECT *
      FROM bank_reconciliation_history
      WHERE tenant_id = $1
        AND reconciliation_id = $2
      LIMIT 1
      `,
      [tenantId, reconciliationId]
    );

    return row ? this.toReconciliationHistoryEntry(row) : null;
  }

  /**
   * Lista histórico com filtros
   * 
   * @param tenantId - ID do tenant
   * @param filters - Filtros opcionais
   * @returns Lista de entradas
   */
  async list(
    tenantId: string,
    filters: ReconciliationHistoryFilters = {}
  ): Promise<ReconciliationHistoryEntry[]> {
    let query = `
      SELECT *
      FROM bank_reconciliation_history
      WHERE tenant_id = $1
    `;

    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.currency) {
      query += ` AND currency = $${paramIndex}`;
      params.push(filters.currency);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND createdAt >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND createdAt <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY createdAt DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    const rows = await runQueriesWithTenant<{
      reconciliation_id: string;
      tenant_id: string;
      internal_balance: string;
      external_balance: string;
      difference: string;
      currency: string;
      filters_applied: any;
      notes: string | null;
      metadata: any;
      performed_by_user_id: string | null;
      createdAt: Date;
    }>(tenantId, query, params);

    return rows.map(row => this.toReconciliationHistoryEntry(row));
  }

  /**
   * Converte row do banco para objeto
   */
  private toReconciliationHistoryEntry(row: {
    reconciliation_id: string;
    tenant_id: string;
    internal_balance: string;
    external_balance: string;
    difference: string;
    currency: string;
    filters_applied: any;
    notes: string | null;
    metadata: any;
    performed_by_user_id: string | null;
    createdAt: Date;
  }): ReconciliationHistoryEntry {
    return {
      reconciliationId: row.reconciliation_id,
      tenantId: row.tenant_id,
      internalBalance: parseFloat(row.internal_balance),
      externalBalance: parseFloat(row.external_balance),
      difference: parseFloat(row.difference),
      currency: row.currency,
      filtersApplied: row.filters_applied || {},
      notes: row.notes || undefined,
      metadata: row.metadata || {},
      performedByUserId: row.performed_by_user_id || undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const bankReconciliationHistoryRepository = new BankReconciliationHistoryRepository();




