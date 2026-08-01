// backend/src/modules/bank/bank-reconciliation-history.repository.ts
// READ-MODEL: Repository para Histórico de Conciliações Bancárias
// Status: READ-MODEL PURO (não CORE, não fonte de verdade, não decisório)

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  DORMENTE (F-BANK-RECONCILIATION-RELINK, 2026-07-31) — SEM CALLER
// ║ NORMA:   docs/02_decisions/RECONCILIATION_DISCREPANCY_DUAL_TABLE.md
// ║ NÃO:     religar este repository. A tabela `bank_reconciliation_history` NUNCA existiu no
// ║          schema vivo (DDL só em migrations_archive/0216_bank_reconciliation_history.sql,
// ║          nunca aplicado às migrations vivas — schema-ghost; todo INSERT/SELECT aqui é 42P01).
// ║          O único caller (rota core/unifybank, prefixo /admin/finance) foi RELIGADO ao SSOT
// ║          canônico. NÃO apagar este arquivo — deleção de módulo pré-existente exige
// ║          autorização explícita do dono, mesmo dormente e sem caller.
// ║ EM VEZ:  modules/reconciliation/reconciliation.repository.ts — createManualReconciliationRun/
// ║          listManualReconciliationRuns/getManualReconciliationRunById (tabelas vivas do
// ║          Prompt 52, ver reconciliation-engine.service.ts).
// ╚════════════════════════════════════════════════════════════════

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { asMoneyCents, type MoneyCents } from '@contracts/marketplace/canonical';
import type { BankCurrency } from './bank-account.types';

/**
 * Entrada de histórico de reconciliação
 */
export interface ReconciliationHistoryEntry {
  reconciliationId: string;
  tenantId: string;
  internalBalanceCents: number;
  externalBalanceCents: number;
  differenceCents: number;
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
  internalBalanceCents: number;
  externalBalanceCents: number;
  differenceCents: number;
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
      created_at: Date;
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
        input.internalBalanceCents,
        input.externalBalanceCents,
        input.differenceCents,
        input.currency,
        input.filtersApplied || {},
        input.notes || null,
        input.metadata || {},
        input.performedByUserId || null,
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar entrada de histórico de reconciliação');
    }
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
      created_at: Date;
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
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

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
      created_at: Date;
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
    created_at: Date;
  }): ReconciliationHistoryEntry {
    return {
      reconciliationId: row.reconciliation_id,
      tenantId: row.tenant_id,
      internalBalanceCents: asMoneyCents(Math.round(Number(row.internal_balance))),
      externalBalanceCents: asMoneyCents(Math.round(Number(row.external_balance))),
      differenceCents: asMoneyCents(Math.round(Number(row.difference))),
      currency: row.currency,
      filtersApplied: row.filters_applied || {},
      notes: row.notes || undefined,
      metadata: row.metadata || {},
      performedByUserId: row.performed_by_user_id || undefined,
      createdAt: row.created_at,
    };
  }
}

export const bankReconciliationHistoryRepository = new BankReconciliationHistoryRepository();




