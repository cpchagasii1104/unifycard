// src/core/unifybank/test-currency.service.ts
//
// Serviço para gerenciar moeda fictícia de teste (TEST)
// Permite emissão de saldo para testes de fluxos econômicos
//
// REGRAS:
// - Apenas ambiente de desenvolvimento/teste
// - Apenas role 'admin' pode emitir
// - Todas as emissões são registradas no ledger
// - Rastreabilidade completa (adminId, userId, timestamp, reason)

import { accountService } from '../economy/accounts/account.service';
import { transactionService } from '../economy/transactions/transaction.service';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { v4 as uuidv4 } from 'uuid';
import type { Currency } from '../economy/accounts/account.types';

const TEST_CURRENCY: Currency = 'TEST';

interface EmitTestCurrencyInput {
  tenantId: string;
  userId: string;
  amountCents: number;
  reason: string;
  adminId: string;
}

interface EmitTestCurrencyResult {
  transactionId: string;
  accountId: string;
  newBalance: number;
  amountCents: number;
  reason: string;
  emittedAt: Date;
}

interface TestCurrencyLedgerEntry {
  entryId: string;
  transactionId: string;
  accountId: string;
  amountCents: number;
  reason: string;
  adminId: string;
  userId: string;
  createdAt: Date;
}

class TestCurrencyService {
  /**
   * Emite saldo fictício (TEST) para um usuário
   * 
   * GARANTIAS:
   * - Apenas moeda TEST pode ser emitida
   * - Cria conta se não existir
   * - Registra transação no ledger
   * - Rastreabilidade completa
   */
  async emitTestCurrency(input: EmitTestCurrencyInput): Promise<EmitTestCurrencyResult> {
    const { tenantId, userId, amount, reason, adminId } = input;

    // Validação: apenas TEST
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (amount > 1000000) {
      throw new Error('Maximum emission amount is 1,000,000 TEST');
    }

    // 1. Buscar ou criar conta do usuário em TEST
    const userAccount = await accountService.getOrCreateUserPrimaryAccount(
      tenantId,
      userId,
      TEST_CURRENCY
    );

    // 2. Buscar ou criar conta "UnifyBank Treasury" (emissor) em TEST
    const treasuryAccount = await accountService.getOrCreateSystemAccount(
      tenantId,
      'platform_ops',
      TEST_CURRENCY
    );

    // 3. Transferir de treasury para usuário (emissão)
    const transferResult = await transactionService.transfer(tenantId, {
      fromAccount: treasuryAccount.accountId,
      toAccount: userAccount.accountId,
      amount,
      eventId: uuidv4(),
      metadata: {
        type: 'test_currency_emission',
        reason,
        adminId,
        userId,
        currency: TEST_CURRENCY,
        source: 'unifybank_test_currency',
      },
    });

    // 4. Buscar saldo atualizado
    const updatedAccount = await accountService.getAccountById(tenantId, userAccount.accountId);
    if (!updatedAccount) {
      throw new Error('Failed to retrieve updated account');
    }

    return {
      transactionId: transferResult.transaction.transactionId,
      accountId: userAccount.accountId,
      newBalance: updatedAccount.balance,
      amount,
      reason,
      emittedAt: new Date(),
    };
  }


  /**
   * Lista todas as emissões de TEST para um usuário
   * Busca no ledger todas as transações de emissão
   */
  async getTestCurrencyLedger(
    tenantId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ entries: TestCurrencyLedgerEntry[]; totalCents: number }> {
    // Buscar conta do usuário em TEST
    const userAccounts = await accountService.getAccountsByOwner(tenantId, userId, 'user');
    const testAccount = userAccounts.find(acc => acc.currency === TEST_CURRENCY);

    if (!testAccount) {
      return { entries: [], totalCents: 0 };
    }

    // Buscar entradas no ledger que são créditos (emissões)
    const entriesRows = await runQueriesWithTenant<{
      entry_id: string;
      transaction_id: string;
      account_id: string;
      amountCents: string;
      createdAt: Date;
      metadata: any;
    }>(
      tenantId,
      `
      SELECT 
        l.entry_id,
        l.transaction_id,
        l.account_id,
        l.amount,
        l.createdAt,
        t.metadata
      FROM ledger l
      INNER JOIN transactions t ON t.transaction_id = l.transaction_id
      WHERE 
        l.account_id = $1
        AND l.entry_type = 'credit'
        AND t.metadata->>'type' = 'test_currency_emission'
        AND t.currency = 'TEST'
      ORDER BY l.createdAt DESC
      LIMIT $2 OFFSET $3
      `,
      [testAccount.accountId, limit, offset]
    );

    const totalRow = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM ledger l
      INNER JOIN transactions t ON t.transaction_id = l.transaction_id
      WHERE 
        l.account_id = $1
        AND l.entry_type = 'credit'
        AND t.metadata->>'type' = 'test_currency_emission'
        AND t.currency = 'TEST'
      `,
      [testAccount.accountId]
    );

    const entries: TestCurrencyLedgerEntry[] = (entriesRows || []).map((row) => ({
      entryId: row.entry_id,
      transactionId: row.transaction_id,
      accountId: row.account_id,
      amountCents: parseFloat(row.amount),
      reason: row.metadata?.reason || 'N/A',
      adminId: row.metadata?.adminId || 'N/A',
      userId: row.metadata?.userId || userId,
      createdAt: row.createdAt,
    }));

    return {
      entries,
      totalCents: parseInt(totalRow?.count || '0', 10),
    };
  }

  /**
   * Valida se a moeda é TEST (gate de segurança)
   */
  validateTestCurrency(currency: string): boolean {
    return currency === TEST_CURRENCY;
  }
}

export const testCurrencyService = new TestCurrencyService();






























