// backend/src/modules/bank/bank-split.repository.ts
// SPRINT 2: TRANSACTIONS + SPLIT ENGINE
// Repository para splits do Unify Bank

import type { PoolClient } from 'pg';
import { assertIntegerCents } from '@core/bank/assert-cents';
import { getClientWithTenant, runQueriesWithTenant, runQueryWithTenant } from '@core/database/pool';
import type {
  BankSplit,
  CreateBankSplitInput,
} from './bank-split.types';
import type { FinancialAuthorshipContext } from './financial-authorship.types';

/** Row após JOIN com bank_accounts (leitura). */
interface BankSplitRow {
  split_id: string;
  tenant_id: string;
  transaction_id: string;
  service_order_id: string | null;
  target_account_id: string | null;
  /** FISCAL-4E (PASSE 3R-2): conta-alvo RESOLVIDA (existência + tenant) para read-back fail-closed. */
  resolved_account_id?: string | null;
  resolved_account_tenant?: string | null;
  amount_cents: string | number;
  percentage: string | null;
  split_type: string;
  description: string | null;
  metadata: unknown;
  created_at: Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolve target_actor_id quando target account tem actor associado.
 * DECISION-0036: target_actor_id é NULLABLE — destinos system (fee/regional_fund/
 * reserve) não têm actor associado, mas continuam válidos como destinos de split
 * via target_account_id (NOT NULL). Esta função retorna null para system.
 *
 * Preserva legacy reads (queries que agregam por actor) populando target_actor_id
 * quando conta destino tem actor_id válido.
 */
async function resolveTargetActorIdOptional(
  client: PoolClient,
  tenantId: string,
  targetAccountId: string
): Promise<string | null> {
  const r = await client.query<{ actor_id: string | null }>(
    `SELECT actor_id FROM bank_accounts WHERE tenant_id = $1 AND id = $2::uuid LIMIT 1`,
    [tenantId, targetAccountId]
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error(`bank_splits: conta destino não encontrada: ${targetAccountId}`);
  }
  if (row.actor_id && UUID_RE.test(row.actor_id)) {
    return row.actor_id;
  }
  return null;
}

class BankSplitRepository {
  private normalizeSplitLegAmount(amt: string): number {
    return Math.round(Number(amt));
  }

  private isCompleteSplitLegRow(row: { target_account_id: string | null }): row is { target_account_id: string } {
    return !!row.target_account_id;
  }

  private mapSplitLegRow(row: { split_id: string; target_account_id: string; amt: string }) {
    return {
      split_id: row.split_id,
      target_account_id: row.target_account_id,
      amount_cents: this.normalizeSplitLegAmount(row.amt),
    };
  }

  private async querySplitLegsPrimary(
    client: PoolClient,
    tenantId: string,
    transactionId: string,
    sql: string
  ): Promise<Array<{ split_id: string; target_account_id: string; amt: string }>> {
    const r = await client.query<{
      split_id: string;
      target_account_id: string;
      amt: string;
    }>(sql, [tenantId, transactionId]);

    return r.rows;
  }

  private async querySplitLegsFallback(
    client: PoolClient,
    tenantId: string,
    transactionId: string
  ): Promise<Array<{ split_id: string; target_account_id: string | null; amt: string }>> {
    const r2 = await client.query<{
      split_id: string;
      target_account_id: string | null;
      amt: string;
    }>(
      `SELECT bs.id::text as split_id, bs.amount_cents::text as amt,
              (SELECT ba.id FROM bank_accounts ba
               WHERE ba.tenant_id = bs.tenant_id
                 AND (ba.actor_id = bs.target_actor_id OR ba.owner_id = bs.target_actor_id::text)
               ORDER BY ba.created_at ASC LIMIT 1) as target_account_id
       FROM bank_splits bs
       WHERE bs.tenant_id = $1 AND bs.transaction_id = $2
       ORDER BY bs.created_at ASC`,
      [tenantId, transactionId]
    );

    return r2.rows;
  }

  /**
   * Converte row do banco para objeto BankSplit
   */
  private toSplit(row: BankSplitRow): BankSplit {
    const tid = row.target_account_id;
    if (!tid) {
      throw new Error(
        `bank_splits: split ${row.split_id} sem target_account_id resolvível (JOIN bank_accounts)`
      );
    }
    // FISCAL-4E (PASSE 3R-2) READ-BACK FAIL-CLOSED: quando a resolução de existência/tenant foi computada
    // (getSplitsByTransaction), o destino persistido é AUTORITATIVO — se a conta referenciada não existir
    // ou for de OUTRO tenant, FALHA FECHADO (nunca cai em fallback Actor, nunca troca destino, nunca omite).
    // createSplit passa a linha SEM esses campos (destino recém-inserido) → cheque não se aplica.
    if (row.resolved_account_id !== undefined) {
      if (!row.resolved_account_id) {
        throw new Error(
          `BANK_SPLIT_TARGET_ACCOUNT_NOT_FOUND: split ${row.split_id} referencia conta ${tid} inexistente`
        );
      }
      if (row.resolved_account_tenant !== row.tenant_id) {
        throw new Error(
          `BANK_SPLIT_TARGET_ACCOUNT_CROSS_TENANT: split ${row.split_id} conta ${tid} pertence a outro tenant`
        );
      }
    }
    return {
      splitId: row.split_id,
      tenantId: row.tenant_id,
      transactionId: row.transaction_id,
      serviceOrderId: row.service_order_id,
      targetAccountId: tid,
      amountCents:
        typeof row.amount_cents === 'string'
          ? parseInt(row.amount_cents, 10)
          : Number(row.amount_cents),
      percentage: row.percentage ? parseFloat(row.percentage) : null,
      splitType: row.split_type as BankSplit['splitType'],
      description: row.description,
      metadata: (row.metadata as Record<string, unknown>) ?? null,
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Cria um split
   * 
   * Se client for passado, usa o mesmo client (mesma transação SQL). Não faz release.
   * Se não, obtém client próprio e faz release no finally.
   * 
   * 🔴 HARD FAIL: authorship é obrigatório (exceto jobs internos/system com authoritySource='system')
   */
  async createSplit(
    tenantId: string,
    input: CreateBankSplitInput,
    client?: PoolClient
  ): Promise<BankSplit> {
    const {
      transactionId,
      targetAccountId,
      amountCents,
      percentage,
      splitType,
      description,
      metadata,
      authorship,
    } = input;

    // 🔴 HARD FAIL: Autoria obrigatória (REGRA INQUEBRÁVEL)
    if (!authorship) {
      throw new Error('Financial authorship is mandatory. Missing authorship context.');
    }

    return this.createSplitWithAuthorship(tenantId, input, authorship, client);
  }

  /**
   * Cria split com autoria (método interno)
   * Se client for passado, usa-o e não faz release. Caso contrário, obtém e libera.
   */
  private async createSplitWithAuthorship(
    tenantId: string,
    input: CreateBankSplitInput,
    authorship: FinancialAuthorshipContext,
    existingClient?: PoolClient
  ): Promise<BankSplit> {
    const {
      transactionId,
      targetAccountId,
      amountCents,
      percentage,
      splitType,
      description,
      metadata,
      policyVersionId,
      jurisdictionSnapshot,
    } = input;

    assertIntegerCents(amountCents, 'amountCents');

    const client = existingClient ?? (await getClientWithTenant(tenantId));
    const ownClient = !existingClient;

    try {
      const sourceActorId = authorship.actingForActorId;
      if (!sourceActorId || !UUID_RE.test(sourceActorId)) {
        throw new Error(
          'bank_splits: actingForActorId (source_actor_id) deve ser UUID de actor válido'
        );
      }
      // DECISION-0036: target_account_id é destino soberano (NOT NULL); target_actor_id
      // é opcional (NULLABLE) — populated quando conta tem actor associado, NULL para
      // destinos system (fee/regional_fund/reserve).
      const targetActorIdOptional = await resolveTargetActorIdOptional(client, tenantId, targetAccountId);

      const result = await client.query<{
        id: string;
        tenant_id: string;
        transaction_id: string;
        amount_cents: string | number;
        percentage: string | null;
        split_type: string;
        created_at: Date;
      }>(
        `
        INSERT INTO bank_splits (
          tenant_id, transaction_id, source_actor_id, target_account_id, target_actor_id,
          amount_cents, split_type, percentage, policy_version_id, jurisdiction_snapshot
        )
        VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, $9::uuid, $10::jsonb)
        RETURNING id, tenant_id, transaction_id, amount_cents, percentage::text, split_type, created_at
        `,
        [
          tenantId,
          transactionId,
          sourceActorId,
          targetAccountId,
          targetActorIdOptional,
          amountCents,
          splitType,
          percentage ?? null,
          policyVersionId ?? null,
          jurisdictionSnapshot ? JSON.stringify(jurisdictionSnapshot) : null,
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Failed to create split');
      }

      const ins = result.rows[0];
      return this.toSplit({
        split_id: ins.id,
        tenant_id: ins.tenant_id,
        transaction_id: ins.transaction_id,
        service_order_id: null,
        target_account_id: targetAccountId,
        amount_cents: ins.amount_cents,
        percentage: ins.percentage,
        split_type: ins.split_type,
        description: description ?? null,
        metadata: metadata ?? null,
        created_at: ins.created_at,
      });
    } finally {
      if (ownClient) {
        client.release();
      }
    }
  }

  /**
   * Pernas de split para o motor de reversão (Bank-only SQL: bank_splits + bank_accounts).
   */
  async loadSplitLegsForReversal(
    client: PoolClient,
    tenantId: string,
    transactionId: string
  ): Promise<{ split_id: string; target_account_id: string; amount_cents: number }[]> {
    const tryQueries = [
      `SELECT id::text as split_id, target_account_id, amount_cents::text as amt
       FROM bank_splits WHERE tenant_id = $1 AND transaction_id = $2 ORDER BY created_at ASC`,
      `SELECT id::text as split_id, target_account_id, amount::text as amt
       FROM bank_splits WHERE tenant_id = $1 AND transaction_id = $2 ORDER BY created_at ASC`,
    ];
    for (const sql of tryQueries) {
      try {
        const primaryRows = await this.querySplitLegsPrimary(client, tenantId, transactionId, sql);
        if (primaryRows.length > 0 && primaryRows.every((x) => x.target_account_id)) {
          return primaryRows.map((row) => this.mapSplitLegRow(row));
        }
      } catch {
        /* próximo formato de coluna */
      }
    }
    const fallbackRows = await this.querySplitLegsFallback(client, tenantId, transactionId);
    return fallbackRows
      .filter((row) => this.isCompleteSplitLegRow(row))
      .map((row) => this.mapSplitLegRow(row));
  }

  /**
   * Busca splits de uma transação
   */
  async getSplitsByTransaction(
    tenantId: string,
    transactionId: string
  ): Promise<BankSplit[]> {
    const client = await getClientWithTenant(tenantId);

    try {
      // FISCAL-4E (PASSE 3R): destino reconstruído PRIORITARIAMENTE pela FK persistida
      // bank_splits.target_account_id (identidade canônica do destino), com fallback à resolução
      // legada por Actor (target_actor_id) só quando a FK for NULL (dado legado). Isto resolve
      // corretamente contas system (owner_type='system', actor_id NULL) — ex.: a linha tax_reserve
      // para a conta fiscal_reserve — que a resolução por Actor jamais resolveria. Callers Actor
      // existentes seguem idênticos (a FK persistida aponta para a mesma conta do Actor).
      const result = await client.query<BankSplitRow>(
        `
        SELECT
          bs.id AS split_id,
          bs.tenant_id,
          bs.transaction_id,
          NULL::uuid AS service_order_id,
          COALESCE(bs.target_account_id, ba_actor.id) AS target_account_id,
          ba_target.id AS resolved_account_id,
          ba_target.tenant_id AS resolved_account_tenant,
          bs.amount_cents,
          bs.percentage::text,
          bs.split_type,
          NULL::text AS description,
          NULL::jsonb AS metadata,
          bs.created_at
        FROM bank_splits bs
        LEFT JOIN bank_accounts ba_actor
          ON bs.target_account_id IS NULL
         AND ba_actor.tenant_id = bs.tenant_id
         AND (ba_actor.actor_id = bs.target_actor_id OR ba_actor.owner_id = bs.target_actor_id::text)
        LEFT JOIN bank_accounts ba_target
          ON ba_target.id = COALESCE(bs.target_account_id, ba_actor.id)
        WHERE bs.transaction_id = $1 AND bs.tenant_id = $2
        ORDER BY bs.created_at ASC
        `,
        [transactionId, tenantId]
      );

      return result.rows.map((row) => this.toSplit(row));
    } finally {
      client.release();
    }
  }

  /**
   * Valida que a soma dos splits é igual ao total da transação.
   *
   * Se `existingClient` for passado, executa na mesma transação SQL (vê INSERTs
   * pré-COMMIT). Senão obtém conexão nova (só vê dados commitados).
   *
   * Bug pré-existente corrigido em F9 (DECISION-0036): antes desta correção, a
   * função sempre obtinha conexão nova e não enxergava splits inseridos na
   * transação ativa em createTransactionWithSplitAndAuthorship — falha mascarada
   * por B8 (resolveTargetActorId rejeitava destinos system antes do validate).
   */
  async validateSplitsSum(
    tenantId: string,
    transactionId: string,
    transactionAmountCents: number,
    existingClient?: PoolClient
  ): Promise<{ isValid: boolean; splitsSumCents: number; differenceCents: number }> {
    const client = existingClient ?? (await getClientWithTenant(tenantId));
    const ownClient = !existingClient;

    try {
      const result = await client.query<{ splitsSumCents: string }>(
        `
        SELECT COALESCE(SUM(amount_cents), 0)::text as "splitsSumCents"
        FROM bank_splits
        WHERE transaction_id = $1 AND tenant_id = $2
        `,
        [transactionId, tenantId]
      );

      const splitsSumCents = parseInt(result.rows[0]?.splitsSumCents || '0', 10);
      const differenceCents = Math.abs(transactionAmountCents - splitsSumCents);

      return {
        isValid: differenceCents === 0,
        splitsSumCents,
        differenceCents,
      };
    } finally {
      if (ownClient) {
        client.release();
      }
    }
  }

  /**
   * Busca splits de uma Service Order
   */
  async getSplitsByServiceOrder(
    tenantId: string,
    _serviceOrderId: string
  ): Promise<BankSplit[]> {
    // Schema Genesis não possui service_order_id em bank_splits.
    void _serviceOrderId;
    void tenantId;
    return [];
  }

  /**
   * Soma de splits por referência de transação (ex.: post_id em social).
   */
  async sumImpactCentsByTransactionReferenceIds(
    tenantId: string,
    referenceIds: string[]
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (referenceIds.length === 0) return out;
    const rows = await runQueriesWithTenant<{ ref_id: string; sum_cents: string }>(
      tenantId,
      `
      SELECT bt.reference_id::text AS ref_id, COALESCE(SUM(bs.amount_cents), 0)::text AS sum_cents
      FROM bank_splits bs
      INNER JOIN bank_transactions bt
        ON bt.id = bs.transaction_id AND bt.tenant_id = bs.tenant_id
      WHERE bs.tenant_id = $1 AND bt.reference_id = ANY($2::text[])
      GROUP BY bt.reference_id
      `,
      [tenantId, referenceIds]
    );
    for (const r of rows) {
      out.set(r.ref_id, parseInt(r.sum_cents, 10) || 0);
    }
    return out;
  }

  /**
   * Volume económico: soma splits cuja conta destino pertence ao actor indicado.
   * (ex.: resumo de grupo quando o id de rota é o actor do grupo.)
   */
  async sumVolumeCentsForSplitsTargetingAccountActor(
    tenantId: string,
    accountActorId: string
  ): Promise<number> {
    const row = await runQueryWithTenant<{ totalCents: string }>(
      tenantId,
      `
      SELECT COALESCE(SUM(bs.amount_cents::numeric), 0)::text AS "totalCents"
      FROM bank_splits bs
      INNER JOIN bank_accounts ba
        ON ba.tenant_id = bs.tenant_id
       AND (ba.actor_id = bs.target_actor_id OR ba.owner_id = bs.target_actor_id::text)
       AND ba.actor_id = $2::uuid
      WHERE bs.tenant_id = $1
      `,
      [tenantId, accountActorId]
    );
    return row ? Number(row.totalCents) : 0;
  }

  /**
   * Linhas de split para visualização de execução de pagamento (domínio services).
   */
  async getPaymentExecutionSplitRows(
    tenantId: string,
    transactionId: string
  ): Promise<
    Array<{
      split_id: string;
      amount_cents: number;
      percentage: string | null;
      metadata: Record<string, unknown> | string | null;
      created_at: Date;
      receiver_actor_id: string | null;
    }>
  > {
    const rows = await runQueriesWithTenant<{
      split_id: string;
      amt: string;
      percentage: string | null;
      metadata: unknown;
      created_at: Date;
      receiver_actor_id: string | null;
    }>(
      tenantId,
      `
      SELECT bs.id::text AS split_id,
             bs.amount_cents::text AS amt,
             bs.percentage::text,
             NULL::jsonb AS metadata,
             bs.created_at,
             ba.actor_id::text AS receiver_actor_id
      FROM bank_splits bs
      LEFT JOIN bank_accounts ba
        ON ba.tenant_id = bs.tenant_id
       AND (ba.actor_id = bs.target_actor_id OR ba.owner_id = bs.target_actor_id::text)
      WHERE bs.transaction_id = $1 AND bs.tenant_id = $2
      ORDER BY bs.created_at ASC
      `,
      [transactionId, tenantId]
    );
    return rows.map((row) => ({
      split_id: row.split_id,
      amount_cents: Math.round(Number(row.amt)),
      percentage: row.percentage,
      metadata: row.metadata as Record<string, unknown> | string | null,
      created_at: row.created_at,
      receiver_actor_id: row.receiver_actor_id,
    }));
  }

  /**
   * Soma amount_cents em splits por transação (backfill / validação).
   */
  /**
   * Últimos splits do tenant (debug / scripts E2E).
   */
  async listRecentSplitsDebug(
    tenantId: string,
    limit: number
  ): Promise<
    Array<{
      id: string;
      transaction_id: string;
      source_actor_id: string;
      target_actor_id: string;
      amount_cents: number;
      split_type: string;
      created_at: Date;
    }>
  > {
    const rows = await runQueriesWithTenant<{
      id: string;
      transaction_id: string;
      source_actor_id: string;
      target_actor_id: string;
      amount_cents: string;
      split_type: string;
      created_at: Date;
    }>(
      tenantId,
      `
      SELECT id, transaction_id, source_actor_id, target_actor_id, amount_cents::text,
             split_type, created_at
      FROM bank_splits
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [tenantId, limit]
    );
    return rows.map((r) => ({
      id: r.id,
      transaction_id: r.transaction_id,
      source_actor_id: r.source_actor_id,
      target_actor_id: r.target_actor_id,
      amount_cents: parseInt(r.amount_cents, 10) || 0,
      split_type: r.split_type,
      created_at: r.created_at,
    }));
  }

  async sumAmountCentsForTransaction(
    tenantId: string,
    transactionId: string,
    client?: PoolClient
  ): Promise<number> {
    const run = async (c: PoolClient) => {
      const r = await c.query<{ s: string }>(
        `SELECT COALESCE(SUM(amount_cents), 0)::text AS s FROM bank_splits WHERE transaction_id = $1 AND tenant_id = $2`,
        [transactionId, tenantId]
      );
      return Math.round(Number(r.rows[0]?.s ?? 0));
    };
    if (client) {
      return run(client);
    }
    const c = await getClientWithTenant(tenantId);
    try {
      return await run(c);
    } finally {
      c.release();
    }
  }
}

export const bankSplitRepository = new BankSplitRepository();








