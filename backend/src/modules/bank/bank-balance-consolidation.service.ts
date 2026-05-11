// backend/src/modules/bank/bank-balance-consolidation.service.ts
// READ-MODEL: Balanço Financeiro Consolidado
// Status: READ-MODEL PURO (não CORE, não fonte de verdade, não decisório)

import { bankAccountRepository } from './bank-account.repository';
import { bankLedgerRepository } from './bank-ledger.repository';
import type {
  ConsolidatedBalance,
  ConsolidatedBalanceFilters,
  BalanceByAccountType,
  BalanceByRegion,
  BalanceByCurrency,
  AccountCountByType,
  LargestAccount,
  SmallestAccount,
  ReconciliationData,
} from './bank-balance-consolidation.types';
import { asMoneyCents } from '@contracts/marketplace/canonical';
import type { BankAccount, BankAccountOwnerType, BankAccountType } from './bank-account.types';

/**
 * Service para consolidação de balanço financeiro (READ-MODEL)
 * 
 * REGRAS ABSOLUTAS:
 * - Sempre calcula on-demand (nunca persiste)
 * - Nunca usado para decisões
 * - Nunca substitui o ledger
 * - Ledger é a única fonte da verdade
 * - Este é apenas um READ-MODEL para visualização administrativa
 */
class BankBalanceConsolidationService {
  /**
   * Obtém balanço financeiro consolidado
   * 
   * FONTE ÚNICA DE DADOS: bank-ledger.repository.ts.calculateBalance()
   * 
   * Estratégia:
   * 1. Iterar sobre todas as bank_accounts do tenant
   * 2. Calcular saldo de cada conta via ledger (fonte da verdade)
   * 3. Agregar resultados (soma)
   * 4. NÃO recalcular lógica de saldo (usa método canônico)
   * 
   * @param tenantId - ID do tenant
   * @param filters - Filtros opcionais (moeda, tipo de owner, etc)
   * @returns Balanço consolidado (READ-MODEL)
   */
  async getConsolidatedBalance(
    tenantId: string,
    filters: ConsolidatedBalanceFilters = {}
  ): Promise<ConsolidatedBalance> {
    // NOTA: `filters.currency` é aceito por compat de assinatura mas IGNORADO
    // (DECISION-0025: UnifyBank Genesis opera mono-currency BRL).
    const { ownerType, activeOnly = false, startDate, endDate } = filters;

    // 1. Buscar todas as contas do tenant (com filtros opcionais)
    // NOTA: Usar busca direta via query para evitar paginação (READ-MODEL pode ser lento)
    // FONTE ÚNICA: bank_accounts (via repository)
    // Schema Genesis: colunas `account_id`, `currency`, `cached_balance`, `metadata`,
    // `updated_at` foram removidas. Saldo real vem do ledger (DECISION-0024).
    // `last_activity_at` substitui `updated_at` no contrato externo
    // (ver DT-bank-accounts-last-activity-ghost-column).
    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);

    let query = `
      SELECT id, tenant_id, owner_id, owner_type, account_type,
             created_at, last_activity_at
      FROM bank_accounts
      WHERE tenant_id = $1
    `;

    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (ownerType) {
      query += ` AND owner_type = $${paramIndex}`;
      params.push(ownerType);
      paramIndex++;
    }

    // Filtros de data (filtrar por data de criação da conta)
    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await client.query<{
      id: string;
      tenant_id: string;
      owner_id: string;
      owner_type: string;
      account_type: string;
      created_at: Date;
      last_activity_at: Date;
    }>(query, params);

    const allAccounts: BankAccount[] = result.rows.map((row) => ({
      accountId: row.id,
      tenantId: row.tenant_id,
      ownerId: row.owner_id,
      ownerType: row.owner_type as BankAccountOwnerType,
      accountType: (row.account_type || 'credit') as BankAccountType,
      // DECISION-0025: mono-currency BRL na linhagem Genesis.
      currency: 'BRL',
      // DECISION-0024 + DT-bank-cachedBalanceCents-naming-heterogeneity:
      // campo é alias de compat; saldo real é materializado no loop via ledger.
      cachedBalanceCents: asMoneyCents(0),
      // DECISION-0024: metadata em bank_accounts é deprecada.
      metadata: null,
      createdAt: row.created_at.toISOString(),
      // DT-bank-accounts-last-activity-ghost-column:
      // `last_activity_at` tem default now() e nunca é atualizada em runtime;
      // valor é equivalente a created_at no sistema atual.
      updatedAt: row.last_activity_at.toISOString(),
    }));

    client.release();

    // 2. Calcular saldo de cada conta via ledger (FONTE DA VERDADE)
    const balancesByAccount: Map<
      string,
      { balanceCents: number; currency: string; ownerType: BankAccountOwnerType; ownerId: string }
    > = new Map();
    const balancesByType: BalanceByAccountType = {
      userBalanceCents: 0,
      companyBalanceCents: 0,
      systemBalanceCents: 0,
    };
    const balancesByCurrency: BalanceByCurrency = {};
    const accountCountByType: AccountCountByType = {
      user: 0,
      company: 0,
      system: 0,
    };

    let largestAccount: {
      accountId: string;
      ownerId: string;
      ownerType: BankAccountOwnerType;
      balanceCents: number;
      currency: string;
    } | null = null;
    let smallestAccount: {
      accountId: string;
      ownerId: string;
      ownerType: BankAccountOwnerType;
      balanceCents: number;
      currency: string;
    } | null = null;

    for (const account of allAccounts) {
      // Calcular saldo via ledger (fonte da verdade)
      const balance = await bankLedgerRepository.calculateBalance(tenantId, account.accountId);

      // Filtrar contas inativas se solicitado
      if (activeOnly && balance.balanceCents === 0) {
        continue;
      }

      // Armazenar saldo por conta (com metadados)
      balancesByAccount.set(account.accountId, {
        balanceCents: balance.balanceCents,
        currency: account.currency,
        ownerType: account.ownerType,
        ownerId: account.ownerId,
      });

      // Agregar por tipo de conta
      const ownerType = account.ownerType as BankAccountOwnerType;
      if (ownerType === 'user') {
        balancesByType.userBalanceCents += balance.balanceCents;
        accountCountByType.user++;
      } else if (ownerType === 'company') {
        balancesByType.companyBalanceCents += balance.balanceCents;
        accountCountByType.company++;
      } else if (ownerType === 'system') {
        balancesByType.systemBalanceCents += balance.balanceCents;
        accountCountByType.system++;
      }

      // Agregar por moeda
      if (!balancesByCurrency[account.currency]) {
        balancesByCurrency[account.currency] = 0;
      }
      balancesByCurrency[account.currency] += balance.balanceCents;

      // Identificar maior e menor conta
      if (!largestAccount || balance.balanceCents > largestAccount.balanceCents) {
        largestAccount = {
          accountId: account.accountId,
          ownerId: account.ownerId,
          ownerType: account.ownerType,
          balanceCents: balance.balanceCents,
          currency: account.currency,
        };
      }

      if (!smallestAccount || balance.balanceCents < smallestAccount.balanceCents) {
        smallestAccount = {
          accountId: account.accountId,
          ownerId: account.ownerId,
          ownerType: account.ownerType,
          balanceCents: balance.balanceCents,
          currency: account.currency,
        };
      }
    }

    // 3. Calcular saldo total
    const totalSystemBalanceCents = Array.from(balancesByAccount.values()).reduce(
      (sum, acc) => sum + acc.balanceCents,
      0
    );

    // 4. Calcular saldo médio por conta
    const activeAccountCount = balancesByAccount.size;
    const averageBalancePerAccountCents =
      activeAccountCount > 0 ? totalSystemBalanceCents / activeAccountCount : 0;

    // 5. Agregar por região (fundo regional)
    // NOTA: Usar APENAS fonte canônica existente
    // - Se via bank_accounts (system account regional_fund): usar essa
    // - Se via bank_splits.split_type='regional_fund': agregar por região
    // Por enquanto, usar conta de sistema regional_fund (fonte canônica)
    const balancesByRegion: BalanceByRegion = {};

    // Buscar conta de sistema regional_fund
    // NOTA: Esta é a fonte canônica para fundo regional
    try {
      // DECISION-0025: mono-currency BRL na linhagem Genesis.
      // O parâmetro `currency` de getSystemAccount é aceito por compat de
      // assinatura mas ignorado no provider Genesis.
      const regionalFundAccount = await bankAccountRepository.getSystemAccount(
        tenantId,
        'regional_fund',
        'BRL'
      );

      if (regionalFundAccount) {
        const regionalBalance = await bankLedgerRepository.calculateBalance(
          tenantId,
          regionalFundAccount.accountId
        );

        // Usar tenant_id como região padrão (ou metadata.regionId se existir)
        const regionId = (regionalFundAccount.metadata?.regionId as string) || tenantId;
        balancesByRegion[regionId] = regionalBalance.balanceCents;
      }
    } catch (error) {
      // Se não houver conta regional_fund, não adicionar ao byRegion
      // Isso é esperado em alguns tenants
      console.warn('[BankBalanceConsolidation] Conta regional_fund não encontrada:', error);
    }

    // 6. Preparar dados de reconciliação (INPUT MANUAL)
    const reconciliation: ReconciliationData = {
      internalBalanceCents: totalSystemBalanceCents,
      externalBalanceCents: null,
      differenceCents: null,
    };

    // 7. Determinar moeda base.
    // DECISION-0025: sistema é mono-BRL Genesis; `filters.currency` ignorado.
    // Lógica de 'MULTI' mantida como compat defensiva, mas inalcançável
    // enquanto bank_accounts não tiver coluna currency.
    const currencyKeys = Object.keys(balancesByCurrency);
    const baseCurrency = currencyKeys.length === 1
      ? currencyKeys[0]
      : currencyKeys.length > 1
        ? 'MULTI'
        : 'BRL';

    // 8. Retornar estrutura consolidada
    return {
      totalSystemBalanceCents,
      byAccountType: balancesByType,
      byCurrency: balancesByCurrency,
      byRegion: balancesByRegion,
      accountCountByType,
      averageBalancePerAccountCents,
      largestAccount: largestAccount ? {
        accountId: largestAccount.accountId,
        ownerId: largestAccount.ownerId,
        ownerType: largestAccount.ownerType,
        balanceCents: largestAccount.balanceCents,
        currency: largestAccount.currency,
      } : null,
      smallestAccount: smallestAccount ? {
        accountId: smallestAccount.accountId,
        ownerId: smallestAccount.ownerId,
        ownerType: smallestAccount.ownerType,
        balanceCents: smallestAccount.balanceCents,
        currency: smallestAccount.currency,
      } : null,
      reconciliation,
      calculatedAt: new Date().toISOString(),
      currency: baseCurrency,
      totalAccounts: activeAccountCount,
    };
  }

  /**
   * Atualiza dados de reconciliação (INPUT MANUAL)
   * 
   * NOTA: Este método NÃO persiste dados.
   * Apenas calcula a diferença entre saldo interno e externo.
   * 
   * @param consolidatedBalance - Balanço consolidado existente
   * @param externalBalance - Saldo bancário externo (INPUT MANUAL)
   * @returns Balanço consolidado com reconciliação atualizada
   */
  updateReconciliation(
    consolidatedBalance: ConsolidatedBalance,
    externalBalanceCents: number
  ): ConsolidatedBalance {
    const differenceCents =
      consolidatedBalance.reconciliation.internalBalanceCents - externalBalanceCents;

    return {
      ...consolidatedBalance,
      reconciliation: {
        internalBalanceCents: consolidatedBalance.reconciliation.internalBalanceCents,
        externalBalanceCents,
        differenceCents,
      },
    };
  }
}

export const bankBalanceConsolidationService = new BankBalanceConsolidationService();

