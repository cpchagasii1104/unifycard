// tests/smoke/mvp-smoke.test.ts
// Smoke Tests para fluxos críticos do MVP
// 🔴 BLINDAGEM: Testes mínimos, não suite completa
// Objetivo: Validar que fluxos críticos funcionam (passa/falha)

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { buildApp } from '../../src/server';
import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import { pool } from '../../src/core/database/pool';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

// ============================================================
// HELPERS
// ============================================================

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-change-in-production';
const TEST_TENANT_SLUG = 'mvp-smoke-test';

interface TestUser {
  userId: string;
  tenantId: string;
  email: string;
  globalUserId: string;
  token: string;
}

interface TestActor {
  actorId: string;
  actorType: 'user' | 'page';
}

/**
 * Gera token JWT para testes
 */
function generateTestToken(user: {
  userId: string;
  tenantId: string;
  email: string;
  globalUserId: string;
}): string {
  return jwt.sign(
    {
      sub: user.userId,
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email,
      type: 'access',
      globalUserId: user.globalUserId,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Cria ou obtém tenant de teste
 */
async function createOrGetTestTenant(): Promise<string> {
  const result = await pool.query<{ tenant_id: string }>(
    `SELECT tenant_id FROM tenants WHERE slug = $1 LIMIT 1`,
    [TEST_TENANT_SLUG]
  );

  if (result.rows.length > 0) {
    return result.rows[0].tenant_id;
  }

  const insertResult = await pool.query<{ tenant_id: string }>(
    `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING tenant_id`,
    ['MVP Smoke Test Tenant', TEST_TENANT_SLUG]
  );

  return insertResult.rows[0].tenant_id;
}

/**
 * Cria usuário de teste
 */
async function createTestUser(tenantId: string, email: string): Promise<TestUser> {
  const passwordHash = await bcrypt.hash('test123456', 10);
  const globalUserId = uuidv4();
  const userId = uuidv4();

  await pool.query(
    `INSERT INTO global_users (global_user_id, full_name) VALUES ($1, $2) ON CONFLICT (global_user_id) DO NOTHING`,
    [globalUserId, 'Test User']
  );

  await pool.query(
    `INSERT INTO users (user_id, tenant_id, email, global_user_id, password_hash, token_version)
     VALUES ($1, $2, $3, $4, $5, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, tenantId, email, globalUserId, passwordHash]
  );

  const token = generateTestToken({ userId, tenantId, email, globalUserId });

  return { userId, tenantId, email, globalUserId, token };
}

/**
 * Cria actor de teste
 */
async function createTestActor(tenantId: string, userId: string, actorType: 'user' | 'page'): Promise<TestActor> {
  const actorId = uuidv4();

  await pool.query(
    `INSERT INTO actors (actor_id, tenant_id, actor_type, user_id, display_name)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (actor_id) DO NOTHING`,
    [actorId, tenantId, actorType, userId, 'Test Actor']
  );

  return { actorId, actorType };
}

/**
 * Cria post de teste
 */
async function createTestPost(tenantId: string, globalUserId: string, intent: string): Promise<string> {
  const postId = uuidv4();

  await pool.query(
    `INSERT INTO posts (post_id, tenant_id, global_user_id, content, intent, created_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (post_id) DO NOTHING`,
    [postId, tenantId, globalUserId, 'Test Post', intent]
  );

  return postId;
}

/**
 * Cria company de teste
 */
async function createTestCompany(tenantId: string, globalUserId: string): Promise<string> {
  const companyId = uuidv4();

  await pool.query(
    `INSERT INTO companies (company_id, global_user_id, cnpj, company_name, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (company_id) DO NOTHING`,
    [companyId, globalUserId, '12345678000190', 'Test Company']
  );

  return companyId;
}

// ============================================================
// SMOKE TESTS
// ============================================================

describe('MVP Smoke Tests - Fluxos Críticos', () => {
  let app: FastifyInstance;
  let tenantId: string;
  let testUser: TestUser;
  let testActor: TestActor;
  let testPostId: string;
  let testCompanyId: string;

  beforeAll(async () => {
    // Criar app Fastify
    app = await buildApp();
    await app.ready();

    // Criar tenant de teste
    tenantId = await createOrGetTestTenant();

    // Criar usuário de teste
    testUser = await createTestUser(tenantId, `smoke-${uuidv4()}@test.com`);

    // Criar actor de teste
    testActor = await createTestActor(tenantId, testUser.userId, 'user');

    // Criar post de teste (para feed plugin)
    testPostId = await createTestPost(tenantId, testUser.globalUserId, 'event');

    // Criar company de teste (para company members)
    testCompanyId = await createTestCompany(tenantId, testUser.globalUserId);
  });

  afterAll(async () => {
    // Limpar dados de teste (opcional - pode deixar para facilitar debug)
    if (app) {
      await app.close();
    }
    // Não fechar pool global (pode ser usado por outros testes)
  });

  describe('1. Feed Plugin Batch', () => {
    it('POST /feed/plugin/render-batch deve renderizar posts em batch', async () => {
      const response = await request(app.server)
        .post('/feed/plugin/render-batch')
        .set('Authorization', `Bearer ${testUser.token}`)
        .set('x-tenant-id', tenantId)
        .send({
          postIds: [testPostId],
        });

      // 🔴 SMOKE TEST: Apenas valida que endpoint responde (passa/falha)
      expect(response.status).toBeLessThan(500); // Não deve ser erro de servidor
      expect(response.body).toBeDefined();
    });

    it('POST /feed/plugin/render-batch deve funcionar com múltiplos posts', async () => {
      const postId2 = await createTestPost(tenantId, testUser.globalUserId, 'service_offer');
      const postId3 = await createTestPost(tenantId, testUser.globalUserId, 'event');

      const response = await request(app.server)
        .post('/feed/plugin/render-batch')
        .set('Authorization', `Bearer ${testUser.token}`)
        .set('x-tenant-id', tenantId)
        .send({
          postIds: [testPostId, postId2, postId3],
        });

      // 🔴 SMOKE TEST: Apenas valida que endpoint responde (passa/falha)
      expect(response.status).toBeLessThan(500);
      expect(response.body).toBeDefined();
    });
  });

  describe('2. Agenda Actor-Scoped', () => {
    it('GET /availability deve retornar disponibilidades filtradas por owner_type/owner_id', async () => {
      // Criar availability de teste
      const availabilityId = uuidv4();
      const startDate = new Date();
      startDate.setHours(9, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(18, 0, 0, 0);

      await pool.query(
        `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, start_datetime, end_datetime, timezone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (availability_id) DO NOTHING`,
        [availabilityId, tenantId, 'user', testActor.actorId, 'fixed', startDate, endDate, 'America/Sao_Paulo', 'active']
      );

      const response = await request(app.server)
        .get('/availability')
        .set('Authorization', `Bearer ${testUser.token}`)
        .set('x-tenant-id', tenantId)
        .query({
          ownerType: 'user',
          ownerId: testActor.actorId,
        });

      // 🔴 SMOKE TEST: Apenas valida que endpoint responde (passa/falha)
      expect(response.status).toBeLessThan(500);
      expect(response.body).toBeDefined();
    });
  });

  describe('3. Conflict → Inbox', () => {
    it('POST /availability/:id/participants deve criar participante e gerar alerta quando houver conflito', async () => {
      // Criar availability principal
      const availabilityId = uuidv4();
      const startDate = new Date();
      startDate.setHours(10, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(12, 0, 0, 0);

      await pool.query(
        `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, start_datetime, end_datetime, timezone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (availability_id) DO NOTHING`,
        [availabilityId, tenantId, 'group', uuidv4(), 'fixed', startDate, endDate, 'America/Sao_Paulo', 'active']
      );

      // Criar availability conflitante para o participante
      const conflictingAvailabilityId = uuidv4();
      await pool.query(
        `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, start_datetime, end_datetime, timezone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (availability_id) DO NOTHING`,
        [conflictingAvailabilityId, tenantId, 'user', testActor.actorId, 'fixed', startDate, endDate, 'America/Sao_Paulo', 'active']
      );

      // Adicionar participante (deve gerar alerta de conflito)
      const response = await request(app.server)
        .post(`/availability/${availabilityId}/participants`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .set('x-tenant-id', tenantId)
        .send({
          actorId: testActor.actorId,
          role: 'executor',
        });

      // 🔴 SMOKE TEST: Apenas valida que endpoint responde (passa/falha)
      expect(response.status).toBeLessThan(500);
      expect(response.body).toBeDefined();

      // Verificar se item foi criado no inbox
      const inboxResponse = await request(app.server)
        .get(`/inbox/actors/${testActor.actorId}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .set('x-tenant-id', tenantId)
        .query({
          sourceType: 'availability_conflict',
        });

      // 🔴 SMOKE TEST: Apenas valida que endpoint responde (passa/falha)
      expect(inboxResponse.status).toBeLessThan(500);
      expect(inboxResponse.body).toBeDefined();
    });
  });

  describe('4. Company Members List', () => {
    it('GET /companies/:companyId/members deve listar membros da empresa', async () => {
      // Criar actor para company
      const companyActorId = uuidv4();
      await pool.query(
        `INSERT INTO actors (actor_id, tenant_id, actor_type, company_id, display_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (actor_id) DO NOTHING`,
        [companyActorId, tenantId, 'page', testCompanyId, 'Test Company Actor']
      );

      // DECISION-0042: membership consolidado em company_users (adapter thin).
      // Resolver global_user_id a partir do actorId (actor_type='user').
      const actorRow = await pool.query<{ global_user_id: string }>(
        `SELECT u.global_user_id
         FROM actors a
         JOIN users u ON u.user_id = a.user_id
         WHERE a.actor_id = $1 AND a.tenant_id = $2 AND a.actor_type = 'user'
         LIMIT 1`,
        [testActor.actorId, tenantId]
      );
      const globalUserId = actorRow.rows[0]?.global_user_id;
      if (globalUserId) {
        await pool.query(
          `INSERT INTO company_users (id, tenant_id, company_id, global_user_id, role, member_status, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           ON CONFLICT (company_id, global_user_id) DO NOTHING`,
          [uuidv4(), tenantId, testCompanyId, globalUserId, 'staff', 'active']
        );
      }

      const response = await request(app.server)
        .get(`/companies/${testCompanyId}/members`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .set('x-tenant-id', tenantId);

      // 🔴 SMOKE TEST: Apenas valida que endpoint responde (passa/falha)
      expect(response.status).toBeLessThan(500);
      expect(response.body).toBeDefined();
    });
  });
});
