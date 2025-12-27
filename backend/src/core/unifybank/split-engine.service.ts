// backend/src/core/unifybank/split-engine.service.ts
// Split Engine Avançado - Orquestração de splits determinísticos
// FASE 5: Split Engine Avançado

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { pool } from '@core/database/pool';
import { getClientWithTenant } from '@core/database/pool';
import { transactionService } from '@core/economy/transactions/transaction.service';
import { accountService } from '@core/economy/accounts/account.service';
import { groupAccountService } from '@core/economy/group-account.service';
import { regionAccountService } from '@core/economy/region-account.service';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import type {
  SplitRule,
  SplitContextType,
  SplitTargetType,
  ApplySplitInput,
  ApplySplitResult,
  SplitEntry,
  CompensateTransactionInput,
  CompensateTransactionResult,
} from './split-engine.types';

class SplitEngineService {
  /**
   * Obtém regra de split padrão para um contexto
   * Por enquanto, regras em memória (MVP)
   * Futuro: buscar do banco de dados
   */
  private getDefaultSplitRule(context: SplitContextType): SplitRule {
    if (context === 'donation') {
      return {
        id: 'default-donation-split',
        context: 'donation',
        rules: [
          {
            targetType: 'group',
            percentage: 0.70, // 70% para o grupo/projeto
            targetId: undefined, // Será resolvido do metadata
          },
          {
            targetType: 'regional_fund',
            percentage: 0.20, // 20% para fundo regional
          },
          {
            targetType: 'platform',
            percentage: 0.10, // 10% para plataforma
          },
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Regra padrão genérica (pode ser expandida)
    return {
      id: 'default-generic-split',
      context,
      rules: [
        {
          targetType: 'user',
          percentage: 0.80, // 80% para usuário principal
          targetId: undefined,
        },
        {
          targetType: 'platform',
          percentage: 0.20, // 20% para plataforma
        },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Valida regra de split
   * - Soma de percentuais deve ser 1.0 (100%)
   * - Todos os percentuais devem ser >= 0 e <= 1
   */
  private validateSplitRule(rule: SplitRule): void {
    const totalPercentage = rule.rules.reduce((sum, r) => sum + r.percentage, 0);
    const tolerance = 0.001; // Tolerância para arredondamento

    if (Math.abs(totalPercentage - 1.0) > tolerance) {
      throw new Error(
        `Split rule percentages must sum to 100% (current: ${(totalPercentage * 100).toFixed(2)}%)`
      );
    }

    for (const r of rule.rules) {
      if (r.percentage < 0 || r.percentage > 1) {
        throw new Error(`Split percentage must be between 0 and 1 (got: ${r.percentage})`);
      }

      // Validar que targetId está presente quando necessário
      if (
        (r.targetType === 'user' || r.targetType === 'group' || r.targetType === 'project') &&
        !r.targetId
      ) {
        throw new Error(`targetId is required for targetType: ${r.targetType}`);
      }
    }
  }

  /**
   * Gera eventId determinístico para split
   * Hash de: originTransactionId + splitGroupId + targetType + targetId + percentage
   */
  private generateDeterministicEventId(
    originTransactionId: string,
    splitGroupId: string,
    targetType: SplitTargetType,
    targetId: string | undefined,
    percentage: number
  ): string {
    const input = `${originTransactionId}|${splitGroupId}|${targetType}|${targetId || ''}|${percentage}`;
    const hash = createHash('sha256').update(input).digest('hex');
    // Converter hash para UUID v4 format (mantém determinístico)
    // Usar primeiros 32 caracteres do hash
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
  }

  /**
   * Cria transferência dentro de uma transação SQL existente
   * Usa o mesmo client para garantir atomicidade
   */
  private async createTransferInTransaction(
    client: any,
    tenantId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    eventId: string,
    metadata: Record<string, any>
  ): Promise<{ transactionId: string; ledgerEntryId: string }> {
    interface AccountRow {
      account_id: string;
      balance: string;
      owner_type: string;
    }

    interface TransactionRow {
      transaction_id: string;
    }

    interface LedgerRow {
      ledger_entry_id: string;
    }

    // Verificar idempotência (eventId único)
    const existing = await client.query(
      `SELECT transaction_id FROM transactions WHERE event_id = $1 LIMIT 1`,
      [eventId]
    ) as { rows: TransactionRow[] };

    if (existing.rows.length > 0) {
      // Já existe, buscar ledger entry
      const ledger = await client.query(
        `SELECT ledger_entry_id FROM ledger WHERE transaction_id = $1 AND entry_type = 'credit' LIMIT 1`,
        [existing.rows[0].transaction_id]
      ) as { rows: LedgerRow[] };
      return {
        transactionId: existing.rows[0].transaction_id,
        ledgerEntryId: ledger.rows[0]?.ledger_entry_id || '',
      };
    }

    // Buscar e travar contas (FOR UPDATE)
    const accounts = await client.query(
      `
      SELECT account_id, balance, owner_type
      FROM accounts
      WHERE account_id IN ($1, $2)
      FOR UPDATE
      `,
      [fromAccountId, toAccountId]
    ) as { rows: Array<{ account_id: string; balance: string; owner_type: string }> };

    interface AccountInfo {
      balance: number;
      ownerType: string;
    }

    const accountsMap = new Map<string, AccountInfo>(
      accounts.rows.map((r) => [
        r.account_id,
        {
          balance: parseFloat(r.balance),
          ownerType: r.owner_type,
        },
      ])
    );

    const fromAccount = accountsMap.get(fromAccountId);
    const toAccount = accountsMap.get(toAccountId);

    if (!fromAccount || !toAccount) {
      throw new Error('One or both accounts not found');
    }

    if (fromAccount.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // ==========================================
    // INVARIANTE 2: SALDO NÃO-NEGATIVO (USER_PRIMARY)
    // ==========================================
    const newFromBalance = fromAccount.balance - amount;
    if (fromAccount.ownerType === 'user' && newFromBalance < 0) {
      throw new Error(
        `Non-negative balance invariant violated: user account ${fromAccountId} would have negative balance (${newFromBalance})`
      );
    }

    // Atualizar saldos
    await client.query(
      `
      UPDATE accounts
      SET balance = CASE
        WHEN account_id = $1 THEN balance - $3
        WHEN account_id = $2 THEN balance + $3
      END
      WHERE account_id IN ($1, $2)
      `,
      [fromAccountId, toAccountId, amount]
    );

    // Criar transação
    // NOTA: Não usar owner_global_user_id (coluna pode não existir)
    // Deixar global_user_id como null - não é crítico para funcionamento
    const fromGlobalUserId = null;
    const toGlobalUserId = null;

    const transaction = await client.query(
      `
      INSERT INTO transactions (
        tenant_id, from_account_id, to_account_id, from_global_user_id, to_global_user_id,
        amount, event_id, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8)
      RETURNING transaction_id
      `,
      [tenantId, fromAccountId, toAccountId, fromGlobalUserId, toGlobalUserId, amount, eventId, JSON.stringify(metadata)]
    ) as { rows: TransactionRow[] };

    const transactionId = transaction.rows[0].transaction_id;

    // Criar lançamentos no ledger (double-entry)
    const debitEntry = await client.query(
      `
      INSERT INTO ledger (
        tenant_id, transaction_id, account_id, entry_type, amount,
        balance_before, balance_after, metadata
      )
      VALUES ($1, $2, $3, 'debit', $4, $5, $6, $7)
      RETURNING ledger_entry_id
      `,
      [
        tenantId,
        transactionId,
        fromAccountId,
        amount,
        fromAccount.balance,
        fromAccount.balance - amount,
        JSON.stringify(metadata),
      ]
    ) as { rows: LedgerRow[] };

    const creditEntry = await client.query(
      `
      INSERT INTO ledger (
        tenant_id, transaction_id, account_id, entry_type, amount,
        balance_before, balance_after, metadata
      )
      VALUES ($1, $2, $3, 'credit', $4, $5, $6, $7)
      RETURNING ledger_entry_id
      `,
      [
        tenantId,
        transactionId,
        toAccountId,
        amount,
        toAccount.balance,
        toAccount.balance + amount,
        JSON.stringify(metadata),
      ]
    ) as { rows: LedgerRow[] };

    return {
      transactionId,
      ledgerEntryId: creditEntry.rows[0].ledger_entry_id,
    };
  }

  /**
   * Resolve conta de destino baseado no targetType
   */
  private async resolveTargetAccount(
    tenantId: string,
    targetType: SplitTargetType,
    targetId?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    switch (targetType) {
      case 'user':
        if (!targetId) {
          throw new Error('targetId is required for user target');
        }
        const account = await accountService.getOrCreateUserPrimaryAccount(
          tenantId,
          targetId,
          'BRL'
        );
        return account.accountId;

      case 'group':
        if (!targetId) {
          // Tentar obter do metadata
          const groupId = metadata?.targetId || metadata?.groupId;
          if (!groupId) {
            throw new Error('targetId or groupId in metadata is required for group target');
          }
          return await groupAccountService.createOrGetGroupAccount(tenantId, groupId);
        }
        return await groupAccountService.createOrGetGroupAccount(tenantId, targetId);

      case 'project':
        if (!targetId) {
          throw new Error('targetId is required for project target');
        }
        // Verificar se conta de projeto existe, criar se não existir
        const existing = await pool.query<{ account_id: string }>(
          `
          SELECT account_id
          FROM accounts
          WHERE tenant_id = $1 AND owner_id = $2 AND owner_type = 'project' AND currency = 'BRL'
          LIMIT 1
          `,
          [tenantId, targetId]
        );

        if (existing.rows.length > 0) {
          return existing.rows[0].account_id;
        }

        // Criar conta de projeto
        const created = await pool.query<{ account_id: string }>(
          `
          INSERT INTO accounts (tenant_id, owner_id, owner_type, balance, currency)
          VALUES ($1, $2, 'project', 0, 'BRL')
          RETURNING account_id
          `,
          [tenantId, targetId]
        );

        if (created.rows.length === 0) {
          throw new Error('Failed to create project account');
        }

        return created.rows[0].account_id;

      case 'regional_fund':
        // Resolver conta regional - REQUER globalUserId no metadata
        const globalUserId = metadata?.globalUserId || metadata?.fromGlobalUserId;
        if (!globalUserId) {
          throw new Error(
            'globalUserId is required in metadata to resolve regional fund account. Provide fromGlobalUserId in split metadata.'
          );
        }

        // Resolver userId do globalUserId
        const userResult = await pool.query<{ user_id: string }>(
          `
          SELECT user_id
          FROM users
          WHERE tenant_id = $1 AND global_user_id = $2
          LIMIT 1
          `,
          [tenantId, globalUserId]
        );

        if (userResult.rows.length === 0) {
          throw new Error(`User not found for globalUserId: ${globalUserId}`);
        }

        const userId = userResult.rows[0].user_id;
        const regionAccountId = await regionAccountService.resolveRegionAccountId({
          tenantId,
          userId,
        });

        if (!regionAccountId) {
          throw new Error(`Regional account could not be resolved for userId: ${userId}`);
        }

        return regionAccountId;

      case 'platform':
        const platformAccount = await accountService.getPlatformAccount(tenantId, 'BRL');
        return platformAccount.accountId;

      default:
        throw new Error(`Unknown target type: ${targetType}`);
    }
  }

  /**
   * Aplica split em uma transação base
   * 
   * Fluxo:
   * 1. Validar entrada
   * 2. Obter regra de split
   * 3. Validar regra
   * 4. Resolver contas de destino
   * 5. Criar transações de split (todas na mesma transação SQL)
   * 6. Registrar metadados no ledger
   * 7. Retornar resultado
   */
  async applySplit(input: ApplySplitInput): Promise<ApplySplitResult> {
    const { baseTransactionId, amount, context, metadata = {}, splitRuleId, tenantId } = input;

    // 1. Validar entrada
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    // 2. Obter regra de split
    const rule = splitRuleId
      ? await this.getSplitRuleById(tenantId, splitRuleId)
      : this.getDefaultSplitRule(context);

    if (!rule || !rule.isActive) {
      throw new Error(`Split rule not found or inactive: ${splitRuleId || 'default'}`);
    }

    // 3. Validar regra
    this.validateSplitRule(rule);

    // 4. Buscar transação base para obter conta de origem
    const baseTransaction = await pool.query<{
      from_account_id: string;
      to_account_id: string;
      amount: string;
    }>(
      `
      SELECT from_account_id, to_account_id, amount
      FROM transactions
      WHERE transaction_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [baseTransactionId, tenantId]
    );

    if (baseTransaction.rows.length === 0) {
      throw new Error(`Base transaction not found: ${baseTransactionId}`);
    }

    const fromAccountId = baseTransaction.rows[0].from_account_id;
    
    // Gerar splitGroupId determinístico baseado no baseTransactionId
    // Isso garante que retries do mesmo baseTransactionId usem o mesmo splitGroupId
    const splitGroupIdHash = createHash('sha256')
      .update(`${baseTransactionId}|${context}`)
      .digest('hex')
      .substring(0, 32);
    const splitGroupId = `${splitGroupIdHash.substring(0, 8)}-${splitGroupIdHash.substring(8, 12)}-4${splitGroupIdHash.substring(13, 16)}-${splitGroupIdHash.substring(16, 20)}-${splitGroupIdHash.substring(20, 32)}`;
    
    const entries: SplitEntry[] = [];

    // 5. Criar TODAS as transações de split dentro de UMA ÚNICA transação SQL
    // BEGIN → criar todos os splits → COMMIT (ou ROLLBACK se qualquer um falhar)
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      // Resolver todas as contas ANTES de criar transações (para validar tudo)
      const splitConfigs: Array<{
        rule: typeof rule.rules[0];
        targetAccountId: string;
        amount: number;
        finalTargetId: string | undefined;
      }> = [];

      for (const splitRule of rule.rules) {
        // Resolver targetId se não fornecido
        let finalTargetId = splitRule.targetId;
        if (!finalTargetId && splitRule.targetType !== 'regional_fund' && splitRule.targetType !== 'platform') {
          // Tentar obter do metadata
          finalTargetId = metadata.targetId || metadata.groupId || metadata.projectId;
          if (!finalTargetId) {
            throw new Error(
              `targetId required for ${splitRule.targetType} but not found in rule or metadata`
            );
          }
        }

        // Resolver conta de destino (dentro da transação)
        const targetAccountId = await this.resolveTargetAccount(
          tenantId,
          splitRule.targetType,
          finalTargetId,
          metadata
        );

        // Calcular amount do split
        const splitAmount = amount * splitRule.percentage;
        const roundedAmount = Math.round(splitAmount * 100) / 100; // Arredondar para 2 casas decimais

        splitConfigs.push({
          rule: splitRule,
          targetAccountId,
          amount: roundedAmount,
          finalTargetId,
        });
      }

      // ==========================================
      // INVARIANTE 4: SPLIT INVARIANTS
      // ==========================================
      // Validar que soma dos valores dos splits = valor base
      // Ajustar remainder no último split se necessário
      const totalSplitAmount = splitConfigs.reduce((sum, config) => sum + config.amount, 0);
      const remainder = amount - totalSplitAmount;

      if (Math.abs(remainder) > 0.01) {
        // Ajustar último split para absorver remainder
        if (splitConfigs.length > 0) {
          const lastConfig = splitConfigs[splitConfigs.length - 1];
          lastConfig.amount = Math.round((lastConfig.amount + remainder) * 100) / 100;
        }
      }

      // Validação final: soma deve bater exatamente (com tolerância de arredondamento)
      const finalTotal = splitConfigs.reduce((sum, config) => sum + config.amount, 0);
      if (Math.abs(finalTotal - amount) > 0.01) {
        await client.query('ROLLBACK');
        throw new Error(
          `Split invariant violated: sum of split amounts (${finalTotal}) != base amount (${amount})`
        );
      }

      // Criar todas as transações de split dentro da mesma transação SQL
      for (const config of splitConfigs) {
        // Gerar eventId determinístico
        const splitEventId = this.generateDeterministicEventId(
          baseTransactionId,
          splitGroupId,
          config.rule.targetType,
          config.finalTargetId,
          config.rule.percentage
        );

        const transferResult = await this.createTransferInTransaction(
          client,
          tenantId,
          fromAccountId,
          config.targetAccountId,
          config.amount,
          splitEventId,
          {
            type: 'split',
            originTransactionId: baseTransactionId,
            splitGroupId,
            ruleId: rule.id,
            targetType: config.rule.targetType,
            targetId: config.finalTargetId,
            percentage: config.rule.percentage,
            context,
            ...metadata,
          }
        );

        entries.push({
          ruleId: rule.id,
          targetType: config.rule.targetType,
          targetId: config.finalTargetId,
          percentage: config.rule.percentage,
          amount: config.amount,
          accountId: config.targetAccountId,
          transactionId: transferResult.transactionId,
          ledgerEntryId: transferResult.ledgerEntryId,
        });
      }

      await client.query('COMMIT');

      return {
        splitGroupId,
        baseTransactionId,
        totalAmount: amount,
        entries,
        createdAt: new Date(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Busca regra de split por ID (futuro: do banco)
   * Por enquanto, retorna null (usa default)
   */
  private async getSplitRuleById(tenantId: string, ruleId: string): Promise<SplitRule | null> {
    // TODO: Implementar busca no banco quando tabela existir
    // Por enquanto, retorna null (usa default)
    return null;
  }

  /**
   * Compensa uma transação criando transação inversa
   * 
   * NÃO altera lançamentos existentes
   * Cria nova transação que inverte débitos/créditos
   */
  async compensateTransaction(
    input: CompensateTransactionInput
  ): Promise<CompensateTransactionResult> {
    const { originTransactionId, reason, metadata = {}, tenantId } = input;

    // Buscar transação original e seus splits
    const originTransaction = await pool.query<{
      transaction_id: string;
      from_account_id: string;
      to_account_id: string;
      amount: string;
      metadata: any;
    }>(
      `
      SELECT transaction_id, from_account_id, to_account_id, amount, metadata
      FROM transactions
      WHERE transaction_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [originTransactionId, tenantId]
    );

    if (originTransaction.rows.length === 0) {
      throw new Error(`Origin transaction not found: ${originTransactionId}`);
    }

    const origin = originTransaction.rows[0];
    const originAmount = parseFloat(origin.amount);

    // Buscar todos os splits relacionados
    const splitTransactions = await pool.query<{
      transaction_id: string;
      from_account_id: string;
      to_account_id: string;
      amount: string;
      metadata: any;
    }>(
      `
      SELECT transaction_id, from_account_id, to_account_id, amount, metadata
      FROM transactions
      WHERE tenant_id = $1
        AND metadata->>'type' = 'split'
        AND metadata->>'originTransactionId' = $2
      `,
      [tenantId, originTransactionId]
    );

    const reversedEntries: Array<{
      originalEntryId: string;
      compensationEntryId: string;
    }> = [];

    // 1. Compensar transação base (inverter)
    const baseCompensationEventId = uuidv4();
    const baseCompensation = await transactionService.transfer(tenantId, {
      fromAccount: origin.to_account_id, // Inverter: de quem recebeu para quem enviou
      toAccount: origin.from_account_id, // Inverter: para quem enviou
      amount: originAmount,
      eventId: baseCompensationEventId,
      metadata: {
        type: 'compensation',
        originTransactionId,
        reason,
        ...metadata,
      },
    });

    reversedEntries.push({
      originalEntryId: origin.transaction_id,
      compensationEntryId: baseCompensation.transaction.transactionId,
    });

    // 2. Compensar cada split (inverter)
    for (const splitTx of splitTransactions.rows) {
      const splitAmount = parseFloat(splitTx.amount);
      const splitCompensationEventId = uuidv4();

      const splitCompensation = await transactionService.transfer(tenantId, {
        fromAccount: splitTx.to_account_id, // Inverter
        toAccount: splitTx.from_account_id, // Inverter
        amount: splitAmount,
        eventId: splitCompensationEventId,
        metadata: {
          type: 'compensation',
          originTransactionId: splitTx.transaction_id,
          originalOriginTransactionId: originTransactionId,
          reason,
          ...metadata,
        },
      });

      reversedEntries.push({
        originalEntryId: splitTx.transaction_id,
        compensationEntryId: splitCompensation.transaction.transactionId,
      });
    }

    return {
      compensationTransactionId: baseCompensation.transaction.transactionId,
      originTransactionId,
      reversedEntries,
      createdAt: new Date(),
    };
  }
}

export const splitEngineService = new SplitEngineService();















