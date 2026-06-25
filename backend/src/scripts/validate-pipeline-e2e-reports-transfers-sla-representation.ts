/**
 * E2E F-REPORTS-TRANSFERS-SLA-REPRESENTATION (executa DECISION-0113).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-reports-transfers-sla-representation-ephemeral.ps1.
 *
 * Prova (HTTP real via fastify.inject), com reports:view_operational concedido, que GET /reports/transfers/sla:
 *   • fromActorId/toActorId representáveis → 200 (escopado ao actor);
 *   • fromActorId/toActorId de actor ALHEIO → 403 REPORT_ACTOR_NOT_REPRESENTABLE (mesmo com a permissão);
 *   • SEM filtro → self-scoped (transfers em que o self é PARTE: from OU to), NÃO tenant-wide;
 *   • Δbank=0 (leitura logística money-free).
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/report|transfer|sla|representation|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedUser(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + (seq += 137)).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${cpf}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id };
}

async function buildApp(tenantId: string, userId: string, actorId: string): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  // reports:view_operational CONCEDIDO — o ponto é que canRepresentActor barra mesmo com a permissão.
  app.decorate('requirePermission', (_perms: string[]) => async () => { /* allow */ });
  await app.register(async (scope) => {
    scope.decorateRequest('user', null);
    scope.decorateRequest('tenant', null);
    scope.decorateRequest('actionContext', null);
    scope.addHook('preHandler', async (req) => {
      (req as any).user = { id: userId, userId, tenantId };
      (req as any).tenant = { id: tenantId };
      (req as any).actionContext = { actorId };
    });
    const reportsRoutes = (await import('../modules/reports/reports.routes')).default;
    await scope.register(reportsRoutes, { prefix: '/reports' });
  });
  await app.ready();
  return app;
}

const idsOf = (payload: string): string[] => {
  try { const j = JSON.parse(payload); const arr = Array.isArray(j) ? j : (j.data ?? j.items ?? []); return arr.map((r: any) => r.stockTransferId || r.stock_transfer_id || r.id).filter(Boolean); }
  catch { return []; }
};

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const tenantId = randomUUID();
  await tenantService.createTenant({ id: tenantId, name: 'Reports SLA', slug: `rsla-${Date.now()}` });
  const A = await seedUser(tenantId, 'Self A');
  const B = await seedUser(tenantId, 'Other B');
  const C = await seedUser(tenantId, 'Other C');

  const mkTransfer = async (from: string, to: string): Promise<string> =>
    (await pool.query<{ id: string }>(
      `INSERT INTO stock_transfers (tenant_id, from_actor_id, to_actor_id, status, shipped_at) VALUES ($1::uuid,$2::uuid,$3::uuid,'SHIPPED',NOW()) RETURNING id::text AS id`,
      [tenantId, from, to]
    )).rows[0].id;
  const T_AB = await mkTransfer(A.actorId, B.actorId); // self é origem
  const T_BA = await mkTransfer(B.actorId, A.actorId); // self é destino
  const T_BC = await mkTransfer(B.actorId, C.actorId); // self FORA

  const bankSql = `SELECT ((SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_ledger))::int AS n`;
  const bankBefore = await count(bankSql);

  const app = await buildApp(tenantId, A.userId, A.actorId);
  const get = (qs: string) => app.inject({ method: 'GET', url: `/reports/transfers/sla${qs}` });

  try {
    // T1 — fromActorId = self (representável) → 200, inclui T_AB, não T_BC
    {
      const r = await get(`?fromActorId=${A.actorId}`);
      const ids = idsOf(r.payload);
      record('T1 fromActorId self representável → 200 (escopado, inclui T_AB, exclui T_BC)',
        r.statusCode === 200 && ids.includes(T_AB) && !ids.includes(T_BC), `status=${r.statusCode} ids=${ids.length}`);
    }
    // T2 — toActorId = self → 200, inclui T_BA
    {
      const r = await get(`?toActorId=${A.actorId}`);
      const ids = idsOf(r.payload);
      record('T2 toActorId self representável → 200 (inclui T_BA)', r.statusCode === 200 && ids.includes(T_BA), `status=${r.statusCode}`);
    }
    // T3 — fromActorId = actor ALHEIO (B) → 403 (mesmo com reports:view_operational)
    {
      const r = await get(`?fromActorId=${B.actorId}`);
      record('T3 fromActorId alheio → 403 REPORT_ACTOR_NOT_REPRESENTABLE (permissão não basta)',
        r.statusCode === 403 && /REPORT_ACTOR_NOT_REPRESENTABLE/.test(r.payload), `status=${r.statusCode} body=${r.payload.slice(0, 80)}`);
    }
    // T4 — toActorId = actor ALHEIO (C) → 403
    {
      const r = await get(`?toActorId=${C.actorId}`);
      record('T4 toActorId alheio → 403 REPORT_ACTOR_NOT_REPRESENTABLE', r.statusCode === 403 && /REPORT_ACTOR_NOT_REPRESENTABLE/.test(r.payload), `status=${r.statusCode}`);
    }
    // T5 — SEM filtro → self-scoped (T_AB + T_BA, NÃO T_BC), não tenant-wide
    {
      const r = await get('');
      const ids = idsOf(r.payload);
      record('T5 sem filtro → self-scoped (from OU to = self; inclui T_AB+T_BA, EXCLUI T_BC) — não tenant-wide',
        r.statusCode === 200 && ids.includes(T_AB) && ids.includes(T_BA) && !ids.includes(T_BC), `status=${r.statusCode} ids=${JSON.stringify(ids)}`);
    }
    // T6 — leitura continua viva (tabelas reais): a consulta retorna linhas reais
    {
      const r = await get('');
      record('T6 leitura viva (stock_transfers real; retorna linhas)', r.statusCode === 200 && idsOf(r.payload).length >= 2, `n=${idsOf(r.payload).length}`);
    }
  } finally { await app.close(); }

  // T7 — Δbank=0
  record('T7 Δbank=0 (leitura logística não move dinheiro)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ /reports/transfers/sla: actor alheio → 403 mesmo com permissão; sem filtro → self-scoped; irmãs intactas; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
