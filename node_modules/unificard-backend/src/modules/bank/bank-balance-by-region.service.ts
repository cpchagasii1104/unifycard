// backend/src/modules/bank/bank-balance-by-region.service.ts
// READ-MODEL: Consolidação de Balanço Financeiro por Região
// Status: READ-MODEL PURO (não CORE, não fonte de verdade, não decisório)

import { runQueriesWithTenant } from '@core/database/pool';
import { bankAccountRepository } from './bank-account.repository';
import { bankLedgerRepository } from './bank-ledger.repository';
import type { BankCurrency } from './bank-account.types';

/**
 * Informações de fundo regional
 */
export interface RegionalFundInfo {
  regionId: string;
  regionName?: string;
  accountId: string;
  currency: string;
  balance: number;
  lastTransactionDate?: string;
  transactionCount?: number;
}

/**
 * Histórico de transações do fundo regional
 */
export interface RegionalFundHistoryEntry {
  transactionId: string;
  type: 'credit' | 'debit';
  amount: number;
  description?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

/**
 * Histórico completo do fundo regional
 */
export interface RegionalFundHistory {
  regionId: string;
  accountId: string;
  currency: string;
  currentBalance: number;
  entries: RegionalFundHistoryEntry[];
  period: {
    startDate?: string;
    endDate?: string;
  };
  totalCredits: number;
  totalDebits: number;
}

/**
 * Service para consolidação de balanço por região (READ-MODEL)
 * 
 * REGRAS ABSOLUTAS:
 * - Sempre calcula on-demand (nunca persiste)
 * - Nunca usado para decisões
 * - Nunca substitui o ledger
 * - Ledger é a única fonte da verdade
 * - Este é apenas um READ-MODEL para visualização administrativa
 * - FONTE CANÔNICA: conta de sistema regional_fund
 * - Histórico via bank_ledger + bank_transactions (NÃO criar nova fonte de verdade)
 */
class BankBalanceByRegionService {
  /**
   * Lista todos os fundos regionais (READ-MODEL)
   * 
   * FONTE CANÔNICA: contas de sistema com owner_type='system' e tipo 'regional_fund'
   * 
   * @param tenantId - ID do tenant
   * @param currency - Moeda (opcional)
   * @returns Lista de fundos regionais
   */
  async listRegionalFunds(
    tenantId: string,
    currency?: BankCurrency
  ): Promise<RegionalFundInfo[]> {
    // Buscar todas as contas de sistema regional_fund
    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);

    let query = `
      SELECT account_id, owner_id, currency, metadata
      FROM bank_accounts
      WHERE tenant_id = $1
        AND owner_type = 'system'
        AND metadata->>'systemAccountType' = 'regional_fund'
    `;

    const params: any[] = [tenantId];

    if (currency) {
      query += ` AND currency = $2`;
      params.push(currency);
    }

    const result = await client.query<{
      account_id: string;
      owner_id: string;
      currency: string;
      metadata: any;
    }>(query, params);

    client.release();

    // Calcular saldo de cada conta via ledger (FONTE DA VERDADE)
    const funds: RegionalFundInfo[] = [];

    for (const row of result.rows) {
      const balance = await bankLedgerRepository.calculateBalance(tenantId, row.account_id);

      // Buscar última transação (para lastTransactionDate)
      const lastTransaction = await runQueriesWithTenant<{
        transaction_id: string;
        created_at: Date;
      }>(
        tenantId,
        `
        SELECT transaction_id, created_at
        FROM bank_transactions
        WHERE tenant_id = $1
          AND (from_account_id = $2 OR to_account_id = $2)
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [tenantId, row.account_id]
      );

      // Contar transações
      const transactionCount = await runQueriesWithTenant<{
        count: string;
      }>(
        tenantId,
        `
        SELECT COUNT(*) as count
        FROM bank_transactions
        WHERE tenant_id = $1
          AND (from_account_id = $2 OR to_account_id = $2)
        `,
        [tenantId, row.account_id]
      );

      const regionId = (row.metadata?.regionId as string) || row.owner_id;
      const regionName = (row.metadata?.regionName as string) || undefined;

      funds.push({
        regionId,
        regionName,
        accountId: row.account_id,
        currency: row.currency,
        balance: balance.balance,
        lastTransactionDate: lastTransaction?.[0]?.created_at?.toISOString(),
        transactionCount: transactionCount?.[0] ? parseInt(transactionCount[0].count, 10) : 0,
      });
    }

    return funds;
  }

  /**
   * Obtém informações de um fundo regional específico (READ-MODEL)
   * 
   * FONTE CANÔNICA: conta de sistema regional_fund
   * 
   * @param tenantId - ID do tenant
   * @param regionId - ID da região
   * @param currency - Moeda (opcional, default: BRL)
   * @returns Informações do fundo regional
   */
  async getRegionalFund(
    tenantId: string,
    regionId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<RegionalFundInfo | null> {
    // Buscar conta de sistema regional_fund para a região
    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);

    const result = await client.query<{
      account_id: string;
      owner_id: string;
      currency: string;
      metadata: any;
    }>(
      `
      SELECT account_id, owner_id, currency, metadata
      FROM bank_accounts
      WHERE tenant_id = $1
        AND owner_type = 'system'
        AND metadata->>'systemAccountType' = 'regional_fund'
        AND currency = $2
        AND (
          metadata->>'regionId' = $3
          OR owner_id = $3
        )
      LIMIT 1
      `,
      [tenantId, currency, regionId]
    );

    client.release();

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const balance = await bankLedgerRepository.calculateBalance(tenantId, row.account_id);

    // Buscar última transação
    const lastTransaction = await runQueriesWithTenant<{
      transaction_id: string;
      created_at: Date;
    }>(
      tenantId,
      `
      SELECT transaction_id, created_at
      FROM bank_transactions
      WHERE tenant_id = $1
        AND (from_account_id = $2 OR to_account_id = $2)
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [tenantId, row.account_id]
    );

    // Contar transações
    const transactionCount = await runQueriesWithTenant<{
      count: string;
    }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM bank_transactions
      WHERE tenant_id = $1
        AND (from_account_id = $2 OR to_account_id = $2)
      `,
      [tenantId, row.account_id]
    );

    const regionName = (row.metadata?.regionName as string) || undefined;

    return {
      regionId,
      regionName,
      accountId: row.account_id,
      currency: row.currency,
      balance: balance.balance,
      lastTransactionDate: lastTransaction?.[0]?.created_at?.toISOString(),
      transactionCount: transactionCount?.[0] ? parseInt(transactionCount[0].count, 10) : 0,
    };
  }

  /**
   * Obtém histórico de transações do fundo regional (READ-MODEL)
   * 
   * FONTE CANÔNICA: bank_ledger + bank_transactions
   * NÃO criar nova fonte de verdade
   * 
   * @param tenantId - ID do tenant
   * @param regionId - ID da região
   * @param currency - Moeda (opcional, default: BRL)
   * @param startDate - Data inicial (opcional)
   * @param endDate - Data final (opcional)
   * @param limit - Limite de registros (opcional, default: 100)
   * @param offset - Offset para paginação (opcional, default: 0)
   * @returns Histórico do fundo regional
   */
  async getRegionalFundHistory(
    tenantId: string,
    regionId: string,
    currency: BankCurrency = 'BRL',
    startDate?: Date,
    endDate?: Date,
    limit: number = 100,
    offset: number = 0
  ): Promise<RegionalFundHistory> {
    // Buscar conta de sistema regional_fund
    const fund = await this.getRegionalFund(tenantId, regionId, currency);
    if (!fund) {
      throw new Error(`Fundo regional não encontrado para região ${regionId}`);
    }

    // Buscar transações (FONTE CANÔNICA: bank_transactions)
    let query = `
      SELECT 
        bt.transaction_id,
        bt.from_account_id,
        bt.to_account_id,
        bt.amount,
        bt.currency,
        bt.transaction_type,
        bt.metadata,
        bt.created_at
      FROM bank_transactions bt
      WHERE bt.tenant_id = $1
        AND (bt.from_account_id = $2 OR bt.to_account_id = $2)
    `;

    const params: any[] = [tenantId, fund.accountId];
    let paramIndex = 3;

    if (startDate) {
      query += ` AND bt.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND bt.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY bt.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const transactions = await runQueriesWithTenant<{
      transaction_id: string;
      from_account_id: string;
      to_account_id: string;
      amount: string;
      currency: string;
      transaction_type: string;
      metadata: any;
      created_at: Date;
    }>(tenantId, query, params);

    // Processar transações
    const entries: RegionalFundHistoryEntry[] = [];
    let totalCredits = 0;
    let totalDebits = 0;

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount);
      const isCredit = tx.to_account_id === fund.accountId;

      if (isCredit) {
        totalCredits += amount;
        entries.push({
          transactionId: tx.transaction_id,
          type: 'credit',
          amount,
          description: tx.metadata?.description || `Transação ${tx.transaction_type}`,
          createdAt: tx.created_at.toISOString(),
          metadata: tx.metadata,
        });
      } else {
        totalDebits += amount;
        entries.push({
          transactionId: tx.transaction_id,
          type: 'debit',
          amount,
          description: tx.metadata?.description || `Transação ${tx.transaction_type}`,
          createdAt: tx.created_at.toISOString(),
          metadata: tx.metadata,
        });
      }
    }

    return {
      regionId,
      accountId: fund.accountId,
      currency: fund.currency,
      currentBalance: fund.balance,
      entries,
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
      totalCredits,
      totalDebits,
    };
  }
}

export const bankBalanceByRegionService = new BankBalanceByRegionService();


