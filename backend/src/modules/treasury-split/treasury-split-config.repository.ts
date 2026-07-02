// Treasury Split Config Repository — tabelas treasury_split_config e treasury_split_executions.
// Não escreve em bank_transactions nem bank_ledger.
// F-GROUP-B-FINANCIAL-WORKERS-TENANT-LOOP-RLS (DECISION-0149): claim e cheques de idempotência
// são TENANT-SCOPED — o worker itera tenants (tenant-loop) com client de tenant-context;
// treasury_split_config/treasury_split_executions estão sob RLS+FORCE desde 20260702170000
// (bank_settlements já estava desde 20260702160000).

import type { PoolClient } from 'pg';
import { runQueryWithTenant } from '@core/database/pool';

const DEFAULT_SLUG = 'default';
const DEFAULT_PCT_REGIONAL = 5.0;
const DEFAULT_PCT_COMMUNITY = 3.0;
const DEFAULT_PCT_SYSTEM_RESERVE = 2.0;
const DEFAULT_PCT_GOVERNANCE = 2.0;
const DEFAULT_PCT_SELLER = 88.0;
const DEFAULT_CURRENCY = 'BRL';

export interface TreasurySplitConfigRow {
  id: string;
  tenant_id: string;
  slug: string;
  pct_regional: string;
  pct_community: string;
  pct_system_reserve: string;
  pct_governance: string;
  pct_seller: string;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

export interface TreasurySplitConfig {
  id: string;
  tenantId: string;
  slug: string;
  pctRegional: number;
  pctCommunity: number;
  pctSystemReserve: number;
  pctGovernance: number;
  pctSeller: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

function toConfig(row: TreasurySplitConfigRow): TreasurySplitConfig {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    pctRegional: parseFloat(row.pct_regional),
    pctCommunity: parseFloat(row.pct_community),
    pctSystemReserve: parseFloat(row.pct_system_reserve),
    pctGovernance: parseFloat(row.pct_governance),
    pctSeller: parseFloat(row.pct_seller),
    currency: row.currency,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Retorna a config de split do tenant. Slug default: "default".
 */
export async function getSplitConfig(
  tenantId: string,
  slug: string = DEFAULT_SLUG
): Promise<TreasurySplitConfig | null> {
  const row = await runQueryWithTenant<TreasurySplitConfigRow>(
    tenantId,
    `SELECT id, tenant_id, slug, pct_regional, pct_community, pct_system_reserve, pct_governance, pct_seller, currency, created_at, updated_at
     FROM treasury_split_config
     WHERE tenant_id = $1 AND slug = $2`,
    [tenantId, slug]
  );
  return row ? toConfig(row) : null;
}

/**
 * Cria a config default do tenant (idempotente: se já existir slug default, retorna a existente).
 */
export async function createDefaultSplitConfig(tenantId: string): Promise<TreasurySplitConfig> {
  const existing = await getSplitConfig(tenantId, DEFAULT_SLUG);
  if (existing) return existing;

  const row = await runQueryWithTenant<TreasurySplitConfigRow>(
    tenantId,
    `INSERT INTO treasury_split_config (tenant_id, slug, pct_regional, pct_community, pct_system_reserve, pct_governance, pct_seller, currency)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id, slug) DO UPDATE SET updated_at = now()
     RETURNING id, tenant_id, slug, pct_regional, pct_community, pct_system_reserve, pct_governance, pct_seller, currency, created_at, updated_at`,
    [
      tenantId,
      DEFAULT_SLUG,
      DEFAULT_PCT_REGIONAL,
      DEFAULT_PCT_COMMUNITY,
      DEFAULT_PCT_SYSTEM_RESERVE,
      DEFAULT_PCT_GOVERNANCE,
      DEFAULT_PCT_SELLER,
      DEFAULT_CURRENCY,
    ]
  );
  if (!row) throw new Error('createDefaultSplitConfig: insert failed');
  return toConfig(row);
}

// --- treasury_split_executions (idempotência)

export interface TreasurySplitExecutionRow {
  id: string;
  tenant_id: string;
  settlement_id: string;
  idempotency_key: string | null;
  split_result: Record<string, unknown>;
  created_at: Date;
}

/**
 * Verifica se já existe execução para este settlement_id (idempotência).
 * 🔴 TENANT-SCOPED: sob RLS+FORCE, um cheque de idempotência com pool cru retornaria vazio SEMPRE
 * no role restrito — quebrando a proteção anti-split-duplo silenciosamente. tenantId obrigatório.
 */
export async function hasExecutionForSettlement(
  tenantId: string,
  settlementId: string
): Promise<boolean> {
  const row = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `SELECT id FROM treasury_split_executions WHERE tenant_id = $1 AND settlement_id = $2`,
    [tenantId, settlementId]
  );
  return !!row;
}

/**
 * Verifica se já existe execução para (tenant_id, idempotency_key) quando key não é null.
 */
export async function hasExecutionForIdempotencyKey(
  tenantId: string,
  idempotencyKey: string
): Promise<boolean> {
  const row = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `SELECT id FROM treasury_split_executions WHERE tenant_id = $1 AND idempotency_key = $2`,
    [tenantId, idempotencyKey]
  );
  return !!row;
}

/**
 * Lista bank_settlements com status = 'sent' que ainda não têm registro em treasury_split_executions.
 * Usado pelo Treasury Split Worker.
 */
export interface SettlementPendingSplit {
  settlementId: string;
  tenantId: string;
  amountCents: number;
  currency: string;
}

/**
 * Captura atômica de settlements pendentes de split DE UM TENANT: FOR UPDATE SKIP LOCKED.
 * O client deve estar em transação E vir de getClientWithTenant(tenantId) — o worker chama isto
 * dentro do tenant-loop (DECISION-0149). Lê bank_settlements (RLS+FORCE desde 20260702160000).
 * (A antiga listSettlementsPendingSplit cross-tenant foi removida: zero callers — código morto.)
 */
export async function claimNextSettlementsPendingSplit(
  client: PoolClient,
  tenantId: string,
  limit: number
): Promise<SettlementPendingSplit[]> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    amount_cents: string;
    currency: string;
  }>(
    `SELECT s.id, s.tenant_id, s.amount_cents, s.currency
     FROM bank_settlements s
     LEFT JOIN treasury_split_executions e ON e.settlement_id = s.id
     WHERE s.status = 'sent' AND e.id IS NULL AND s.tenant_id = $2
     ORDER BY s.created_at ASC
     LIMIT $1
     FOR UPDATE OF s SKIP LOCKED`,
    [limit, tenantId]
  );
  return result.rows.map((r) => ({
    settlementId: r.id,
    tenantId: r.tenant_id,
    amountCents: parseInt(String(r.amount_cents), 10),
    currency: r.currency,
  }));
}

/**
 * Registra uma execução de split (chamar após executar o split com sucesso).
 */
export async function recordSplitExecution(
  tenantId: string,
  settlementId: string,
  splitResult: Record<string, unknown>,
  idempotencyKey?: string | null
): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `INSERT INTO treasury_split_executions (tenant_id, settlement_id, idempotency_key, split_result)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (settlement_id) DO NOTHING`,
    [tenantId, settlementId, idempotencyKey ?? null, JSON.stringify(splitResult)]
  );
}