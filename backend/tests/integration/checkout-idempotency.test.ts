// backend/tests/integration/checkout-idempotency.test.ts
// Teste de idempotência para POST /api/checkout/event-ticket

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { buildApp } from '../../src/server';
import type { FastifyInstance } from 'fastify';
import { pool, runQueryWithTenant } from '../../src/core/database/pool';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-change-in-production';

describe('Checkout Idempotency - POST /api/checkout/event-ticket', () => {
  let app: FastifyInstance;
  const tenantId = uuidv4();
  let buyerUserId: string;
  let buyerGlobalUserId: string;
  let organizerGlobalUserId: string;
  let buyerToken: string;
  let eventId: string;
  let cityId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Criar tenant
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, city_id)
       VALUES ($1, 'Checkout Idempotency Test', NULL)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId]
    );

    // Garantir que existe uma city de teste
    let cityResult = await pool.query<{ city_id: string }>(
      `SELECT city_id FROM cities LIMIT 1`
    );
    
    if (cityResult.rows.length === 0) {
      // Criar país de teste se não existir
      let countryResult = await pool.query<{ country_id: string }>(
        `SELECT country_id FROM countries WHERE code = 'BR' LIMIT 1`
      );
      
      let countryId: string;
      if (countryResult.rows.length === 0) {
        const newCountry = await pool.query<{ country_id: string }>(
          `INSERT INTO countries (code, name, name_en)
           VALUES ('BR', 'Brasil', 'Brazil')
           RETURNING country_id`
        );
        countryId = newCountry.rows[0].country_id;
      } else {
        countryId = countryResult.rows[0].country_id;
      }
      
      // Criar estado de teste se não existir
      let stateResult = await pool.query<{ state_id: string }>(
        `SELECT state_id FROM states WHERE country_id = $1 AND code = 'SP' LIMIT 1`,
        [countryId]
      );
      
      let stateId: string;
      if (stateResult.rows.length === 0) {
        const newState = await pool.query<{ state_id: string }>(
          `INSERT INTO states (country_id, code, name, name_en)
           VALUES ($1, 'SP', 'São Paulo', 'Sao Paulo')
           RETURNING state_id`,
          [countryId]
        );
        stateId = newState.rows[0].state_id;
      } else {
        stateId = stateResult.rows[0].state_id;
      }
      
      // Criar cidade de teste
      const newCity = await pool.query<{ city_id: string }>(
        `INSERT INTO cities (state_id, name, name_en)
         VALUES ($1, 'São Paulo', 'Sao Paulo')
         RETURNING city_id`,
        [stateId]
      );
      cityId = newCity.rows[0].city_id;
    } else {
      cityId = cityResult.rows[0].city_id;
    }

    // Criar global users
    buyerGlobalUserId = uuidv4();
    organizerGlobalUserId = uuidv4();

    await pool.query(
      `INSERT INTO global_users (global_user_id, full_name, created_at)
       VALUES ($1, 'Buyer User', now()), ($2, 'Organizer User', now())
       ON CONFLICT (global_user_id) DO NOTHING`,
      [buyerGlobalUserId, organizerGlobalUserId]
    );

    // Criar buyer user
    const buyerEmail = `buyer-${uuidv4()}@test.com`;
    const hashedPassword = await bcrypt.hash('test123', 10);

    const buyerUserResult = await pool.query<{ user_id: string }>(
      `INSERT INTO users (tenant_id, email, password_hash, global_user_id, created_at, token_version)
       VALUES ($1, $2, $3, $4, now(), 0)
       RETURNING user_id`,
      [tenantId, buyerEmail, hashedPassword, buyerGlobalUserId]
    );

    if (buyerUserResult.rows.length === 0) {
      throw new Error('Failed to create buyer user');
    }

    buyerUserId = buyerUserResult.rows[0].user_id;

    // Gerar token JWT para buyer
    buyerToken = jwt.sign(
      {
        sub: buyerUserId,
        userId: buyerUserId,
        tenantId: tenantId,
        email: buyerEmail,
        type: 'access',
        globalUserId: buyerGlobalUserId,
        tokenVersion: 0,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Criar evento
    const eventResult = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `INSERT INTO events (
        tenant_id, title, description, start_time, end_time,
        city_id, created_by_global_user_id,
        event_type, status, ticket_price, accepts_consumption, timezone
      )
      VALUES (
        $1, 'Test Event', 'Event for idempotency test',
        NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days',
        $2, $3,
        'SHOW', 'PUBLISHED', 100.00, true, 'America/Sao_Paulo'
      )
      RETURNING id`,
      [tenantId, cityId, organizerGlobalUserId]
    );

    if (!eventResult) {
      throw new Error('Failed to create test event');
    }

    eventId = eventResult.id;

    // Criar conta do buyer com saldo
    const { accountService } = await import('../../src/core/economy/accounts/account.service');
    await accountService.getOrCreateUserPrimaryAccount(tenantId, buyerGlobalUserId, 'BRL');
  });

  afterAll(async () => {
    // Limpar dados de teste
    try {
      await runQueryWithTenant(tenantId, `DELETE FROM event_tickets WHERE tenant_id = $1`, [tenantId]);
      await runQueryWithTenant(tenantId, `DELETE FROM transactions WHERE tenant_id = $1`, [tenantId]);
      await runQueryWithTenant(tenantId, `DELETE FROM events WHERE tenant_id = $1`, [tenantId]);
      await runQueryWithTenant(tenantId, `DELETE FROM users WHERE tenant_id = $1`, [tenantId]);
      await pool.query('DELETE FROM global_users WHERE global_user_id IN ($1, $2)', [
        buyerGlobalUserId,
        organizerGlobalUserId,
      ]);
      await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [tenantId]);
    } catch (error) {
      console.error('Erro ao limpar dados de teste:', error);
    }
    await app.close();
  });

  it('deve retornar o mesmo transactionId quando duas requisições idênticas são enviadas com a mesma idempotency key', async () => {
    const idempotencyKey = uuidv4();

    // Primeira requisição
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/checkout/event-ticket',
      headers: {
        authorization: `Bearer ${buyerToken}`,
        'x-tenant-id': tenantId,
      },
      payload: {
        eventId: eventId,
        idempotencyKey: idempotencyKey,
      },
    });

    expect(response1.statusCode).toBe(200);
    const result1 = JSON.parse(response1.body);
    expect(result1.success).toBe(true);
    expect(result1.transactionId).toBeDefined();
    const transactionId1 = result1.transactionId;

    // Segunda requisição idêntica com a mesma idempotency key
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/checkout/event-ticket',
      headers: {
        authorization: `Bearer ${buyerToken}`,
        'x-tenant-id': tenantId,
      },
      payload: {
        eventId: eventId,
        idempotencyKey: idempotencyKey,
      },
    });

    expect(response2.statusCode).toBe(200);
    const result2 = JSON.parse(response2.body);
    expect(result2.success).toBe(true);

    // Deve retornar o mesmo transactionId
    expect(result2.transactionId).toBe(transactionId1);

    // Verificar que existe apenas uma transação no banco com essa idempotency key
    const transactions = await runQueryWithTenant<{ transaction_id: string }>(
      tenantId,
      `SELECT transaction_id
       FROM transactions
       WHERE metadata->>'idempotencyKey' = $1`,
      [idempotencyKey]
    );

    // Deve existir apenas uma transação
    expect(transactions.length).toBe(1);
    expect(transactions[0].transaction_id).toBe(transactionId1);
  });
});

