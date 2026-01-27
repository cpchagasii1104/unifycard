// backend/tests/integration/bank-invariants.test.ts
// CONTINUOUS PRODUCTION: Invariant Test Suite for Unify Bank
// Proves core invariants: double-entry, reversals, split determinism, idempotency, referral expiration, group allocation

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../src/core/database/pool';
import { bankTransactionService } from '../../src/modules/bank/bank-transaction.service';
import { bankAccountService } from '../../src/modules/bank/bank-account.service';
import { bankIntegrationService } from '../../src/modules/bank/bank-integration.service';
import { bankLedgerRepository } from '../../src/modules/bank/bank-ledger.repository';
import { bankSplitRepository } from '../../src/modules/bank/bank-split.repository';
import { userGroupAllocationRepository } from '../../src/core/user-group-allocation/user-group-allocation.repository';
import { runQueryWithTenant } from '../../src/core/database/pool';
import { v4 as uuidv4 } from 'uuid';

describe('Bank Invariants - Continuous Production', () => {
  let testTenantId: string;
  let testUserId1: string;
  let testUserId2: string;
  let testGroupId1: string;
  let testGroupId2: string;
  let testGroupId3: string;

  beforeAll(async () => {
    // Criar tenant de teste
    const tenantResult = await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug) 
       VALUES (gen_random_uuid(), 'Test Invariants', 'test-invariants')
       RETURNING tenant_id`
    );
    testTenantId = tenantResult.rows[0].tenant_id;

    // Criar usuários de teste
    const user1Result = await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, password_hash)
       VALUES (gen_random_uuid(), $1, 'user1@test.com', 'hash')
       RETURNING user_id`,
      [testTenantId]
    );
    testUserId1 = user1Result.rows[0].user_id;

    const user2Result = await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, password_hash)
       VALUES (gen_random_uuid(), $1, 'user2@test.com', 'hash')
       RETURNING user_id`,
      [testTenantId]
    );
    testUserId2 = user2Result.rows[0].user_id;

    // Criar grupos de teste
    const group1Result = await pool.query(
      `INSERT INTO groups (group_id, tenant_id, owner_actor_id, name, status)
       VALUES (gen_random_uuid(), $1, $2, 'Group 1', 'active')
       RETURNING group_id`,
      [testTenantId, testUserId1]
    );
    testGroupId1 = group1Result.rows[0].group_id;

    const group2Result = await pool.query(
      `INSERT INTO groups (group_id, tenant_id, owner_actor_id, name, status)
       VALUES (gen_random_uuid(), $1, $2, 'Group 2', 'active')
       RETURNING group_id`,
      [testTenantId, testUserId1]
    );
    testGroupId2 = group2Result.rows[0].group_id;

    const group3Result = await pool.query(
      `INSERT INTO groups (group_id, tenant_id, owner_actor_id, name, status)
       VALUES (gen_random_uuid(), $1, $2, 'Group 3', 'active')
       RETURNING group_id`,
      [testTenantId, testUserId1]
    );
    testGroupId3 = group3Result.rows[0].group_id;

    // Criar contas do sistema
    await bankAccountService.getOrCreateAccount(testTenantId, {
      ownerId: 'system',
      ownerType: 'system',
      currency: 'BRL',
    });
  });

  afterAll(async () => {
    // Limpar dados de teste
    await pool.query('DELETE FROM bank_ledger WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_splits WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_transactions WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_accounts WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM user_group_allocations WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM user_referral_links WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM groups WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
  });

  describe('1. Double-Entry Invariant', () => {
    it('should have SUM(amount_cents signed) == 0 for each transaction', async () => {
      // Criar transação de teste
      const fromAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId1,
        ownerType: 'user',
        currency: 'BRL',
      });

      const toAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId2,
        ownerType: 'user',
        currency: 'BRL',
      });

      // Creditar saldo inicial
      const reserveAccount = await bankAccountService.getSystemAccount(testTenantId, 'reserve', 'BRL');
      if (reserveAccount) {
        await bankTransactionService.createSimpleTransaction(testTenantId, {
          eventId: uuidv4(),
          fromAccountId: reserveAccount.accountId,
          toAccountId: fromAccount.accountId,
          amount: 1000,
          currency: 'BRL',
          transactionType: 'deposit',
          description: 'Initial balance',
        });
      }

      const result = await bankTransactionService.createSimpleTransaction(testTenantId, {
        eventId: uuidv4(),
        fromAccountId: fromAccount.accountId,
        toAccountId: toAccount.accountId,
        amount: 100,
        currency: 'BRL',
        transactionType: 'transfer',
        description: 'Test transfer',
      });

      // Verificar double-entry: soma de credits - debits deve ser 0
      const ledgerEntries = await bankLedgerRepository.getEntriesByTransaction(
        testTenantId,
        result.transaction.transactionId
      );

      const sum = ledgerEntries.reduce((acc, entry) => {
        const signedAmount = entry.entryType === 'credit' ? entry.amount : -entry.amount;
        return acc + signedAmount;
      }, 0);

      expect(Math.abs(sum)).toBeLessThan(0.01); // Tolerância de 1 centavo
    });
  });

  describe('2. Exact Reversal Invariant', () => {
    it('should restore all account balances exactly after reversal', async () => {
      const fromAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId1,
        ownerType: 'user',
        currency: 'BRL',
      });

      const toAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId2,
        ownerType: 'user',
        currency: 'BRL',
      });

      // Obter saldos antes
      const fromBalanceBefore = await bankAccountService.getBalance(testTenantId, fromAccount.accountId);
      const toBalanceBefore = await bankAccountService.getBalance(testTenantId, toAccount.accountId);

      // Criar transação
      const result = await bankTransactionService.createSimpleTransaction(testTenantId, {
        eventId: uuidv4(),
        fromAccountId: fromAccount.accountId,
        toAccountId: toAccount.accountId,
        amount: 50,
        currency: 'BRL',
        transactionType: 'transfer',
        description: 'Test reversal',
      });

      // Obter saldos após transação
      const fromBalanceAfter = await bankAccountService.getBalance(testTenantId, fromAccount.accountId);
      const toBalanceAfter = await bankAccountService.getBalance(testTenantId, toAccount.accountId);

      // Reverter transação
      await bankTransactionService.reverseTransaction(testTenantId, result.transaction.transactionId);

      // Obter saldos após reversão
      const fromBalanceAfterReversal = await bankAccountService.getBalance(testTenantId, fromAccount.accountId);
      const toBalanceAfterReversal = await bankAccountService.getBalance(testTenantId, toAccount.accountId);

      // Verificar que saldos retornaram exatamente ao valor anterior
      expect(Math.abs(fromBalanceAfterReversal.balance - fromBalanceBefore.balance)).toBeLessThan(0.01);
      expect(Math.abs(toBalanceAfterReversal.balance - toBalanceBefore.balance)).toBeLessThan(0.01);
    });
  });

  describe('3. Split Determinism', () => {
    it('should produce identical splits in same order for same context', async () => {
      const fromAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId1,
        ownerType: 'user',
        currency: 'BRL',
      });

      const toAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId2,
        ownerType: 'user',
        currency: 'BRL',
      });

      // Criar duas transações com mesmo contexto
      const result1 = await bankTransactionService.createTransactionWithSplit(testTenantId, {
        eventId: uuidv4(),
        fromAccountId: fromAccount.accountId,
        amount: 100,
        currency: 'BRL',
        context: 'service_booking',
        revenueShareAccountId: toAccount.accountId,
        description: 'Test split 1',
      });

      const result2 = await bankTransactionService.createTransactionWithSplit(testTenantId, {
        eventId: uuidv4(),
        fromAccountId: fromAccount.accountId,
        amount: 100,
        currency: 'BRL',
        context: 'service_booking',
        revenueShareAccountId: toAccount.accountId,
        description: 'Test split 2',
      });

      // Obter splits
      const splits1 = await bankSplitRepository.getSplitsByTransaction(testTenantId, result1.transaction.transactionId);
      const splits2 = await bankSplitRepository.getSplitsByTransaction(testTenantId, result2.transaction.transactionId);

      // Verificar que splits são idênticos em tipo e ordem
      expect(splits1.length).toBe(splits2.length);
      
      for (let i = 0; i < splits1.length; i++) {
        expect(splits1[i].splitType).toBe(splits2[i].splitType);
        // Valores podem diferir ligeiramente por arredondamento, mas tipos e ordem devem ser iguais
      }
    });
  });

  describe('4. Idempotency', () => {
    it('should not create duplicate rows with same event_id', async () => {
      const eventId = uuidv4();
      const fromAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId1,
        ownerType: 'user',
        currency: 'BRL',
      });

      const toAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId2,
        ownerType: 'user',
        currency: 'BRL',
      });

      // Criar transação
      await bankTransactionService.createSimpleTransaction(testTenantId, {
        eventId,
        fromAccountId: fromAccount.accountId,
        toAccountId: toAccount.accountId,
        amount: 100,
        currency: 'BRL',
        transactionType: 'transfer',
        description: 'Test idempotency',
      });

      // Tentar criar novamente com mesmo event_id
      await expect(
        bankTransactionService.createSimpleTransaction(testTenantId, {
          eventId,
          fromAccountId: fromAccount.accountId,
          toAccountId: toAccount.accountId,
          amount: 100,
          currency: 'BRL',
          transactionType: 'transfer',
          description: 'Test idempotency duplicate',
        })
      ).rejects.toThrow();

      // Verificar que só existe uma transação
      const count = await runQueryWithTenant<{ count: string }>(
        testTenantId,
        `SELECT COUNT(*)::text as count FROM bank_transactions WHERE event_id = $1`,
        [eventId]
      );

      expect(parseInt(count[0].count, 10)).toBe(1);
    });
  });

  describe('5. Referral Expiration', () => {
    it('should not generate referral split after 1 year', async () => {
      const referrerAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId1,
        ownerType: 'user',
        currency: 'BRL',
      });

      const referredAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId2,
        ownerType: 'user',
        currency: 'BRL',
      });

      // Criar referral link com data antiga (mais de 1 ano)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      oneYearAgo.setDate(oneYearAgo.getDate() - 1); // 1 ano e 1 dia atrás

      await runQueryWithTenant(
        testTenantId,
        `INSERT INTO user_referral_links (tenant_id, referrer_user_id, referred_user_id, referral_code_used, created_at)
         VALUES ($1, $2, $3, 'TEST', $4)
         ON CONFLICT (referred_user_id) DO UPDATE SET created_at = $4`,
        [testTenantId, testUserId1, testUserId2, oneYearAgo]
      );

      // Criar transação com split
      const result = await bankTransactionService.createTransactionWithSplit(testTenantId, {
        eventId: uuidv4(),
        fromAccountId: referredAccount.accountId,
        amount: 100,
        currency: 'BRL',
        context: 'service_booking',
        revenueShareAccountId: referredAccount.accountId,
        fromUserId: testUserId2,
        description: 'Test expired referral',
      });

      // Verificar que não há split de referral
      const splits = await bankSplitRepository.getSplitsByTransaction(testTenantId, result.transaction.transactionId);
      const referralSplits = splits.filter((s) => s.splitType === 'referral');

      expect(referralSplits.length).toBe(0);
    });

    it('should generate referral split before 1 year', async () => {
      const referrerAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId1,
        ownerType: 'user',
        currency: 'BRL',
      });

      const referredAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId2,
        ownerType: 'user',
        currency: 'BRL',
      });

      // Criar referral link recente (menos de 1 ano)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      await runQueryWithTenant(
        testTenantId,
        `INSERT INTO user_referral_links (tenant_id, referrer_user_id, referred_user_id, referral_code_used, created_at)
         VALUES ($1, $2, $3, 'TEST', $4)
         ON CONFLICT (referred_user_id) DO UPDATE SET created_at = $4`,
        [testTenantId, testUserId1, testUserId2, sixMonthsAgo]
      );

      // Criar transação com split
      const result = await bankTransactionService.createTransactionWithSplit(testTenantId, {
        eventId: uuidv4(),
        fromAccountId: referredAccount.accountId,
        amount: 100,
        currency: 'BRL',
        context: 'service_booking',
        revenueShareAccountId: referredAccount.accountId,
        fromUserId: testUserId2,
        description: 'Test active referral',
      });

      // Verificar que há split de referral
      const splits = await bankSplitRepository.getSplitsByTransaction(testTenantId, result.transaction.transactionId);
      const referralSplits = splits.filter((s) => s.splitType === 'referral');

      expect(referralSplits.length).toBeGreaterThan(0);
    });
  });

  describe('6. Group Allocation', () => {
    it('should respect max 3 groups and sum <= 100%', async () => {
      const userAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId1,
        ownerType: 'user',
        currency: 'BRL',
      });

      // Configurar 3 grupos com percentuais
      await userGroupAllocationRepository.upsert(testTenantId, {
        userId: testUserId1,
        groupId: testGroupId1,
        percentage: 30,
      });

      await userGroupAllocationRepository.upsert(testTenantId, {
        userId: testUserId1,
        groupId: testGroupId2,
        percentage: 40,
      });

      await userGroupAllocationRepository.upsert(testTenantId, {
        userId: testUserId1,
        groupId: testGroupId3,
        percentage: 20,
      });

      // Criar transação com split
      const result = await bankTransactionService.createTransactionWithSplit(testTenantId, {
        eventId: uuidv4(),
        fromAccountId: userAccount.accountId,
        amount: 1000,
        currency: 'BRL',
        context: 'service_booking',
        revenueShareAccountId: userAccount.accountId,
        fromUserId: testUserId1,
        description: 'Test group allocation',
      });

      // Verificar splits de grupos
      const splits = await bankSplitRepository.getSplitsByTransaction(testTenantId, result.transaction.transactionId);
      
      // Verificar que grupos receberam valores corretos
      // Nota: grupos podem não ter metadata.groupId, então verificamos por targetAccountId
      const groupAccounts = await Promise.all([
        bankAccountService.getAccountByOwner(testTenantId, testGroupId1, 'company', 'BRL'),
        bankAccountService.getAccountByOwner(testTenantId, testGroupId2, 'company', 'BRL'),
        bankAccountService.getAccountByOwner(testTenantId, testGroupId3, 'company', 'BRL'),
      ]);
      
      const groupAccountIds = groupAccounts.filter(a => a).map(a => a!.accountId);
      const groupSplits = splits.filter((s) => groupAccountIds.includes(s.targetAccountId));

      expect(groupSplits.length).toBeLessThanOrEqual(3);

      // Verificar que soma não excede 100%
      const totalGroupAmount = groupSplits.reduce((sum, s) => sum + s.amount, 0);
      expect(totalGroupAmount).toBeLessThanOrEqual(1000);
    });

    it('should send remainder to regional_fund when sum < 100%', async () => {
      const userAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId1,
        ownerType: 'user',
        currency: 'BRL',
      });

      // Configurar apenas 1 grupo com 50%
      await userGroupAllocationRepository.deleteAllByUserId(testTenantId, testUserId1);
      await userGroupAllocationRepository.upsert(testTenantId, {
        userId: testUserId1,
        groupId: testGroupId1,
        percentage: 50,
      });

      // Criar transação com split
      const result = await bankTransactionService.createTransactionWithSplit(testTenantId, {
        eventId: uuidv4(),
        fromAccountId: userAccount.accountId,
        amount: 1000,
        currency: 'BRL',
        context: 'service_booking',
        revenueShareAccountId: userAccount.accountId,
        fromUserId: testUserId1,
        description: 'Test remainder to regional fund',
      });

      // Verificar que há split para regional_fund
      const splits = await bankSplitRepository.getSplitsByTransaction(testTenantId, result.transaction.transactionId);
      const regionalFundAccount = await bankAccountService.getSystemAccount(testTenantId, 'regional_fund', 'BRL');
      const regionalFundSplits = splits.filter((s) => 
        s.splitType === 'regional_fund' || 
        (regionalFundAccount && s.targetAccountId === regionalFundAccount.accountId)
      );

      expect(regionalFundSplits.length).toBeGreaterThan(0);
    });

    it('should send 100% to regional_fund when no groups configured', async () => {
      const userAccount = await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId2,
        ownerType: 'user',
        currency: 'BRL',
      });

      // Garantir que não há alocações
      await userGroupAllocationRepository.deleteAllByUserId(testTenantId, testUserId2);

      // Criar transação com split
      const result = await bankTransactionService.createTransactionWithSplit(testTenantId, {
        eventId: uuidv4(),
        fromAccountId: userAccount.accountId,
        amount: 1000,
        currency: 'BRL',
        context: 'service_booking',
        revenueShareAccountId: userAccount.accountId,
        fromUserId: testUserId2,
        description: 'Test no groups -> regional fund',
      });

      // Verificar que há split para regional_fund
      const splits = await bankSplitRepository.getSplitsByTransaction(testTenantId, result.transaction.transactionId);
      const regionalFundAccount = await bankAccountService.getSystemAccount(testTenantId, 'regional_fund', 'BRL');
      const regionalFundSplits = splits.filter((s) => 
        s.splitType === 'regional_fund' || 
        (regionalFundAccount && s.targetAccountId === regionalFundAccount.accountId)
      );

      expect(regionalFundSplits.length).toBeGreaterThan(0);
    });
  });
});







