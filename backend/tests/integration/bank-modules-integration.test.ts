// backend/tests/integration/bank-modules-integration.test.ts
// SPRINT 3: SYSTEM INTEGRATION WITH UNIFY BANK
// Testes de integração end-to-end (Events, Services, Groups)

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../src/core/database/pool';
import { bankIntegrationService } from '../../src/modules/bank/bank-integration.service';
import { bankTransactionService } from '../../src/modules/bank/bank-transaction.service';
import { bankAccountService } from '../../src/modules/bank/bank-account.service';
import { bankLedgerRepository } from '../../src/modules/bank/bank-ledger.repository';
import { v4 as uuidv4 } from 'uuid';

describe('Bank Modules Integration - Sprint 3', () => {
  let testTenantId: string;
  let testUserId1: string;
  let testUserId2: string;
  let testEventId: string;
  let testGroupId: string;
  let testServiceId: string;
  let testBookingId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    const tenantResult = await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug) 
       VALUES (gen_random_uuid(), 'Test Integration', 'test-integration')
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

    // Criar evento de teste (mock)
    testEventId = uuidv4();
    await pool.query(
      `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, status, ticket_price_cents, city_id)
       VALUES ($1, $2, $3, 'user', 'CULTURAL', 'PUBLISHED', 10000, NULL)`,
      [testEventId, testTenantId, testUserId2]
    );

    // Criar grupo de teste (mock)
    testGroupId = uuidv4();
    await pool.query(
      `INSERT INTO groups (group_id, tenant_id, owner_user_id, name, description, is_active)
       VALUES ($1, $2, $3, 'Test Group', 'Test Description', true)`,
      [testGroupId, testTenantId, testUserId1]
    );

    // Criar service e booking de teste (mock)
    testServiceId = uuidv4();
    testBookingId = uuidv4();

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
    // Limpar dados de teste (bank_ledger é append-only, isolado por tenant_id)
    await pool.query('DELETE FROM bank_splits WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_transactions WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_accounts WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM events WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM groups WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
  });

  describe('Events Integration', () => {
    it('should create bank transaction when event ticket is purchased', async () => {
      const result = await bankIntegrationService.processEventTicketPayment(testTenantId, {
        eventId: testEventId,
        buyerUserId: testUserId1,
        amount: 100,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      expect(result.transactionId).toBeDefined();
      expect(result.splits.length).toBeGreaterThan(0);

      // Verificar que transação existe no bank
      const transaction = await bankTransactionService.getTransactionById(testTenantId, result.transactionId);
      expect(transaction).toBeDefined();
      expect(transaction!.amount).toBe(100);
      expect(transaction!.transactionType).toBe('split');
    });

    it('should read organizer balance from bank', async () => {
      // Criar algumas transações de ingressos
      await bankIntegrationService.processEventTicketPayment(testTenantId, {
        eventId: testEventId,
        buyerUserId: testUserId1,
        amount: 50,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      // Ler saldo do organizador do bank
      const organizerBalance = await bankIntegrationService.getEventOrganizerBalance(
        testTenantId,
        testEventId,
        'BRL'
      );

      expect(organizerBalance).toBeGreaterThan(0);
    });
  });

  describe('Services Integration', () => {
    it('should create bank transaction when service booking payment is executed', async () => {
      const result = await bankIntegrationService.processServiceBookingPayment(testTenantId, {
        bookingId: testBookingId,
        serviceId: testServiceId,
        buyerUserId: testUserId1,
        providerUserId: testUserId2,
        amount: 200,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      expect(result.transactionId).toBeDefined();
      expect(result.splits.length).toBe(2); // Provider (97%) + Fee (3%)

      // Verificar que transação existe no bank
      const transaction = await bankTransactionService.getTransactionById(testTenantId, result.transactionId);
      expect(transaction).toBeDefined();
      expect(transaction!.amount).toBe(200);
    });

    it('should reverse transaction when service booking is cancelled', async () => {
      // Criar transação inicial
      const originalResult = await bankIntegrationService.processServiceBookingPayment(testTenantId, {
        bookingId: testBookingId,
        serviceId: testServiceId,
        buyerUserId: testUserId1,
        providerUserId: testUserId2,
        amount: 150,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      // Reverter transação (simulando cancelamento)
      const reversalResult = await bankIntegrationService.reverseTransaction(
        testTenantId,
        originalResult.transactionId
      );

      expect(reversalResult.reversalTransactionId).toBeDefined();
    });
  });

  describe('Groups Integration', () => {
    it('should create bank transaction when group receives contribution', async () => {
      const result = await bankIntegrationService.processGroupContribution(testTenantId, {
        groupId: testGroupId,
        contributorUserId: testUserId1,
        amount: 75,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      expect(result.transactionId).toBeDefined();

      // Verificar que transação existe no bank
      const transaction = await bankTransactionService.getTransactionById(testTenantId, result.transactionId);
      expect(transaction).toBeDefined();
      expect(transaction!.amount).toBe(75);
    });

    it('should read group balance from bank', async () => {
      // Criar contribuição
      await bankIntegrationService.processGroupContribution(testTenantId, {
        groupId: testGroupId,
        contributorUserId: testUserId1,
        amount: 50,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      // Ler saldo do grupo do bank
      const groupBalance = await bankIntegrationService.getGroupBalance(testTenantId, testGroupId, 'BRL');

      expect(groupBalance).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Flow', () => {
    it('should maintain money conservation across all modules', async () => {
      // Capturar total antes
      const accountsBefore = await bankAccountService.searchAccounts(testTenantId, {});
      const totalBefore = await Promise.all(
        accountsBefore.map((acc) => bankLedgerRepository.calculateBalance(testTenantId, acc.accountId))
      );
      const sumBefore = totalBefore.reduce((sum, balance) => sum + balance.balanceCents, 0);

      // Executar ações em múltiplos módulos
      await bankIntegrationService.processEventTicketPayment(testTenantId, {
        eventId: testEventId,
        buyerUserId: testUserId1,
        amount: 100,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      await bankIntegrationService.processServiceBookingPayment(testTenantId, {
        bookingId: testBookingId,
        serviceId: testServiceId,
        buyerUserId: testUserId1,
        providerUserId: testUserId2,
        amount: 50,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      await bankIntegrationService.processGroupContribution(testTenantId, {
        groupId: testGroupId,
        contributorUserId: testUserId1,
        amount: 25,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      // Capturar total depois
      const accountsAfter = await bankAccountService.searchAccounts(testTenantId, {});
      const totalAfter = await Promise.all(
        accountsAfter.map((acc) => bankLedgerRepository.calculateBalance(testTenantId, acc.accountId))
      );
      const sumAfter = totalAfter.reduce((sum, balance) => sum + balance.balanceCents, 0);

      // Total deve ser igual (dinheiro não é criado nem destruído)
      expect(Math.abs(sumBefore - sumAfter)).toBeLessThan(0.01);
    });
  });
});







