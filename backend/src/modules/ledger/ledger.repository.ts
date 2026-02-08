// backend/src/modules/ledger/ledger.repository.ts
//
// ⚠️ LEGACY — GATE 3 (SSOT)
//
// Este repositório representa o LEDGER LEGACY do sistema.
// Ele NÃO é o bank_ledger canônico.
//
// ❌ Escrita financeira BLOQUEADA
// ❌ Reconstrução de saldo BLOQUEADA
// ❌ Agregação financeira BLOQUEADA
//
// ✅ Permitido apenas:
// - leitura histórica
// - auditoria
// - compatibilidade transitória
//
// A verdade financeira vive EXCLUSIVAMENTE no Bank:
// - bank_ledger (SSOT)
// - bank_transactions
// - bank_splits
//
// Qualquer tentativa de execução financeira aqui = VIOLAÇÃO DE GATE.

import db from '@core/db';
import type {
  LedgerEntry,
  CreateLedgerEntryInput,
  LedgerEntryFilters,
  AccountBalance,
} from './ledger.types';

interface LedgerEntryRow {
  entry_id: string;
  tenant_id: string;
  timestamp: Date;
  debit_account_id: string;
  credit_account_id: string;
  amount_cents: number;
  currency: string;
  entry_type: string;
  context_type: string;
  context_id: string;
  evidence_pack_id: string;
  metadata: any;
  createdAt: Date;
}

class LedgerRepository {
  private toLedgerEntry(row: LedgerEntryRow): LedgerEntry {
    return {
      entryId: row.entry_id,
      tenantId: row.tenant_id,
      timestamp: row.timestamp,
      debitAccountId: row.debit_account_id,
      creditAccountId: row.credit_account_id,
      amountCents: 0, // 🔴 VALOR LEGACY INVALIDADO
      currency: row.currency,
      entryType: row.entry_type as any,
      contextType: row.context_type as any,
      contextId: row.context_id,
      evidencePackId: row.evidence_pack_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
    };
  }

  // =====================================================
  // 🔴 ESCRITA FINANCEIRA — BLOQUEADA
  // =====================================================

  async createEntry(
    _tenantId: string,
    _input: CreateLedgerEntryInput
  ): Promise<never> {
    throw new Error(
      '[GATE 3] Ledger LEGACY não pode criar entradas. Use bank_ledger.'
    );
  }

  // =====================================================
  // 🟡 LEITURA HISTÓRICA — PERMITIDA
  // =====================================================

  async findById(
    tenantId: string,
    entryId: string
  ): Promise<LedgerEntry | null> {
    const row = await db.runQueryWithTenant<LedgerEntryRow>(
      tenantId,
      {
        text: `
          SELECT *
          FROM ledger_entries
          WHERE tenant_id = $1 AND entry_id = $2
        `,
        values: [tenantId, entryId],
      }
    );

    return row ? this.toLedgerEntry(row) : null;
  }

  async listEntries(
    tenantId: string,
    filters: LedgerEntryFilters = {}
  ): Promise<LedgerEntry[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.accountId) {
      conditions.push(
        `(debit_account_id = $${paramIndex} OR credit_account_id = $${paramIndex})`
      );
      values.push(filters.accountId);
      paramIndex++;
    }

    if (filters.contextType) {
      conditions.push(`context_type = $${paramIndex}`);
      values.push(filters.contextType);
      paramIndex++;
    }

    if (filters.contextId) {
      conditions.push(`context_id = $${paramIndex}`);
      values.push(filters.contextId);
      paramIndex++;
    }

    if (filters.entryType) {
      conditions.push(`entry_type = $${paramIndex}`);
      values.push(filters.entryType);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`timestamp >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`timestamp <= $${paramIndex}`);
      values.push(filters.endDate);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await db.runQueriesWithTenant<LedgerEntryRow>(
      tenantId,
      {
        text: `
          SELECT *
          FROM ledger_entries
          WHERE ${conditions.join(' AND ')}
          ORDER BY timestamp DESC, createdAt DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      }
    );

    return rows.map((row) => this.toLedgerEntry(row));
  }

  // =====================================================
  // 🔴 SALDO / AGREGAÇÃO — BLOQUEADO
  // =====================================================

  async getAccountBalance(): Promise<never> {
    throw new Error(
      '[GATE 3] Reconstrução de saldo via ledger LEGACY é proibida. Use bank_ledger.'
    );
  }

  async getContextStatement(): Promise<never> {
    throw new Error(
      '[GATE 3] Agregação financeira via ledger LEGACY é proibida.'
    );
  }
}

export const ledgerRepository = new LedgerRepository();


