// Leituras agregadas sobre transações SSOT — apenas módulo Bank.
import { runQueriesWithTenant, runQueryWithTenant } from '@core/database/pool';

class BankTransactionReadRepository {
  /**
   * Soma amount_cents por id de transação (batch).
   */
  async getAmountCentsByTransactionIds(
    tenantId: string,
    transactionIds: string[]
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (transactionIds.length === 0) return out;
    const rows = await runQueriesWithTenant<{ id: string; amount_cents: string }>(
      tenantId,
      `
      SELECT id::text, amount_cents::text
      FROM bank_transactions
      WHERE tenant_id = $1 AND id = ANY($2::uuid[])
      `,
      [tenantId, transactionIds]
    );
    for (const r of rows) {
      out.set(r.id, parseInt(r.amount_cents, 10) || 0);
    }
    return out;
  }

  /**
   * Metadados de transação por id (batch), tenant-scoped. Leitura pura — usada por readers de
   * extrato/fundo que precisam enriquecer entradas do ledger com o metadata da transação, sem SQL
   * direto a bank_* fora do domínio Bank (R-8: fronteira BANK_DOMAIN_RULES §3 / LEI §4.6).
   */
  async getMetadataByTransactionIds(
    tenantId: string,
    transactionIds: string[]
  ): Promise<Map<string, Record<string, unknown>>> {
    const out = new Map<string, Record<string, unknown>>();
    if (transactionIds.length === 0) return out;
    const rows = await runQueriesWithTenant<{ id: string; metadata: Record<string, unknown> | null }>(
      tenantId,
      `
      SELECT id::text, metadata
      FROM bank_transactions
      WHERE tenant_id = $1 AND id = ANY($2::uuid[])
      `,
      [tenantId, transactionIds]
    );
    for (const r of rows) {
      out.set(r.id, (r.metadata ?? {}) as Record<string, unknown>);
    }
    return out;
  }

  /**
   * Primeira transação por reference (backfill / reconciliação).
   */
  async findIdByReferenceTypeAndReferenceId(
    tenantId: string,
    referenceType: string,
    referenceId: string
  ): Promise<string | null> {
    const row = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `
      SELECT id::text FROM bank_transactions
      WHERE tenant_id = $1 AND reference_type = $2 AND reference_id = $3
      LIMIT 1
      `,
      [tenantId, referenceType, referenceId]
    );
    return row?.id ?? null;
  }

  /**
   * Últimas transações do tenant (debug / scripts).
   */
  async listRecentTransactionRows(
    tenantId: string,
    limit: number
  ): Promise<
    Array<{
      id: string;
      tenant_id: string;
      amount_cents: number;
      reference_type: string | null;
      reference_id: string | null;
      completed: boolean;
    }>
  > {
    const rows = await runQueriesWithTenant<{
      id: string;
      tenant_id: string;
      amount_cents: string;
      reference_type: string | null;
      reference_id: string | null;
      completed: boolean;
    }>(
      tenantId,
      `
      SELECT id, tenant_id, amount_cents::text, reference_type, reference_id,
             internal_completed_at IS NOT NULL AS completed
      FROM bank_transactions
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [tenantId, limit]
    );
    return rows.map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      amount_cents: parseInt(r.amount_cents, 10) || 0,
      reference_type: r.reference_type,
      reference_id: r.reference_id,
      completed: r.completed,
    }));
  }

  /**
   * Busca resumo consolidado de wallet para um actor.
   * Calcula balance através de SUM(credit - debit) no ledger.
   * Retorna null se actor não possui contas.
   */
  async getWalletSummaryByActorId(
    tenantId: string,
    actorId: string
  ): Promise<{
    balanceCents: number;
    currency: string;
    accountsCount: number;
  } | null> {
    const row = await runQueryWithTenant<{
      balance_cents: string;
      currency: string;
      accounts_count: string;
    }>(
      tenantId,
      `
      SELECT
        COALESCE(SUM(
          CASE
            WHEN bl.direction = 'credit' THEN bl.amount_cents
            WHEN bl.direction = 'debit' THEN -bl.amount_cents
            ELSE 0
          END
        ), 0)::text AS balance_cents,
        'BRL' AS currency,
        COUNT(DISTINCT ba.id)::text AS accounts_count
      FROM bank_accounts ba
      LEFT JOIN bank_ledger bl
        ON bl.account_id = ba.id
       AND bl.tenant_id = ba.tenant_id
      WHERE ba.tenant_id = $1
        AND ba.actor_id = $2::uuid
      `,
      [tenantId, actorId]
    );

    if (!row || parseInt(row.accounts_count, 10) === 0) {
      return null;
    }

    return {
      balanceCents: parseInt(row.balance_cents, 10) || 0,
      currency: row.currency,
      accountsCount: parseInt(row.accounts_count, 10),
    };
  }

  /**
   * Lista transações recentes (ledger entries) de todas as contas de um actor.
   * Usa bank_ledger.direction (não entry_type).
   */
  async listRecentTransactionsByActorId(
    tenantId: string,
    actorId: string,
    opts: { limit?: number } = {}
  ): Promise<Array<{
    entryId: string;
    accountId: string;
    direction: 'credit' | 'debit';
    amountCents: number;
    createdAt: Date;
  }>> {
    const limit = opts.limit ?? 10;

    const rows = await runQueriesWithTenant<{
      entry_id: string;
      account_id: string;
      direction: string;
      amount_cents: string;
      created_at: Date;
    }>(
      tenantId,
      `
      SELECT
        bl.id::text AS entry_id,
        bl.account_id::text,
        bl.direction,
        bl.amount_cents::text,
        bl.created_at
      FROM bank_ledger bl
      INNER JOIN bank_accounts ba
        ON ba.id = bl.account_id
       AND ba.tenant_id = bl.tenant_id
      WHERE bl.tenant_id = $1
        AND ba.actor_id = $2::uuid
      ORDER BY bl.created_at DESC
      LIMIT $3
      `,
      [tenantId, actorId, limit]
    );

    return rows.map(r => ({
      entryId: r.entry_id,
      accountId: r.account_id,
      direction: r.direction as 'credit' | 'debit',
      amountCents: parseInt(r.amount_cents, 10) || 0,
      createdAt: r.created_at,
    }));
  }

  /**
   * Timestamp de liquidação interna por id de transação.
   * Retorna null se transação não existe ou ainda não foi liquidada.
   */
  /**
   * DECISION-0189 (F3): conta de ORIGEM (bank_transactions.account_id) + dono — insumo da
   * autorização por recurso das leituras de split. Leitura pura, tenant-scoped, no domínio Bank.
   */
  async getOriginAccountByTransactionId(
    tenantId: string,
    transactionId: string
  ): Promise<{ accountId: string; ownerType: string; ownerId: string } | null> {
    const row = await runQueryWithTenant<{ account_id: string; owner_type: string; owner_id: string }>(
      tenantId,
      `SELECT t.account_id, a.owner_type, a.owner_id
         FROM bank_transactions t
         JOIN bank_accounts a ON a.id = t.account_id AND a.tenant_id = t.tenant_id
        WHERE t.tenant_id = $1 AND t.id = $2
        LIMIT 1`,
      [tenantId, transactionId]
    );
    return row ? { accountId: row.account_id, ownerType: row.owner_type, ownerId: row.owner_id } : null;
  }

  async getInternalCompletedAtById(
    tenantId: string,
    transactionId: string
  ): Promise<Date | null> {
    const row = await runQueryWithTenant<{ internal_completed_at: Date | null }>(
      tenantId,
      `SELECT internal_completed_at FROM bank_transactions
       WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
      [tenantId, transactionId]
    );
    return row?.internal_completed_at ?? null;
  }
}

export const bankTransactionReadRepository = new BankTransactionReadRepository();