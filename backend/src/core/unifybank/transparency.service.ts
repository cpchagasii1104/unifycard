// backend/src/core/unifybank/transparency.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de Transparência Financeira - Visualização de extratos, splits e fundos regionais
// Usa Unify Bank (bank_transactions, bank_ledger, bank_splits) como fonte da verdade

import { getClientWithTenant } from '@core/database/pool';
import { integerCentsFromDbWire } from '@modules/bank/integer-cents-from-db';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import { resolveGlobalUserId } from '@core/identity/identity.utils';

export interface StatementEntry {
  transactionId: string;
  type: 'p2p' | 'donation' | 'split' | 'compensation' | 'other';
  amountCents: number;
  direction: 'in' | 'out';
  balanceAfterCents: number;
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
    targetType: 'user' | 'group' | 'project' | 'regional_fund' | 'reserve' | 'platform';
    targetId?: string;
    percentage: number;
    amountCents: number;
    createdAt: Date;
  }>;
  totalPercentage: number;
  totalAmountCents: number;
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
  currentBalanceCents: number;
  entries: RegionalFundEntry[];
  summary: {
    totalInCents: number;
    totalOutCents: number;
    netAmountCents: number;
  };
}

export interface RegionalFundAdminView {
  regionId: string;
  accountId: string;
  currentBalanceCents: number;
  entries: RegionalFundEntry[];
  summary: {
    totalInCents: number;
    totalOutCents: number;
    netAmountCents: number;
    byOriginCents: Record<string, number>;
    byContextCents: Record<string, number>;
    byPeriod: Array<{
      period: string; // YYYY-MM
      totalInCents: number;
      totalOutCents: number;
    }>;
  };
}

class TransparencyService {
  private buildSplitAccountMap(rows: Array<{ account_id: string; owner_id: string; owner_type: string }>) {
    return new Map<string, { ownerId: string; ownerType: string }>(
      rows.map((a) => [a.account_id, { ownerId: a.owner_id, ownerType: a.owner_type }])
    );
  }

  private buildSplitTxRows(
    rows: Array<{
      transaction_id: string;
      target_account_id: string;
      amountCents: string;
      percentage: string | null;
      split_type: string;
      created_at: Date;
    }>,
    accountMap: Map<string, { ownerId: string; ownerType: string }>
  ) {
    interface SplitTxMetadata {
      type: string;
      splitType: string;
      targetAccountId: string;
      targetId?: string;
      targetType?: string;
      percentage: number | null;
    }

    return rows.map((split) => ({
      transaction_id: split.transaction_id,
      amountCents: integerCentsFromDbWire(split.amountCents, 'split.amountCents'),
      metadata: {
        type: 'split',
        splitType: split.split_type,
        targetAccountId: split.target_account_id,
        targetId: accountMap.get(split.target_account_id)?.ownerId,
        targetType: accountMap.get(split.target_account_id)?.ownerType,
        percentage: split.percentage ? parseFloat(split.percentage) : null,
      } as SplitTxMetadata,
      createdAt: split.created_at,
    }));
  }

  private resolveSplitDetailTargetType(
    metadata: { targetType?: string; splitType: string }
  ): SplitDetail['splits'][0]['targetType'] {
    let targetType: SplitDetail['splits'][0]['targetType'] = 'user';
    if (metadata.targetType === 'user') targetType = 'user';
    else if (metadata.targetType === 'company' || metadata.targetType === 'group') targetType = 'group';
    else if (metadata.splitType === 'regional_fund') targetType = 'regional_fund';
    else if (metadata.splitType === 'reserve') targetType = 'reserve';
    else if (metadata.splitType === 'fee') targetType = 'platform';
    return targetType;
  }

  private mapSplitDetailRow(row: {
    transaction_id: string;
    amountCents: number;
    metadata: {
      splitType: string;
      targetType?: string;
      targetId?: string;
      percentage: number | null;
    };
    createdAt: Date;
  }) {
    const metadata = row.metadata;

    return {
      transactionId: row.transaction_id,
      targetType: this.resolveSplitDetailTargetType(metadata),
      targetId: metadata.targetId,
      percentage: metadata.percentage ?? 0,
      amountCents: row.amountCents,
      createdAt: row.createdAt,
    };
  }

  private resolveRegionalFundOrigin(metadata: { type?: string; context?: string }): string {
    let origin = 'other';
    if (metadata.type === 'split' && metadata.context === 'donation') {
      origin = 'donation';
    } else if (metadata.type === 'split' && metadata.context === 'service') {
      origin = 'service';
    } else if (metadata.type === 'split' && metadata.context === 'event') {
      origin = 'event';
    }
    return origin;
  }

  private mapRegionalFundEntry(
    row: { transaction_id: string; entry_type: string; amountCents: string; created_at: Date },
    metadata: Record<string, any>
  ): RegionalFundEntry {
    return {
      transactionId: row.transaction_id,
      type: row.entry_type as 'credit' | 'debit',
      amountCents: integerCentsFromDbWire(row.amountCents, 'regionalFund.amountCents'),
      origin: this.resolveRegionalFundOrigin(metadata),
      originTransactionId: metadata.originTransactionId,
      destination: metadata.targetId,
      context: metadata.context,
      createdAt: row.created_at,
      metadata,
    };
  }

  /**
   * Obtém extrato financeiro do usuário
   * Usa dados do bank_ledger (fonte da verdade do Unify Bank)
   */
  async getUserStatement(
    tenantId: string,
    globalUserId: string,
    options: { limit?: number; offset?: number; startDate?: Date; endDate?: Date } = {}
  ): Promise<StatementResult> {
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
      return { entries: [], totalCents: 0, hasMore: false };
    }
    return this._getStatementForAccount(tenantId, userAccount.accountId, options);
  }

  /**
   * 2026-05-18 P1 — Bank actor-context.
   * Obtém extrato financeiro por actor. Resolve actor → conta apropriada
   * (user/page/group) e delega para _getStatementForAccount.
   *
   * Authority do user sobre o actor DEVE ser validada pelo caller ANTES
   * (via actorCapabilitiesService). Este método apenas resolve actor → conta.
   */
  async getActorStatement(
    tenantId: string,
    actorId: string,
    options: { limit?: number; offset?: number; startDate?: Date; endDate?: Date } = {}
  ): Promise<StatementResult> {
    const client = await getClientWithTenant(tenantId);
    let actorRow: { actor_type: string; user_id: string | null; company_id: string | null; group_id: string | null } | null = null;
    try {
      const r = await client.query<{
        actor_type: string;
        user_id: string | null;
        company_id: string | null;
        group_id: string | null;
      }>(
        `SELECT actor_type, user_id, company_id, group_id FROM actors WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1`,
        [tenantId, actorId]
      );
      actorRow = r.rows[0] ?? null;
    } finally {
      client.release();
    }
    if (!actorRow) {
      return { entries: [], totalCents: 0, hasMore: false };
    }
    const bankAccount = bankPortsRegistry.getBankAccount();
    let account = null as Awaited<ReturnType<typeof bankAccount.getAccountByOwner>> | null;
    if (actorRow.actor_type === 'user' && actorRow.user_id) {
      account = await bankAccount.getAccountByOwner(tenantId, actorRow.user_id, 'user', 'BRL');
    } else if (actorRow.actor_type === 'page' && actorRow.company_id) {
      account = await bankAccount.getAccountByOwner(tenantId, actorRow.company_id, 'company', 'BRL');
    } else if (actorRow.actor_type === 'group' && actorRow.group_id) {
      account = await bankAccount.getAccountByOwner(tenantId, actorRow.group_id, 'company', 'BRL');
    }
    if (!account) {
      return { entries: [], totalCents: 0, hasMore: false };
    }
    return this._getStatementForAccount(tenantId, account.accountId, options);
  }

  /**
   * Helper privado — query SQL de extrato para um accountId resolvido.
   * Compartilhado por getUserStatement e getActorStatement.
   * Não duplica lógica; refator localizado para suporte de actor-context.
   */
  private async _getStatementForAccount(
    tenantId: string,
    accountId: string,
    options: { limit?: number; offset?: number; startDate?: Date; endDate?: Date }
  ): Promise<StatementResult> {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    // Buscar entradas do bank_ledger para essa conta
    const client = await getClientWithTenant(tenantId);

    try {
      // Etapa 1.5 — schema vigente:
      //   bank_ledger.id (não entry_id), direction (não entry_type), amount_cents (não amount)
      //   bank_transactions.id (não transaction_id), concept_id (proxy de transaction_type)
      //   status: derivado de internal_completed_at IS NOT NULL
      //   original_transaction_id: extraído de metadata->>'originTransactionId'
      //   balance_after: running sum window por conta (não persistido)
      let query = `
        SELECT
          l.id AS entry_id,
          l.transaction_id,
          l.direction AS entry_type,
          l.amount_cents AS "amountCents",
          SUM(CASE WHEN l.direction = 'credit' THEN l.amount_cents ELSE -l.amount_cents END)
            OVER (PARTITION BY l.account_id ORDER BY l.created_at ASC, l.id ASC ROWS UNBOUNDED PRECEDING) AS balance_after,
          l.created_at,
          t.metadata as transaction_metadata,
          CASE WHEN t.internal_completed_at IS NOT NULL THEN 'completed' ELSE 'pending' END AS status,
          t.concept_id AS transaction_type,
          (t.metadata->>'originTransactionId') AS original_transaction_id
        FROM bank_ledger l
        INNER JOIN bank_transactions t ON t.id = l.transaction_id
        WHERE l.account_id = $1 AND l.tenant_id = $2
      `;

      const params: any[] = [accountId, tenantId];
      let paramIndex = 3;

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
        amountCents: string;
        balance_after: string;
        created_at: Date;
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
          amountCents: integerCentsFromDbWire(row.amountCents, 'ledger.amountCents'),
          direction: (entryType === 'credit' ? 'in' : 'out') as 'in' | 'out',
          balanceAfterCents: integerCentsFromDbWire(row.balance_after, 'ledger.balance_after'),
          createdAt: row.created_at,
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
      // 1. Buscar transação base no Unify Bank (Etapa 1.5 — schema vigente: id, amount_cents)
      const baseTx = await client.query<{
        transaction_id: string;
        amountCents: string;
        metadata: any;
        created_at: Date;
      }>(
        `
        SELECT id AS transaction_id, amount_cents AS "amountCents", metadata, created_at
        FROM bank_transactions
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [transactionId, tenantId]
      );

      if (baseTx.rows.length === 0) {
        return null;
      }

      const base = baseTx.rows[0];
      const baseMetadata = base.metadata || {};

      // Etapa 1.5 — removido short-circuit baseado em metadata.splitGroupId (vestígio do schema antigo
      // onde splits eram transações separadas agregadas por splitGroupId). DECISION-0036 estabeleceu
      // bank_splits como tabela soberana linkada via bank_splits.transaction_id; basta consultar
      // diretamente. Transações sem splits retornam splits=[] naturalmente pela query.

      // 2. Buscar todos os splits da transação no Unify Bank (Etapa 1.5 — schema vigente: id, amount_cents)
      // No Unify Bank, splits estão na tabela bank_splits, não em transações separadas
      const splits = await client.query<{
        split_id: string;
        transaction_id: string;
        target_account_id: string;
        amountCents: string;
        percentage: string | null;
        split_type: string;
        created_at: Date;
      }>(
        `
        SELECT id AS split_id, transaction_id, target_account_id, amount_cents AS "amountCents", percentage, split_type, created_at
        FROM bank_splits
        WHERE tenant_id = $1 AND transaction_id = $2
        ORDER BY created_at ASC
        `,
        [tenantId, transactionId]
      );

      // Buscar informações das contas de destino dos splits (Etapa 1.5 — bank_accounts.id)
      const splitAccountIds = splits.rows.map((s) => s.target_account_id);
      type SplitAccountRow = { account_id: string; owner_id: string; owner_type: string };
      const splitAccounts: { rows: SplitAccountRow[] } = splitAccountIds.length > 0
        ? await client.query<SplitAccountRow>(
            `
            SELECT id AS account_id, owner_id, owner_type
            FROM bank_accounts
            WHERE id = ANY($1::uuid[]) AND tenant_id = $2
            `,
            [splitAccountIds, tenantId]
          )
        : { rows: [] };

      const accountMap = this.buildSplitAccountMap(splitAccounts.rows);
      const splitTxs = this.buildSplitTxRows(splits.rows, accountMap);
      const splitDetails = splitTxs.map((row) => this.mapSplitDetailRow(row));

      const totalPercentage = splitDetails.reduce((sum, s) => sum + s.percentage, 0);
      const totalAmountCents = splitDetails.reduce((sum, s) => sum + s.amountCents, 0);

      return {
        baseTransaction: {
          transactionId: base.transaction_id,
          amountCents: integerCentsFromDbWire(base.amountCents, 'base.amountCents'),
          type: baseMetadata.type || 'other',
          createdAt: base.created_at,
          metadata: baseMetadata,
        },
        splits: splitDetails,
        totalPercentage,
        totalAmountCents,
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
    // F-C1-HOME-READ-SEAL (CP7): o adapter LANÇA quando a conta de sistema não existe (fail-closed,
    // correto para WRITERS de money). Neste READER, fundo não configurado no tenant = AUSÊNCIA
    // legítima → null (200 regionalFund:null), não erro estrutural. O throw do adapter fica intacto.
    const bankAccount = bankPortsRegistry.getBankAccount();
    let regionalFundAccount: Awaited<ReturnType<typeof bankAccount.getSystemAccount>> | null = null;
    try {
      regionalFundAccount = await bankAccount.getSystemAccount(tenantId, 'regional_fund', 'BRL');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not found/i.test(msg)) {
        regionalFundAccount = null; // ausência honesta (fundo não configurado neste tenant)
      } else {
        throw err; // erro estrutural real continua observável
      }
    }

    if (!regionalFundAccount) {
      return null; // Não há fundo regional para esse usuário
    }

    const regionAccountId = regionalFundAccount.accountId;

    // 3. Obter saldo atual do Unify Bank
    const balance = await bankAccount.getBalance(tenantId, regionAccountId);

    // 4. Buscar movimentações do bank_ledger
    const client = await getClientWithTenant(tenantId);

    try {
      // Etapa 1.5 — schema vigente: bank_ledger.direction (não entry_type), amount_cents (não amount)
      const ledgerEntries = await client.query<{
        transaction_id: string;
        entry_type: string;
        amountCents: string;
        created_at: Date;
      }>(
        `
        SELECT l.transaction_id, l.direction AS entry_type, l.amount_cents AS "amountCents", l.created_at
        FROM bank_ledger l
        WHERE l.account_id = $1 AND l.tenant_id = $2
        ORDER BY l.created_at DESC
        LIMIT $3 OFFSET $4
        `,
        [regionAccountId, tenantId, limit, offset]
      );

      // 5. Buscar metadados das transações do Unify Bank (Etapa 1.5 — bank_transactions.id é UUID)
      const transactionIds = ledgerEntries.rows.map((r) => r.transaction_id);
      const transactions = transactionIds.length > 0
        ? await client.query<{
            transaction_id: string;
            metadata: any;
          }>(
            `
            SELECT id AS transaction_id, metadata
            FROM bank_transactions
            WHERE id = ANY($1::uuid[]) AND tenant_id = $2
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
        const metadata = (txMap.get(row.transaction_id) || {}) as TransactionMetadata;
        return this.mapRegionalFundEntry(row, metadata as Record<string, any>);
      });

      const totalInCents = entries
        .filter((e) => e.type === 'credit')
        .reduce((sum, e) => sum + e.amountCents, 0);
      const totalOutCents = entries
        .filter((e) => e.type === 'debit')
        .reduce((sum, e) => sum + e.amountCents, 0);

      return {
        accountId: regionAccountId,
        currentBalanceCents: balance.balanceCents,
        entries,
        summary: {
          totalInCents,
          totalOutCents,
          netAmountCents: totalInCents - totalOutCents,
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
      // Etapa 1.5 — schema vigente: bank_ledger.direction/amount_cents; JOIN via bank_transactions.id
      let query = `
        SELECT
          l.transaction_id,
          l.direction AS entry_type,
          l.amount_cents AS "amountCents",
          l.created_at,
          t.metadata
        FROM bank_ledger l
        INNER JOIN bank_transactions t ON t.id = l.transaction_id
        WHERE l.account_id = $1 AND l.tenant_id = $2
      `;

      const params: any[] = [regionAccountId, tenantId];
      let paramIndex = 3;

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
        amountCents: string;
        created_at: Date;
        metadata: any;
      }>(query, params);

      const entries: RegionalFundEntry[] = ledgerEntries.rows.map((row) => {
        const metadata = (row.metadata || {}) as Record<string, any>;
        return this.mapRegionalFundEntry(row, metadata);
      });

      // 4. Calcular agregações
      const totalInCents = entries
        .filter((e) => e.type === 'credit')
        .reduce((sum, e) => sum + e.amountCents, 0);
      const totalOutCents = entries
        .filter((e) => e.type === 'debit')
        .reduce((sum, e) => sum + e.amountCents, 0);

      // Agrupar por origem (valores em centavos — sufixo Cents no nome do campo)
      const byOriginCents: Record<string, number> = {};
      entries
        .filter((e) => e.type === 'credit')
        .forEach((e) => {
          byOriginCents[e.origin] = (byOriginCents[e.origin] || 0) + e.amountCents;
        });

      // Agrupar por contexto (valores em centavos — sufixo Cents no nome do campo)
      const byContextCents: Record<string, number> = {};
      entries
        .filter((e) => e.type === 'credit')
        .forEach((e) => {
          const ctx = e.context || 'other';
          byContextCents[ctx] = (byContextCents[ctx] || 0) + e.amountCents;
        });

      // Agrupar por período (mensal — valores em centavos)
      const byPeriodMap = new Map<string, { in: number; out: number }>();
      entries.forEach((e) => {
        const period = e.createdAt.toISOString().substring(0, 7); // YYYY-MM
        const current = byPeriodMap.get(period) || { in: 0, out: 0 };
        if (e.type === 'credit') {
          current.in += e.amountCents;
        } else {
          current.out += e.amountCents;
        }
        byPeriodMap.set(period, current);
      });

      const byPeriod = Array.from(byPeriodMap.entries())
        .map(([period, data]) => ({
          period,
          totalInCents: data.in,
          totalOutCents: data.out,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      return {
        regionId,
        accountId: regionAccountId,
        currentBalanceCents: balance.balanceCents,
        entries,
        summary: {
          totalInCents,
          totalOutCents,
          netAmountCents: totalInCents - totalOutCents,
          byOriginCents,
          byContextCents,
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



























