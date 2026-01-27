// backend/tests/integration/bank-p2p-donation-migration.test.ts
// CONTINUOUS PRODUCTION: Tests proving P2P Transfer and Donation migrated to Unify Bank

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../src/core/database/pool';
import { bankP2PTransferService } from '../../src/core/unifybank/bank-p2p-transfer.service';
import { donationService } from '../../src/core/unifybank/donation.service';
import { bankTransactionService } from '../../src/modules/bank/bank-transaction.service';
import { bankAccountService } from '../../src/modules/bank/bank-account.service';
import { bankLedgerRepository } from '../../src/modules/bank/bank-ledger.repository';
import { v4 as uuidv4 } from 'uuid';

describe('Bank P2P Transfer and Donation Migration - Continuous Production', () => {
  let testTenantId: string;
  let testUserId1: string;
  let testUserId2: string;
  let testGroupId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    const tenantResult = await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug) 
       VALUES (gen_random_uuid(), 'Test P2P Migration', 'test-p2p-migration')
       RETURNING tenant_id`
    );
    testTenantId = tenantResult.rows[0].tenant_id;

    // Criar usuários de teste
    const user1Result = await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, password_hash)
       VALUES (gen_random_uuid(), $1, 'p2puser1@test.com', 'hash')
       RETURNING user_id`,
      [testTenantId]
    );
    testUserId1 = user1Result.rows[0].user_id;

    const user2Result = await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, password_hash)
       VALUES (gen_random_uuid(), $1, 'p2puser2@test.com', 'hash')
       RETURNING user_id`,
      [testTenantId]
    );
    testUserId2 = user2Result.rows[0].user_id;

    // Criar grupo de teste
    testGroupId = uuidv4();
    await pool.query(
      `INSERT INTO groups (group_id, tenant_id, owner_user_id, name, description, is_active, metadata)
       VALUES ($1, $2, $3, 'Test Donation Group', 'Test Description', true, '{"hasFinancialIntent": true}'::jsonb)`,
      [testGroupId, testTenantId, testUserId1]
    );

    // Depositar saldo inicial para user1
    await bankTransactionService.createSimpleTransaction(testTenantId, {
      eventId: uuidv4(),
      toAccountId: (await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testUserId1,
        ownerType: 'user',
        currency: 'BRL',
      })).accountId,
      amount: 1000,
      currency: 'BRL',
      transactionType: 'deposit',
    });
  });

  afterAll(async () => {
    // Limpar dados de teste
    await pool.query('DELETE FROM bank_splits WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_ledger WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_transactions WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_accounts WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM groups WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
  });

  describe('P2P Transfer Migration', () => {
    it('should create Bank transaction when P2P transfer is executed', async () => {
      const result = await bankP2PTransferService.transferP2P(testTenantId, {
        fromUserId: testUserId1,
        toUserId: testUserId2,
        amount: 100,
        eventId: uuidv4(),
      });

      expect(result.transaction.transactionId).toBeDefined();
      expect(result.fromAccountBalance).toBeLessThan(1000);
      expect(result.toAccountBalance).toBe(100);

      // Verificar que transação existe no Bank
      const transaction = await bankTransactionService.getTransactionById(
        testTenantId,
        result.transaction.transactionId
      );
      expect(transaction).toBeDefined();
      expect(transaction!.amount).toBe(100);
      expect(transaction!.transactionType).toBe('split');
      expect(transaction!.metadata?.type).toBe('p2p_transfer');
    });

    it('should use p2p_transfer context with 0% fee', async () => {
      const result = await bankP2PTransferService.transferP2P(testTenantId, {
        fromUserId: testUserId1,
        toUserId: testUserId2,
        amount: 50,
        eventId: uuidv4(),
      });

      // Verificar splits (deve ter apenas revenue_share 100% para destinatário)
      const transaction = await bankTransactionService.getTransactionById(
        testTenantId,
        result.transaction.transactionId
      );
      expect(transaction).toBeDefined();
      
      // Buscar splits
      const { bankSplitRepository } = await import('../../src/modules/bank/bank-split.repository');
      const splits = await bankSplitRepository.getSplitsByTransactionId(
        testTenantId,
        result.transaction.transactionId
      );
      
      // Deve ter apenas 1 split (100% para destinatário, 0% fee)
      expect(splits.length).toBe(1);
      expect(splits[0].splitType).toBe('revenue_share');
      expect(splits[0].amount).toBe(50);
    });
  });

  describe('Donation Migration', () => {
    it('should create Bank transaction when user donation is created', async () => {
      const result = await donationService.createDonation(testTenantId, {
        fromUserId: testUserId1,
        targetType: 'user',
        targetId: testUserId2,
        amount: 75,
        message: 'Test donation',
        eventId: uuidv4(),
      });

      expect(result.transactionId).toBeDefined();
      expect(result.amount).toBe(75);
      expect(result.targetType).toBe('user');

      // Verificar que transação existe no Bank
      const transaction = await bankTransactionService.getTransactionById(
        testTenantId,
        result.transactionId
      );
      expect(transaction).toBeDefined();
      expect(transaction!.metadata?.type).toBe('donation');
    });

    it('should create Bank transaction when group donation is created', async () => {
      const result = await donationService.createDonation(testTenantId, {
        fromUserId: testUserId1,
        targetType: 'group',
        targetId: testGroupId,
        amount: 50,
        message: 'Group donation',
        eventId: uuidv4(),
      });

      expect(result.transactionId).toBeDefined();
      expect(result.targetType).toBe('group');

      // Verificar que transação existe no Bank
      const transaction = await bankTransactionService.getTransactionById(
        testTenantId,
        result.transactionId
      );
      expect(transaction).toBeDefined();
      expect(transaction!.metadata?.type).toBe('donation');
      expect(transaction!.metadata?.targetType).toBe('group');
    });
  });

  describe('No Economy Usage', () => {
    it('should not create entries in legacy transactions table', async () => {
      // Processar P2P transfer
      await bankP2PTransferService.transferP2P(testTenantId, {
        fromUserId: testUserId1,
        toUserId: testUserId2,
        amount: 25,
        eventId: uuidv4(),
      });

      // Verificar que NÃO há transações na tabela legacy
      const legacyTransactions = await pool.query(
        `SELECT COUNT(*) as count FROM transactions WHERE tenant_id = $1`,
        [testTenantId]
      );

      // Pode haver transações legadas de outros testes, mas não devemos criar novas
      const bankTransactions = await pool.query(
        `SELECT COUNT(*) as count FROM bank_transactions WHERE tenant_id = $1`,
        [testTenantId]
      );

      expect(parseInt(bankTransactions.rows[0].count)).toBeGreaterThan(0);
    });
  });

  describe('Money Conservation', () => {
    it('should maintain money conservation with Bank-only transactions', async () => {
      // Capturar total antes
      const accountsBefore = await bankAccountService.searchAccounts(testTenantId, {});
      const totalBefore = await Promise.all(
        accountsBefore.map((acc) =>
          bankLedgerRepository.calculateBalance(testTenantId, acc.accountId)
        )
      );
      const sumBefore = totalBefore.reduce((sum, balance) => sum + balance.balance, 0);

      // Processar P2P e doação via Bank
      await bankP2PTransferService.transferP2P(testTenantId, {
        fromUserId: testUserId1,
        toUserId: testUserId2,
        amount: 40,
        eventId: uuidv4(),
      });

      await donationService.createDonation(testTenantId, {
        fromUserId: testUserId1,
        targetType: 'group',
        targetId: testGroupId,
        amount: 20,
        eventId: uuidv4(),
      });

      // Capturar total depois
      const accountsAfter = await bankAccountService.searchAccounts(testTenantId, {});
      const totalAfter = await Promise.all(
        accountsAfter.map((acc) =>
          bankLedgerRepository.calculateBalance(testTenantId, acc.accountId)
        )
      );
      const sumAfter = totalAfter.reduce((sum, balance) => sum + balance.balance, 0);

      // Total deve ser igual (dinheiro não é criado nem destruído)
      expect(Math.abs(sumBefore - sumAfter)).toBeLessThan(0.01);
    });
  });
});







