// tests/integration/events.routes.test.ts
// Testes de integração para rotas de eventos
// FASE 8: HARDENING

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { buildApp } from '../../src/server';
import type { FastifyInstance } from 'fastify';
import { pool } from '../../src/core/database/pool';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { accountService } from '../../src/core/economy/accounts/account.service';
import { actorRepository } from '../../src/modules/social/actor.repository';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

describe('Events Routes Integration', () => {
  let app: FastifyInstance;
  const testTenantId = uuidv4();
  let testUserId: string;
  let testGlobalUserId: string;
  let testActorId: string;
  let testToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Criar tenant de teste
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, city_id)
       VALUES ($1, 'Test Tenant Routes', NULL)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [testTenantId]
    );

    // Criar usuário de teste
    testUserId = uuidv4();
    testGlobalUserId = uuidv4();

    await pool.query(
      `INSERT INTO global_users (global_user_id, full_name, created_at)
       VALUES ($1, 'Test User Routes', now())
       ON CONFLICT (global_user_id) DO NOTHING`,
      [testGlobalUserId]
    );

    await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, global_user_id, created_at)
       VALUES ($1, $2, 'test@routes.com', $3, now())
       ON CONFLICT (user_id) DO NOTHING`,
      [testUserId, testTenantId, testGlobalUserId]
    );

    // Criar actor
    const actor = await actorRepository.findOrCreateUserActor(
      testTenantId,
      testUserId,
      testGlobalUserId
    );
    testActorId = actor.actor_id;

    // Criar conta
    await accountService.getOrCreateUserPrimaryAccount(testTenantId, testUserId, 'BRL');

    // Gerar token
    testToken = jwt.sign(
      {
        sub: testUserId,
        userId: testUserId,
        tenantId: testTenantId,
        email: 'test@routes.com',
        globalUserId: testGlobalUserId,
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Limpar dados de teste
    await pool.query(`DELETE FROM event_attendees WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM events WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM actors WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM users WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM global_users WHERE global_user_id = $1`, [testGlobalUserId]);
    await pool.query(`DELETE FROM tenants WHERE tenant_id = $1`, [testTenantId]);
    
    await app.close();
  });

  describe('POST /events', () => {
    it('deve criar evento com autenticação', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/events',
        headers: {
          authorization: `Bearer ${testToken}`,
          'x-tenant-id': testTenantId,
        },
        payload: {
          actor_id: testActorId,
          actor_type: 'user',
          event_type: 'cultural',
          title: 'Test Event Route',
          datetime_start: new Date(Date.now() + 86400000).toISOString(),
          datetime_end: new Date(Date.now() + 90000000).toISOString(),
          visibility: 'public',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.event).toBeDefined();
      expect(body.event.status).toBe('draft');
    });

    it('deve retornar 401 sem autenticação', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/events',
        headers: {
          'x-tenant-id': testTenantId,
        },
        payload: {
          actor_id: testActorId,
          actor_type: 'user',
          event_type: 'cultural',
          title: 'Test Event',
          datetime_start: new Date(Date.now() + 86400000).toISOString(),
          datetime_end: new Date(Date.now() + 90000000).toISOString(),
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /events/:id/publish', () => {
    it('deve publicar evento com autenticação', async () => {
      // Criar evento primeiro
      const createResponse = await app.inject({
        method: 'POST',
        url: '/events',
        headers: {
          authorization: `Bearer ${testToken}`,
          'x-tenant-id': testTenantId,
        },
        payload: {
          actor_id: testActorId,
          actor_type: 'user',
          event_type: 'cultural',
          title: 'Test Event Publish',
          datetime_start: new Date(Date.now() + 86400000).toISOString(),
          datetime_end: new Date(Date.now() + 90000000).toISOString(),
          visibility: 'public',
        },
      });

      const createBody = JSON.parse(createResponse.body);
      const eventId = createBody.event.id;

      // Publicar
      const publishResponse = await app.inject({
        method: 'POST',
        url: `/events/${eventId}/publish`,
        headers: {
          authorization: `Bearer ${testToken}`,
          'x-tenant-id': testTenantId,
        },
      });

      expect(publishResponse.statusCode).toBe(200);
      const publishBody = JSON.parse(publishResponse.body);
      expect(publishBody.event.status).toBe('published');
    });
  });
});














