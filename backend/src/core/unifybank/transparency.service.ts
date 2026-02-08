// backend/src/core/unifybank/transparency.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de Transparência Financeira - Visualização de extratos, splits e fundos regionais
// Usa Unify Bank (bank_transactions, bank_ledger, bank_splits) como fonte da verdade

import { getClientWithTenant } from '@core/database/pool';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import { resolveGlobalUserId } from '@core/identity/identity.utils';

export interface StatementEntry {
  transactionId: string;
  type: 'p2p' | 'donation' | 'split' | 'compensation' | 'other';
  amountCents: number;
  direction: 'in' | 'out';
  balanceAfter: number;
  createdAt: Date;
  context?: string; // event_ticket, service_booking, ride_payment, donation, p2p_transfer, etc.
  status?: 'completed' | 'reversed' | 'pending' | 'failed';
  referenceType?: string; // event, booking, ride, group, etc.
  referenceId?: string; // ID da referência
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
  totalCents: number;
  hasMore: boolean;
}

export interface SplitDetail {
  baseTransaction: {
    transactionId: string;
    amountCents: number;
    type: string;
    createdAt: Date;
    metadata: Record<string, any>;
  };
  splits: Array<{
    transactionId: string;
    targetType: 'user' | 'group' | 'project' | 'regional_fund' | 'platform';
    targetId?: string;
    percentage: number;
    amountCents: number;
    createdAt: Date;
  }>;
  totalPercentage: number;
  totalAmount: number;
}

export interface RegionalFundEntry {
  transactionId: string;
  type: 'credit' | 'debit';
  amountCents: number;
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
   * Usa dados do bank_ledger (fonte da verdade do Unify Bank)
   */
  async getUserStatement(
    tenantId: string,
    globalUserId: string,
    options: { limit?: number; offset?: number; startDate?: Date; endDate?: Date } = {}
  ): Promise<StatementResult> {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    // 1. Resolver conta principal do usuário no Unify Bank
    const userId = await this.getUserIdFromGlobalId(tenantId, globalUserId);
    if (!userId) {
      throw new Error('User not found');
    }

    // Verificar se conta existe no Unify Bank
    const bankAccount = bankPortsRegistry.getBankAccount();
    const userAccount = await bankAccount.getAccountByOwner(tenantId, userId, 'user', 'BRL');
    if (!userAccount) {
      // Sem conta bancária: retornar extrato vazio (não é erro)
      return {
        entries: [],
        totalCents: 0,
        hasMore: false,
      };
    }

    const accountId = userAccount.accountId;

    // 2. Buscar entradas do bank_ledger para essa conta
    const client = await getClientWithTenant(tenantId);

    try {
      let query = `
        SELECT 
          l.entry_id,
          l.transaction_id,
          l.entry_type,
          l.amount,
          l.balance_after,
          l.createdAt,
          t.metadata as transaction_metadata,
          t.status,
          t.transaction_type,
          t.original_transaction_id
        FROM bank_ledger l
        INNER JOIN bank_transactions t ON t.transaction_id = l.transaction_id
        WHERE l.account_id = $1 AND l.tenant_id = $2
      `;

      const params: any[] = [accountId, tenantId];
      let paramIndex = 3;

      if (startDate) {
        query += ` AND l.createdAt >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND l.createdAt <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY l.createdAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit + 1, offset); // +1 para verificar se tem mais

      const result = await client.query<{
        entry_id: string;
        transaction_id: string;
        entry_type: string;
        amountCents: string;
        balance_after: string;
        createdAt: Date;
        transaction_metadata: any;
        status: string;
        transaction_type: string;
        original_transaction_id: string | null;
      }>(query, params);

      const hasMore = result.rows.length > limit;
      const entries = result.rows.slice(0, limit).map((row) => {
        const metadata = row.transaction_metadata || {};
        const entryType = row.entry_type as 'credit' | 'debit';

        // Determinar tipo da transação (legacy para compatibilidade)
        let type: StatementEntry['type'] = 'other';
        if (metadata.type === 'p2p_transfer') type = 'p2p';
        else if (metadata.type === 'donation') type = 'donation';
        else if (metadata.type === 'split') type = 'split';
        else if (metadata.type === 'compensation') type = 'compensation';

        // Extrair context do metadata (ou inferir do transaction_type)
        let context: string | undefined = metadata.context;
        if (!context) {
          // Inferir context do metadata.type ou transaction_type
          if (metadata.type === 'event_ticket' || metadata.type === 'event_consumption') context = 'event_ticket';
          else if (metadata.type === 'service_booking') context = 'service_booking';
          else if (metadata.type === 'ride_payment') context = 'ride_payment';
          else if (metadata.type === 'p2p_transfer') context = 'p2p_transfer';
          else if (metadata.type === 'donation') context = 'donation';
          else if (metadata.type === 'group_contribution') context = 'group_contribution';
          else if (row.transaction_type === 'deposit') context = 'deposit';
          else if (row.transaction_type === 'withdrawal') context = 'withdrawal';
        }

        // Determinar status (completed ou reversed)
        const status = row.original_transaction_id ? 'reversed' : (row.status === 'completed' ? 'completed' : row.status);

        // Determinar reference_type e reference_id do metadata
        let referenceType: string | undefined;
        let referenceId: string | undefined;
        
        if (metadata.eventId) {
          referenceType = 'event';
          referenceId = metadata.eventId;
        } else if (metadata.bookingId) {
          referenceType = 'booking';
          referenceId = metadata.bookingId;
        } else if (metadata.rideId) {
          referenceType = 'ride';
          referenceId = metadata.rideId;
        } else if (metadata.groupId) {
          referenceType = 'group';
          referenceId = metadata.groupId;
        } else if (metadata.targetId && metadata.targetType) {
          referenceType = metadata.targetType;
          referenceId = metadata.targetId;
        }

        return {
          transactionId: row.transaction_id,
          type,
          amountCents: parseFloat(row.amount),
          direction: (entryType === 'credit' ? 'in' : 'out') as 'in' | 'out',
          balanceAfter: parseFloat(row.balance_after),
          createdAt: row.createdAt,
          context: context || 'other',
          status: status as 'completed' | 'reversed' | 'pending' | 'failed',
          referenceType,
          referenceId,
          metadata: {
            type: metadata.type,
            targetType: metadata.targetType,
            targetId: metadata.targetId,
            originTransactionId: metadata.originTransactionId,
            splitGroupId: metadata.splitGroupId,
            message: metadata.message,
            context,
            eventId: metadata.eventId,
            bookingId: metadata.bookingId,
            rideId: metadata.rideId,
            groupId: metadata.groupId,
          },
        };
      });

      return {
        entries,
        totalCents: entries.length,
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
      // 1. Buscar transação base no Unify Bank
      const baseTx = await client.query<{
        transaction_id: string;
        amountCents: string;
        metadata: any;
        createdAt: Date;
      }>(
        `
        SELECT transaction_id, amount, metadata, createdAt
        FROM bank_transactions
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
            amountCents: parseFloat(base.amount),
            type: baseMetadata.type || 'other',
            createdAt: base.createdAt,
            metadata: baseMetadata,
          },
          splits: [],
          totalPercentage: 0,
          totalAmount: 0,
        };
      }

      // 2. Buscar todos os splits da transação no Unify Bank
      // No Unify Bank, splits estão na tabela bank_splits, não em transações separadas
      const splits = await client.query<{
        split_id: string;
        transaction_id: string;
        target_account_id: string;
        amountCents: string;
        percentage: string | null;
        split_type: string;
        createdAt: Date;
      }>(
        `
        SELECT split_id, transaction_id, target_account_id, amount, percentage, split_type, createdAt
        FROM bank_splits
        WHERE tenant_id = $1 AND transaction_id = $2
        ORDER BY createdAt ASC
        `,
        [tenantId, transactionId]
      );

      // Buscar informações das contas de destino dos splits
      const splitAccountIds = splits.rows.map((s) => s.target_account_id);
      const splitAccounts = splitAccountIds.length > 0
        ? await client.query<{
            account_id: string;
            owner_id: string;
            owner_type: string;
          }>(
            `
            SELECT account_id, owner_id, owner_type
            FROM bank_accounts
            WHERE account_id = ANY($1::text[]) AND tenant_id = $2
            `,
            [splitAccountIds, tenantId]
          )
        : { rows: [] };

      const accountMap = new Map(
        splitAccounts.rows.map((a) => [a.account_id, { ownerId: a.owner_id, ownerType: a.owner_type }])
      );

      const splitTxs = splits.rows.map((split) => ({
        transaction_id: split.transaction_id,
        amountCents: split.amount,
        metadata: {
          type: 'split',
          splitType: split.split_type,
          targetAccountId: split.target_account_id,
          targetId: accountMap.get(split.target_account_id)?.ownerId,
          targetType: accountMap.get(split.target_account_id)?.ownerType,
          percentage: split.percentage ? parseFloat(split.percentage) : null,
        },
        createdAt: split.createdAt,
      }));

      const splitDetails = splitTxs.map((row) => {
        const metadata = row.metadata || {};
        // Mapear owner_type para targetType compatível
        let targetType: SplitDetail['splits'][0]['targetType'] = 'user';
        if (metadata.targetType === 'user') targetType = 'user';
        else if (metadata.targetType === 'company' || metadata.targetType === 'group') targetType = 'group';
        else if (metadata.splitType === 'regional_fund') targetType = 'regional_fund';
        else if (metadata.splitType === 'fee') targetType = 'platform';

        return {
          transactionId: row.transaction_id,
          targetType,
          targetId: metadata.targetId,
          percentage: metadata.percentage || 0,
          amountCents: parseFloat(row.amount),
          createdAt: row.createdAt,
        };
      });

      const totalPercentage = splitDetails.reduce((sum, s) => sum + s.percentage, 0);
      const totalAmount = splitDetails.reduce((sum, s) => sum + s.amount, 0);

      return {
        baseTransaction: {
          transactionId: base.transaction_id,
          amountCents: parseFloat(base.amount),
          type: baseMetadata.type || 'other',
          createdAt: base.createdAt,
          metadata: baseMetadata,
        },
        splits: splitDetails,
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

    // 2. Resolver conta regional no Unify Bank (conta de sistema regional_fund)
    // Buscar conta regional_fund do sistema para a região do usuário
    const bankAccount = bankPortsRegistry.getBankAccount();
    const regionalFundAccount = await bankAccount.getSystemAccount(tenantId, 'regional_fund', 'BRL');

    if (!regionalFundAccount) {
      return null; // Não há fundo regional para esse usuário
    }

    const regionAccountId = regionalFundAccount.accountId;

    // 3. Obter saldo atual do Unify Bank
    const balance = await bankAccount.getBalance(tenantId, regionAccountId);

    // 4. Buscar movimentações do bank_ledger
    const client = await getClientWithTenant(tenantId);

    try {
      const ledgerEntries = await client.query<{
        transaction_id: string;
        entry_type: string;
        amountCents: string;
        createdAt: Date;
      }>(
        `
        SELECT l.transaction_id, l.entry_type, l.amount, l.createdAt
        FROM bank_ledger l
        WHERE l.account_id = $1 AND l.tenant_id = $2
        ORDER BY l.createdAt DESC
        LIMIT $3 OFFSET $4
        `,
        [regionAccountId, tenantId, limit, offset]
      );

      // 5. Buscar metadados das transações do Unify Bank
      const transactionIds = ledgerEntries.rows.map((r) => r.transaction_id);
      const transactions = transactionIds.length > 0
        ? await client.query<{
            transaction_id: string;
            metadata: any;
          }>(
            `
            SELECT transaction_id, metadata
            FROM bank_transactions
            WHERE transaction_id = ANY($1::text[]) AND tenant_id = $2
            `,
            [transactionIds, tenantId]
          )
        : { rows: [] };

      interface TransactionMetadata {
        type?: string;
        context?: string;
        originTransactionId?: string;
        targetId?: string;
      }

      const txMap = new Map<string, TransactionMetadata>();
      transactions.rows.forEach((tx) => {
        txMap.set(tx.transaction_id, (tx.metadata || {}) as TransactionMetadata);
      });

      const entries: RegionalFundEntry[] = ledgerEntries.rows.map((row) => {
        const metadata = txMap.get(row.transaction_id) || {} as TransactionMetadata;
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
          amountCents: parseFloat(row.amount),
          origin,
          originTransactionId: metadata.originTransactionId,
          destination: metadata.targetId,
          context: metadata.context,
          createdAt: row.createdAt,
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

    // 1. Resolver conta regional no Unify Bank (conta de sistema regional_fund)
    const bankAccount = bankPortsRegistry.getBankAccount();
    const regionalFundAccount = await bankAccount.getSystemAccount(tenantId, 'regional_fund', 'BRL');

    if (!regionalFundAccount) {
      return null; // Não há conta regional para essa região
    }

    const regionAccountId = regionalFundAccount.accountId;

    // 2. Obter saldo atual do Unify Bank
    const balance = await bankAccount.getBalance(tenantId, regionAccountId);

    // 3. Buscar todas as movimentações do bank_ledger
    const client = await getClientWithTenant(tenantId);

    try {
      let query = `
        SELECT 
          l.transaction_id,
          l.entry_type,
          l.amount,
          l.createdAt,
          t.metadata
        FROM bank_ledger l
        INNER JOIN bank_transactions t ON t.transaction_id = l.transaction_id
        WHERE l.account_id = $1 AND l.tenant_id = $2
      `;

      const params: any[] = [regionAccountId, tenantId];
      let paramIndex = 3;

      if (startDate) {
        query += ` AND l.createdAt >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND l.createdAt <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY l.createdAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const ledgerEntries = await client.query<{
        transaction_id: string;
        entry_type: string;
        amountCents: string;
        createdAt: Date;
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
          amountCents: parseFloat(row.amount),
          origin,
          originTransactionId: metadata.originTransactionId,
          destination: metadata.targetId,
          context: metadata.context,
          createdAt: row.createdAt,
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



























