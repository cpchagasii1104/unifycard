/**
 * E2E F-SOCIAL-POST-INTENT-QUARANTINE-GATE (§4.8.4).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-social-post-intent-quarantine-gate-ephemeral.ps1.
 *
 * Prova que um actor bloqueado não publica post/intent na superfície canônica (social 2.0 createPost), sem abrir
 * dinheiro e sem religar o legado:
 *   • não-bloqueado publica → OK;
 *   • author bloqueado → 403 ACTOR_EFFECTIVELY_BLOCKED (nenhuma linha em posts; gate ANTES de validateIntent/effect);
 *   • author bloqueado com intent service_offer → 403 (intent é semântica, não decoração);
 *   • acting/createdAs bloqueado (author ativo) → 403;
 *   • legado POST /social/posts/create continua 501 SOCIAL_LEGACY_POST_CREATE_CONTAINED;
 *   • canRepresentActor puro; zero payment_intents/bank_*; schedules vazio; Δbank=0.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { social2Service } from '../modules/social/social-2.0.service';
import { authorizationService } from '../core/authorization/authorization.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const errOf = (e: any): { code?: string; status?: number; msg: string } => ({ code: e?.code, status: e?.statusCode, msg: e?.message || String(e) });
const isBlocked403 = (err: any): boolean => err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(`${err?.code || ''} ${err?.msg || ''}`);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/social|post|intent|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 113).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id };
}
const block = (tenantId: string, actorId: string) => pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [actorId, tenantId]);

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Social Post Intent Quarantine', slug: `spiq-${Date.now()}` });
  const oA = await seedActor(TENANT_ID, 'AuthorA');  // author — será bloqueado
  const oB = await seedActor(TENANT_ID, 'AuthorB');  // author — permanece ativo
  const x = await seedActor(TENANT_ID, 'ActingX');   // acting/createdAs — será bloqueado

  const createPost = (author: string, asUser: string, intent: any, createdAs?: string) =>
    social2Service.createPost(TENANT_ID, asUser, `post-${seq++}`, author, [], intent, undefined, undefined, undefined, undefined, undefined, createdAs)
      .then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const postCount = (actorId: string) => count(`SELECT count(*)::int AS n FROM posts WHERE tenant_id=$1 AND actor_id=$2`, [TENANT_ID, actorId]);

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const piSql = `SELECT COALESCE((SELECT count(*) FROM payment_intents),0)::int AS n`;
  const bankBefore = await count(bankSql);
  const piBefore = await count(piSql).catch(() => 0);

  // ── FASE OK / SEPARAÇÃO DE GATES ──
  // não-bloqueado PASSA o gate de quarentena → segue para validateIntent (gate de capability, SEPARADO).
  // Sucesso OU erro de capability (POST_CONTENT) provam que a quarentena NÃO bloqueou; o que bloqueia é o intent.
  { const r = await createPost(oA.actorId, oA.userId, 'personal'); record('T1 author não-bloqueado PASSA o gate de quarentena (erro ≠ ACTOR_EFFECTIVELY_BLOCKED; intent/capability é gate separado)', r.ok === true || (r.ok === false && !isBlocked403(r.err)), JSON.stringify(r.err)); }

  const postsBefore = await postCount(oA.actorId);
  await block(TENANT_ID, oA.actorId);
  await block(TENANT_ID, x.actorId);

  // ── QUARENTENA ──
  record('T2 author bloqueado publica → 403 ACTOR_EFFECTIVELY_BLOCKED', isBlocked403((await createPost(oA.actorId, oA.userId, 'personal')).err));
  record('T3 bloqueado → nenhuma linha nova em posts', (await postCount(oA.actorId)) === postsBefore, `before=${postsBefore}`);
  record('T4 author bloqueado intent service_offer → 403 (intent é semântica, gate antes de validateIntent)', isBlocked403((await createPost(oA.actorId, oA.userId, 'service_offer')).err));
  record('T5 acting/createdAs bloqueado (author ativo) → 403', isBlocked403((await createPost(oB.actorId, oB.userId, 'personal', x.actorId)).err));

  // ── LEGADO 501 (não religado) ──
  {
    const app = Fastify({ logger: false });
    const socialRoutes = (await import('../modules/social/social.routes')).default;
    await app.register(async (scope) => {
      scope.decorateRequest('user', null); scope.decorateRequest('tenant', null); scope.decorateRequest('actionContext', null);
      scope.addHook('preHandler', async (req) => { (req as any).user = { id: oB.userId, userId: oB.userId }; (req as any).tenant = { id: TENANT_ID }; (req as any).actionContext = { actorId: oB.actorId }; });
      await scope.register(socialRoutes as any, { prefix: '/social' });
    });
    await app.ready();
    try {
      const r = await app.inject({ method: 'POST', url: '/social/posts/create', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ content: 'x' }) });
      record('T6 legado POST /social/posts/create → 501 SOCIAL_LEGACY_POST_CREATE_CONTAINED (não religado)', r.statusCode === 501 && /SOCIAL_LEGACY_POST_CREATE_CONTAINED/.test(r.payload), `status=${r.statusCode} body=${r.payload.slice(0, 80)}`);
    } finally { await app.close(); }
  }

  // ── NÃO-REGRESSÃO / MONEY-FREE ──
  record('T7 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, oA.userId, oA.actorId)) === true);
  record('T8 zero payment_intents (intent é semântica, não executa dinheiro)', (await count(piSql).catch(() => 0)) === piBefore, `before=${piBefore}`);
  record('T9 Δbank=0 (nenhum bank_* tocado)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);
  record('T10 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ author/acting bloqueado não publica post/intent (gate antes de validateIntent/effect); legado 501 intacto; canRepresentActor puro; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
