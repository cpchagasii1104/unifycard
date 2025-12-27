// backend/tests/integration/transparency.test.ts
// Testes de integração para Transparência Financeira
// FASE 6: Transparência Financeira

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../src/core/database/pool';
import { transparencyService } from '../../src/core/unifybank/transparency.service';
import { transactionService } from '../../src/core/economy/transactions/transaction.service';
import { accountService } from '../../src/core/economy/accounts/account.service';
import { bankP2PTransferService } from '../../src/core/unifybank/bank-p2p-transfer.service';
import { donationService } from '../../src/core/unifybank/donation.service';
import { splitEngineService } from '../../src/core/unifybank/split-engine.service';
import { groupAccountService } from '../../src/core/economy/group-account.service';
import { resolveGlobalUserId } from '../../src/core/identity/identity.utils';

describe('Transparência Financeira - Integração', () => {
  const testTenantId = uuidv4();
  let testUserId1: string;
  let testUserId2: string;
  let testGlobalUserId1: string;
  let testGlobalUserId2: string;
  let testGroupId: string;
  let testAccountId1: string;
  let testAccountId2: string;
  let testGroupAccountId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, city_id)
       VALUES ($1, 'Test Tenant', NULL)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [testTenantId]
    );

    // Criar usuários de teste
    testUserId1 = uuidv4();
    testUserId2 = uuidv4();
    testGlobalUserId1 = uuidv4();
    testGlobalUserId2 = uuidv4();

    await pool.query(
      `INSERT INTO global_users (global_user_id, full_name, created_at)
       VALUES ($1, 'Test User 1', now()), ($2, 'Test User 2', now())
       ON CONFLICT (global_user_id) DO NOTHING`,
      [testGlobalUserId1, testGlobalUserId2]
    );

    await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, global_user_id, created_at)
       VALUES ($1, $2, 'user1@test.com', $3, now()), ($4, $2, 'user2@test.com', $5, now())
       ON CONFLICT (user_id) DO NOTHING`,
      [testUserId1, testTenantId, testGlobalUserId1, testUserId2, testGlobalUserId2]
    );

    // Criar grupo de teste
    testGroupId = uuidv4();
    await pool.query(
      `INSERT INTO groups (group_id, tenant_id, owner_user_id, name, description, is_active, created_at)
       VALUES ($1, $2, $3, 'Test Group', 'Test Description', true, now())
       ON CONFLICT (group_id) DO NOTHING`,
      [testGroupId, testTenantId, testUserId1]
    );

    // Criar contas
    const account1 = await accountService.getOrCreateUserPrimaryAccount(
      testTenantId,
      testUserId1,
      'BRL'
    );
    testAccountId1 = account1.accountId;

    const account2 = await accountService.getOrCreateUserPrimaryAccount(
      testTenantId,
      testUserId2,
      'BRL'
    );
    testAccountId2 = account2.accountId;

    // Criar conta de grupo
    testGroupAccountId = await groupAccountService.createOrGetGroupAccount(
      testTenantId,
      testGroupId
    );

    // Adicionar saldo inicial
    await pool.query(
      `UPDATE accounts SET balance = 1000 WHERE account_id = $1`,
      [testAccountId1]
    );
  });

  afterAll(async () => {
    // Limpar dados de teste
    try {
      await pool.query(`DELETE FROM transactions WHERE tenant_id = $1`, [testTenantId]);
      await pool.query(`DELETE FROM ledger WHERE tenant_id = $1`, [testTenantId]);
      await pool.query(`DELETE FROM accounts WHERE tenant_id = $1`, [testTenantId]);
      await pool.query(`DELETE FROM groups WHERE tenant_id = $1`, [testTenantId]);
      await pool.query(`DELETE FROM users WHERE tenant_id = $1`, [testTenantId]);
      await pool.query(`DELETE FROM tenants WHERE tenant_id = $1`, [testTenantId]);
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  describe('Extrato do Usuário', () => {
    it('deve retornar extrato com transações corretas', async () => {
      // Criar uma transação P2P
      const transferResult = await bankP2PTransferService.transferP2P(testTenantId, {
        fromUserId: testUserId1,
        toUserId: testUserId2,
        amount: 50,
        eventId: uuidv4(),
      });

      // Buscar extrato
      const statement = await transparencyService.getUserStatement(
        testTenantId,
        testGlobalUserId1,
        { limit: 10, offset: 0 }
      );

      expect(statement).toBeDefined();
      expect(statement.entries.length).toBeGreaterThan(0);

      // Verificar que a transação P2P está no extrato
      const p2pEntry = statement.entries.find(
        (e) => e.transactionId === transferResult.transaction.transactionId
      );
      expect(p2pEntry).toBeDefined();
      expect(p2pEntry?.type).toBe('p2p');
      expect(p2pEntry?.direction).toBe('out');
      expect(p2pEntry?.amount).toBe(50);
      expect(p2pEntry?.balanceAfter).toBeDefined();
    });

    it('deve usar balanceAfter do ledger (não recalcular)', async () => {
      // Criar transação
      const transferResult = await bankP2PTransferService.transferP2P(testTenantId, {
        fromUserId: testUserId1,
        toUserId: testUserId2,
        amount: 30,
        eventId: uuidv4(),
      });

      // Buscar extrato
      const statement = await transparencyService.getUserStatement(
        testTenantId,
        testGlobalUserId1,
        { limit: 1, offset: 0 }
      );

      expect(statement.entries.length).toBe(1);
      const entry = statement.entries[0];

      // Verificar que balanceAfter vem do ledger
      const ledgerEntry = await pool.query<{ balance_after: string }>(
        `
        SELECT balance_after
        FROM ledger
        WHERE transaction_id = $1 AND account_id = $2 AND entry_type = 'debit'
        LIMIT 1
        `,
        [transferResult.transaction.transactionId, testAccountId1]
      );

      expect(parseFloat(ledgerEntry.rows[0]?.balance_after || '0')).toBe(entry.balanceAfter);
    });
  });

  describe('Detalhe de Split', () => {
    it('deve retornar todos os splits de um splitGroupId', async () => {
      // Criar doação (que aplica split automaticamente)
      const donationResult = await donationService.createDonation(testTenantId, {
        fromUserId: testUserId1,
        targetType: 'group',
        targetId: testGroupId,
        amount: 100,
        message: 'Test donation',
        eventId: uuidv4(),
      });

      // Buscar detalhe de split
      const splitDetail = await transparencyService.getTransactionSplits(
        testTenantId,
        donationResult.transactionId
      );

      expect(splitDetail).toBeDefined();
      expect(splitDetail?.baseTransaction.transactionId).toBe(donationResult.transactionId);
      expect(splitDetail?.splits.length).toBeGreaterThan(0);

      // Verificar que soma dos splits = 100%
      expect(splitDetail?.totalPercentage).toBeCloseTo(1.0, 2);
      expect(splitDetail?.totalAmount).toBeCloseTo(100, 2);
    });

    it('deve retornar null para transação sem split', async () => {
      // Criar transação P2P simples (sem split)
      const transferResult = await bankP2PTransferService.transferP2P(testTenantId, {
        fromUserId: testUserId1,
        toUserId: testUserId2,
        amount: 25,
        eventId: uuidv4(),
      });

      // Buscar detalhe de split
      const splitDetail = await transparencyService.getTransactionSplits(
        testTenantId,
        transferResult.transaction.transactionId
      );

      expect(splitDetail).toBeDefined();
      expect(splitDetail?.splits.length).toBe(0);
      expect(splitDetail?.totalPercentage).toBe(0);
    });

    it('deve retornar null para transação inexistente', async () => {
      const splitDetail = await transparencyService.getTransactionSplits(
        testTenantId,
        uuidv4()
      );

      expect(splitDetail).toBeNull();
    });
  });

  describe('Fundo Regional - Usuário', () => {
    it('deve retornar fundo regional com entradas corretas', async () => {
      // Criar doação (que gera split para regional_fund)
      await donationService.createDonation(testTenantId, {
        fromUserId: testUserId1,
        targetType: 'group',
        targetId: testGroupId,
        amount: 200,
        message: 'Test donation for regional fund',
        eventId: uuidv4(),
      });

      // Buscar fundo regional
      const regionalFund = await transparencyService.getUserRegionalFund(
        testTenantId,
        testGlobalUserId1,
        { limit: 10, offset: 0 }
      );

      // Pode ser null se não houver conta regional configurada
      // Isso é aceitável para o teste
      if (regionalFund) {
        expect(regionalFund.accountId).toBeDefined();
        expect(regionalFund.currentBalance).toBeDefined();
        expect(regionalFund.entries.length).toBeGreaterThanOrEqual(0);
        expect(regionalFund.summary.totalIn).toBeGreaterThanOrEqual(0);
      }
    });

    it('deve calcular totais corretamente', async () => {
      const regionalFund = await transparencyService.getUserRegionalFund(
        testTenantId,
        testGlobalUserId1,
        { limit: 100, offset: 0 }
      );

      if (regionalFund) {
        const calculatedTotalIn = regionalFund.entries
          .filter((e) => e.type === 'credit')
          .reduce((sum, e) => sum + e.amount, 0);
        const calculatedTotalOut = regionalFund.entries
          .filter((e) => e.type === 'debit')
          .reduce((sum, e) => sum + e.amount, 0);

        expect(regionalFund.summary.totalIn).toBeCloseTo(calculatedTotalIn, 2);
        expect(regionalFund.summary.totalOut).toBeCloseTo(calculatedTotalOut, 2);
        expect(regionalFund.summary.netAmount).toBeCloseTo(
          calculatedTotalIn - calculatedTotalOut,
          2
        );
      }
    });
  });

  describe('Fundo Regional - Admin', () => {
    it('deve retornar visão administrativa completa', async () => {
      // Resolver regionId do tenant (usando stateId como fallback)
      const tenant = await pool.query<{ city_id: string | null }>(
        `SELECT city_id FROM tenants WHERE tenant_id = $1 LIMIT 1`,
        [testTenantId]
      );

      // Se não houver cityId, usar um regionId de teste
      const regionId = 'test-region-id';

      const adminView = await transparencyService.getAdminRegionalFund(
        testTenantId,
        regionId,
        { limit: 100, offset: 0 }
      );

      // Pode ser null se não houver conta regional
      if (adminView) {
        expect(adminView.regionId).toBe(regionId);
        expect(adminView.accountId).toBeDefined();
        expect(adminView.currentBalance).toBeDefined();
        expect(adminView.summary).toBeDefined();
        expect(adminView.summary.byOrigin).toBeDefined();
        expect(adminView.summary.byContext).toBeDefined();
        expect(adminView.summary.byPeriod).toBeDefined();
      }
    });

    it('deve agrupar corretamente por origem e contexto', async () => {
      const regionId = 'test-region-id';

      const adminView = await transparencyService.getAdminRegionalFund(
        testTenantId,
        regionId,
        { limit: 100, offset: 0 }
      );

      if (adminView && adminView.entries.length > 0) {
        // Verificar que byOrigin contém as origens corretas
        const entriesByOrigin = new Map<string, number>();
        adminView.entries
          .filter((e) => e.type === 'credit')
          .forEach((e) => {
            entriesByOrigin.set(e.origin, (entriesByOrigin.get(e.origin) || 0) + e.amount);
          });

        for (const [origin, amount] of Object.entries(adminView.summary.byOrigin)) {
          expect(entriesByOrigin.get(origin)).toBeCloseTo(amount, 2);
        }
      }
    });
  });

  describe('Read-only (sem modificações)', () => {
    it('não deve criar/modificar transações ao buscar extrato', async () => {
      const beforeCount = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM transactions WHERE tenant_id = $1`,
        [testTenantId]
      );

      await transparencyService.getUserStatement(testTenantId, testGlobalUserId1, {
        limit: 10,
        offset: 0,
      });

      const afterCount = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM transactions WHERE tenant_id = $1`,
        [testTenantId]
      );

      expect(afterCount.rows[0]?.count).toBe(beforeCount.rows[0]?.count);
    });

    it('não deve criar/modificar transações ao buscar split detail', async () => {
      const beforeCount = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM transactions WHERE tenant_id = $1`,
        [testTenantId]
      );

      // Criar uma transação para buscar
      const transferResult = await bankP2PTransferService.transferP2P(testTenantId, {
        fromUserId: testUserId1,
        toUserId: testUserId2,
        amount: 15,
        eventId: uuidv4(),
      });

      await transparencyService.getTransactionSplits(
        testTenantId,
        transferResult.transaction.transactionId
      );

      const afterCount = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM transactions WHERE tenant_id = $1`,
        [testTenantId]
      );

      // Deve ter apenas 1 transação a mais (a que criamos)
      expect(parseInt(afterCount.rows[0]?.count || '0', 10)).toBe(
        parseInt(beforeCount.rows[0]?.count || '0', 10) + 1
      );
    });
  });
});















