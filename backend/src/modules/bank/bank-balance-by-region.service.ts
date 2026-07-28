// backend/src/modules/bank/bank-balance-by-region.service.ts
// READ-MODEL: Consolidação de Balanço Financeiro por Região
// Status: READ-MODEL PURO (não CORE, não fonte de verdade, não decisório)
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   DECISION-0166 D3 · SSOT_REGISTRY_UNIFICARD.md §5.10-5.12 (Lei 7 — identidade ≠ string)
// ║ NÃO:     identificar fundo regional por metadata/owner_id string em bank_accounts
// ║ EM VEZ:  regional_fund_accounts (FK) JOIN bank_accounts — ver bank-account.service.ts§lookupRegionalFundAccount
// ╚════════════════════════════════════════════════════════════════

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
  amountCents: number;
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
 * - FONTE CANÔNICA: regional_fund_accounts (FK territorial, DECISION-0166 D3) JOIN bank_accounts
 *   — NUNCA metadata/owner_id string (Lei 7 / SSOT_REGISTRY §5.10-5.12)
 * - Histórico via bank_ledger + bank_transactions (NÃO criar nova fonte de verdade)
 */
class BankBalanceByRegionService {
  /**
   * Lista todos os fundos regionais (READ-MODEL)
   *
   * FONTE CANÔNICA: regional_fund_accounts (FK territorial) JOIN bank_accounts
   * (owner_type='system'). regionId = city_id quando presente, senão scope_level — mesma
   * convenção já ratificada no read-model irmão de consolidação por conta (DECISION-0177 D10).
   * Sem catálogo de nomes territoriais religado aqui: regionName permanece ausente (honesto,
   * não inventado) até frente própria acoplar country/state/city para exibição.
   *
   * @param tenantId - ID do tenant
   * @param currency - Moeda (opcional)
   * @returns Lista de fundos regionais
   */
  async listRegionalFunds(
    tenantId: string,
    currency?: BankCurrency
  ): Promise<RegionalFundInfo[]> {
    // Buscar todas as contas de fundo regional via FK canônica (regional_fund_accounts)
    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);

    const query = `
      SELECT rfa.bank_account_id::text AS account_id, ba.owner_id, rfa.city_id::text AS city_id, rfa.scope_level
      FROM regional_fund_accounts rfa
      JOIN bank_accounts ba ON ba.id = rfa.bank_account_id AND ba.tenant_id = rfa.tenant_id
      WHERE rfa.tenant_id = $1
        AND ba.owner_type = 'system'
    `;

    const params: any[] = [tenantId];

    const result = await client.query<{
      account_id: string;
      owner_id: string;
      city_id: string | null;
      scope_level: string;
    }>(query, params);

    client.release();

    // Calcular saldo de cada conta via ledger (FONTE DA VERDADE)
    const funds: RegionalFundInfo[] = [];

    for (const row of result.rows) {
      const balance = await bankLedgerRepository.calculateBalance(tenantId, row.account_id);

      // Buscar última transação (para lastTransactionDate)
      const lastTransaction = await runQueriesWithTenant<{
        transaction_id: string;
        createdAt: Date;
      }>(
        tenantId,
        `
        SELECT transaction_id, createdAt
        FROM bank_transactions
        WHERE tenant_id = $1
          AND (from_account_id = $2 OR to_account_id = $2)
        ORDER BY createdAt DESC
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

      const regionId = row.city_id ?? row.scope_level;
      const regionName = undefined;

      funds.push({
        regionId,
        regionName,
        accountId: row.account_id,
        currency: currency ?? 'BRL',
        balance: balance.balanceCents,
        lastTransactionDate: lastTransaction?.[0]?.createdAt?.toISOString(),
        transactionCount: transactionCount?.[0] ? parseInt(transactionCount[0].count, 10) : 0,
      });
    }

    return funds;
  }

  /**
   * Obtém informações de um fundo regional específico (READ-MODEL)
   *
   * FONTE CANÔNICA: regional_fund_accounts (FK territorial) JOIN bank_accounts.
   * regionId aceito = city_id (quando o escopo tem cidade) OU scope_level (planet/country/
   * state/neighborhood, que hoje não têm city_id) — mesma convenção do listRegionalFunds acima.
   *
   * @param tenantId - ID do tenant
   * @param regionId - city_id OU scope_level (ver convenção acima)
   * @param currency - Moeda (opcional, default: BRL)
   * @returns Informações do fundo regional
   */
  async getRegionalFund(
    tenantId: string,
    regionId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<RegionalFundInfo | null> {
    // Buscar conta de fundo regional via FK canônica (regional_fund_accounts)
    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);

    const result = await client.query<{
      account_id: string;
      owner_id: string;
      city_id: string | null;
      scope_level: string;
    }>(
      `
      SELECT rfa.bank_account_id::text AS account_id, ba.owner_id, rfa.city_id::text AS city_id, rfa.scope_level
      FROM regional_fund_accounts rfa
      JOIN bank_accounts ba ON ba.id = rfa.bank_account_id AND ba.tenant_id = rfa.tenant_id
      WHERE rfa.tenant_id = $1
        AND ba.owner_type = 'system'
        AND (
          rfa.city_id::text = $2
          OR (rfa.city_id IS NULL AND rfa.scope_level = $2)
        )
      LIMIT 1
      `,
      [tenantId, regionId]
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
      createdAt: Date;
    }>(
      tenantId,
      `
      SELECT transaction_id, createdAt
      FROM bank_transactions
      WHERE tenant_id = $1
        AND (from_account_id = $2 OR to_account_id = $2)
      ORDER BY createdAt DESC
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

    const regionName = undefined;

    return {
      regionId,
      regionName,
      accountId: row.account_id,
      currency,
      balance: balance.balanceCents,
      lastTransactionDate: lastTransaction?.[0]?.createdAt?.toISOString(),
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
        bt.createdAt
      FROM bank_transactions bt
      WHERE bt.tenant_id = $1
        AND (bt.from_account_id = $2 OR bt.to_account_id = $2)
    `;

    const params: any[] = [tenantId, fund.accountId];
    let paramIndex = 3;

    if (startDate) {
      query += ` AND bt.createdAt >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND bt.createdAt <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY bt.createdAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const transactions = await runQueriesWithTenant<{
      transaction_id: string;
      from_account_id: string;
      to_account_id: string;
      amountCents: string;
      currency: string;
      transaction_type: string;
      metadata: any;
      createdAt: Date;
    }>(tenantId, query, params);

    // Processar transações
    const entries: RegionalFundHistoryEntry[] = [];
    let totalCredits = 0;
    let totalDebits = 0;

    for (const tx of transactions) {
      const amountCents = parseInt(tx.amountCents, 10);
      const isCredit = tx.to_account_id === fund.accountId;

      if (isCredit) {
        totalCredits += amountCents;
        entries.push({
          transactionId: tx.transaction_id,
          type: 'credit',
          amountCents,
          description: tx.metadata?.description || `Transação ${tx.transaction_type}`,
          createdAt: tx.createdAt.toISOString(),
          metadata: tx.metadata,
        });
      } else {
        totalDebits += amountCents;
        entries.push({
          transactionId: tx.transaction_id,
          type: 'debit',
          amountCents,
          description: tx.metadata?.description || `Transação ${tx.transaction_type}`,
          createdAt: tx.createdAt.toISOString(),
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




