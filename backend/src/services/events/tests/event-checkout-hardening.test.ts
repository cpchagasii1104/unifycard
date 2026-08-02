// Event checkout hardening tests (legacy path; file location histórico).
//
// Testes de hardening para checkout de eventos
// Valida: split para organizador, idempotência, concorrência
//
// STALE (achado R-baixa 2 da re-auditoria Yala, 2026-07-05): exercita POST
// /api/checkout/event-ticket, CONTIDO fail-closed (F-CHECKOUT-EVENT-TICKET-LEGACY-INSERT-
// SCHEMA-GHOST-CONTAINMENT). Skipped até reescrever contra o caminho canônico
// (POST /api/events/:id/checkout) ou o arquivo ser desmontado.

import { buildApp } from '../../../server';
import type { FastifyInstance } from 'fastify';
import { pool, runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

// ============================================================
// HELPERS
// ============================================================

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-change-in-production';
const TEST_TENANT_SLUG = 'event-checkout-test';

interface TestUser {
  userId: string;
  tenantId: string;
  email: string;
  globalUserId: string;
  token: string;
}

interface TestEvent {
  eventId: string;
  organizerAccountId: string;
  ticketPrice: number;
  organizerType: 'user' | 'company';
}

// ============================================================
// SETUP E TEARDOWN
// ============================================================

describe.skip('Event Checkout Hardening', () => {
  let app: FastifyInstance;
  let tenantId: string;
  let cityId: string;
  let buyerUser: TestUser;
  let organizerUser: TestUser;
  let testEvent: TestEvent;

  beforeAll(async () => {
    app = await buildApp();

    // Criar tenant de teste
    const tenantResult = await pool.query<{ tenant_id: string }>(
      `
        INSERT INTO tenants (name, slug)
        VALUES ($1, $2)
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
        RETURNING tenant_id
      `,
      ['Event Checkout Test Tenant', TEST_TENANT_SLUG]
    );

    if (tenantResult.rows.length === 0) {
      throw new Error('Failed to create test tenant');
    }

    tenantId = tenantResult.rows[0].tenant_id;

    // Buscar city_id do tenant ou usar primeira cidade disponível
    const cityResult = await pool.query<{ city_id: string }>(
      `SELECT city_id FROM cities LIMIT 1`
    );
    cityId = cityResult.rows[0]?.city_id || '';

    // Criar global users
    const buyerGlobalUserId = uuidv4();
    const organizerGlobalUserId = uuidv4();

    await runQueryWithTenant(
      tenantId,
      `
        INSERT INTO global_users (global_user_id, full_name)
        VALUES ($1, 'Buyer User'), ($2, 'Organizer User')
        ON CONFLICT (global_user_id) DO NOTHING
      `,
      [buyerGlobalUserId, organizerGlobalUserId]
    );

    // Criar users locais
    const buyerEmail = `buyer-${uuidv4()}@test.com`;
    const organizerEmail = `organizer-${uuidv4()}@test.com`;
    const hashedPassword = await bcrypt.hash('test123', 10);

    const buyerUserResult = await runQueryWithTenant<{ user_id: string }>(
      tenantId,
      `
        INSERT INTO users (tenant_id, email, password_hash, global_user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING user_id
      `,
      [tenantId, buyerEmail, hashedPassword, buyerGlobalUserId]
    );

    const organizerUserResult = await runQueryWithTenant<{ user_id: string }>(
      tenantId,
      `
        INSERT INTO users (tenant_id, email, password_hash, global_user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING user_id
      `,
      [tenantId, organizerEmail, hashedPassword, organizerGlobalUserId]
    );

    if (!buyerUserResult || !organizerUserResult) {
      throw new Error('Failed to create test users');
    }

    buyerUser = {
      userId: buyerUserResult.user_id,
      tenantId,
      email: buyerEmail,
      globalUserId: buyerGlobalUserId,
      token: jwt.sign(
        { userId: buyerUserResult.user_id, globalUserId: buyerGlobalUserId },
        JWT_SECRET
      ),
    };

    organizerUser = {
      userId: organizerUserResult.user_id,
      tenantId,
      email: organizerEmail,
      globalUserId: organizerGlobalUserId,
      token: jwt.sign(
        { userId: organizerUserResult.user_id, globalUserId: organizerGlobalUserId },
        JWT_SECRET
      ),
    };

    // Criar evento com usuário organizador (simplificado para teste)
    const eventResult = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `
        INSERT INTO events (
          tenant_id, title, description, starts_at, ends_at,
          city_id, created_by_global_user_id,
          event_type, status, ticket_price, accepts_consumption, timezone
        )
        VALUES (
          $1, 'Test Event', 'Event for checkout tests',
          NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days',
          $2, $3,
          'SHOW', 'published', 100.00, true, 'America/Sao_Paulo'
        )
        RETURNING id
      `,
      [tenantId, cityId, organizerGlobalUserId]
    );

    if (!eventResult) {
      throw new Error('Failed to create test event');
    }

    // Resolver conta do organizador (usuário)
    const { accountService } = await import('../../../core/economy/account.service');
    const organizerAccount = await accountService.getOrCreateUserPrimaryAccount(
      tenantId,
      organizerGlobalUserId,
      'BRL'
    );

    testEvent = {
      eventId: eventResult.id,
      organizerAccountId: organizerAccount.accountId,
      ticketPrice: 100.00,
      organizerType: 'user',
    };
  });

  afterAll(async () => {
    // Limpar dados de teste
    await runQueryWithTenant(
      tenantId,
      `
        DELETE FROM event_tickets WHERE tenant_id = $1;
        DELETE FROM event_consumptions WHERE tenant_id = $1;
        DELETE FROM events WHERE tenant_id = $1;
        DELETE FROM companies WHERE tenant_id = $1;
        DELETE FROM users WHERE tenant_id = $1;
      `,
      [tenantId]
    );

    await pool.end();
  });

  // ============================================================
  // TESTES
  // ============================================================

  describe('Split de Eventos - EVENT_ORGANIZER', () => {
    it('Deve enviar 70% do split para o organizador (usuário)', async () => {
      const idempotencyKey = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/checkout/event-ticket',
        headers: {
          authorization: `Bearer ${buyerUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          eventId: testEvent.eventId,
          idempotencyKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();

      // Verificar no ledger: 70% foi para organizador
      const organizerTransactions = await runQueriesWithTenant<{
        transaction_id: string;
        amount_cents: string;
        to_account: string;
      }>(
        tenantId,
        `
          SELECT transaction_id, amount AS amount_cents, to_account
          FROM transactions
          WHERE to_account = $1
            AND metadata->>'splitTargetType' = 'EVENT_ORGANIZER'
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [testEvent.organizerAccountId]
      );

      expect(organizerTransactions.length).toBeGreaterThan(0);
      const organizerTx = organizerTransactions[0];
      expect(parseFloat(String(organizerTx.amount_cents))).toBeCloseTo(testEvent.ticketPrice * 0.70, 2);
    });

    it('Deve enviar 70% do split para o organizador (usuário)', async () => {
      // Criar evento com usuário organizador (sem empresa)
      const userEventResult = await runQueryWithTenant<{ id: string }>(
        tenantId,
        `
          INSERT INTO events (
            tenant_id, title, description, starts_at, ends_at,
            city_id, created_by_global_user_id,
            event_type, status, ticket_price, timezone
          )
          VALUES (
            $1, 'User Event', 'Event organized by user',
            NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days',
            $2, $3,
            'SHOW', 'published', 50.00, 'America/Sao_Paulo'
          )
          RETURNING id
        `,
        [tenantId, cityId, organizerUser.globalUserId]
      );

      if (!userEventResult) {
        throw new Error('Failed to create user event');
      }

      const idempotencyKey = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/checkout/event-ticket',
        headers: {
          authorization: `Bearer ${buyerUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          eventId: userEventResult.id,
          idempotencyKey,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verificar que split foi para conta do usuário organizador
      const { accountService } = await import('../../../core/economy/account.service');
      const userAccount = await accountService.getOrCreateUserPrimaryAccount(
        tenantId,
        organizerUser.globalUserId,
        'BRL'
      );

      const userTransactions = await runQueriesWithTenant<{
        transaction_id: string;
        amount_cents: string;
      }>(
        tenantId,
        `
          SELECT transaction_id, amount AS amount_cents
          FROM transactions
          WHERE to_account = $1
            AND metadata->>'splitTargetType' = 'EVENT_ORGANIZER'
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [userAccount.accountId]
      );

      expect(userTransactions.length).toBeGreaterThan(0);
      expect(parseFloat(String(userTransactions[0].amount_cents))).toBeCloseTo(50.00 * 0.70, 2);
    });

    it('NUNCA deve usar WORKER em contexto EVENT', async () => {
      const idempotencyKey = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/checkout/event-ticket',
        headers: {
          authorization: `Bearer ${buyerUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          eventId: testEvent.eventId,
          idempotencyKey,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verificar que NENHUMA transação tem splitTargetType = 'WORKER'
      const workerTransactions = await runQueriesWithTenant<{ transaction_id: string }>(
        tenantId,
        `
          SELECT transaction_id
          FROM transactions
          WHERE metadata->>'splitTargetType' = 'WORKER'
            AND metadata->>'module' IN ('EVENT_TICKET', 'EVENT_CONSUMPTION')
        `
      );

      expect(workerTransactions.length).toBe(0);
    });
  });

  describe('Idempotência de Checkout', () => {
    it('Retry com mesmo idempotencyKey deve retornar mesmo ticket_id', async () => {
      const idempotencyKey = uuidv4();

      // Primeira chamada
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/checkout/event-ticket',
        headers: {
          authorization: `Bearer ${buyerUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          eventId: testEvent.eventId,
          idempotencyKey,
        },
      });

      expect(response1.statusCode).toBe(200);
      const result1 = JSON.parse(response1.body);
      const ticketId1 = result1.ticketId;
      const transactionId1 = result1.transactionId;

      // Retry (segunda chamada com mesmo idempotencyKey)
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/checkout/event-ticket',
        headers: {
          authorization: `Bearer ${buyerUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          eventId: testEvent.eventId,
          idempotencyKey, // Mesmo idempotencyKey
        },
      });

      expect(response2.statusCode).toBe(200);
      const result2 = JSON.parse(response2.body);

      // Deve retornar mesmo ticket_id e transaction_id
      expect(result2.ticketId).toBe(ticketId1);
      expect(result2.transactionId).toBe(transactionId1);

      // Verificar que não criou ticket duplicado
      const ticketCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
          SELECT COUNT(*) as count
          FROM event_tickets
          WHERE idempotency_key = $1
        `,
        [idempotencyKey]
      );

      expect(parseInt(ticketCount?.count || '0', 10)).toBe(1);
    });

    it('Retry com mesmo idempotencyKey não deve duplicar transações no ledger', async () => {
      const idempotencyKey = uuidv4();

      // Primeira chamada
      await app.inject({
        method: 'POST',
        url: '/api/checkout/event-ticket',
        headers: {
          authorization: `Bearer ${buyerUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          eventId: testEvent.eventId,
          idempotencyKey,
        },
      });

      // Contar transações antes do retry
      const transactionsBefore = await runQueriesWithTenant<{ transaction_id: string }>(
        tenantId,
        `
          SELECT transaction_id
          FROM transactions
          WHERE metadata->>'idempotencyKey' = $1
        `,
        [idempotencyKey]
      );

      const countBefore = transactionsBefore.length;

      // Retry
      await app.inject({
        method: 'POST',
        url: '/api/checkout/event-ticket',
        headers: {
          authorization: `Bearer ${buyerUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          eventId: testEvent.eventId,
          idempotencyKey, // Mesmo idempotencyKey
        },
      });

      // Contar transações depois do retry
      const transactionsAfter = await runQueriesWithTenant<{ transaction_id: string }>(
        tenantId,
        `
          SELECT transaction_id
          FROM transactions
          WHERE metadata->>'idempotencyKey' = $1
        `,
        [idempotencyKey]
      );

      const countAfter = transactionsAfter.length;

      // Não deve ter criado transações duplicadas
      expect(countAfter).toBe(countBefore);
    });

    it('Retry de consumo com mesmo idempotencyKey deve retornar mesmo resultado', async () => {
      const idempotencyKey = uuidv4();

      // Primeira chamada
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/checkout/event-consumption',
        headers: {
          authorization: `Bearer ${buyerUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          eventId: testEvent.eventId,
          items: [{ name: 'Bebida', quantity: 2, price: 15.00 }],
          idempotencyKey,
        },
      });

      expect(response1.statusCode).toBe(200);
      const result1 = JSON.parse(response1.body);
      const consumptionIds1 = result1.consumptions.map((c: any) => c.id);

      // Retry
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/checkout/event-consumption',
        headers: {
          authorization: `Bearer ${buyerUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          eventId: testEvent.eventId,
          items: [{ name: 'Bebida', quantity: 2, price: 15.00 }],
          idempotencyKey, // Mesmo idempotencyKey
        },
      });

      expect(response2.statusCode).toBe(200);
      const result2 = JSON.parse(response2.body);

      // Deve retornar mesmos consumption IDs
      const consumptionIds2 = result2.consumptions.map((c: any) => c.id);
      expect(consumptionIds2).toEqual(consumptionIds1);
    });
  });

  describe('Concorrência e Overbooking', () => {
    it('Não deve permitir overbooking de capacidade (concorrência)', async () => {
      // Criar evento com capacidade limitada
      const limitedEventResult = await runQueryWithTenant<{ id: string }>(
        tenantId,
        `
          INSERT INTO events (
            tenant_id, title, description, starts_at, ends_at,
            city_id, created_by_global_user_id,
            event_type, status, ticket_price, max_capacity, current_occupancy, timezone
          )
          VALUES (
            $1, 'Limited Event', 'Event with capacity 1',
            NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days',
            $2, $3,
            'SHOW', 'published', 50.00, 1, 0, 'America/Sao_Paulo'
          )
          RETURNING id
        `,
        [tenantId, cityId, organizerUser.globalUserId]
      );

      if (!limitedEventResult) {
        throw new Error('Failed to create limited event');
      }

      // Duas chamadas simultâneas (simulando concorrência)
      const [response1, response2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/checkout/event-ticket',
          headers: {
            authorization: `Bearer ${buyerUser.token}`,
            'x-tenant-id': tenantId,
          },
          payload: {
            eventId: limitedEventResult.id,
            idempotencyKey: uuidv4(),
          },
        }),
        app.inject({
          method: 'POST',
          url: '/api/checkout/event-ticket',
          headers: {
            authorization: `Bearer ${buyerUser.token}`,
            'x-tenant-id': tenantId,
          },
          payload: {
            eventId: limitedEventResult.id,
            idempotencyKey: uuidv4(),
          },
        }),
      ]);

      // Uma deve ter sucesso, outra deve falhar (sold out)
      const successCount = [response1, response2].filter(
        (r) => r.statusCode === 200
      ).length;
      const errorCount = [response1, response2].filter(
        (r) => r.statusCode === 400 && JSON.parse(r.body).error.includes('sold out')
      ).length;

      expect(successCount).toBe(1);
      expect(errorCount).toBe(1);

      // Verificar que apenas 1 ticket foi criado
      const ticketCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
          SELECT COUNT(*) as count
          FROM event_tickets
          WHERE event_id = $1
        `,
        [limitedEventResult.id]
      );

      expect(parseInt(ticketCount?.count || '0', 10)).toBe(1);
    });
  });
});