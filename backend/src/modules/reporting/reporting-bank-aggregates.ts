/**
 * Agregações de reporting a partir do SSOT financeiro (bank_transactions / bank_ledger / bank_splits).
 * Substitui o módulo economy ledger (stub) para KPIs e exportações.
 *
 * Semântica: totais derivados de transferências registadas em bank_transactions; comissão/fee via bank_splits.split_type = 'fee'.
 */
import { getClientWithTenant } from '@core/database/pool';

export async function sumBankTransactionVolumeCents(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const client = await getClientWithTenant(tenantId);
  try {
    const r = await client.query<{ s: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS s
       FROM bank_transactions
       WHERE tenant_id = $1::uuid
         AND created_at >= $2
         AND created_at <= $3`,
      [tenantId, startDate, endDate]
    );
    return parseInt(r.rows[0]?.s ?? '0', 10);
  } finally {
    client.release();
  }
}

export async function sumPlatformFeeFromBankSplitsCents(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const client = await getClientWithTenant(tenantId);
  try {
    const r = await client.query<{ s: string }>(
      `SELECT COALESCE(SUM(bs.amount_cents), 0)::text AS s
       FROM bank_splits bs
       INNER JOIN bank_transactions bt ON bt.id = bs.transaction_id AND bt.tenant_id = bs.tenant_id
       WHERE bs.tenant_id = $1::uuid
         AND bs.split_type = 'fee'
         AND bs.created_at >= $2
         AND bs.created_at <= $3`,
      [tenantId, startDate, endDate]
    );
    return parseInt(r.rows[0]?.s ?? '0', 10);
  } finally {
    client.release();
  }
}

export async function sumBankTransactionVolumeByMonth(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ period: string; revenueCents: number; transactionCount: number }>> {
  const client = await getClientWithTenant(tenantId);
  try {
    const r = await client.query<{ period: string; revenue_cents: string; cnt: string }>(
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
    return r.rows.map((row) => ({
      period: row.period,
      revenueCents: parseInt(row.revenue_cents, 10),
      transactionCount: parseInt(row.cnt, 10),
    }));
  } finally {
    client.release();
  }
}

export async function sumBankTransactionVolumeByReferenceType(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ referenceType: string; revenueCents: number; transactionCount: number }>> {
  const client = await getClientWithTenant(tenantId);
  try {
    const r = await client.query<{ ref_type: string | null; revenue_cents: string; cnt: string }>(
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
    return r.rows.map((row) => ({
      referenceType: row.ref_type ?? 'unknown',
      revenueCents: parseInt(row.revenue_cents, 10),
      transactionCount: parseInt(row.cnt, 10),
    }));
  } finally {
    client.release();
  }
}

export async function sumPlatformFeeByMonthFromSplits(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ period: string; commissionCents: number; transactionCount: number }>> {
  const client = await getClientWithTenant(tenantId);
  try {
    const r = await client.query<{ period: string; commission_cents: string; cnt: string }>(
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
    return r.rows.map((row) => ({
      period: row.period,
      commissionCents: parseInt(row.commission_cents, 10),
      transactionCount: parseInt(row.cnt, 10),
    }));
  } finally {
    client.release();
  }
}

/** Exportação: linhas do bank_ledger no período (SSOT de movimentos). */
export async function listBankLedgerRowsForExport(
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
  const client = await getClientWithTenant(tenantId);
  try {
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

    const r = await client.query<{
      id: string;
      account_id: string;
      transaction_id: string;
      direction: string;
      amount_cents: string;
      created_at: Date;
    }>(q, params);

    return r.rows.map((row) => ({
      entryId: row.id,
      accountId: row.account_id,
      transactionId: row.transaction_id,
      direction: row.direction,
      amountCents: parseInt(String(row.amount_cents), 10),
      createdAt: row.created_at.toISOString(),
    }));
  } finally {
    client.release();
  }
}

/** Volume financeiro total (soma absoluta movimentada em bank_transactions no período). */
export async function sumAbsoluteBankTransactionVolumeCents(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  return sumBankTransactionVolumeCents(tenantId, startDate, endDate);
}

/**
 * Soma de volume por actor: entradas no bank_ledger ligadas a contas com actor_id.
 * Usado em risk dashboard como substituto do ledger económico (stub).
 */
/**
 * Linhas de crédito no bank_ledger (para batch de payout), com actor em bank_accounts.
 * Substitui listEntries do economy ledger (stub) — semântica: créditos a contas de utilizador no período.
 */
export async function listBankLedgerCreditLinesForPayoutWindow(
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
  const client = await getClientWithTenant(tenantId);
  try {
    const r = await client.query<{
      id: string;
      amount_cents: string;
      actor_id: string;
    }>(
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
    return r.rows.map((row) => ({
      entryId: row.id,
      debitAccountId: `actor:${row.actor_id}`,
      amountCents: parseInt(String(row.amount_cents), 10),
      metadata: {},
    }));
  } finally {
    client.release();
  }
}

export async function sumLedgerVolumeCentsForActorAccounts(
  tenantId: string,
  actorId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const client = await getClientWithTenant(tenantId);
  try {
    const r = await client.query<{ s: string }>(
      `SELECT COALESCE(SUM(bl.amount_cents), 0)::text AS s
       FROM bank_ledger bl
       INNER JOIN bank_accounts ba ON ba.id = bl.account_id AND ba.tenant_id = bl.tenant_id
       WHERE bl.tenant_id = $1::uuid
         AND ba.actor_id = $2::uuid
         AND bl.created_at >= $3
         AND bl.created_at <= $4`,
      [tenantId, actorId, startDate, endDate]
    );
    return parseInt(r.rows[0]?.s ?? '0', 10);
  } finally {
    client.release();
  }
}