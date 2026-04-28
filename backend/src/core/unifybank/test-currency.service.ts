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

import { accountService } from '../economy/account.service';
import { transactionService } from '../economy/transaction.service';
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
  newBalanceCents: number;
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
    const { tenantId, userId, amountCents, reason, adminId } = input;

    // Validação: apenas TEST
    if (amountCents <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (amountCents > 1000000) {
      throw new Error('Maximum emission amount is 1,000,000 TEST');
    }

    // 1. Buscar ou criar conta do usuário em TEST
    const userAccount = await accountService.getOrCreateUserPrimaryAccount(
      tenantId,
      userId,
      TEST_CURRENCY
    );

    // 2. Buscar ou criar conta sistema (reserve) em TEST para emissão
    const treasuryAccount = await accountService.getOrCreateSystemAccount(
      tenantId,
      'reserve',
      TEST_CURRENCY
    );

    // 3. Transferir de treasury para usuário (emissão)
    const emissionRef = uuidv4();
    const transferResult = await transactionService.transfer(tenantId, {
      fromAccount: treasuryAccount.accountId,
      toAccount: userAccount.accountId,
      amountCents,
      eventId: emissionRef,
      referenceType: 'test_currency_emission',
      referenceId: emissionRef,
      metadata: {
        type: 'test_currency_emission',
        reason,
        adminId,
        userId,
        currency: TEST_CURRENCY,
        source: 'unifybank_test_currency',
      },
      concept_id: 'system-reserve-credit', // TODO: RFC — substituir por test-currency-emission (devtools)
    });

    // 4. Buscar saldo atualizado
    const updatedAccount = await accountService.getAccountById(tenantId, userAccount.accountId);
    if (!updatedAccount) {
      throw new Error('Failed to retrieve updated account');
    }

    return {
      transactionId: transferResult.transactionId,
      accountId: userAccount.accountId,
      newBalanceCents: updatedAccount.balanceCents,
      amountCents,
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
    void limit;
    void offset;

    // TODO DECISION-0007 / FASE 6: reimplementar sobre bank_ledger + bank_transactions
    // com filtros semânticos adequados para TEST currency. Até lá, retorna vazio
    // (tabelas "ledger" e "transactions" não existem no schema Gênesis).

    // Buscar conta do usuário em TEST (mantém mesmo ramo de “sem conta” que antes)
    const userAccounts = await accountService.getAccountsByOwner(tenantId, userId, 'user');
    const testAccount = userAccounts.find(acc => acc.currency === TEST_CURRENCY);

    if (!testAccount) {
      return { entries: [], totalCents: 0 };
    }

    return {
      entries: [],
      totalCents: 0,
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






























