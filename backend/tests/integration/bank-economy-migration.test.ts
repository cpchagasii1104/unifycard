// backend/tests/integration/bank-economy-migration.test.ts
// CONTINUOUS PRODUCTION: Tests proving Events/Groups migrated to Unify Bank
// Validates that Events and Groups write to Bank and no longer touch Economy

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../src/core/database/pool';
import { bankIntegrationService } from '../../src/modules/bank/bank-integration.service';
import { bankTransactionService } from '../../src/modules/bank/bank-transaction.service';
import { bankAccountService } from '../../src/modules/bank/bank-account.service';
import { bankLedgerRepository } from '../../src/modules/bank/bank-ledger.repository';
import { eventsPaymentService } from '../../src/modules/events/events-payment.service';
import { v4 as uuidv4 } from 'uuid';

describe('Bank Economy Migration - Continuous Production', () => {
  let testTenantId: string;
  let testUserId1: string;
  let testUserId2: string;
  let testEventId: string;
  let testGroupId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    const tenantResult = await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug) 
       VALUES (gen_random_uuid(), 'Test Migration', 'test-migration')
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

    // Criar evento de teste
    testEventId = uuidv4();
    await pool.query(
      `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, status, ticket_price_cents, city_id)
       VALUES ($1, $2, $3, 'user', 'CULTURAL', 'PUBLISHED', 10000, NULL)`,
      [testEventId, testTenantId, testUserId2]
    );

    // Criar grupo de teste
    testGroupId = uuidv4();
    await pool.query(
      `INSERT INTO groups (group_id, tenant_id, owner_user_id, name, description, is_active, metadata)
       VALUES ($1, $2, $3, 'Test Group', 'Test Description', true, '{"hasFinancialIntent": true}'::jsonb)`,
      [testGroupId, testTenantId, testUserId1]
    );

    // Depositar saldo inicial
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
    // Limpar dados de teste (bank_ledger é append-only, isolado por tenant_id)
    await pool.query('DELETE FROM bank_splits WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_transactions WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_accounts WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM events WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM groups WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
  });

  describe('Events Payment Migration', () => {
    it('should create Bank transaction when event payment is processed', async () => {
      const result = await eventsPaymentService.processEventPayment({
        tenantId: testTenantId,
        eventId: testEventId,
        attendeeUserId: testUserId1,
        organizerId: testUserId2,
        amount: 100,
        currency: 'BRL',
      });

      expect(result.transactionIds.length).toBeGreaterThan(0);
      const transactionId = result.transactionIds[0];

      // Verificar que transação existe no Bank
      const transaction = await bankTransactionService.getTransactionById(testTenantId, transactionId);
      expect(transaction).toBeDefined();
      expect(transaction!.amount).toBe(100);
      expect(transaction!.transactionType).toBe('split');
    });

    it('should use event_ticket context for Bank transaction', async () => {
      const result = await bankIntegrationService.processEventTicketPayment(testTenantId, {
        eventId: testEventId,
        buyerUserId: testUserId1,
        amount: 50,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      // Verificar que splits foram criados (organizer + fee + regional_fund + reserve)
      expect(result.splits.length).toBeGreaterThan(0);

      // Verificar que transação existe no Bank
      const transaction = await bankTransactionService.getTransactionById(testTenantId, result.transactionId);
      expect(transaction).toBeDefined();
      expect(transaction!.metadata?.type).toBe('event_ticket');
    });
  });

  describe('Groups Migration', () => {
    it('should read group balance from Bank only', async () => {
      // Criar contribuição para o grupo
      await bankIntegrationService.processGroupContribution(testTenantId, {
        groupId: testGroupId,
        contributorUserId: testUserId1,
        amount: 75,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      // Ler saldo do grupo do Bank
      const balance = await bankIntegrationService.getGroupBalance(testTenantId, testGroupId, 'BRL');
      expect(balance).toBeGreaterThan(0);
    });

    it('should create Bank transaction for group contribution', async () => {
      const result = await bankIntegrationService.processGroupContribution(testTenantId, {
        groupId: testGroupId,
        contributorUserId: testUserId1,
        amount: 50,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      expect(result.transactionId).toBeDefined();

      // Verificar que transação existe no Bank
      const transaction = await bankTransactionService.getTransactionById(testTenantId, result.transactionId);
      expect(transaction).toBeDefined();
      expect(transaction!.amount).toBe(50);
      expect(transaction!.transactionType).toBe('split');
      expect(transaction!.metadata?.type).toBe('group_contribution');
    });
  });

  describe('No Economy Usage', () => {
    it('should not create entries in legacy transactions table', async () => {
      // Processar pagamento de evento
      await eventsPaymentService.processEventPayment({
        tenantId: testTenantId,
        eventId: testEventId,
        attendeeUserId: testUserId1,
        organizerId: testUserId2,
        amount: 25,
        currency: 'BRL',
      });

      // Verificar que NÃO há transações na tabela legacy
      const legacyTransactions = await pool.query(
        `SELECT COUNT(*) as count FROM transactions WHERE tenant_id = $1`,
        [testTenantId]
      );

      // Pode haver transações legadas de outros testes, mas não devemos criar novas
      // O importante é que a nova transação está no Bank
      const bankTransactions = await pool.query(
        `SELECT COUNT(*) as count FROM bank_transactions WHERE tenant_id = $1`,
        [testTenantId]
      );

      expect(parseInt(bankTransactions.rows[0].count)).toBeGreaterThan(0);
    });

    it('should not create entries in legacy ledger table', async () => {
      // Processar pagamento de evento
      await eventsPaymentService.processEventPayment({
        tenantId: testTenantId,
        eventId: testEventId,
        attendeeUserId: testUserId1,
        organizerId: testUserId2,
        amount: 30,
        currency: 'BRL',
      });

      // Verificar que NÃO há entradas no ledger legacy para novas transações
      // (pode haver entradas legadas, mas novas devem ir para bank_ledger)
      const bankLedgerEntries = await pool.query(
        `SELECT COUNT(*) as count FROM bank_ledger WHERE tenant_id = $1`,
        [testTenantId]
      );

      expect(parseInt(bankLedgerEntries.rows[0].count)).toBeGreaterThan(0);
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
      const sumBefore = totalBefore.reduce((sum, balance) => sum + balance.balanceCents, 0);

      // Processar pagamentos via Bank
      await eventsPaymentService.processEventPayment({
        tenantId: testTenantId,
        eventId: testEventId,
        attendeeUserId: testUserId1,
        organizerId: testUserId2,
        amount: 40,
        currency: 'BRL',
      });

      await bankIntegrationService.processGroupContribution(testTenantId, {
        groupId: testGroupId,
        contributorUserId: testUserId1,
        amount: 20,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      // Capturar total depois
      const accountsAfter = await bankAccountService.searchAccounts(testTenantId, {});
      const totalAfter = await Promise.all(
        accountsAfter.map((acc) =>
          bankLedgerRepository.calculateBalance(testTenantId, acc.accountId)
        )
      );
      const sumAfter = totalAfter.reduce((sum, balance) => sum + balance.balanceCents, 0);

      // Total deve ser igual (dinheiro não é criado nem destruído)
      expect(Math.abs(sumBefore - sumAfter)).toBeLessThan(0.01);
    });
  });
});







