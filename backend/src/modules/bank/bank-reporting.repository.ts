// Leituras agregadas de KPI/exportação sobre o SSOT financeiro — domínio Bank.
// Substitui o módulo economy ledger (stub) para KPIs e exportações.
// Semântica: totais derivados de transferências registadas em bank_transactions; comissão/fee via bank_splits.split_type = 'fee'.

import { runQueriesWithTenant, runQueryWithTenant } from '@core/database/pool';

class BankReportingRepository {
  /**
   * Volume total de transferências no período (proxy operacional de GMV).
   */
  async sumBankTransactionVolumeCents(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const row = await runQueryWithTenant<{ s: string }>(
      tenantId,
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s
       FROM bank_transactions
       WHERE tenant_id = $1::uuid
         AND created_at >= $2
         AND created_at <= $3`,
      [tenantId, startDate, endDate]
    );
    return parseInt(row?.s ?? '0', 10);
  }

  /**
   * Soma de fee da plataforma (split_type = 'fee') no período.
   */
  async sumPlatformFeeFromBankSplitsCents(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const row = await runQueryWithTenant<{ s: string }>(
      tenantId,
      `SELECT COALESCE(SUM(bs.amount_cents), 0)::text AS s
       FROM bank_splits bs
       INNER JOIN bank_transactions bt ON bt.id = bs.transaction_id AND bt.tenant_id = bs.tenant_id
       WHERE bs.tenant_id = $1::uuid
         AND bs.split_type = 'fee'
         AND bs.created_at >= $2
         AND bs.created_at <= $3`,
      [tenantId, startDate, endDate]
    );
    return parseInt(row?.s ?? '0', 10);
  }

  /**
   * Volume mensal: período (YYYY-MM), receita, contagem.
   */
  async sumBankTransactionVolumeByMonth(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ period: string; revenueCents: number; transactionCount: number }>> {
    const rows = await runQueriesWithTenant<{ period: string; revenue_cents: string; cnt: string }>(
      tenantId,
      `SELECT
         to_char(bt.created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS period,
         COALESCE(SUM(bt.amount_cents), 0)::text AS revenue_cents,
         COUNT(*)::text AS cnt
       FROM bank_transactions bt
       WHERE bt.tenant_id = $1::uuid
         AND bt.created_at >= $2
         AND bt.created_at <= $3
       GROUP BY 1
       ORDER BY 1 ASC`,
      [tenantId, startDate, endDate]
    );
    return rows.map((row) => ({
      period: row.period,
      revenueCents: parseInt(row.revenue_cents, 10),
      transactionCount: parseInt(row.cnt, 10),
    }));
  }

  /**
   * Volume por reference_type: tipo, receita, contagem.
   */
  async sumBankTransactionVolumeByReferenceType(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ referenceType: string; revenueCents: number; transactionCount: number }>> {
    const rows = await runQueriesWithTenant<{ ref_type: string | null; revenue_cents: string; cnt: string }>(
      tenantId,
      `SELECT
         COALESCE(bt.reference_type, 'unknown') AS ref_type,
         COALESCE(SUM(bt.amount_cents), 0)::text AS revenue_cents,
         COUNT(*)::text AS cnt
       FROM bank_transactions bt
       WHERE bt.tenant_id = $1::uuid
         AND bt.created_at >= $2
         AND bt.created_at <= $3
       GROUP BY COALESCE(bt.reference_type, 'unknown')
       ORDER BY ref_type ASC`,
      [tenantId, startDate, endDate]
    );
    return rows.map((row) => ({
      referenceType: row.ref_type ?? 'unknown',
      revenueCents: parseInt(row.revenue_cents, 10),
      transactionCount: parseInt(row.cnt, 10),
    }));
  }

  /**
   * Comissão mensal via splits (fee): período (YYYY-MM), comissão, contagem.
   */
  async sumPlatformFeeByMonthFromSplits(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ period: string; commissionCents: number; transactionCount: number }>> {
    const rows = await runQueriesWithTenant<{ period: string; commission_cents: string; cnt: string }>(
      tenantId,
      `SELECT
         to_char(bs.created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS period,
         COALESCE(SUM(bs.amount_cents), 0)::text AS commission_cents,
         COUNT(*)::text AS cnt
       FROM bank_splits bs
       INNER JOIN bank_transactions bt ON bt.id = bs.transaction_id AND bt.tenant_id = bs.tenant_id
       WHERE bs.tenant_id = $1::uuid
         AND bs.split_type = 'fee'
         AND bs.created_at >= $2
         AND bs.created_at <= $3
       GROUP BY 1
       ORDER BY 1 ASC`,
      [tenantId, startDate, endDate]
    );
    return rows.map((row) => ({
      period: row.period,
      commissionCents: parseInt(row.commission_cents, 10),
      transactionCount: parseInt(row.cnt, 10),
    }));
  }

  /**
   * Exportação: linhas do bank_ledger no período (SSOT de movimentos).
   */
  async listBankLedgerRowsForExport(
    tenantId: string,
    startDate: Date | undefined,
    endDate: Date | undefined,
    limit: number,
    accountId?: string
  ): Promise<
    Array<{
      entryId: string;
      accountId: string;
      transactionId: string;
      direction: string;
      amountCents: number;
      createdAt: string;
    }>
  > {
    let q = `
      SELECT id, account_id, transaction_id, direction, amount_cents, created_at
      FROM bank_ledger
      WHERE tenant_id = $1::uuid
    `;
    const params: unknown[] = [tenantId];
    let i = 2;
    if (accountId) {
      q += ` AND account_id = $${i}::uuid`;
      params.push(accountId);
      i++;
    }
    if (startDate) {
      q += ` AND created_at >= $${i}`;
      params.push(startDate);
      i++;
    }
    if (endDate) {
      q += ` AND created_at <= $${i}`;
      params.push(endDate);
      i++;
    }
    q += ` ORDER BY created_at DESC LIMIT $${i}`;
    params.push(limit);

    const rows = await runQueriesWithTenant<{
      id: string;
      account_id: string;
      transaction_id: string;
      direction: string;
      amount_cents: string;
      created_at: Date;
    }>(tenantId, q, params);

    return rows.map((row) => ({
      entryId: row.id,
      accountId: row.account_id,
      transactionId: row.transaction_id,
      direction: row.direction,
      amountCents: parseInt(String(row.amount_cents), 10),
      createdAt: row.created_at.toISOString(),
    }));
  }

  /**
   * Volume financeiro total — wrapper semântico que delega para sumBankTransactionVolumeCents.
   */
  async sumAbsoluteBankTransactionVolumeCents(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    return this.sumBankTransactionVolumeCents(tenantId, startDate, endDate);
  }

  /**
   * Linhas de crédito no bank_ledger (batch de payout), com actor em bank_accounts.
   * Semântica: créditos a contas de utilizador no período.
   */
  async listBankLedgerCreditLinesForPayoutWindow(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    limit: number
  ): Promise<
    Array<{
      entryId: string;
      debitAccountId: string;
      amountCents: number;
      metadata: Record<string, unknown>;
    }>
  > {
    const rows = await runQueriesWithTenant<{
      id: string;
      amount_cents: string;
      actor_id: string;
    }>(
      tenantId,
      `
      SELECT bl.id, bl.amount_cents, ba.actor_id
      FROM bank_ledger bl
      INNER JOIN bank_accounts ba ON ba.id = bl.account_id AND ba.tenant_id = bl.tenant_id
      WHERE bl.tenant_id = $1::uuid
        AND bl.direction = 'credit'
        AND ba.actor_id IS NOT NULL
        AND bl.created_at >= $2
        AND bl.created_at <= $3
      ORDER BY bl.created_at ASC
      LIMIT $4
      `,
      [tenantId, startDate, endDate, limit]
    );
    return rows.map((row) => ({
      entryId: row.id,
      debitAccountId: `actor:${row.actor_id}`,
      amountCents: parseInt(String(row.amount_cents), 10),
      metadata: {},
    }));
  }

  /**
   * Soma de volume no bank_ledger por actor (via join com bank_accounts).
   */
  async sumLedgerVolumeCentsForActorAccounts(
    tenantId: string,
    actorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const row = await runQueryWithTenant<{ s: string }>(
      tenantId,
      `SELECT COALESCE(SUM(bl.amount_cents), 0)::text AS s
       FROM bank_ledger bl
       INNER JOIN bank_accounts ba ON ba.id = bl.account_id AND ba.tenant_id = bl.tenant_id
       WHERE bl.tenant_id = $1::uuid
         AND ba.actor_id = $2::uuid
         AND bl.created_at >= $3
         AND bl.created_at <= $4`,
      [tenantId, actorId, startDate, endDate]
    );
    return parseInt(row?.s ?? '0', 10);
  }
}

export const bankReportingRepository = new BankReportingRepository();
