// backend/src/modules/bank/fiscal-reserve-account.resolver.ts
// FISCAL-4E — DECISION-0179 D4 (provisionamento LOOKUP-ONLY). Vive no DOMÍNIO BANK (LEI §4.6: SQL sobre
// bank_accounts só aqui). Resolve a conta fiscal_reserve por (tenant_id, fiscal_identity_id, currency)
// via fiscal_reserve_accounts JOIN bank_accounts, com validação cumulativa. NUNCA cria/insere nada.
//
// Ausência LEGÍTIMA (query retorna 0 linhas) → FISCAL_RESERVE_ACCOUNT_MISSING.
// Erro de infraestrutura (SQL/conexão/timeout) → PROPAGA (nunca convertido em "missing" — vetor V24).
// Proibido: INSERT · auto-provision · fallback (regional/escrow/platform_revenue/platform_fees) ·
//           primeira conta · busca por nome/owner · cross-tenant.

import type { PoolClient } from 'pg';
import { getClientWithTenant } from '@core/database/pool';

/** Ausência LEGÍTIMA: nenhum mapping para a tuple solicitada. */
export class FiscalReserveAccountMissingError extends Error {
  readonly statusCode = 404;
  constructor(tenantId: string, fiscalIdentityId: string, currency: string) {
    super(`FISCAL_RESERVE_ACCOUNT_MISSING: nenhum mapping fiscal_reserve para tenant=${tenantId} fiscal_identity=${fiscalIdentityId} currency=${currency}`);
    this.name = 'FiscalReserveAccountMissingError';
  }
}

/** Cardinalidade anômala (>1 mapping para a mesma tuple). */
export class FiscalReserveAccountAmbiguousError extends Error {
  readonly statusCode = 500;
  constructor(tenantId: string, fiscalIdentityId: string, currency: string, count: number) {
    super(`FISCAL_RESERVE_ACCOUNT_AMBIGUOUS: ${count} mappings para tenant=${tenantId} fiscal_identity=${fiscalIdentityId} currency=${currency} (esperado exatamente um)`);
    this.name = 'FiscalReserveAccountAmbiguousError';
  }
}

/**
 * O mapping EXISTE mas seus vínculos/dados são incoerentes (conta inexistente, tenant divergente,
 * account_type ≠ fiscal_reserve). NÃO é ausência — NÃO pode ser mascarado como MISSING.
 */
export class FiscalReserveAccountIntegrityError extends Error {
  readonly statusCode = 500;
  constructor(reason: string, tenantId: string, fiscalIdentityId: string, currency: string) {
    super(`FISCAL_RESERVE_ACCOUNT_INTEGRITY_ERROR: mapping incoerente (${reason}) para tenant=${tenantId} fiscal_identity=${fiscalIdentityId} currency=${currency}`);
    this.name = 'FiscalReserveAccountIntegrityError';
  }
}

export interface FiscalReserveAccountQuery {
  tenantId: string;
  fiscalIdentityId: string;
  currency: string;
}

export interface ResolvedFiscalReserveAccount {
  bankAccountId: string;
}

// Busca o MAPPING exato por (tenant, fiscal_identity, currency) e faz LEFT JOIN da conta vinculada.
// NÃO filtra tenant/account_type no WHERE (isso mascararia mapping corrompido como ausência). A
// validação de integridade é feita na APLICAÇÃO, distinguindo MISSING de INTEGRITY_ERROR.
const RESOLVE_SQL = `
  SELECT fra.bank_account_id::text AS bank_account_id,
         (ba.id IS NOT NULL) AS account_exists,
         ba.tenant_id::text  AS account_tenant_id,
         ba.account_type     AS account_type
    FROM fiscal_reserve_accounts fra
    LEFT JOIN bank_accounts ba ON ba.id = fra.bank_account_id
   WHERE fra.tenant_id = $1::uuid
     AND fra.fiscal_identity_id = $2::uuid
     AND fra.currency = $3`;

/**
 * Resolve a conta fiscal_reserve. Read-only mesmo com `existingClient` (nunca escreve).
 * `existingClient` fornecido → usa o client recebido; ausente → adquire e libera client próprio.
 *
 * 0 mapping → FISCAL_RESERVE_ACCOUNT_MISSING · >1 → AMBIGUOUS · 1 válido → conta ·
 * 1 incoerente → FISCAL_RESERVE_ACCOUNT_INTEGRITY_ERROR (nunca mascarado como MISSING).
 * Erro SQL/conexão → PROPAGA (V24; nunca convertido em missing).
 */
export async function resolveFiscalReserveAccount(
  query: FiscalReserveAccountQuery,
  existingClient?: PoolClient
): Promise<ResolvedFiscalReserveAccount> {
  const { tenantId, fiscalIdentityId, currency } = query;
  const ownsClient = existingClient == null;
  const client = existingClient ?? (await getClientWithTenant(tenantId));
  try {
    // Erro aqui (SQL/conexão) PROPAGA — NÃO é capturado nem convertido em missing (V24).
    const res = await client.query<{ bank_account_id: string; account_exists: boolean; account_tenant_id: string | null; account_type: string | null }>(
      RESOLVE_SQL, [tenantId, fiscalIdentityId, currency]);
    if (res.rows.length === 0) {
      throw new FiscalReserveAccountMissingError(tenantId, fiscalIdentityId, currency);
    }
    if (res.rows.length > 1) {
      throw new FiscalReserveAccountAmbiguousError(tenantId, fiscalIdentityId, currency, res.rows.length);
    }
    const row = res.rows[0]!;
    // Mapping existe → validar integridade dos vínculos na aplicação (erro explícito, não ausência).
    if (!row.account_exists) {
      throw new FiscalReserveAccountIntegrityError('conta vinculada inexistente', tenantId, fiscalIdentityId, currency);
    }
    if (row.account_tenant_id !== tenantId) {
      throw new FiscalReserveAccountIntegrityError('tenant da conta divergente', tenantId, fiscalIdentityId, currency);
    }
    if (row.account_type !== 'fiscal_reserve') {
      throw new FiscalReserveAccountIntegrityError(`account_type='${row.account_type}' (esperado fiscal_reserve)`, tenantId, fiscalIdentityId, currency);
    }
    return { bankAccountId: row.bank_account_id };
  } finally {
    if (ownsClient) client.release();
  }
}
