// backend/src/modules/bank/bank-account.repository.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Repository para contas do Unify Bank
// Alinhado ao schema Genesis 0003_bank_core.sql (id, tenant_id, actor_id, owner_type, owner_id, account_type, credit_status, last_activity_at, inactive_since, expires_at, created_at)

import type { PoolClient } from 'pg';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { asMoneyCents, type MoneyCents } from '@contracts/marketplace/canonical';
import type {
  BankAccount,
  BankAccountType,
  CreateBankAccountInput,
  BankAccountSearchOptions,
  BankAccountOwnerType,
  BankCurrency,
} from './bank-account.types';

/** Row conforme tabela bank_accounts no Genesis (0003) */
interface BankAccountRow {
  id: string;
  tenant_id: string;
  actor_id: string | null;
  owner_type: string;
  owner_id: string;
  account_type: string;
  credit_status: string;
  last_activity_at: Date | null;
  inactive_since: Date | null;
  expires_at: Date | null;
  created_at: Date;
}

/** Genesis: owner_type IN ('actor','system','escrow'). API usa 'user'|'company'|'system'|'escrow'. */
function toDbOwnerType(ownerType: BankAccountOwnerType): string {
  if (ownerType === 'system') return 'system';
  if (ownerType === 'escrow') return 'escrow';
  return 'actor';
}

class BankAccountRepository {
  /**
   * Converte row do banco (schema Genesis) para objeto BankAccount (API do módulo).
   */
  private toBankAccount(row: BankAccountRow): BankAccount {
    // 🔴 SEM INVENÇÃO (2026-08-04). Isto devolvia `'user'` para toda linha `'actor'` — inclusive
    // as de empresa, que gravam `ownerId = company_id`. Agora devolve o que está gravado. Se o
    // caller precisa saber se é pessoa ou empresa, resolve pelo ACTOR (`actors.actor_type`, o SSOT
    // dessa distinção), nunca por um enum que o Bank colapsou na escrita.
    const ownerType = row.owner_type as BankAccountOwnerType;
    return {
      accountId: row.id,
      tenantId: row.tenant_id,
      ownerId: row.owner_id,
      ownerType,
      accountType: (row.account_type || 'credit') as BankAccountType,
      currency: 'BRL',
      cachedBalanceCents: asMoneyCents(0),
      metadata: null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.created_at.toISOString(),
      actorId: row.actor_id ?? undefined,
    };
  }

  /**
   * Busca conta por ID
   *
   * 🔴 GARANTIA CANÔNICA: Cross-tenant leakage prevention
   */
  async getAccountById(
    tenantId: string,
    accountId: string
  ): Promise<BankAccount | null> {
    const row = await runQueryWithTenant<BankAccountRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, owner_type, owner_id, account_type, credit_status,
             last_activity_at, inactive_since, expires_at, created_at
      FROM bank_accounts
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, accountId]
    );

    return row ? this.toBankAccount(row) : null;
  }

  /**
   * Busca conta por owner (Genesis não tem coluna currency; ignora filtro currency).
   */
  async getAccountByOwner(
    tenantId: string,
    ownerId: string,
    ownerType: BankAccountOwnerType,
    _currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    const dbOwnerType = toDbOwnerType(ownerType);
    const row = await runQueryWithTenant<BankAccountRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, owner_type, owner_id, account_type, credit_status,
             last_activity_at, inactive_since, expires_at, created_at
      FROM bank_accounts
      WHERE tenant_id = $1
        AND owner_id = $2
        AND owner_type = $3
      LIMIT 1
      `,
      [tenantId, ownerId, dbOwnerType]
    );

    return row ? this.toBankAccount(row) : null;
  }

  /**
   * Busca conta por owner e account_type (para lifecycle: uma conta por tipo por owner).
   * Para owner_type = 'system': se não houver linha exata, retorna a única conta system do tenant
   * (compatível com constraint uq_bank_accounts_one_system_per_tenant quando existir no banco).
   */
  async getAccountByOwnerAndType(
    tenantId: string,
    ownerId: string,
    ownerType: BankAccountOwnerType,
    accountType: string,
    _currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    const dbOwnerType = toDbOwnerType(ownerType);
    const row = await runQueryWithTenant<BankAccountRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, owner_type, owner_id, account_type, credit_status,
             last_activity_at, inactive_since, expires_at, created_at
      FROM bank_accounts
      WHERE tenant_id = $1
        AND owner_id = $2
        AND owner_type = $3
        AND account_type = $4
      LIMIT 1
      `,
      [tenantId, ownerId, dbOwnerType, accountType]
    );
    // REMOVIDO: fallback perigoso que retornava qualquer conta system quando não achava a específica.
    // Violava identidade semântica e causava loop infinito no ReleaseWorker (2026-05-09).
    return row ? this.toBankAccount(row) : null;
  }

  /**
   * Busca contas com filtros
   */
  /**
   * Listagem simples para scripts de validação E2E (debug).
   */
  async listAccountsDebugRows(
    tenantId: string,
    limit: number
  ): Promise<
    Array<{
      id: string;
      tenant_id: string;
      owner_type: string;
      owner_id: string;
      account_type: string;
      actor_id: string | null;
    }>
  > {
    return runQueriesWithTenant(
      tenantId,
      `
      SELECT id, tenant_id, owner_type, owner_id, account_type, actor_id
      FROM bank_accounts
      WHERE tenant_id = $1
      ORDER BY created_at
      LIMIT $2
      `,
      [tenantId, limit]
    );
  }

  async searchAccounts(
    tenantId: string,
    options: BankAccountSearchOptions = {}
  ): Promise<BankAccount[]> {
    const {
      ownerId,
      ownerType,
      limit = 100,
      offset = 0,
    } = options;

    let query = `
      SELECT id, tenant_id, actor_id, owner_type, owner_id, account_type, credit_status,
             last_activity_at, inactive_since, expires_at, created_at
      FROM bank_accounts
      WHERE tenant_id = $1
    `;

    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (ownerId) {
      query += ` AND owner_id = $${paramIndex}`;
      params.push(ownerId);
      paramIndex++;
    }

    if (ownerType) {
      query += ` AND owner_type = $${paramIndex}`;
      params.push(toDbOwnerType(ownerType));
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const rows = await runQueriesWithTenant<BankAccountRow>(
      tenantId,
      query,
      params
    );

    return rows.map((row) => this.toBankAccount(row));
  }

  /**
   * Cria uma nova conta (apenas colunas existentes no Genesis).
   */
  async createAccount(
    tenantId: string,
    input: CreateBankAccountInput
  ): Promise<BankAccount> {
    const { ownerId, ownerType, accountType = 'credit' } = input;
    const dbOwnerType = toDbOwnerType(ownerType);

    let actorId: string | null = null;
    if (dbOwnerType === 'escrow') {
      actorId = null;
    } else if (dbOwnerType === 'actor') {
      if (ownerType === 'user') {
        // D-money (Camada 1 — 2026-05-26): composite `${actorId}:actor_wallet`
        // resolve actor por id direto (não por user_id). Para os demais
        // composites do plano legado (`${userId}:user_wallet`), resolve via
        // actors.user_id como sempre.
        if (ownerId.endsWith(':actor_wallet')) {
          const actorIdFromComposite = ownerId.slice(0, -':actor_wallet'.length);
          const actorRow = await runQueryWithTenant<{ id: string }>(
            tenantId,
            `SELECT id FROM actors WHERE tenant_id = $1 AND id = $2::uuid LIMIT 1`,
            [tenantId, actorIdFromComposite]
          );
          actorId = actorRow?.id ?? null;
        } else {
          // owner_id pode ser `${userUuid}:user_wallet` (lifecycle) ou legado `userUuid`.
          const userUuid = ownerId.endsWith(':user_wallet')
            ? ownerId.slice(0, -':user_wallet'.length)
            : ownerId;
          // bank_accounts.actor_id → FK actors(id); social layer expõe actor_id (= id após 0064)
          const actorRow = await runQueryWithTenant<{ id: string }>(
            tenantId,
            `SELECT id FROM actors
             WHERE tenant_id = $1 AND user_id = $2::uuid
               AND actor_type IN ('user', 'person', 'actor_human')
             LIMIT 1`,
            [tenantId, userUuid]
          );
          actorId = actorRow?.id ?? null;
        }
      } else if (ownerType === 'company') {
        // 2026-05-18 fix DT-PRESSURE-BANK-ACCOUNT-COMPANY-OWNER-FK-VIOLATION:
        // Resolve actor_id via JOIN — padrão clonado do bloco 'user' acima.
        // Bug anterior usava ownerId (companyId) direto como actor_id, violando
        // FK bank_accounts.actor_id → actors.id (companyId ≠ actor.id).
        //
        // Material: ownerType='company' é usado por DOIS callers distintos no
        // runtime atual:
        //   1. bankIntegrationService.resolveCompanyAccount → ownerId=companyId
        //   2. bankIntegrationService.resolveGroupAccount → ownerId=groupId
        //      (workaround upstream: comentário literal em bank-integration.service.ts:60
        //       "Grupos usam ownerType 'company' por enquanto (pode ser ajustado depois)")
        //
        // Logo o fix tenta resolver por company_id primeiro (caso 1);
        // se não bater, tenta por group_id (caso 2). Sem inventar contrato novo
        // — apenas cobrindo o uso material atual.
        const ownerUuid = ownerId.includes(':') ? ownerId.split(':')[0]! : ownerId;
        const companyActorRow = await runQueryWithTenant<{ id: string }>(
          tenantId,
          `SELECT id FROM actors
           WHERE tenant_id = $1 AND company_id = $2::uuid AND actor_type = 'page'
           LIMIT 1`,
          [tenantId, ownerUuid]
        );
        if (companyActorRow) {
          actorId = companyActorRow.id;
        } else {
          // Fallback: caller pode ter passado groupId (resolveGroupAccount)
          const groupActorRow = await runQueryWithTenant<{ id: string }>(
            tenantId,
            `SELECT id FROM actors
             WHERE tenant_id = $1 AND group_id = $2::uuid AND actor_type = 'group'
             LIMIT 1`,
            [tenantId, ownerUuid]
          );
          actorId = groupActorRow?.id ?? null;
        }
      } else {
        actorId = ownerId.includes(':') ? ownerId.split(':')[0]! : ownerId;
      }
    }

    const row = await runQueryWithTenant<BankAccountRow>(
      tenantId,
      actorId != null
        ? `
      INSERT INTO bank_accounts (tenant_id, owner_id, owner_type, account_type, actor_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tenant_id, actor_id, owner_type, owner_id, account_type, credit_status,
                last_activity_at, inactive_since, expires_at, created_at
      `
        : `
      INSERT INTO bank_accounts (tenant_id, owner_id, owner_type, account_type)
      VALUES ($1, $2, $3, $4)
      RETURNING id, tenant_id, actor_id, owner_type, owner_id, account_type, credit_status,
                last_activity_at, inactive_since, expires_at, created_at
      `,
      actorId != null ? [tenantId, ownerId, dbOwnerType, accountType, actorId] : [tenantId, ownerId, dbOwnerType, accountType]
    );

    if (!row) {
      throw new Error('Failed to create bank account');
    }

    return this.toBankAccount(row);
  }

  /**
   * Atualiza cached_balance — NO-OP no Genesis (tabela não possui cached_balance nem updatedAt).
   * Saldo real é sempre calculado do ledger.
   */
  async updateCachedBalance(
    _tenantId: string,
    _accountId: string,
    _balanceCents: MoneyCents,
    _client?: PoolClient
  ): Promise<void> {
    // Schema Genesis não possui cached_balance nem updatedAt; saldo vem do ledger.
  }

  /**
   * Busca conta do sistema por nome (owner_id = 'system:{accountName}:{tenantId}').
   */
  /**
   * Conta system de liquidez (emissão) para manutenção/backfill E2E.
   */
  async getOrCreateSystemLiquidityIssuanceAccountId(
    client: PoolClient,
    tenantId: string
  ): Promise<string> {
    const ownerId = `system:liquidity_issuance:${tenantId}`;
    const existing = await client.query<{ id: string }>(
      `
      SELECT id FROM bank_accounts
      WHERE tenant_id = $1 AND owner_type = 'system' AND owner_id = $2
      LIMIT 1
      `,
      [tenantId, ownerId]
    );
    if (existing.rows[0]) return existing.rows[0].id;
    const ins = await client.query<{ id: string }>(
      `
      INSERT INTO bank_accounts (tenant_id, owner_id, owner_type, account_type)
      VALUES ($1, $2, 'system', 'credit')
      RETURNING id
      `,
      [tenantId, ownerId]
    );
    return ins.rows[0]!.id;
  }

  /**
   * Resolve actor_id de conta wallet com owner_type actor (risk / integrações).
   */
  async findActorIdForActorOwnedAccount(
    tenantId: string,
    ownerId: string
  ): Promise<string | null> {
    const row = await runQueryWithTenant<{ actor_id: string | null }>(
      tenantId,
      `
      SELECT actor_id FROM bank_accounts
      WHERE tenant_id = $1 AND owner_type = 'actor' AND owner_id = $2
      LIMIT 1
      `,
      [tenantId, ownerId]
    );
    return row?.actor_id ?? null;
  }

  async getSystemAccount(
    tenantId: string,
    accountName: 'fee' | 'regional_fund' | 'reserve' | 'escrow' | 'platform_ops',
    _currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    const ownerIdString = `system:${accountName}:${tenantId}`;

    const row = await runQueryWithTenant<BankAccountRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, owner_type, owner_id, account_type, credit_status,
             last_activity_at, inactive_since, expires_at, created_at
      FROM bank_accounts
      WHERE tenant_id = $1
        AND owner_id = $2
        AND owner_type = 'system'
      LIMIT 1
      `,
      [tenantId, ownerIdString]
    );

    return row ? this.toBankAccount(row) : null;
  }
}

export const bankAccountRepository = new BankAccountRepository();
