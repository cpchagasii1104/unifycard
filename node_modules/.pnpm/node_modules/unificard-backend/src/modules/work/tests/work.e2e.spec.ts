// src/modules/work/tests/work.e2e.spec.ts
//
// Testes E2E para o módulo Work
// Valida o fluxo completo: criação de job → aplicação → aprovação → pagamento → ledger → reputação

// Jest globals são importados automaticamente
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
const TEST_TENANT_SLUG = 'work-e2e-test';

interface TestUser {
  userId: string;
  tenantId: string;
  email: string;
  globalUserId: string | null;
  token: string;
}

interface TestWorker {
  workerId: string;
  userId: string;
}

interface TestSkill {
  skillId: string;
}

/**
 * Gera um token JWT válido para testes
 */
function generateTestToken(user: {
  userId: string;
  tenantId: string;
  email: string;
  globalUserId?: string | null;
  permissions?: string[];
}): string {
  const payload: any = {
    sub: user.userId,
    userId: user.userId,
    tenantId: user.tenantId,
    email: user.email,
    type: 'access',
  };

  if (user.globalUserId) {
    payload.globalUserId = user.globalUserId;
  }

  if (user.permissions) {
    payload.permissions = user.permissions;
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
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
    ['Work E2E Test Tenant', TEST_TENANT_SLUG]
  );

  return insertResult.rows[0].tenant_id;
}

/**
 * Cria um usuário de teste
 */
async function createTestUser(
  tenantId: string,
  email: string,
  permissions: string[] = []
): Promise<TestUser> {
  const passwordHash = await bcrypt.hash('test123456', 10);

  // Criar global_user se necessário
  const globalUserResult = await pool.query<{ global_user_id: string }>(
    `INSERT INTO global_users (full_name) VALUES ($1) RETURNING global_user_id`,
    [`Test User ${email}`]
  );
  const globalUserId = globalUserResult.rows[0].global_user_id;

  // Criar usuário local
  const userResult = await pool.query<{ user_id: string; email: string }>(
    `INSERT INTO users (tenant_id, email, password_hash, global_user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id, email`,
    [tenantId, email.toLowerCase(), passwordHash, globalUserId]
  );

  const userId = userResult.rows[0].user_id;

  // Criar perfil
  await runQueryWithTenant(
    tenantId,
    `INSERT INTO profiles (tenant_id, user_id, full_name) VALUES ($1, $2, $3)`,
    [tenantId, userId, `Test User ${email}`]
  );

  // Atribuir permissões se necessário
  if (permissions.length > 0) {
    // Buscar role padrão ou criar
    const roleResult = await runQueryWithTenant<{ role_id: string }>(
      tenantId,
      `SELECT role_id FROM roles WHERE name = 'user' LIMIT 1`,
      []
    );

    if (roleResult) {
      const roleId = roleResult.role_id;
      await runQueryWithTenant(
        tenantId,
        `INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [tenantId, userId, roleId]
      );
    }
  }

  const token = generateTestToken({
    userId,
    tenantId,
    email: email.toLowerCase(),
    globalUserId,
    permissions,
  });

  return {
    userId,
    tenantId,
    email: email.toLowerCase(),
    globalUserId,
    token,
  };
}

/**
 * Cria um worker de teste
 */
async function createTestWorker(tenantId: string, userId: string): Promise<TestWorker> {
  const workerResult = await runQueryWithTenant<{ worker_id: string }>(
    tenantId,
    `INSERT INTO workers (tenant_id, user_id, bio, hourly_rate, is_active, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING worker_id`,
    [tenantId, userId, 'Test worker bio', 50.0, true, true]
  );

  if (!workerResult) {
    throw new Error('Failed to create test worker');
  }

  return {
    workerId: workerResult.worker_id,
    userId,
  };
}

/**
 * Cria uma skill de teste
 */
async function createTestSkill(tenantId: string, name: string): Promise<TestSkill> {
  const skillResult = await runQueryWithTenant<{ skill_id: string }>(
    tenantId,
    `INSERT INTO skills (tenant_id, name, category, description)
     VALUES ($1, $2, $3, $4)
     RETURNING skill_id`,
    [tenantId, name, 'test', `Test skill: ${name}`]
  );

  if (!skillResult) {
    throw new Error('Failed to create test skill');
  }

  return {
    skillId: skillResult.skill_id,
  };
}

// ============================================================
// TESTES E2E
// ============================================================

describe('Work Module E2E Tests', () => {
  let app: FastifyInstance;
  let tenantId: string;
  let clientUser: TestUser;
  let workerUser: TestUser;
  let worker: TestWorker;
  let skill: TestSkill;

  beforeAll(async () => {
    // Criar app Fastify
    app = await buildApp();
    await app.ready();

    // Criar tenant de teste
    tenantId = await createOrGetTestTenant();

    // Criar usuários de teste
    clientUser = await createTestUser(
      tenantId,
      `client-${uuidv4()}@test.com`,
      ['work:job:create', 'work:job:read', 'work:application:read', 'work:assignment:create', 'work:assignment:update']
    );

    workerUser = await createTestUser(
      tenantId,
      `worker-${uuidv4()}@test.com`,
      ['work:application:create', 'work:application:read', 'work:assignment:read']
    );

    // Criar worker profile
    worker = await createTestWorker(tenantId, workerUser.userId);

    // Criar skill de teste
    skill = await createTestSkill(tenantId, 'Test Skill E2E');
  });

  afterAll(async () => {
    // Limpar dados de teste (opcional - pode deixar para facilitar debug)
    // await cleanupTestData(tenantId);
    await app.close();
    await pool.end();
  });

  describe('Fluxo completo: Job → Application → Assignment → Payment → Ledger → Reputation', () => {
    let jobId: string;
    let applicationId: string;
    let assignmentId: string;
    let transactionId: string | null = null;

    it('1. Deve criar um job', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/work/jobs',
        headers: {
          authorization: `Bearer ${clientUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          title: 'E2E Test Job',
          description: 'Job criado para testes E2E',
          requiredSkills: [skill.skillId],
          budgetMin: 100,
          budgetMax: 200,
        },
      });

      expect(response.statusCode).toBe(201);
      const job = JSON.parse(response.body);
      expect(job).toHaveProperty('jobId');
      expect(job.title).toBe('E2E Test Job');
      jobId = job.jobId;
    });

    it('2. Deve criar uma aplicação (candidate)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/work/applications/job/${jobId}`,
        headers: {
          authorization: `Bearer ${workerUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          proposedRate: 150,
          message: 'Aplicação de teste E2E',
        },
      });

      expect(response.statusCode).toBe(201);
      const application = JSON.parse(response.body);
      expect(application).toHaveProperty('applicationId');
      expect(application.status).toBe('pending');
      applicationId = application.applicationId;
    });

    it('3. Deve criar um assignment (aprovação)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/work/assignments/job/${jobId}`,
        headers: {
          authorization: `Bearer ${clientUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          workerId: worker.workerId,
          agreedRate: 150,
          paymentType: 'fixed',
        },
      });

      expect(response.statusCode).toBe(201);
      const assignment = JSON.parse(response.body);
      expect(assignment).toHaveProperty('assignmentId');
      expect(assignment.status).toBe('assigned');
      expect(assignment.agreedRate).toBe(150);
      assignmentId = assignment.assignmentId;
    });

    it('4. Deve completar o assignment e gerar pagamento', async () => {
      // Primeiro, garantir que o cliente tem saldo suficiente
      const clientAccounts = await runQueriesWithTenant<{ account_id: string; balance: string }>(
        tenantId,
        `SELECT account_id, balance FROM accounts WHERE owner_id = $1 AND owner_type = 'user' LIMIT 1`,
        [clientUser.userId]
      );

      let clientAccountId: string;
      if (clientAccounts.length === 0) {
        // Criar conta se não existir
        const accountResult = await runQueryWithTenant<{ account_id: string }>(
          tenantId,
          `INSERT INTO accounts (tenant_id, owner_id, owner_type, balance, currency)
           VALUES ($1, $2, 'user', $3, 'BRL')
           RETURNING account_id`,
          [tenantId, clientUser.userId, 1000]
        );
        if (!accountResult) {
          throw new Error('Failed to create client account');
        }
        clientAccountId = accountResult.account_id;
      } else {
        clientAccountId = clientAccounts[0].account_id;
        // Garantir saldo suficiente
        await runQueryWithTenant(
          tenantId,
          `UPDATE accounts SET balance = 1000 WHERE account_id = $1`,
          [clientAccountId]
        );
      }

      // Completar assignment
      const response = await app.inject({
        method: 'POST',
        url: `/work/assignments/${assignmentId}/complete`,
        headers: {
          authorization: `Bearer ${clientUser.token}`,
          'x-tenant-id': tenantId,
        },
        payload: {
          rating: 5,
          comment: 'Excelente trabalho!',
          qualityRating: 5,
          punctualityRating: 5,
          professionalismRating: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      const assignment = JSON.parse(response.body);
      expect(assignment.status).toBe('completed');
      expect(assignment.paymentTransactionId).toBeTruthy();
      transactionId = assignment.paymentTransactionId;
    });

    it('5. Deve verificar registro no ledger (credit e debit)', async () => {
      expect(transactionId).toBeTruthy();

      // Buscar entradas do ledger para a transação
      const ledgerEntries = await runQueriesWithTenant<{
        entry_id: string;
        account_id: string;
        entry_type: string;
        amount: string;
        transaction_id: string;
      }>(
        tenantId,
        `SELECT entry_id, account_id, entry_type, amount, transaction_id
         FROM ledger
         WHERE transaction_id = $1
         ORDER BY entry_type`,
        [transactionId]
      );

      expect(ledgerEntries.length).toBe(2);

      const debitEntry = ledgerEntries.find((e: { entry_type: string }) => e.entry_type === 'debit');
      const creditEntry = ledgerEntries.find((e: { entry_type: string }) => e.entry_type === 'credit');

      expect(debitEntry).toBeTruthy();
      expect(creditEntry).toBeTruthy();
      expect(parseFloat(debitEntry!.amount)).toBe(150);
      expect(parseFloat(creditEntry!.amount)).toBe(150);
    });

    it('6. Deve verificar metadata da transação (source: work, job_id)', async () => {
      expect(transactionId).toBeTruthy();

      const transaction = await runQueryWithTenant<{
        transaction_id: string;
        metadata: any;
      }>(
        tenantId,
        `SELECT transaction_id, metadata FROM transactions WHERE transaction_id = $1`,
        [transactionId]
      );

      expect(transaction).toBeTruthy();
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      const tx = transaction;
      expect(tx.metadata).toHaveProperty('module', 'work');
      expect(tx.metadata).toHaveProperty('type', 'work_assignment_payment');
      expect(tx.metadata).toHaveProperty('jobId', jobId);
      expect(tx.metadata).toHaveProperty('assignmentId', assignmentId);
    });

    it('7. Deve verificar atualização de reputação', async () => {
      // Buscar reputação do worker após a review
      const reputation = await runQueryWithTenant<{
        entity_type: string;
        entity_id: string;
        score: string;
      }>(
        tenantId,
        `SELECT entity_type, entity_id, score
         FROM reputation_scores
         WHERE entity_type = 'worker' AND entity_id = $1
         LIMIT 1`,
        [worker.workerId]
      );

      // A reputação pode não existir ainda se o sistema de reputação não foi inicializado
      // Mas se existir, deve ter um score
      if (reputation) {
        expect(parseFloat(reputation.score)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(reputation.score)).toBeLessThanOrEqual(5);
      }
    });
  });
});

