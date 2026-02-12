// backend/tests/integration/account-tenant-isolation.test.ts
// Teste de isolamento de tenant para GET /economy/accounts/:accountId

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../src/core/database/pool';
import { accountService } from '../../src/core/economy/accounts/account.service';
import { buildApp } from '../../src/server';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-change-in-production';

describe('Account Tenant Isolation - GET /economy/accounts/:accountId', () => {
  let app: FastifyInstance;
  const tenantAId = uuidv4();
  const tenantBId = uuidv4();
  let tenantAUserId: string;
  let tenantBUserId: string;
  let tenantAGlobalUserId: string;
  let tenantBGlobalUserId: string;
  let accountIdInTenantA: string;
  let tenantBToken: string;

  beforeAll(async () => {
    // Criar app Fastify
    app = await buildApp();
    await app.ready();

    // Criar tenant A
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, city_id)
       VALUES ($1, 'Tenant A', NULL)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantAId]
    );

    // Criar tenant B
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, city_id)
       VALUES ($1, 'Tenant B', NULL)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantBId]
    );

    // Criar usuários
    tenantAUserId = uuidv4();
    tenantBUserId = uuidv4();
    tenantAGlobalUserId = uuidv4();
    tenantBGlobalUserId = uuidv4();

    await pool.query(
      `INSERT INTO global_users (global_user_id, full_name, created_at)
       VALUES ($1, 'Tenant A User', now()), ($2, 'Tenant B User', now())
       ON CONFLICT (global_user_id) DO NOTHING`,
      [tenantAGlobalUserId, tenantBGlobalUserId]
    );

    await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, global_user_id, created_at, token_version)
       VALUES ($1, $2, 'usera@test.com', $3, now(), 0), ($4, $5, 'userb@test.com', $6, now(), 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [tenantAUserId, tenantAId, tenantAGlobalUserId, tenantBUserId, tenantBId, tenantBGlobalUserId]
    );

    // Criar conta no tenant A
    const account = await accountService.createAccount(tenantAId, {
      ownerId: tenantAUserId,
      ownerType: 'user',
      currency: 'BRL',
    });
    accountIdInTenantA = account.accountId;

    // Gerar token JWT para tenant B
    tenantBToken = jwt.sign(
      {
        sub: tenantBUserId,
        userId: tenantBUserId,
        tenantId: tenantBId,
        email: 'userb@test.com',
        type: 'access',
        globalUserId: tenantBGlobalUserId,
        tokenVersion: 0,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Limpar dados de teste
    try {
      await pool.query('DELETE FROM accounts WHERE account_id = $1', [accountIdInTenantA]);
      await pool.query('DELETE FROM users WHERE user_id IN ($1, $2)', [tenantAUserId, tenantBUserId]);
      await pool.query('DELETE FROM global_users WHERE global_user_id IN ($1, $2)', [tenantAGlobalUserId, tenantBGlobalUserId]);
      await pool.query('DELETE FROM tenants WHERE tenant_id IN ($1, $2)', [tenantAId, tenantBId]);
    } catch (error) {
      console.error('Erro ao limpar dados de teste:', error);
    }
    await app.close();
  });

  it('deve retornar 403 ou 404 quando tenant B tenta acessar conta do tenant A via HTTP', async () => {
    // Fazer requisição HTTP real ao endpoint
    const response = await app.inject({
      method: 'GET',
      url: `/economy/accounts/${accountIdInTenantA}`,
      headers: {
        authorization: `Bearer ${tenantBToken}`,
        'x-tenant-id': tenantBId,
      },
    });

    // Deve retornar 403 ou 404
    expect([403, 404]).toContain(response.statusCode);
  });
});

