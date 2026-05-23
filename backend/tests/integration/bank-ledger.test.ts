// backend/tests/integration/bank-ledger.test.ts
// Integração: ledger + transfer com contrato canónico (centavos branded na fronteira do repo; write-path explícito).

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../src/core/database/pool';
import { bankAccountService } from '../../src/modules/bank/bank-account.service';
import { bankLedgerRepository } from '../../src/modules/bank/bank-ledger.repository';
import { bankTransactionService } from '../../src/modules/bank/bank-transaction.service';
import { bankAccountRepository } from '../../src/modules/bank/bank-account.repository';
import { actorRepository } from '../../src/modules/social/actor.repository';
import { buildFinancialAuthorshipFromRequest } from '../../src/modules/bank/financial-authorship.helper';
import { asMoneyCents, toPositiveMoneyCents } from '../../src/contracts/marketplace/canonical';
import { v4 as uuidv4 } from 'uuid';

describe('BankLedger - Sprint 1', () => {
  let testTenantId: string;
  let testUserId: string;
  let testActorId: string;
  let testAccountId: string;
  let testAccountId2: string;
  /** Conta system só para capacidade de execução (trigger check_coverage / system_coverage). */
  let systemCoverageAccountId: string;

  beforeAll(async () => {
    const tenantResult = await pool.query(
      `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
      ['Test Bank', `test-bank-${uuidv4().slice(0, 8)}`]
    );
    testTenantId = tenantResult.rows[0].id;

    const userResult = await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, password_hash)
       VALUES (gen_random_uuid(), $1, 'test@bank.com', 'hash')
       RETURNING user_id`,
      [testTenantId]
    );
    testUserId = userResult.rows[0].user_id;

    const actor = await actorRepository.findOrCreateUserActor(testTenantId, testUserId);
    testActorId = actor.actor_id;

    const account1 = await bankAccountRepository.createAccount(testTenantId, {
      ownerId: testUserId,
      ownerType: 'user',
      currency: 'BRL',
    });
    testAccountId = account1.accountId;

    const account2 = await bankAccountRepository.createAccount(testTenantId, {
      ownerId: `ledger-empty-${uuidv4()}`,
      ownerType: 'system',
      currency: 'BRL',
    });
    testAccountId2 = account2.accountId;

    const coveragePool = await bankAccountRepository.createAccount(testTenantId, {
      ownerId: `ledger-coverage-pool-${uuidv4()}`,
      ownerType: 'system',
      currency: 'BRL',
    });
    systemCoverageAccountId = coveragePool.accountId;
    await pool.query(
      `INSERT INTO bank_ledger (tenant_id, account_id, transaction_id, direction, amount_cents, purpose)
       VALUES ($1, $2, NULL, 'credit', $3, 'execution')`,
      [testTenantId, systemCoverageAccountId, 500_000_000]
    );
  });

  afterAll(async () => {
    if (!testTenantId) return;
    try {
      await pool.query('ALTER TABLE bank_ledger DISABLE TRIGGER bank_ledger_no_update');
      await pool.query('ALTER TABLE bank_ledger DISABLE TRIGGER bank_ledger_no_delete');
      await pool.query('DELETE FROM bank_ledger WHERE tenant_id = $1', [testTenantId]);
    } finally {
      await pool.query('ALTER TABLE bank_ledger ENABLE TRIGGER bank_ledger_no_update');
      await pool.query('ALTER TABLE bank_ledger ENABLE TRIGGER bank_ledger_no_delete');
    }
    await pool.query('DELETE FROM bank_transactions WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM bank_accounts WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM actors WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [testTenantId]);
  });

  function testAuthorship(accountId: string) {
    return buildFinancialAuthorshipFromRequest({
      performedByUserId: testUserId,
      actingForActorId: testActorId,
      actingForAccountId: accountId,
      authoritySource: 'ownership',
      permissionSnapshot: {
        permissionKey: 'ownership',
        allowed: true,
        actorId: testActorId,
        userId: testUserId,
        decidedAt: new Date().toISOString(),
      },
    });
  }

  describe('Balance Calculation', () => {
    it('should calculate balance from empty ledger as zero', async () => {
      const balance = await bankLedgerRepository.calculateBalance(testTenantId, testAccountId2);

      expect(balance.balanceCents).toBe(0);
      expect(balance.totalCreditsCents).toBe(0);
      expect(balance.totalDebitsCents).toBe(0);
      expect(balance.entryCount).toBe(0);
    });

    it('should calculate balance correctly after credits', async () => {
      await bankLedgerRepository.createEntry(testTenantId, {
        accountId: testAccountId,
        entryType: 'credit',
        amountCents: toPositiveMoneyCents(100),
        balanceBeforeCents: asMoneyCents(0),
        balanceAfterCents: asMoneyCents(100),
        description: 'Test credit',
        authorship: testAuthorship(testAccountId),
      });

      const balance = await bankLedgerRepository.calculateBalance(testTenantId, testAccountId);

      expect(balance.balanceCents).toBe(100);
      expect(balance.totalCreditsCents).toBe(100);
      expect(balance.totalDebitsCents).toBe(0);
      expect(balance.entryCount).toBe(1);
    });

    it('should calculate balance correctly after debits', async () => {
      await bankLedgerRepository.createEntry(testTenantId, {
        accountId: testAccountId,
        entryType: 'debit',
        amountCents: toPositiveMoneyCents(30),
        balanceBeforeCents: asMoneyCents(100),
        balanceAfterCents: asMoneyCents(70),
        description: 'Test debit',
        authorship: testAuthorship(testAccountId),
      });

      const balance = await bankLedgerRepository.calculateBalance(testTenantId, testAccountId);

      expect(balance.balanceCents).toBe(70);
      expect(balance.totalCreditsCents).toBe(100);
      expect(balance.totalDebitsCents).toBe(30);
      expect(balance.entryCount).toBe(2);
    });
  });

  describe('Transfers', () => {
    it('should create double-entry for transfer', async () => {
      const eventId = uuidv4();
      const refId = uuidv4();

      const result = await bankTransactionService.transfer(testTenantId, {
        eventId,
        fromAccountId: testAccountId,
        toAccountId: testAccountId2,
        amountCents: 50,
        currency: 'BRL',
        transactionType: 'transfer',
        referenceType: 'integration_test',
        referenceId: refId,
        description: 'Integration test transfer at least 10 chars',
        authorship: testAuthorship(testAccountId),
      });

      expect(result.transactionId).toBeDefined();
      expect(result.fromBalanceCents).toBe(20);
      expect(result.toBalanceCents).toBe(50);
      expect(result.ledgerEntries.fromEntry).toBeDefined();
      expect(result.ledgerEntries.toEntry).toBeDefined();

      const fromBalance = await bankLedgerRepository.calculateBalance(testTenantId, testAccountId);
      const toBalance = await bankLedgerRepository.calculateBalance(testTenantId, testAccountId2);

      expect(fromBalance.balanceCents).toBe(20);
      expect(toBalance.balanceCents).toBe(50);
    });

    it('should fail transfer with insufficient balance', async () => {
      const eventId = uuidv4();
      const refId = uuidv4();

      await expect(
        bankTransactionService.transfer(testTenantId, {
          eventId,
          fromAccountId: testAccountId,
          toAccountId: testAccountId2,
          amountCents: 1000,
          currency: 'BRL',
          transactionType: 'transfer',
          referenceType: 'integration_test',
          referenceId: refId,
          description: 'Integration test insufficient funds case',
          authorship: testAuthorship(testAccountId),
        })
      ).rejects.toThrow('INSUFFICIENT_FUNDS');
    });

    it('should maintain balance invariant after transfer', async () => {
      const eventId = uuidv4();
      const refId = uuidv4();
      const initialFromBalance = await bankLedgerRepository.calculateBalance(testTenantId, testAccountId);
      const initialToBalance = await bankLedgerRepository.calculateBalance(testTenantId, testAccountId2);
      const transferAmount = 10;

      await bankTransactionService.transfer(testTenantId, {
        eventId,
        fromAccountId: testAccountId,
        toAccountId: testAccountId2,
        amountCents: transferAmount,
        currency: 'BRL',
        transactionType: 'transfer',
        referenceType: 'integration_test',
        referenceId: refId,
        description: 'Integration test invariant transfer',
        authorship: testAuthorship(testAccountId),
      });

      const finalFromBalance = await bankLedgerRepository.calculateBalance(testTenantId, testAccountId);
      const finalToBalance = await bankLedgerRepository.calculateBalance(testTenantId, testAccountId2);

      const totalBefore = initialFromBalance.balanceCents + initialToBalance.balanceCents;
      const totalAfter = finalFromBalance.balanceCents + finalToBalance.balanceCents;

      expect(totalBefore).toBe(totalAfter);
      expect(finalFromBalance.balanceCents).toBe(initialFromBalance.balanceCents - transferAmount);
      expect(finalToBalance.balanceCents).toBe(initialToBalance.balanceCents + transferAmount);
    });
  });

  describe('Balance Validation', () => {
    it('should surface ledger vs stub cache when DB has no cached_balance (Genesis)', async () => {
      const validation = await bankAccountService.validateBalance(testTenantId, testAccountId);

      // Genesis: sem coluna cached_balance no row — o repo devolve cache 0; o saldo real vem só do ledger.
      expect(validation.calculatedBalanceCents).toBeGreaterThan(0);
      expect(validation.cachedBalanceCents).toBe(0);
      expect(validation.isValid).toBe(false);
      expect(validation.differenceCents).toBe(validation.calculatedBalanceCents);
    });

    it('should update cached balance if it differs from calculated', async () => {
      await bankAccountRepository.updateCachedBalance(testTenantId, testAccountId, asMoneyCents(999));

      const account = await bankAccountService.getAccountById(testTenantId, testAccountId);
      const balance = await bankLedgerRepository.calculateBalance(testTenantId, testAccountId);

      expect(account!.cachedBalanceCents).toBe(balance.balanceCents);
    });
  });

  describe('Ledger Immutability', () => {
    it('should prevent UPDATE on ledger entries', async () => {
      const entry = await bankLedgerRepository.createEntry(testTenantId, {
        accountId: testAccountId,
        entryType: 'credit',
        amountCents: toPositiveMoneyCents(5),
        balanceBeforeCents: asMoneyCents(10),
        balanceAfterCents: asMoneyCents(15),
        authorship: testAuthorship(testAccountId),
      });

      await expect(
        pool.query(`UPDATE bank_ledger SET amount_cents = 999 WHERE id = $1`, [entry.entryId])
      ).rejects.toThrow(/append-only|not allowed/i);
    });

    it('should prevent DELETE on ledger entries', async () => {
      const entry = await bankLedgerRepository.createEntry(testTenantId, {
        accountId: testAccountId,
        entryType: 'credit',
        amountCents: toPositiveMoneyCents(5),
        balanceBeforeCents: asMoneyCents(15),
        balanceAfterCents: asMoneyCents(20),
        authorship: testAuthorship(testAccountId),
      });

      await expect(pool.query(`DELETE FROM bank_ledger WHERE id = $1`, [entry.entryId])).rejects.toThrow(
        /append-only|not allowed/i
      );
    });
  });
});
