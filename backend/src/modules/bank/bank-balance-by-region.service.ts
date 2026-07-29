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
 * - Histórico via bank_ledger (bankLedgerRepository.getEntriesByAccount — NÃO criar nova
 *   fonte de verdade; bank_transactions não tem from/to_account_id, ver allowlist C4)
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

    let result;
    try {
      result = await client.query<{
        account_id: string;
        owner_id: string;
        city_id: string | null;
        scope_level: string;
      }>(query, params);
    } finally {
      client.release();
    }

    // Calcular saldo de cada conta via ledger (FONTE DA VERDADE)
    // entryCount/lastEntryAt já vêm prontos de calculateBalance() — não repetir a consulta
    // (bank_ledger não tem transaction_id/createdAt como colunas de bank_transactions; C4).
    const funds: RegionalFundInfo[] = [];

    for (const row of result.rows) {
      const fundBalance = await bankLedgerRepository.calculateBalance(tenantId, row.account_id);

      const regionId = row.city_id ?? row.scope_level;
      const regionName = undefined;

      funds.push({
        regionId,
        regionName,
        accountId: row.account_id,
        currency: currency ?? 'BRL',
        balance: fundBalance.balanceCents,
        lastTransactionDate: fundBalance.lastEntryAt?.toISOString(),
        transactionCount: fundBalance.entryCount,
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

    let result;
    try {
      result = await client.query<{
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
    } finally {
      client.release();
    }

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    // entryCount/lastEntryAt já vêm prontos de calculateBalance() — não repetir a consulta
    // (bank_ledger não tem transaction_id/createdAt como colunas de bank_transactions; C4).
    const fundBalance = await bankLedgerRepository.calculateBalance(tenantId, row.account_id);

    const regionName = undefined;

    return {
      regionId,
      regionName,
      accountId: row.account_id,
      currency,
      balance: fundBalance.balanceCents,
      lastTransactionDate: fundBalance.lastEntryAt?.toISOString(),
      transactionCount: fundBalance.entryCount,
    };
  }

  /**
   * Obtém histórico de transações do fundo regional (READ-MODEL)
   * 
   * FONTE CANÔNICA: bank_ledger (bankLedgerRepository.getEntriesByAccount)
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

    // Buscar lançamentos (FONTE CANÔNICA: bank_ledger, via bankLedgerRepository — mesmo
    // repositório usado no cálculo acima; bank_ledger já carrega `direction` nativamente,
    // então credit/debit não precisa ser inferido por from/to_account_id, que nunca
    // existiram nesta tabela nem em bank_transactions — ver allowlist C4).
    // Filtro de data e paginação preservados via BankLedgerSearchOptions
    // (getEntriesByAccount já suporta startDate/endDate/limit/offset).
    const ledgerEntries = await bankLedgerRepository.getEntriesByAccount(tenantId, fund.accountId, {
      startDate,
      endDate,
      limit,
      offset,
    });

    // Processar lançamentos
    const entries: RegionalFundHistoryEntry[] = [];
    let totalCredits = 0;
    let totalDebits = 0;

    for (const entry of ledgerEntries) {
      const amountCents = Number(entry.amountCents);
      const description = entry.description || `Lançamento ${entry.entryType}`;

      if (entry.entryType === 'credit') {
        totalCredits += amountCents;
      } else {
        totalDebits += amountCents;
      }

      entries.push({
        transactionId: entry.transactionId,
        type: entry.entryType,
        amountCents,
        description,
        createdAt: entry.createdAt,
        metadata: entry.metadata ?? undefined,
      });
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




