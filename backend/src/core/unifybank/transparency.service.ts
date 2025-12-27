// backend/src/core/unifybank/transparency.service.ts
// Serviço de Transparência Financeira - FASE 6
// Visualização de extratos, splits e fundos regionais

import { getClientWithTenant } from '@core/database/pool';
import { accountService } from '@core/economy/accounts/account.service';
import { regionAccountService } from '@core/economy/region-account.service';
import { resolveGlobalUserId } from '@core/identity/identity.utils';

export interface StatementEntry {
  transactionId: string;
  type: 'p2p' | 'donation' | 'split' | 'compensation' | 'other';
  amount: number;
  direction: 'in' | 'out';
  balanceAfter: number;
  createdAt: Date;
  metadata: {
    type?: string;
    targetType?: string;
    targetId?: string;
    originTransactionId?: string;
    splitGroupId?: string;
    message?: string;
    [key: string]: any;
  };
}

export interface StatementResult {
  entries: StatementEntry[];
  total: number;
  hasMore: boolean;
}

export interface SplitDetail {
  baseTransaction: {
    transactionId: string;
    amount: number;
    type: string;
    createdAt: Date;
    metadata: Record<string, any>;
  };
  splits: Array<{
    transactionId: string;
    targetType: 'user' | 'group' | 'project' | 'regional_fund' | 'platform';
    targetId?: string;
    percentage: number;
    amount: number;
    createdAt: Date;
  }>;
  totalPercentage: number;
  totalAmount: number;
}

export interface RegionalFundEntry {
  transactionId: string;
  type: 'credit' | 'debit';
  amount: number;
  origin: string; // 'donation' | 'service' | 'event' | 'other'
  originTransactionId?: string;
  destination?: string; // Para saídas
  context?: string;
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface RegionalFundView {
  accountId: string;
  regionId?: string;
  currentBalance: number;
  entries: RegionalFundEntry[];
  summary: {
    totalIn: number;
    totalOut: number;
    netAmount: number;
  };
}

export interface RegionalFundAdminView {
  regionId: string;
  accountId: string;
  currentBalance: number;
  entries: RegionalFundEntry[];
  summary: {
    totalIn: number;
    totalOut: number;
    netAmount: number;
    byOrigin: Record<string, number>;
    byContext: Record<string, number>;
    byPeriod: Array<{
      period: string; // YYYY-MM
      totalIn: number;
      totalOut: number;
    }>;
  };
}

class TransparencyService {
  /**
   * Obtém extrato financeiro do usuário
   * Usa dados do ledger (não recalcula saldo)
   */
  async getUserStatement(
    tenantId: string,
    globalUserId: string,
    options: { limit?: number; offset?: number; startDate?: Date; endDate?: Date } = {}
  ): Promise<StatementResult> {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    // 1. Resolver conta principal do usuário
    const userId = await this.getUserIdFromGlobalId(tenantId, globalUserId);
    if (!userId) {
      throw new Error('User not found');
    }

    const userAccount = await accountService.getOrCreateUserPrimaryAccount(tenantId, userId, 'BRL');
    const accountId = userAccount.accountId;

    // 2. Buscar entradas do ledger para essa conta
    const client = await getClientWithTenant(tenantId);

    try {
      let query = `
        SELECT 
          l.entry_id,
          l.transaction_id,
          l.entry_type,
          l.amount,
          l.balance_after,
          l.created_at,
          t.metadata as transaction_metadata
        FROM ledger l
        INNER JOIN transactions t ON t.transaction_id = l.transaction_id
        WHERE l.account_id = $1
      `;

      const params: any[] = [accountId];
      let paramIndex = 2;

      if (startDate) {
        query += ` AND l.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND l.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit + 1, offset); // +1 para verificar se tem mais

      const result = await client.query<{
        entry_id: string;
        transaction_id: string;
        entry_type: string;
        amount: string;
        balance_after: string;
        created_at: Date;
        transaction_metadata: any;
      }>(query, params);

      const hasMore = result.rows.length > limit;
      const entries = result.rows.slice(0, limit).map((row) => {
        const metadata = row.transaction_metadata || {};
        const entryType = row.entry_type as 'credit' | 'debit';

        // Determinar tipo da transação
        let type: StatementEntry['type'] = 'other';
        if (metadata.type === 'p2p_transfer') type = 'p2p';
        else if (metadata.type === 'donation') type = 'donation';
        else if (metadata.type === 'split') type = 'split';
        else if (metadata.type === 'compensation') type = 'compensation';

        return {
          transactionId: row.transaction_id,
          type,
          amount: parseFloat(row.amount),
          direction: (entryType === 'credit' ? 'in' : 'out') as 'in' | 'out',
          balanceAfter: parseFloat(row.balance_after),
          createdAt: row.created_at,
          metadata: {
            type: metadata.type,
            targetType: metadata.targetType,
            targetId: metadata.targetId,
            originTransactionId: metadata.originTransactionId,
            splitGroupId: metadata.splitGroupId,
            message: metadata.message,
          },
        };
      });

      return {
        entries,
        total: entries.length,
        hasMore,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Obtém detalhe de split de uma transação base
   * Busca todas as transações que compartilham o mesmo splitGroupId
   */
  async getTransactionSplits(
    tenantId: string,
    transactionId: string
  ): Promise<SplitDetail | null> {
    const client = await getClientWithTenant(tenantId);

    try {
      // 1. Buscar transação base
      const baseTx = await client.query<{
        transaction_id: string;
        amount: string;
        metadata: any;
        created_at: Date;
      }>(
        `
        SELECT transaction_id, amount, metadata, created_at
        FROM transactions
        WHERE transaction_id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [transactionId, tenantId]
      );

      if (baseTx.rows.length === 0) {
        return null;
      }

      const base = baseTx.rows[0];
      const baseMetadata = base.metadata || {};
      const splitGroupId = baseMetadata.splitGroupId;

      // Se não tem splitGroupId, não é uma transação com split
      if (!splitGroupId) {
        return {
          baseTransaction: {
            transactionId: base.transaction_id,
            amount: parseFloat(base.amount),
            type: baseMetadata.type || 'other',
            createdAt: base.created_at,
            metadata: baseMetadata,
          },
          splits: [],
          totalPercentage: 0,
          totalAmount: 0,
        };
      }

      // 2. Buscar todas as transações com o mesmo splitGroupId
      const splitTxs = await client.query<{
        transaction_id: string;
        amount: string;
        metadata: any;
        created_at: Date;
      }>(
        `
        SELECT transaction_id, amount, metadata, created_at
        FROM transactions
        WHERE tenant_id = $1
          AND metadata->>'splitGroupId' = $2
          AND metadata->>'type' = 'split'
        ORDER BY created_at ASC
        `,
        [tenantId, splitGroupId]
      );

      const splits = splitTxs.rows.map((row) => {
        const metadata = row.metadata || {};
        return {
          transactionId: row.transaction_id,
          targetType: metadata.targetType as SplitDetail['splits'][0]['targetType'],
          targetId: metadata.targetId,
          percentage: metadata.percentage || 0,
          amount: parseFloat(row.amount),
          createdAt: row.created_at,
        };
      });

      const totalPercentage = splits.reduce((sum, s) => sum + s.percentage, 0);
      const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0);

      return {
        baseTransaction: {
          transactionId: base.transaction_id,
          amount: parseFloat(base.amount),
          type: baseMetadata.type || 'other',
          createdAt: base.created_at,
          metadata: baseMetadata,
        },
        splits,
        totalPercentage,
        totalAmount,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Obtém visão do fundo regional para o usuário
   */
  async getUserRegionalFund(
    tenantId: string,
    globalUserId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<RegionalFundView | null> {
    const { limit = 50, offset = 0 } = options;

    // 1. Resolver userId do globalUserId
    const userId = await this.getUserIdFromGlobalId(tenantId, globalUserId);
    if (!userId) {
      throw new Error('User not found');
    }

    // 2. Resolver conta regional
    const regionAccountId = await regionAccountService.resolveRegionAccountId({
      tenantId,
      userId,
    });

    if (!regionAccountId) {
      return null; // Não há fundo regional para esse usuário
    }

    // 3. Obter saldo atual
    const balance = await accountService.getBalance(tenantId, regionAccountId);

    // 4. Buscar movimentações do ledger
    const client = await getClientWithTenant(tenantId);

    try {
      const ledgerEntries = await client.query<{
        transaction_id: string;
        entry_type: string;
        amount: string;
        created_at: Date;
      }>(
        `
        SELECT l.transaction_id, l.entry_type, l.amount, l.created_at
        FROM ledger l
        WHERE l.account_id = $1
        ORDER BY l.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [regionAccountId, limit, offset]
      );

      // 5. Buscar metadados das transações
      const transactionIds = ledgerEntries.rows.map((r) => r.transaction_id);
      const transactions = transactionIds.length > 0
        ? await client.query<{
            transaction_id: string;
            metadata: any;
          }>(
            `
            SELECT transaction_id, metadata
            FROM transactions
            WHERE transaction_id = ANY($1::text[])
            `,
            [transactionIds]
          )
        : { rows: [] };

      const txMap = new Map(
        transactions.rows.map((tx) => [tx.transaction_id, tx.metadata || {}])
      );

      const entries: RegionalFundEntry[] = ledgerEntries.rows.map((row) => {
        const metadata = txMap.get(row.transaction_id) || {};
        const entryType = row.entry_type as 'credit' | 'debit';

        // Determinar origem
        let origin = 'other';
        if (metadata.type === 'split' && metadata.context === 'donation') {
          origin = 'donation';
        } else if (metadata.type === 'split' && metadata.context === 'service') {
          origin = 'service';
        } else if (metadata.type === 'split' && metadata.context === 'event') {
          origin = 'event';
        }

        return {
          transactionId: row.transaction_id,
          type: entryType,
          amount: parseFloat(row.amount),
          origin,
          originTransactionId: metadata.originTransactionId,
          destination: metadata.targetId,
          context: metadata.context,
          createdAt: row.created_at,
          metadata,
        };
      });

      const totalIn = entries
        .filter((e) => e.type === 'credit')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalOut = entries
        .filter((e) => e.type === 'debit')
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        accountId: regionAccountId,
        currentBalance: balance,
        entries,
        summary: {
          totalIn,
          totalOut,
          netAmount: totalIn - totalOut,
        },
      };
    } finally {
      client.release();
    }
  }

  /**
   * Obtém visão administrativa do fundo regional
   */
  async getAdminRegionalFund(
    tenantId: string,
    regionId: string,
    options: { limit?: number; offset?: number; startDate?: Date; endDate?: Date } = {}
  ): Promise<RegionalFundAdminView | null> {
    const { limit = 100, offset = 0, startDate, endDate } = options;

    // 1. Resolver conta regional (usando ownerId = regionId, ownerType = 'group')
    const regionAccounts = await accountService.getAccountsByOwner(tenantId, regionId, 'group');
    const regionAccount = regionAccounts[0];

    if (!regionAccount) {
      return null; // Não há conta regional para essa região
    }

    const regionAccountId = regionAccount.accountId;

    // 2. Obter saldo atual
    const balance = await accountService.getBalance(tenantId, regionAccountId);

    // 3. Buscar todas as movimentações
    const client = await getClientWithTenant(tenantId);

    try {
      let query = `
        SELECT 
          l.transaction_id,
          l.entry_type,
          l.amount,
          l.created_at,
          t.metadata
        FROM ledger l
        INNER JOIN transactions t ON t.transaction_id = l.transaction_id
        WHERE l.account_id = $1
      `;

      const params: any[] = [regionAccountId];
      let paramIndex = 2;

      if (startDate) {
        query += ` AND l.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND l.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const ledgerEntries = await client.query<{
        transaction_id: string;
        entry_type: string;
        amount: string;
        created_at: Date;
        metadata: any;
      }>(query, params);

      const entries: RegionalFundEntry[] = ledgerEntries.rows.map((row) => {
        const metadata = row.metadata || {};
        const entryType = row.entry_type as 'credit' | 'debit';

        let origin = 'other';
        if (metadata.type === 'split' && metadata.context === 'donation') {
          origin = 'donation';
        } else if (metadata.type === 'split' && metadata.context === 'service') {
          origin = 'service';
        } else if (metadata.type === 'split' && metadata.context === 'event') {
          origin = 'event';
        }

        return {
          transactionId: row.transaction_id,
          type: entryType,
          amount: parseFloat(row.amount),
          origin,
          originTransactionId: metadata.originTransactionId,
          destination: metadata.targetId,
          context: metadata.context,
          createdAt: row.created_at,
          metadata,
        };
      });

      // 4. Calcular agregações
      const totalIn = entries
        .filter((e) => e.type === 'credit')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalOut = entries
        .filter((e) => e.type === 'debit')
        .reduce((sum, e) => sum + e.amount, 0);

      // Agrupar por origem
      const byOrigin: Record<string, number> = {};
      entries
        .filter((e) => e.type === 'credit')
        .forEach((e) => {
          byOrigin[e.origin] = (byOrigin[e.origin] || 0) + e.amount;
        });

      // Agrupar por contexto
      const byContext: Record<string, number> = {};
      entries
        .filter((e) => e.type === 'credit')
        .forEach((e) => {
          const ctx = e.context || 'other';
          byContext[ctx] = (byContext[ctx] || 0) + e.amount;
        });

      // Agrupar por período (mensal)
      const byPeriodMap = new Map<string, { in: number; out: number }>();
      entries.forEach((e) => {
        const period = e.createdAt.toISOString().substring(0, 7); // YYYY-MM
        const current = byPeriodMap.get(period) || { in: 0, out: 0 };
        if (e.type === 'credit') {
          current.in += e.amount;
        } else {
          current.out += e.amount;
        }
        byPeriodMap.set(period, current);
      });

      const byPeriod = Array.from(byPeriodMap.entries())
        .map(([period, data]) => ({
          period,
          totalIn: data.in,
          totalOut: data.out,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      return {
        regionId,
        accountId: regionAccountId,
        currentBalance: balance,
        entries,
        summary: {
          totalIn,
          totalOut,
          netAmount: totalIn - totalOut,
          byOrigin,
          byContext,
          byPeriod,
        },
      };
    } finally {
      client.release();
    }
  }

  /**
   * Helper: obtém userId a partir de globalUserId
   */
  private async getUserIdFromGlobalId(
    tenantId: string,
    globalUserId: string
  ): Promise<string | null> {
    const { pool } = await import('@core/database/pool');
    const result = await pool.query<{ user_id: string }>(
      `
      SELECT user_id
      FROM users
      WHERE tenant_id = $1 AND global_user_id = $2
      LIMIT 1
      `,
      [tenantId, globalUserId]
    );

    return result.rows[0]?.user_id || null;
  }
}

export const transparencyService = new TransparencyService();















