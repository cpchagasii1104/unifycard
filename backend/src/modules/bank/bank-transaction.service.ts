// backend/src/modules/bank/bank-transaction.service.ts
// SPRINT 2: TRANSACTIONS + SPLIT ENGINE
// Service para transações do Unify Bank

import { v4 as uuidv4 } from 'uuid';
import { getClientWithTenant } from '@core/database/pool';
import { bankAccountRepository } from './bank-account.repository';
import { bankLedgerRepository } from './bank-ledger.repository';
import { bankSplitRepository } from './bank-split.repository';
import { bankSplitEngineService } from './bank-split-engine.service';
import { bankMetricsService } from '@core/observability/bank-metrics.service';
import type { SplitPolicyMetadata } from './bank-policy.service';
import type { FinancialAuthorshipContext } from './financial-authorship.types';
import type {
  BankTransaction,
  CreateBankTransactionInput,
  BankTransferResult,
  BankCurrency,
  BankTransactionType,
} from './bank-transaction.types';
import type {
  BankTransactionContext,
  BankSplit,
  BankSplitCalculation,
} from './bank-split.types';

interface BankTransactionRow {
  transaction_id: string;
  tenant_id: string;
  event_id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  amountCents: string;
  currency: string;
  transaction_type: string;
  original_transaction_id: string | null;
  status: string;
  description: string | null;
  metadata: any;
  createdAt: Date;
  settledAt: Date | null;
}

class BankTransactionService {
  /**
   * Converte row do banco para objeto BankTransaction
   */
  private toTransaction(row: BankTransactionRow): BankTransaction {
    return {
      transactionId: row.transaction_id,
      tenantId: row.tenant_id,
      eventId: row.event_id,
      fromAccountId: row.from_account_id,
      toAccountId: row.to_account_id,
      amountCents: parseFloat(row.amount),
      currency: row.currency as BankCurrency,
      transactionType: row.transaction_type as any,
      originalTransactionId: row.original_transaction_id,
      status: row.status as any,
      description: row.description,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      settledAt: row.settledAt,
    };
  }

  /**
   * Executa transferência entre contas
   * 
   * REGRAS ARQUITETURAIS:
   * - Transação SQL atômica
   * - Validação de saldo (calculado do ledger)
   * - Double-entry no ledger
   * - Idempotência via event_id
   * - Saldo é sempre calculado do ledger
   */
  async transfer(
    tenantId: string,
    input: CreateBankTransactionInput
  ): Promise<BankTransferResult> {
    const {
      eventId = uuidv4(),
      fromAccountId,
      toAccountId,
      amount,
      currency = 'BRL',
      description,
      metadata,
    } = input;

    // Validações
    if (!fromAccountId || !toAccountId) {
      throw new Error('fromAccountId and toAccountId are required');
    }

    if (fromAccountId === toAccountId) {
      throw new Error('Cannot transfer to the same account');
    }

    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      // Verificar idempotência
      const existingTransaction = await client.query<BankTransactionRow>(
        `SELECT transaction_id FROM bank_transactions WHERE event_id = $1`,
        [eventId]
      );

      if (existingTransaction.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new Error(`Transaction with event_id ${eventId} already exists`);
      }

      // Buscar contas
      const fromAccount = await bankAccountRepository.getAccountById(tenantId, fromAccountId);
      const toAccount = await bankAccountRepository.getAccountById(tenantId, toAccountId);

      if (!fromAccount) {
        await client.query('ROLLBACK');
        throw new Error(`From account ${fromAccountId} not found`);
      }

      if (!toAccount) {
        await client.query('ROLLBACK');
        throw new Error(`To account ${toAccountId} not found`);
      }

      // Verificar moeda
      if (fromAccount.currency !== currency || toAccount.currency !== currency) {
        await client.query('ROLLBACK');
        throw new Error('Currency mismatch');
      }

      // Calcular saldo atual do ledger (FONTE DA VERDADE)
      const fromBalance = await bankLedgerRepository.calculateBalance(tenantId, fromAccountId);
      const toBalance = await bankLedgerRepository.calculateBalance(tenantId, toAccountId);

      // Validar saldo suficiente
      if (fromBalance.balance < amount) {
        await client.query('ROLLBACK');
        throw new Error(`Insufficient balance. Available: ${fromBalance.balance}, Required: ${amount}`);
      }

      // Criar transação
      const transactionResult = await client.query<BankTransactionRow>(
        `
        INSERT INTO bank_transactions (
          tenant_id, event_id, from_account_id, to_account_id,
          amount, currency, transaction_type, status, description, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'transfer', 'completed', $7, $8)
        RETURNING transaction_id, tenant_id, event_id, from_account_id, to_account_id,
                  amount, currency, transaction_type, original_transaction_id,
                  status, description, metadata, createdAt, settledAt
        `,
        [
          tenantId,
          eventId,
          fromAccountId,
          toAccountId,
          amount,
          currency,
          description || null,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );

      const transaction = this.toTransaction(transactionResult.rows[0]);

      // Calcular novos saldos
      const fromBalanceAfter = fromBalance.balance - amount;
      const toBalanceAfter = toBalance.balance + amount;

      // Criar entradas no ledger (double-entry)
      const fromEntry = await bankLedgerRepository.createEntry(tenantId, {
        accountId: fromAccountId,
        transactionId: transaction.transactionId,
        entryType: 'debit',
        amount,
        balanceBefore: fromBalance.balance,
        balanceAfter: fromBalanceAfter,
        description: description || `Transfer to ${toAccountId}`,
        metadata,
      });

      const toEntry = await bankLedgerRepository.createEntry(tenantId, {
        accountId: toAccountId,
        transactionId: transaction.transactionId,
        entryType: 'credit',
        amount,
        balanceBefore: toBalance.balance,
        balanceAfter: toBalanceAfter,
        description: description || `Transfer from ${fromAccountId}`,
        metadata,
      });

      // Atualizar cached_balance (apenas cache)
      await bankAccountRepository.updateCachedBalance(tenantId, fromAccountId, fromBalanceAfter);
      await bankAccountRepository.updateCachedBalance(tenantId, toAccountId, toBalanceAfter);

      // Marcar transação como settled
      await client.query(
        `UPDATE bank_transactions SET settledAt = NOW() WHERE transaction_id = $1`,
        [transaction.transactionId]
      );

      await client.query('COMMIT');

      return {
        transactionId: transaction.transactionId,
        fromAccountId,
        toAccountId,
        amount,
        currency,
        fromBalance: fromBalanceAfter,
        toBalance: toBalanceAfter,
        ledgerEntries: {
          fromEntry: fromEntry.entryId,
          toEntry: toEntry.entryId,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Busca transação por ID
   */
  async getTransactionById(
    tenantId: string,
    transactionId: string
  ): Promise<BankTransaction | null> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<BankTransactionRow>(
        `
        SELECT transaction_id, tenant_id, event_id, from_account_id, to_account_id,
               amount, currency, transaction_type, original_transaction_id,
               status, description, metadata, createdAt, settledAt
        FROM bank_transactions
        WHERE transaction_id = $1
        LIMIT 1
        `,
        [transactionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.toTransaction(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Cria transação simples (sem splits)
   * 
   * REGRAS ARQUITETURAIS:
   * - Transação SQL atômica
   * - Validação de saldo (calculado do ledger)
   * - Double-entry no ledger
   * - Idempotência via event_id
   */
  async createSimpleTransaction(
    tenantId: string,
    input: {
      eventId: string;
      fromAccountId?: string;
      toAccountId?: string;
      amountCents: number;
      currency?: BankCurrency;
      transactionType: BankTransactionType;
      description?: string;
      metadata?: Record<string, any>;
      /**
       * Contexto de autoria (OBRIGATÓRIO - REGRA INQUEBRÁVEL)
       * Hard fail no código se não fornecido
       */
      authorship: FinancialAuthorshipContext;
    }
  ): Promise<{
    transaction: BankTransaction;
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    const {
      eventId,
      fromAccountId,
      toAccountId,
      amount,
      currency = 'BRL',
      transactionType,
      description,
      metadata,
      authorship,
    } = input;

    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    // 🔴 HARD FAIL: Autoria obrigatória (REGRA INQUEBRÁVEL)
    if (!authorship) {
      throw new Error('Financial authorship is mandatory. Missing authorship context.');
    }

    return this.createSimpleTransactionWithAuthorship(tenantId, input);
  }

  /**
   * Cria transação simples com autoria (método interno)
   */
  private async createSimpleTransactionWithAuthorship(
    tenantId: string,
    input: {
      eventId: string;
      fromAccountId?: string;
      toAccountId?: string;
      amountCents: number;
      currency?: BankCurrency;
      transactionType: BankTransactionType;
      description?: string;
      metadata?: Record<string, any>;
      authorship: FinancialAuthorshipContext; // Agora obrigatório
    }
  ): Promise<{
    transaction: BankTransaction;
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    const {
      eventId,
      fromAccountId,
      toAccountId,
      amount,
      currency = 'BRL',
      transactionType,
      description,
      metadata,
      authorship,
    } = input;

    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      // Verificar idempotência
      const existingTransaction = await client.query<BankTransactionRow>(
        `SELECT transaction_id FROM bank_transactions WHERE event_id = $1`,
        [eventId]
      );

      if (existingTransaction.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new Error(`Transaction with event_id ${eventId} already exists`);
      }

      // Validar contas
      if (fromAccountId) {
        const fromAccount = await bankAccountRepository.getAccountById(tenantId, fromAccountId);
        if (!fromAccount) {
          await client.query('ROLLBACK');
          throw new Error(`From account ${fromAccountId} not found`);
        }
        if (fromAccount.currency !== currency) {
          await client.query('ROLLBACK');
          throw new Error('Currency mismatch in from account');
        }
      }

      if (toAccountId) {
        const toAccount = await bankAccountRepository.getAccountById(tenantId, toAccountId);
        if (!toAccount) {
          await client.query('ROLLBACK');
          throw new Error(`To account ${toAccountId} not found`);
        }
        if (toAccount.currency !== currency) {
          await client.query('ROLLBACK');
          throw new Error('Currency mismatch in to account');
        }
      }

      // Validar saldo se houver conta de origem
      if (fromAccountId) {
        const fromBalance = await bankLedgerRepository.calculateBalance(tenantId, fromAccountId);
        if (fromBalance.balance < amount) {
          await client.query('ROLLBACK');
          throw new Error(`Insufficient balance. Available: ${fromBalance.balance}, Required: ${amount}`);
        }
      }

      // Criar transação com autoria
      const transactionResult = await client.query<BankTransactionRow>(
        `
        INSERT INTO bank_transactions (
          tenant_id, event_id, from_account_id, to_account_id,
          amount, currency, transaction_type, status, description, metadata,
          performed_by_user_id, acting_for_actor_id, acting_for_account_id,
          authority_source, permission_snapshot, policy_snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING transaction_id, tenant_id, event_id, from_account_id, to_account_id,
                  amount, currency, transaction_type, original_transaction_id,
                  status, description, metadata, createdAt, settledAt
        `,
        [
          tenantId,
          eventId,
          fromAccountId || null,
          toAccountId || null,
          amount,
          currency,
          transactionType,
          description || null,
          metadata ? JSON.stringify(metadata) : null,
          authorship.performedByUserId,
          authorship.actingForActorId,
          authorship.actingForAccountId,
          authorship.authoritySource,
          authorship.permissionSnapshot ? JSON.stringify(authorship.permissionSnapshot) : null,
          authorship.policySnapshot ? JSON.stringify(authorship.policySnapshot) : null,
        ]
      );

      const transaction = this.toTransaction(transactionResult.rows[0]);
      const ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }> = [];

      // Criar entradas no ledger
      if (fromAccountId) {
        const fromBalance = await bankLedgerRepository.calculateBalance(tenantId, fromAccountId);
        const fromBalanceAfter = fromBalance.balance - amount;

        const fromEntry = await bankLedgerRepository.createEntry(tenantId, {
          accountId: fromAccountId,
          transactionId: transaction.transactionId,
          entryType: 'debit',
          amount,
          balanceBefore: fromBalance.balance,
          balanceAfter: fromBalanceAfter,
          description: description || `Transaction ${transactionType}`,
          metadata,
          authorship, // Passar autoria para ledger
        });

        ledgerEntries.push({ entryId: fromEntry.entryId, accountId: fromAccountId, entryType: 'debit' });
        await bankAccountRepository.updateCachedBalance(tenantId, fromAccountId, fromBalanceAfter);
      }

      if (toAccountId) {
        const toBalance = await bankLedgerRepository.calculateBalance(tenantId, toAccountId);
        const toBalanceAfter = toBalance.balance + amount;

        const toEntry = await bankLedgerRepository.createEntry(tenantId, {
          accountId: toAccountId,
          transactionId: transaction.transactionId,
          entryType: 'credit',
          amount,
          balanceBefore: toBalance.balance,
          balanceAfter: toBalanceAfter,
          description: description || `Transaction ${transactionType}`,
          metadata,
          authorship, // Passar autoria para ledger
        });

        ledgerEntries.push({ entryId: toEntry.entryId, accountId: toAccountId, entryType: 'credit' });
        await bankAccountRepository.updateCachedBalance(tenantId, toAccountId, toBalanceAfter);
      }

      // Marcar transação como settled
      await client.query(
        `UPDATE bank_transactions SET settledAt = NOW() WHERE transaction_id = $1`,
        [transaction.transactionId]
      );

      await client.query('COMMIT');

      return {
        transaction,
        ledgerEntries,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cria transação com splits automáticos
   * 
   * REGRAS ARQUITETURAIS:
   * - Calcula splits baseado no contexto
   * - Cria entradas no ledger para cada split
   * - Persiste splits na tabela bank_splits
   * - Valida invariantes (soma de splits = total)
   */
  async createTransactionWithSplit(
    tenantId: string,
    input: {
      eventId: string;
      fromAccountId: string;
      amountCents: number;
      currency?: BankCurrency;
      context: BankTransactionContext;
      revenueShareAccountId?: string; // Para organizer, worker, etc
      fromUserId?: string; // Para calcular referral e group allocation
      description?: string;
      metadata?: Record<string, any>;
      /**
       * Contexto de autoria (OBRIGATÓRIO - REGRA INQUEBRÁVEL)
       * Hard fail no código se não fornecido
       */
      authorship: FinancialAuthorshipContext;
    }
  ): Promise<{
    transaction: BankTransaction;
    splits: BankSplit[];
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    const {
      eventId,
      fromAccountId,
      amount,
      currency = 'BRL',
      context,
      revenueShareAccountId,
      fromUserId,
      description,
      metadata,
      authorship,
    } = input;

    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    // 🔴 HARD FAIL: Autoria obrigatória (REGRA INQUEBRÁVEL)
    if (!authorship) {
      throw new Error('Financial authorship is mandatory. Missing authorship context.');
    }

    return this.createTransactionWithSplitAndAuthorship(tenantId, input);
  }

  /**
   * Cria transação com split e autoria (método interno)
   */
  private async createTransactionWithSplitAndAuthorship(
    tenantId: string,
    input: {
      eventId: string;
      fromAccountId: string;
      amountCents: number;
      currency?: BankCurrency;
      context: BankTransactionContext;
      revenueShareAccountId?: string;
      fromUserId?: string;
      description?: string;
      metadata?: Record<string, any>;
      authorship: FinancialAuthorshipContext; // Agora obrigatório
    }
  ): Promise<{
    transaction: BankTransaction;
    splits: BankSplit[];
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    const {
      eventId,
      fromAccountId,
      amount,
      currency = 'BRL',
      context,
      revenueShareAccountId,
      fromUserId,
      description,
      metadata,
      authorship,
    } = input;

    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      // Verificar idempotência
      const existingTransaction = await client.query<BankTransactionRow>(
        `SELECT transaction_id FROM bank_transactions WHERE event_id = $1`,
        [eventId]
      );

      if (existingTransaction.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new Error(`Transaction with event_id ${eventId} already exists`);
      }

      // Validar conta de origem
      const fromAccount = await bankAccountRepository.getAccountById(tenantId, fromAccountId);
      if (!fromAccount) {
        await client.query('ROLLBACK');
        throw new Error(`From account ${fromAccountId} not found`);
      }
      if (fromAccount.currency !== currency) {
        await client.query('ROLLBACK');
        throw new Error('Currency mismatch');
      }

      // Validar saldo
      const fromBalance = await bankLedgerRepository.calculateBalance(tenantId, fromAccountId);
      if (fromBalance.balance < amount) {
        await client.query('ROLLBACK');
        throw new Error(`Insufficient balance. Available: ${fromBalance.balance}, Required: ${amount}`);
      }

      // Extrair metadata relevante para resolução hierárquica de split policies
      const splitMetadata: SplitPolicyMetadata | undefined = metadata ? {
        cityId: metadata.cityId,
        state: metadata.state,
        regionId: metadata.regionId,
        country: metadata.country,
        category: metadata.category,
        cnpj: metadata.cnpj,
        storeId: metadata.storeId,
        channel: metadata.channel,
        campaignId: metadata.campaignId,
      } : undefined;

      // Calcular splits (com referral e group allocation se fromUserId fornecido)
      // Metadata é passado para resolução hierárquica de policies
      const splitCalculation = await bankSplitEngineService.calculateSplits(
        tenantId,
        context,
        amount,
        currency,
        revenueShareAccountId,
        fromUserId,
        splitMetadata
      );

      // Validar cálculo de splits
      if (!bankSplitEngineService.validateSplitCalculation(splitCalculation)) {
        await client.query('ROLLBACK');
        bankMetricsService.incrementValidationFailure();
        throw new Error('Split calculation validation failed');
      }

      // Incrementar métrica de transação
      bankMetricsService.incrementTransaction(context);

      // Criar transação com autoria
      const transactionResult = await client.query<BankTransactionRow>(
        `
        INSERT INTO bank_transactions (
          tenant_id, event_id, from_account_id, to_account_id,
          amount, currency, transaction_type, status, description, metadata,
          performed_by_user_id, acting_for_actor_id, acting_for_account_id,
          authority_source, permission_snapshot, policy_snapshot
        )
        VALUES ($1, $2, $3, NULL, $4, $5, 'split', 'completed', $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING transaction_id, tenant_id, event_id, from_account_id, to_account_id,
                  amount, currency, transaction_type, original_transaction_id,
                  status, description, metadata, createdAt, settledAt
        `,
        [
          tenantId,
          eventId,
          fromAccountId,
          amount,
          currency,
          description || `Transaction with split: ${context}`,
          metadata ? JSON.stringify({ ...metadata, context }) : JSON.stringify({ context }),
          authorship.performedByUserId,
          authorship.actingForActorId,
          authorship.actingForAccountId || fromAccountId, // Inferir se não fornecido
          authorship.authoritySource,
          authorship.permissionSnapshot ? JSON.stringify(authorship.permissionSnapshot) : null,
          authorship.policySnapshot ? JSON.stringify(authorship.policySnapshot) : null,
        ]
      );

      const transaction = this.toTransaction(transactionResult.rows[0]);
      const splits: BankSplit[] = [];
      const ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }> = [];

      // Criar débito na conta de origem (com autoria)
      const fromBalanceAfter = fromBalance.balance - amount;
      const fromEntry = await bankLedgerRepository.createEntry(tenantId, {
        accountId: fromAccountId,
        transactionId: transaction.transactionId,
        entryType: 'debit',
        amount,
        balanceBefore: fromBalance.balance,
        balanceAfter: fromBalanceAfter,
        description: description || `Transaction with split: ${context}`,
        metadata,
        authorship, // Passar autoria para ledger
      });

      ledgerEntries.push({ entryId: fromEntry.entryId, accountId: fromAccountId, entryType: 'debit' });
      await bankAccountRepository.updateCachedBalance(tenantId, fromAccountId, fromBalanceAfter);

      // Criar splits e créditos correspondentes
      for (const splitCalc of splitCalculation.splits) {
        // Buscar saldo atual da conta destino
        const targetBalance = await bankLedgerRepository.calculateBalance(tenantId, splitCalc.targetAccountId);
        const targetBalanceAfter = targetBalance.balance + splitCalc.amount;

        // Criar entrada no ledger (com autoria)
        const creditEntry = await bankLedgerRepository.createEntry(tenantId, {
          accountId: splitCalc.targetAccountId,
          transactionId: transaction.transactionId,
          entryType: 'credit',
          amountCents: splitCalc.amount,
          balanceBefore: targetBalance.balance,
          balanceAfter: targetBalanceAfter,
          description: description || `Split: ${splitCalc.splitType}`,
          metadata: { ...metadata, splitType: splitCalc.splitType },
          authorship, // Passar autoria para ledger
        });

        ledgerEntries.push({ entryId: creditEntry.entryId, accountId: splitCalc.targetAccountId, entryType: 'credit' });
        await bankAccountRepository.updateCachedBalance(tenantId, splitCalc.targetAccountId, targetBalanceAfter);

        // Criar split (com autoria)
        const split = await bankSplitRepository.createSplit(tenantId, {
          transactionId: transaction.transactionId,
          targetAccountId: splitCalc.targetAccountId,
          amountCents: splitCalc.amount,
          percentage: splitCalc.percentage,
          splitType: splitCalc.splitType,
          description: description || `Split: ${splitCalc.splitType}`,
          metadata: { 
            ...metadata, 
            splitType: splitCalc.splitType,
            ...(splitCalc.metadata || {}), // Incluir metadata do split engine (ex: groupId)
          },
          authorship, // Passar autoria para split
        });

        splits.push(split);
      }

      // Validar que soma dos splits = total
      const validation = await bankSplitRepository.validateSplitsSum(tenantId, transaction.transactionId, amount);
      if (!validation.isValid) {
        await client.query('ROLLBACK');
        throw new Error(`Split validation failed. Total: ${amount}, Sum: ${validation.total}, Difference: ${validation.difference}`);
      }

      // Marcar transação como settled
      await client.query(
        `UPDATE bank_transactions SET settledAt = NOW() WHERE transaction_id = $1`,
        [transaction.transactionId]
      );

      await client.query('COMMIT');

      return {
        transaction,
        splits,
        ledgerEntries,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reverte uma transação
   * 
   * REGRAS ARQUITETURAIS:
   * - Cria nova transação de reversão
   * - Inverte todas as entradas do ledger
   * - Restaura saldos exatamente como estavam
   * - Marca transação original como reversed
   */
  async reverseTransaction(
    tenantId: string,
    originalTransactionId: string,
    eventId?: string
  ): Promise<{
    reversalTransaction: BankTransaction;
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      // Buscar transação original
      const originalTransaction = await this.getTransactionById(tenantId, originalTransactionId);
      if (!originalTransaction) {
        await client.query('ROLLBACK');
        throw new Error(`Transaction ${originalTransactionId} not found`);
      }

      if (originalTransaction.status === 'reversed') {
        await client.query('ROLLBACK');
        throw new Error(`Transaction ${originalTransactionId} is already reversed`);
      }

      // Buscar entradas do ledger da transação original
      const originalEntries = await bankLedgerRepository.getEntriesByTransaction(tenantId, originalTransactionId);

      if (originalEntries.length === 0) {
        await client.query('ROLLBACK');
        throw new Error(`No ledger entries found for transaction ${originalTransactionId}`);
      }

      // Criar transação de reversão
      const reversalEventId = eventId || uuidv4();
      const reversalResult = await client.query<BankTransactionRow>(
        `
        INSERT INTO bank_transactions (
          tenant_id, event_id, from_account_id, to_account_id,
          amount, currency, transaction_type, original_transaction_id,
          status, description, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'reversal', $7, 'completed', $8, $9)
        RETURNING transaction_id, tenant_id, event_id, from_account_id, to_account_id,
                  amount, currency, transaction_type, original_transaction_id,
                  status, description, metadata, createdAt, settledAt
        `,
        [
          tenantId,
          reversalEventId,
          originalTransaction.toAccountId || null,
          originalTransaction.fromAccountId || null,
          originalTransaction.amount,
          originalTransaction.currency,
          originalTransactionId,
          `Reversal of transaction ${originalTransactionId}`,
          { originalTransactionId, reversedAt: new Date().toISOString() },
        ]
      );

      const reversalTransaction = this.toTransaction(reversalResult.rows[0]);
      const ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }> = [];

      // Reverter cada entrada do ledger
      for (const originalEntry of originalEntries) {
        const currentBalance = await bankLedgerRepository.calculateBalance(tenantId, originalEntry.accountId);
        const reversedEntryType = originalEntry.entryType === 'credit' ? 'debit' : 'credit';
        const reversedBalanceAfter = reversedEntryType === 'credit'
          ? currentBalance.balance + originalEntry.amountCents: currentBalance.balance - originalEntry.amount;

        const reversedEntry = await bankLedgerRepository.createEntry(tenantId, {
          accountId: originalEntry.accountId,
          transactionId: reversalTransaction.transactionId,
          entryType: reversedEntryType,
          amountCents: originalEntry.amount,
          balanceBefore: currentBalance.balance,
          balanceAfter: reversedBalanceAfter,
          description: `Reversal of ${originalEntry.description || 'transaction'}`,
          metadata: { originalEntryId: originalEntry.entryId, originalTransactionId },
        });

        ledgerEntries.push({
          entryId: reversedEntry.entryId,
          accountId: originalEntry.accountId,
          entryType: reversedEntryType,
        });

        await bankAccountRepository.updateCachedBalance(tenantId, originalEntry.accountId, reversedBalanceAfter);
      }

      // Marcar transação original como reversed
      await client.query(
        `UPDATE bank_transactions SET status = 'reversed' WHERE transaction_id = $1`,
        [originalTransactionId]
      );

      // Marcar transação de reversão como settled
      await client.query(
        `UPDATE bank_transactions SET settledAt = NOW() WHERE transaction_id = $1`,
        [reversalTransaction.transactionId]
      );

      await client.query('COMMIT');

      return {
        reversalTransaction,
        ledgerEntries,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Busca detalhes completos de uma transação (com splits)
   */
  async getTransactionDetails(
    tenantId: string,
    transactionId: string
  ): Promise<{
    transaction: BankTransaction;
    splits: BankSplit[];
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit'; amountCents: number }>;
  }> {
    const transaction = await this.getTransactionById(tenantId, transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const splits = await bankSplitRepository.getSplitsByTransaction(tenantId, transactionId);
    const ledgerEntries = await bankLedgerRepository.getEntriesByTransaction(tenantId, transactionId);

    return {
      transaction,
      splits,
      ledgerEntries: ledgerEntries.map((entry) => ({
        entryId: entry.entryId,
        accountId: entry.accountId,
        entryType: entry.entryType,
        amountCents: entry.amount,
      })),
    };
  }
}

export const bankTransactionService = new BankTransactionService();










