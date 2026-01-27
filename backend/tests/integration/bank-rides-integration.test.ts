// backend/tests/integration/bank-rides-integration.test.ts
// SPRINT 4: DRIVER SYSTEM (RIDES) AS A FULL SYSTEM STRESS TEST
// Testes de integração end-to-end para rides com Unify Bank

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../src/core/database/pool';
import { bankIntegrationService } from '../../src/modules/bank/bank-integration.service';
import { bankTransactionService } from '../../src/modules/bank/bank-transaction.service';
import { bankAccountService } from '../../src/modules/bank/bank-account.service';
import { bankLedgerRepository } from '../../src/modules/bank/bank-ledger.repository';
import { distributionService } from '../../src/modules/rides/distribution/distribution.service';
import { v4 as uuidv4 } from 'uuid';

describe('Bank Rides Integration - Sprint 4', () => {
  let testTenantId: string;
  let testPassengerUserId: string;
  let testDriverUserId: string;
  let testDriverId: string;
  let testRideId: string;
  let testServiceTypeId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    const tenantResult = await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug) 
       VALUES (gen_random_uuid(), 'Test Rides Integration', 'test-rides-integration')
       RETURNING tenant_id`
    );
    testTenantId = tenantResult.rows[0].tenant_id;

    // Criar usuários de teste
    const passengerResult = await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, password_hash)
       VALUES (gen_random_uuid(), $1, 'passenger@test.com', 'hash')
       RETURNING user_id`,
      [testTenantId]
    );
    testPassengerUserId = passengerResult.rows[0].user_id;

    const driverResult = await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, password_hash)
       VALUES (gen_random_uuid(), $1, 'driver@test.com', 'hash')
       RETURNING user_id`,
      [testTenantId]
    );
    testDriverUserId = driverResult.rows[0].user_id;

    // Criar driver de teste
    const driverRow = await pool.query(
      `INSERT INTO rides_drivers (driver_id, tenant_id, user_id, is_active, is_verified, rating_count)
       VALUES (gen_random_uuid(), $1, $2, true, true, 0)
       RETURNING driver_id`,
      [testTenantId, testDriverUserId]
    );
    testDriverId = driverRow.rows[0].driver_id;

    // Criar service type de teste
    const serviceTypeRow = await pool.query(
      `INSERT INTO rides_service_types (service_type_id, tenant_id, name, capacity, base_price, is_active)
       VALUES (gen_random_uuid(), $1, 'Standard', 4, 5.00, true)
       RETURNING service_type_id`,
      [testTenantId]
    );
    testServiceTypeId = serviceTypeRow.rows[0].service_type_id;

    // Criar ride de teste
    testRideId = uuidv4();
    await pool.query(
      `INSERT INTO rides_rides (
        ride_id, tenant_id, request_id, passenger_user_id, driver_id, service_type_id,
        status, final_price, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'completed', 50.00, now())`,
      [
        testRideId,
        testTenantId,
        uuidv4(),
        testPassengerUserId,
        testDriverId,
        testServiceTypeId,
      ]
    );

    // Depositar saldo inicial para passageiro
    await bankTransactionService.createSimpleTransaction(testTenantId, {
      eventId: uuidv4(),
      toAccountId: (await bankAccountService.getOrCreateAccount(testTenantId, {
        ownerId: testPassengerUserId,
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
    await pool.query('DELETE FROM rides_ride_distributions WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM rides_rides WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM rides_drivers WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM rides_service_types WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_splits WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_ledger WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_transactions WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_accounts WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
  });

  describe('Ride Payment Flow', () => {
    it('should create bank transaction when ride payment is processed', async () => {
      const ride = {
        ride_id: testRideId,
        passenger_user_id: testPassengerUserId,
        driver_id: testDriverId,
      };
      const price = { total: 50.0 };

      const result = await distributionService.processRidePayment(testTenantId, ride, price);

      expect(result.bankTransactionId).toBeDefined();
      expect(result.driverAmount).toBeCloseTo(48.50, 2); // 50 * 0.97
      expect(result.platformAmount).toBeCloseTo(1.50, 2); // 50 * 0.03

      // Verificar que transação existe no bank
      const transaction = await bankTransactionService.getTransactionById(
        testTenantId,
        result.bankTransactionId!
      );
      expect(transaction).toBeDefined();
      expect(transaction!.amount).toBe(50.0);
      expect(transaction!.transactionType).toBe('split');
    });

    it('should store bankTransactionId in ride metadata', async () => {
      const ride = {
        ride_id: testRideId,
        passenger_user_id: testPassengerUserId,
        driver_id: testDriverId,
      };
      const price = { total: 75.0 };

      const result = await distributionService.processRidePayment(testTenantId, ride, price);

      // Verificar que bankTransactionId foi armazenado
      const rideMetadata = await pool.query<{ metadata: any }>(
        `SELECT metadata FROM rides_rides WHERE tenant_id = $1 AND ride_id = $2`,
        [testTenantId, testRideId]
      );

      expect(rideMetadata.rows[0]?.metadata?.bankTransactionId).toBe(result.bankTransactionId);
    });

    it('should create correct splits (97% driver, 3% fee)', async () => {
      const result = await bankIntegrationService.processRidePayment(testTenantId, {
        rideId: uuidv4(),
        passengerUserId: testPassengerUserId,
        driverUserId: testDriverUserId,
        amount: 100,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      expect(result.splits.length).toBe(2); // Driver + Fee

      // Buscar contas para identificar splits
      const driverAccount = await bankAccountService.getAccountByOwner(
        testTenantId,
        testDriverUserId,
        'user',
        'BRL'
      );
      const feeAccount = await bankAccountService.getSystemAccount(testTenantId, 'fee', 'BRL');

      // Verificar valores aproximados (com tolerância para arredondamento)
      const driverSplit = result.splits.find((s) => s.accountId === driverAccount?.accountId);
      const feeSplit = result.splits.find((s) => s.accountId === feeAccount?.accountId);

      expect(driverSplit).toBeDefined();
      expect(feeSplit).toBeDefined();
      expect(driverSplit!.amount).toBeCloseTo(97.0, 1); // 100 * 0.97
      expect(feeSplit!.amount).toBeCloseTo(3.0, 1); // 100 * 0.03
    });
  });

  describe('Ride Cancellation with Reversal', () => {
    it('should reverse transaction when ride is cancelled after payment', async () => {
      // Criar ride e processar pagamento
      const rideId = uuidv4();
      await pool.query(
        `INSERT INTO rides_rides (
          ride_id, tenant_id, request_id, passenger_user_id, driver_id, service_type_id,
          status, final_price, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', 60.00, now())`,
        [
          rideId,
          testTenantId,
          uuidv4(),
          testPassengerUserId,
          testDriverId,
          testServiceTypeId,
        ]
      );

      const ride = {
        ride_id: rideId,
        passenger_user_id: testPassengerUserId,
        driver_id: testDriverId,
      };
      const price = { total: 60.0 };

      // Processar pagamento
      const paymentResult = await distributionService.processRidePayment(testTenantId, ride, price);
      const bankTransactionId = paymentResult.bankTransactionId!;

      // Capturar saldos antes da reversão
      const passengerAccount = await bankAccountService.getAccountByOwner(
        testTenantId,
        testPassengerUserId,
        'user',
        'BRL'
      );
      const driverAccount = await bankAccountService.getAccountByOwner(
        testTenantId,
        testDriverUserId,
        'user',
        'BRL'
      );

      const passengerBalanceBefore = await bankLedgerRepository.calculateBalance(
        testTenantId,
        passengerAccount!.accountId
      );
      const driverBalanceBefore = await bankLedgerRepository.calculateBalance(
        testTenantId,
        driverAccount!.accountId
      );

      // Reverter transação (simulando cancelamento)
      await bankIntegrationService.reverseTransaction(testTenantId, bankTransactionId);

      // Verificar que saldos foram restaurados
      const passengerBalanceAfter = await bankLedgerRepository.calculateBalance(
        testTenantId,
        passengerAccount!.accountId
      );
      const driverBalanceAfter = await bankLedgerRepository.calculateBalance(
        testTenantId,
        driverAccount!.accountId
      );

      // Saldo do passageiro deve voltar (recebe de volta o que pagou)
      expect(
        Math.abs(
          passengerBalanceAfter.balance - (passengerBalanceBefore.balance + 60.0)
        )
      ).toBeLessThan(0.01);

      // Saldo do motorista deve voltar (perde o que recebeu)
      expect(
        Math.abs(
          driverBalanceAfter.balance - (driverBalanceBefore.balance - 58.2)
        )
      ).toBeLessThan(0.01); // 60 * 0.97
    });
  });

  describe('Money Conservation Invariant', () => {
    it('should maintain money conservation across ride payments', async () => {
      // Capturar total antes
      const accountsBefore = await bankAccountService.searchAccounts(testTenantId, {});
      const totalBefore = await Promise.all(
        accountsBefore.map((acc) =>
          bankLedgerRepository.calculateBalance(testTenantId, acc.accountId)
        )
      );
      const sumBefore = totalBefore.reduce((sum, balance) => sum + balance.balance, 0);

      // Processar pagamento de corrida
      await bankIntegrationService.processRidePayment(testTenantId, {
        rideId: uuidv4(),
        passengerUserId: testPassengerUserId,
        driverUserId: testDriverUserId,
        amount: 80,
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
      const sumAfter = totalAfter.reduce((sum, balance) => sum + balance.balance, 0);

      // Total deve ser igual (dinheiro não é criado nem destruído)
      expect(Math.abs(sumBefore - sumAfter)).toBeLessThan(0.01);
    });

    it('should maintain money conservation after reversal', async () => {
      // Capturar total antes
      const accountsBefore = await bankAccountService.searchAccounts(testTenantId, {});
      const totalBefore = await Promise.all(
        accountsBefore.map((acc) =>
          bankLedgerRepository.calculateBalance(testTenantId, acc.accountId)
        )
      );
      const sumBefore = totalBefore.reduce((sum, balance) => sum + balance.balance, 0);

      // Criar e reverter transação
      const paymentResult = await bankIntegrationService.processRidePayment(testTenantId, {
        rideId: uuidv4(),
        passengerUserId: testPassengerUserId,
        driverUserId: testDriverUserId,
        amount: 90,
        currency: 'BRL',
        idempotencyKey: uuidv4(),
      });

      await bankIntegrationService.reverseTransaction(testTenantId, paymentResult.transactionId);

      // Capturar total depois
      const accountsAfter = await bankAccountService.searchAccounts(testTenantId, {});
      const totalAfter = await Promise.all(
        accountsAfter.map((acc) =>
          bankLedgerRepository.calculateBalance(testTenantId, acc.accountId)
        )
      );
      const sumAfter = totalAfter.reduce((sum, balance) => sum + balance.balance, 0);

      // Total deve ser igual (reversão não cria nem destrói dinheiro)
      expect(Math.abs(sumBefore - sumAfter)).toBeLessThan(0.01);
    });
  });

  describe('No Negative Balances', () => {
    it('should prevent negative balances in ride payments', async () => {
      // Passageiro sem saldo suficiente
      const passengerAccount = await bankAccountService.getAccountByOwner(
        testTenantId,
        testPassengerUserId,
        'user',
        'BRL'
      );
      const balance = await bankLedgerRepository.calculateBalance(
        testTenantId,
        passengerAccount!.accountId
      );

      // Tentar pagar mais do que tem
      if (balance.balance < 200) {
        await expect(
          bankIntegrationService.processRidePayment(testTenantId, {
            rideId: uuidv4(),
            passengerUserId: testPassengerUserId,
            driverUserId: testDriverUserId,
            amount: 200,
            currency: 'BRL',
            idempotencyKey: uuidv4(),
          })
        ).rejects.toThrow();
      }
    });
  });
});







