// backend/src/modules/bank/bank-account.service.ts
// SPRINT 1: FUNDACAO DO UNIFY BANK
// Service para contas do Unify Bank

import { bankAccountRepository } from './bank-account.repository';
import { bankLedgerRepository } from './bank-ledger.repository';
import { asMoneyCents, type MoneyCents } from '@contracts/marketplace/canonical';
import type { PoolClient } from 'pg';
import { runQueryWithTenant } from '@core/database/pool';
import type {
  BankAccount,
  BankAccountType,
  CreateBankAccountInput,
  BankAccountSearchOptions,
  BankAccountOwnerType,
  BankCurrency,
  SystemAccountName,
} from './bank-account.types';
import type { BankAccountBalance } from './bank-ledger.types';

class BankAccountService {
  /**
   * Busca conta por ID
   * Saldo retornado e calculado do ledger (fonte da verdade)
   */
  async getAccountById(
    tenantId: string,
    accountId: string
  ): Promise<BankAccount | null> {
    const account = await bankAccountRepository.getAccountById(tenantId, accountId);

    if (!account) {
      return null;
    }

    // Calcular saldo real do ledger
    const balance = await bankLedgerRepository.calculateBalance(tenantId, accountId);

    // Atualizar cached_balance se diferente
    if (account.cachedBalanceCents !== balance.balanceCents) {
      await bankAccountRepository.updateCachedBalance(tenantId, accountId, balance.balanceCents);
      account.cachedBalanceCents = balance.balanceCents;
    }

    return account;
  }

  /**
   * Busca conta por owner
   */
  async getAccountByOwner(
    tenantId: string,
    ownerId: string,
    ownerType: BankAccountOwnerType,
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    const account = await bankAccountRepository.getAccountByOwner(
      tenantId,
      ownerId,
      ownerType,
      currency
    );

    if (!account) {
      return null;
    }

    // Calcular saldo real do ledger
    const balance = await bankLedgerRepository.calculateBalance(tenantId, account.accountId);

    // Atualizar cached_balance se diferente
    if (account.cachedBalanceCents !== balance.balanceCents) {
      await bankAccountRepository.updateCachedBalance(tenantId, account.accountId, balance.balanceCents);
      account.cachedBalanceCents = balance.balanceCents;
    }

    return account;
  }

  /**
   * Busca OU cria conta por owner
   */
  async getOrCreateAccount(
    tenantId: string,
    input: CreateBankAccountInput
  ): Promise<BankAccount> {
    const { ownerId, ownerType, currency = 'BRL' } = input;

    // Tentar buscar conta existente
    const existing = await bankAccountRepository.getAccountByOwner(
      tenantId,
      ownerId,
      ownerType,
      currency
    );

    if (existing) {
      // Calcular saldo real do ledger
      const balance = await bankLedgerRepository.calculateBalance(tenantId, existing.accountId);

      // Atualizar cached_balance se diferente
      if (existing.cachedBalanceCents !== balance.balanceCents) {
        await bankAccountRepository.updateCachedBalance(tenantId, existing.accountId, balance.balanceCents);
        existing.cachedBalanceCents = balance.balanceCents;
      }

      return existing;
    }

    // Criar nova conta
    return await bankAccountRepository.createAccount(tenantId, input);
  }

  /**
   * Busca contas com filtros
   */
  async searchAccounts(
    tenantId: string,
    options: BankAccountSearchOptions = {}
  ): Promise<BankAccount[]> {
    const accounts = await bankAccountRepository.searchAccounts(tenantId, options);

    // Atualizar saldos calculados do ledger para cada conta
    for (const account of accounts) {
      const balance = await bankLedgerRepository.calculateBalance(tenantId, account.accountId);

      if (account.cachedBalanceCents !== balance.balanceCents) {
        await bankAccountRepository.updateCachedBalance(tenantId, account.accountId, balance.balanceCents);
        account.cachedBalanceCents = balance.balanceCents;
      }
    }

    return accounts;
  }

  /**
   * Calcula saldo da conta a partir do ledger (FONTE DA VERDADE)
   *
   * REGRA ARQUITETURAL: Saldo e SEMPRE calculado do ledger.
   * Este metodo retorna o saldo real, nao o cache.
   */
  async getBalance(
    tenantId: string,
    accountId: string
  ): Promise<BankAccountBalance> {
    return await bankLedgerRepository.calculateBalance(tenantId, accountId);
  }

  /**
   * Busca conta do sistema por nome
   */
  async getSystemAccount(
    tenantId: string,
    accountName: SystemAccountName,
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    const account = await bankAccountRepository.getSystemAccount(tenantId, accountName, currency);

    if (!account) {
      return null;
    }

    // Calcular saldo real do ledger
    const balance = await bankLedgerRepository.calculateBalance(tenantId, account.accountId);

    // Atualizar cached_balance se diferente
    if (account.cachedBalanceCents !== balance.balanceCents) {
      await bankAccountRepository.updateCachedBalance(tenantId, account.accountId, balance.balanceCents);
      account.cachedBalanceCents = balance.balanceCents;
    }

    return account;
  }

  /**
   * Garante contas de lifecycle para um owner (usuario ou company).
   * Idempotente: verifica antes de criar; nao duplica.
   *
   * Chamar apos: criacao de usuario (ownerType 'user') ou de company/seller (ownerType 'company').
   */
  async ensureLifecycleAccountsForOwner(
    tenantId: string,
    ownerId: string,
    ownerType: 'user' | 'company',
    currency: BankCurrency = 'BRL'
  ): Promise<void> {
    if (ownerType === 'user') {
      /** Mesmo padrao que company (`owner:tipo`): evita colisao com legado `owner_id = userId` + outro account_type. */
      const walletOwnerKey = `${ownerId}:user_wallet`;
      const existing = await bankAccountRepository.getAccountByOwnerAndType(
        tenantId,
        walletOwnerKey,
        'user',
        'user_wallet',
        currency
      );
      if (!existing) {
        const legacyWallet = await bankAccountRepository.getAccountByOwnerAndType(
          tenantId,
          ownerId,
          'user',
          'user_wallet',
          currency
        );
        if (!legacyWallet) {
          await bankAccountRepository.createAccount(tenantId, {
            ownerId: walletOwnerKey,
            ownerType: 'user',
            accountType: 'user_wallet',
            currency,
          });
        }
      }
      return;
    }

    const sellerTypes: BankAccountType[] = ['seller_pending', 'seller_available', 'seller_payout'];
    for (const accountType of sellerTypes) {
      const compositeOwnerId = `${ownerId}:${accountType}`;
      const existing = await bankAccountRepository.getAccountByOwnerAndType(
        tenantId,
        compositeOwnerId,
        'company',
        accountType,
        currency
      );
      if (!existing) {
        await bankAccountRepository.createAccount(tenantId, {
          ownerId: compositeOwnerId,
          ownerType: 'company',
          accountType,
          currency,
        });
      }
    }
  }

  /**
   * D-money (Camada 1 — 2026-05-26): Garante a `actor_wallet` do actor.
   *
   * Carteira interna do actor (PF, empresa, ou outro actor econômico)
   * dentro do UnifyBank. Idempotente: se já existe, retorna; senão cria.
   * owner_type='actor' + actor_id NOT NULL (constraint
   * bank_accounts_actor_required_for_actor_owner).
   *
   * owner_id composite: `${actorId}:actor_wallet` — bate com pattern
   * UNIQUE (tenant_id, owner_type, owner_id) e mantém actor_wallet
   * distinta de qualquer outra conta do mesmo actor.
   *
   * Significado: saldo de custódia interna do actor — recebe fundos
   * liberados por D-money após service_order ser aprovada (D2). NÃO
   * é receita da plataforma. NÃO é payout externo.
   *
   * NÃO toca bank_ledger. Apenas garante a existência da conta.
   */
  async ensureActorWalletAccount(
    tenantId: string,
    actorId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount> {
    if (!actorId) {
      throw new Error('ensureActorWalletAccount: actorId obrigatório');
    }
    const compositeOwnerId = `${actorId}:actor_wallet`;
    const existing = await bankAccountRepository.getAccountByOwnerAndType(
      tenantId,
      compositeOwnerId,
      'user', // tradução para DB owner_type='actor' via toDbOwnerType
      'actor_wallet',
      currency
    );
    if (existing) {
      return existing;
    }
    // DT-ENSURE-ACTOR-WALLET-NOT-IDEMPOTENT-UNDER-RACE (corrigido D_FIX Onda 2, 2026-07-05):
    // check-then-insert sem lock — duas chamadas concorrentes podiam colidir no
    // UNIQUE(tenant_id, owner_type, owner_id) e a 2ª explodia com erro cru de constraint em vez
    // de devolver a conta que a 1ª acabou de criar. Fix TARGETED aqui (não em createAccount, que
    // é compartilhado por outros callers com semântica própria): captura especificamente a
    // violação de unicidade (23505) e re-busca a conta que venceu a corrida — idempotência real
    // sem mudar a criação da conta em si nem tocar bank_ledger.
    try {
      return await bankAccountRepository.createAccount(tenantId, {
        ownerId: compositeOwnerId,
        ownerType: 'user', // toDbOwnerType('user') → 'actor' no DB
        accountType: 'actor_wallet',
        currency,
      });
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code === '23505') {
        const winner = await bankAccountRepository.getAccountByOwnerAndType(
          tenantId,
          compositeOwnerId,
          'user',
          'actor_wallet',
          currency
        );
        if (winner) return winner;
      }
      throw err;
    }
  }

  /** C4b (DECISION-0057) — provisiona user_wallet canonicamente a partir do actorId. Idempotente. */
  async ensureUserWalletForActor(
    tenantId: string,
    actorId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount> {
    const row = await runQueryWithTenant<{ user_id: string | null }>(
      tenantId,
      `SELECT user_id FROM actors WHERE tenant_id = $1 AND id = $2`,
      [tenantId, actorId]
    );
    if (!row?.user_id) {
      throw new Error('USER_WALLET_REQUIRES_USER_ID');
    }
    await this.ensureLifecycleAccountsForOwner(tenantId, row.user_id, 'user', currency);
    const wallet = await this.getLifecycleAccount(tenantId, row.user_id, 'user', 'user_wallet', currency);
    if (!wallet) throw new Error('USER_WALLET_CREATION_FAILED');
    return wallet;
  }

  /**
   * D-money — busca actor_wallet do actor sem criar. Retorna null se
   * não existe.
   */
  async getActorWalletAccount(
    tenantId: string,
    actorId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    const compositeOwnerId = `${actorId}:actor_wallet`;
    return bankAccountRepository.getAccountByOwnerAndType(
      tenantId,
      compositeOwnerId,
      'user',
      'actor_wallet',
      currency
    );
  }

  /**
   * Busca conta de lifecycle da plataforma (sistema) por account_type.
   * Ex.: escrow_payments, clearing, bank_settlement.
   */
  async getPlatformLifecycleAccount(
    tenantId: string,
    accountType: BankAccountType,
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    const ownerId = `system:${accountType}:${tenantId}`;
    return bankAccountRepository.getAccountByOwnerAndType(
      tenantId,
      ownerId,
      'system',
      accountType,
      currency
    );
  }

  /**
   * Busca conta de lifecycle por owner e tipo (ex.: seller_available para uma company).
   * Para company usa owner_id composto: `${ownerId}:${accountType}`.
   */
  async getLifecycleAccount(
    tenantId: string,
    ownerId: string,
    ownerType: 'user' | 'company',
    accountType: BankAccountType,
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    if (ownerType === 'user') {
      if (accountType === 'user_wallet') {
        const composite = await bankAccountRepository.getAccountByOwnerAndType(
          tenantId,
          `${ownerId}:user_wallet`,
          'user',
          'user_wallet',
          currency
        );
        if (composite) {
          return composite;
        }
        return bankAccountRepository.getAccountByOwnerAndType(
          tenantId,
          ownerId,
          'user',
          'user_wallet',
          currency
        );
      }
      return bankAccountRepository.getAccountByOwnerAndType(
        tenantId,
        ownerId,
        'user',
        accountType,
        currency
      );
    }
    const compositeOwnerId = `${ownerId}:${accountType}`;
    return bankAccountRepository.getAccountByOwnerAndType(
      tenantId,
      compositeOwnerId,
      'company',
      accountType,
      currency
    );
  }

  /**
   * Conta de sistema por regiao para pool do fundo regional (ledger = SSOT).
   * owner_id unico por (tenant, pais, estado, cidade); idempotente.
   */
  async ensureRegionalFundBankAccountForRegion(
    tenantId: string,
    region: { country: string; state: string; city: string },
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount> {
    const regionKey = `${region.country}-${region.state}-${region.city}`;
    const ownerId = `system:regional_fund:${tenantId}:${regionKey}`;
    const existing = await bankAccountRepository.getAccountByOwnerAndType(
      tenantId,
      ownerId,
      'system',
      'credit',
      currency
    );
    if (existing) {
      return existing;
    }
    return await bankAccountRepository.createAccount(tenantId, {
      ownerId,
      ownerType: 'system',
      accountType: 'credit',
      currency,
    });
  }

  /**
   * DECISION-0166 D3 (Fase 2b) — resolver CANÔNICO de fundo regional por FK do Location Core.
   *
   * (scope_level + IDs territoriais) → regional_fund_accounts → bank_account_id. A VERDADE
   * geográfica é a FK; o owner_id string da conta Bank é apenas rótulo técnico derivado dos IDs.
   * Criar a conta NÃO cria dinheiro (saldo é derivado do bank_ledger, que permanece vazio).
   * Idempotente: UNIQUE por escopo + re-select em corrida.
   *
   * neighborhood = HOLD (D4): recusa fail-closed enquanto o catálogo de bairros não for
   * governado — a ativação do nível é decisão soberana (nova fatia remove a recusa), não
   * consequência de alguém semear rows.
   */
  async ensureRegionalFundAccount(
    tenantId: string,
    scope:
      | { level: 'planet' }
      | { level: 'country'; countryId: string }
      | { level: 'state'; countryId: string; stateId: string }
      | { level: 'city'; countryId: string; stateId: string; cityId: string }
      | { level: 'neighborhood'; countryId: string; stateId: string; cityId: string; neighborhoodId: string },
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount> {
    if (scope.level === 'neighborhood') {
      const err = new Error(
        'REGIONAL_FUND_NEIGHBORHOOD_HOLD: nível neighborhood em HOLD (DECISION-0166 D4) — ' +
          'catálogo de bairros não governado. Ativação do nível exige decisão soberana + seed do catálogo.'
      ) as Error & { statusCode?: number };
      err.statusCode = 501;
      throw err;
    }

    const countryId = 'countryId' in scope ? scope.countryId : null;
    const stateId = 'stateId' in scope ? scope.stateId : null;
    const cityId = 'cityId' in scope ? scope.cityId : null;

    const findExisting = async (): Promise<{ bank_account_id: string } | null> =>
      await runQueryWithTenant<{ bank_account_id: string }>(
        tenantId,
        `SELECT bank_account_id::text
           FROM regional_fund_accounts
          WHERE tenant_id = $1::uuid AND scope_level = $2
            AND country_id IS NOT DISTINCT FROM $3::uuid
            AND state_id IS NOT DISTINCT FROM $4::uuid
            AND city_id IS NOT DISTINCT FROM $5::uuid
            AND neighborhood_id IS NULL
          LIMIT 1`,
        [tenantId, scope.level, countryId, stateId, cityId]
      );

    const existing = await findExisting();
    if (existing) {
      const acc = await bankAccountRepository.getAccountById(tenantId, existing.bank_account_id);
      if (!acc) {
        throw new Error(
          `REGIONAL_FUND_ACCOUNT_DANGLING: regional_fund_accounts aponta bank_account_id ` +
            `${existing.bank_account_id} inexistente — inconsistência material, investigar.`
        );
      }
      return acc;
    }

    // Rótulo técnico derivado dos IDs (NUNCA fonte de verdade — a verdade é a FK acima).
    const labelId = scope.level === 'planet' ? 'planet' : (cityId ?? stateId ?? countryId);
    const ownerId = `system:regional_fund:${tenantId}:${scope.level}:${labelId}`;
    const account = await bankAccountRepository.createAccount(tenantId, {
      ownerId,
      ownerType: 'system',
      accountType: 'credit',
      currency,
    });

    try {
      await runQueryWithTenant(
        tenantId,
        `INSERT INTO regional_fund_accounts
           (tenant_id, scope_level, country_id, state_id, city_id, bank_account_id)
         VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5::uuid, $6::uuid)`,
        [tenantId, scope.level, countryId, stateId, cityId, account.accountId]
      );
    } catch (e: unknown) {
      // Corrida idempotente: outro processo registrou o escopo entre o SELECT e o INSERT —
      // o UNIQUE por escopo barrou; re-resolve e usa a conta vencedora.
      const raced = await findExisting();
      if (raced) {
        const acc = await bankAccountRepository.getAccountById(tenantId, raced.bank_account_id);
        if (acc) return acc;
      }
      throw e;
    }
    return account;
  }

  /**
   * Garante contas de plataforma (uma vez por tenant).
   * Idempotente: verifica antes de criar; nao duplica.
   *
   * Chamar: no bootstrap do tenant ou na primeira operacao financeira do tenant.
   */
  async ensurePlatformAccounts(tenantId: string, currency: BankCurrency = 'BRL'): Promise<void> {
    // Camada 1 — Lifecycle accounts (account_type específico; usados por
    // getPlatformLifecycleAccount em escrow_payments, clearing, bank_settlement,
    // seller_pending, seller_available, seller_payout, payouts).
    const platformTypes: BankAccountType[] = [
      'escrow_payments',
      'platform_revenue',
      'platform_fees',
      'clearing',
      'bank_settlement',
      'risk_reserve',
      'seller_pending',
      'seller_available',
      'seller_payout',
    ];
    for (const accountType of platformTypes) {
      const ownerId = `system:${accountType}:${tenantId}`;
      const existing = await bankAccountRepository.getAccountByOwnerAndType(
        tenantId,
        ownerId,
        'system',
        accountType,
        currency
      );
      if (!existing) {
        try {
          await bankAccountRepository.createAccount(tenantId, {
            ownerId,
            ownerType: 'system',
            accountType,
            currency,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('uq_bank_accounts_one_system_per_tenant') || msg.includes('duplicar valor da chave')) {
            continue;
          }
          throw err;
        }
      }
    }

    // Camada 2 — SystemAccountName accounts (DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION).
    // Convergência implementacional alinhada com DECISION-0036 (premissa ontológica
    // account-centric). 14 callers de getSystemAccount em runtime esperam owner_id
    // pattern `system:${SystemAccountName}:${tenantId}` para resolver destinos de
    // splits canônicos (fee, regional_fund, reserve) e escrow.
    //
    // account_type='credit' genérico — preserva CHECK constraint atual sem migration DDL.
    // Conta resolvida por owner_id (não account_type) em bankAccountRepository.getSystemAccount.
    //
    // Tenant criado via ensurePlatformAccounts puro agora suporta primeiro checkout
    // event_ticket sem workaround (antes desta convergência, scripts E2E criavam
    // manualmente; vide validate-financial-flow-real.ts e validate-pipeline-e2e-transversal.ts).
    const systemAccountNames: SystemAccountName[] = ['reserve', 'fee', 'regional_fund', 'escrow'];
    for (const name of systemAccountNames) {
      const ownerId = `system:${name}:${tenantId}`;
      const existing = await bankAccountRepository.getAccountByOwnerAndType(
        tenantId,
        ownerId,
        'system',
        'credit',
        currency
      );
      if (!existing) {
        try {
          await bankAccountRepository.createAccount(tenantId, {
            ownerId,
            ownerType: 'system',
            accountType: 'credit',
            currency,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('uq_bank_accounts_one_system_per_tenant') || msg.includes('duplicar valor da chave')) {
            continue;
          }
          throw err;
        }
      }
    }
  }

  /**
   * Adquire lock exclusivo em uma conta dentro de uma transacao ativa.
   *
   * LEI 4.7: SELECT FOR UPDATE sobre bank_accounts deve estar DENTRO do dominio Bank.
   * Workers e outros consumidores devem chamar este metodo em vez de fazer
   * SELECT FOR UPDATE diretamente.
   *
   * @param tenantId - Tenant da conta
   * @param accountId - ID da conta a ser lockada
   * @param client - PoolClient com transacao ativa (BEGIN ja executado)
   * @throws Error se conta nao encontrada
   */
  async acquireAccountLock(
    tenantId: string,
    accountId: string,
    client: PoolClient
  ): Promise<void> {
    const result = await client.query(
      `SELECT id FROM bank_accounts WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [tenantId, accountId]
    );
    if (result.rows.length === 0) {
      throw new Error(`Account ${accountId} not found for lock`);
    }
  }

  /**
   * Valida que o saldo calculado do ledger bate com o cached_balance
   *
   * REGRA ARQUITETURAL: Numeros sempre devem bater.
   * Este metodo e usado para validacao e testes.
   */
  async validateBalance(
    tenantId: string,
    accountId: string
  ): Promise<{
    isValid: boolean;
    cachedBalanceCents: MoneyCents;
    calculatedBalanceCents: MoneyCents;
    differenceCents: MoneyCents;
  }> {
    const account = await bankAccountRepository.getAccountById(tenantId, accountId);

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const balance = await bankLedgerRepository.calculateBalance(tenantId, accountId);
    const differenceCents = asMoneyCents(
      Math.abs(account.cachedBalanceCents - balance.balanceCents)
    );

    return {
      isValid: differenceCents === 0,
      cachedBalanceCents: account.cachedBalanceCents,
      calculatedBalanceCents: balance.balanceCents,
      differenceCents,
    };
  }
}

export const bankAccountService = new BankAccountService();
