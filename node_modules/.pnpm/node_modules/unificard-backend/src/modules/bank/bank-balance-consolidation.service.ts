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
import type { BankAccount, BankAccountOwnerType } from './bank-account.types';

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
    const { currency, ownerType, activeOnly = false, startDate, endDate } = filters;

    // 1. Buscar todas as contas do tenant (com filtros opcionais)
    // NOTA: Usar busca direta via query para evitar paginação (READ-MODEL pode ser lento)
    // FONTE ÚNICA: bank_accounts (via repository)
    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);

    let query = `
      SELECT account_id, tenant_id, owner_id, owner_type, currency,
             cached_balance, metadata, createdAt, updatedAt
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

    // Suporte a múltiplas moedas ou moeda única
    if (currency) {
      if (Array.isArray(currency)) {
        query += ` AND currency = ANY($${paramIndex}::text[])`;
        params.push(currency);
        paramIndex++;
      } else {
        query += ` AND currency = $${paramIndex}`;
        params.push(currency);
        paramIndex++;
      }
    }

    // Filtros de data (se aplicável - filtrar por data de criação da conta)
    if (startDate) {
      query += ` AND createdAt >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND createdAt <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY createdAt DESC`;

    const result = await client.query<{
      account_id: string;
      tenant_id: string;
      owner_id: string;
      owner_type: string;
      currency: string;
      cached_balance: string;
      metadata: any;
      createdAt: Date;
      updatedAt: Date;
    }>(query, params);

    const allAccounts: BankAccount[] = result.rows.map((row) => ({
      accountId: row.account_id,
      tenantId: row.tenant_id,
      ownerId: row.owner_id,
      ownerType: row.owner_type as BankAccountOwnerType,
      currency: row.currency as 'BRL' | 'USD' | 'EUR' | 'TEST',
      cachedBalance: parseFloat(row.cached_balance),
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    client.release();

    // 2. Calcular saldo de cada conta via ledger (FONTE DA VERDADE)
    const balancesByAccount: Map<string, { balance: number; currency: string; ownerType: BankAccountOwnerType; ownerId: string }> = new Map();
    const balancesByType: BalanceByAccountType = {
      user: 0,
      company: 0,
      system: 0,
    };
    const balancesByCurrency: BalanceByCurrency = {};
    const accountCountByType: AccountCountByType = {
      user: 0,
      company: 0,
      system: 0,
    };

    let largestAccount: { accountId: string; ownerId: string; ownerType: BankAccountOwnerType; balance: number; currency: string } | null = null;
    let smallestAccount: { accountId: string; ownerId: string; ownerType: BankAccountOwnerType; balance: number; currency: string } | null = null;

    for (const account of allAccounts) {
      // Calcular saldo via ledger (fonte da verdade)
      const balance = await bankLedgerRepository.calculateBalance(tenantId, account.accountId);

      // Filtrar contas inativas se solicitado
      if (activeOnly && Math.abs(balance.balance) < 0.01) {
        continue;
      }

      // Armazenar saldo por conta (com metadados)
      balancesByAccount.set(account.accountId, {
        balance: balance.balance,
        currency: account.currency,
        ownerType: account.ownerType,
        ownerId: account.ownerId,
      });

      // Agregar por tipo de conta
      const ownerType = account.ownerType as BankAccountOwnerType;
      if (ownerType === 'user') {
        balancesByType.user += balance.balance;
        accountCountByType.user++;
      } else if (ownerType === 'company') {
        balancesByType.company += balance.balance;
        accountCountByType.company++;
      } else if (ownerType === 'system') {
        balancesByType.system += balance.balance;
        accountCountByType.system++;
      }

      // Agregar por moeda
      if (!balancesByCurrency[account.currency]) {
        balancesByCurrency[account.currency] = 0;
      }
      balancesByCurrency[account.currency] += balance.balance;

      // Identificar maior e menor conta
      if (!largestAccount || balance.balance > largestAccount.balance) {
        largestAccount = {
          accountId: account.accountId,
          ownerId: account.ownerId,
          ownerType: account.ownerType,
          balance: balance.balance,
          currency: account.currency,
        };
      }

      if (!smallestAccount || balance.balance < smallestAccount.balance) {
        smallestAccount = {
          accountId: account.accountId,
          ownerId: account.ownerId,
          ownerType: account.ownerType,
          balance: balance.balance,
          currency: account.currency,
        };
      }
    }

    // 3. Calcular saldo total
    const totalSystemBalance = Array.from(balancesByAccount.values()).reduce(
      (sum, acc) => sum + acc.balance,
      0
    );

    // 4. Calcular saldo médio por conta
    const activeAccountCount = balancesByAccount.size;
    const averageBalancePerAccount = activeAccountCount > 0 ? totalSystemBalance / activeAccountCount : 0;

    // 5. Agregar por região (fundo regional)
    // NOTA: Usar APENAS fonte canônica existente
    // - Se via bank_accounts (system account regional_fund): usar essa
    // - Se via bank_splits.split_type='regional_fund': agregar por região
    // Por enquanto, usar conta de sistema regional_fund (fonte canônica)
    const balancesByRegion: BalanceByRegion = {};

    // Buscar conta de sistema regional_fund
    // NOTA: Esta é a fonte canônica para fundo regional
    try {
      // Se currency for array, usar primeira moeda ou BRL como fallback
      const currencyForRegionalFund = Array.isArray(currency) 
        ? (currency[0] || 'BRL')
        : (currency || 'BRL');
      
      const regionalFundAccount = await bankAccountRepository.getSystemAccount(
        tenantId,
        'regional_fund',
        currencyForRegionalFund
      );

      if (regionalFundAccount) {
        const regionalBalance = await bankLedgerRepository.calculateBalance(
          tenantId,
          regionalFundAccount.accountId
        );

        // Usar tenant_id como região padrão (ou metadata.regionId se existir)
        const regionId = (regionalFundAccount.metadata?.regionId as string) || tenantId;
        balancesByRegion[regionId] = regionalBalance.balance;
      }
    } catch (error) {
      // Se não houver conta regional_fund, não adicionar ao byRegion
      // Isso é esperado em alguns tenants
      console.warn('[BankBalanceConsolidation] Conta regional_fund não encontrada:', error);
    }

    // 6. Preparar dados de reconciliação (INPUT MANUAL)
    const reconciliation: ReconciliationData = {
      internalBalance: totalSystemBalance,
      externalBalance: null, // INPUT MANUAL - não calculado automaticamente
      difference: null, // Calculado apenas se externalBalance for fornecido
    };

    // 7. Determinar moeda base (ou 'MULTI' se múltiplas moedas)
    const currencyKeys = Object.keys(balancesByCurrency);
    const baseCurrency = currencyKeys.length === 1 
      ? currencyKeys[0] 
      : currencyKeys.length > 1 
        ? 'MULTI' 
        : (currency && !Array.isArray(currency) ? currency : 'BRL');

    // 8. Retornar estrutura consolidada
    return {
      totalSystemBalance,
      byAccountType: balancesByType,
      byCurrency: balancesByCurrency,
      byRegion: balancesByRegion,
      accountCountByType,
      averageBalancePerAccount,
      largestAccount: largestAccount ? {
        accountId: largestAccount.accountId,
        ownerId: largestAccount.ownerId,
        ownerType: largestAccount.ownerType,
        balance: largestAccount.balance,
        currency: largestAccount.currency,
      } : null,
      smallestAccount: smallestAccount ? {
        accountId: smallestAccount.accountId,
        ownerId: smallestAccount.ownerId,
        ownerType: smallestAccount.ownerType,
        balance: smallestAccount.balance,
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
    externalBalance: number
  ): ConsolidatedBalance {
    const difference = consolidatedBalance.reconciliation.internalBalance - externalBalance;

    return {
      ...consolidatedBalance,
      reconciliation: {
        internalBalance: consolidatedBalance.reconciliation.internalBalance,
        externalBalance,
        difference,
      },
    };
  }
}

export const bankBalanceConsolidationService = new BankBalanceConsolidationService();



