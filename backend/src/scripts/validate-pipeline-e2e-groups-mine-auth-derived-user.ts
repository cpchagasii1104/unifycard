/**
 * E2E F-GROUPS-MINE-HTTP-PROOF-AND-ACTIONCONTEXT-DECOUPLING
 * (DECISION-0113 + DECISION-0116 Classe C GROUP_MEMBERS)
 *
 * Contexto:
 *   Commit c00435da corrigiu o handler: userId = req.user?.userId (JWT server-side).
 *   Esta fatia fecha dois resíduos apontados pela Yala:
 *     R1 — E2E anterior (c00435da) usava só SQL/grep/schema, sem chamada HTTP real.
 *     R2 — actionContext middleware exigia actorId em GET /groups/mine, criando contrato
 *          falso (rota self-scoped; actorId não participa da seleção).
 *
 *   Fix R2: bypass exato `rawPath === '/groups/mine' && method === 'GET'` em
 *     action-context.plugin.ts. Auth + tenant permanecem obrigatórios. Bypass isolado ao
 *     path e método exatos — não afeta /groups/:id nem writes.
 *
 * Fail-first documentado (antes do bypass):
 *   GET /groups/mine autenticado sem actionContext → 400 "ActionContext is required"
 *   (execução real; evidência no execution log e opus.md desta fatia).
 *
 * Prova (este script):
 *   A HTTP comportamental — fixtures reais, isolação A vs B, spoof ignorado, unauthenticated 401.
 *   B estrutural — código-fonte: handler, plugin, repository.
 *   C schema DB — group_members.user_id; sem actor_id.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-groups-mine-auth-derived-user.ts
 */

import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(process.cwd(), '.env') });

import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';
import groupsModule from '../modules/groups/groups.module';

const JWT_SECRET = process.env.JWT_SECRET!;
const TENANT_ID = process.env.E2E_TENANT_ID ?? 'fbe13b78-4516-493d-905a-363796aea1d1';
const MARKER = 'E2E-GROUPS-MINE-HTTP';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

function sliceHandler(src: string, startMarker: string, endMarker: string): string {
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s + startMarker.length);
  return s >= 0 && e > s ? src.slice(s, e) : '';
}

function mintToken(userId: string, tokenVersion: number): string {
  return jwt.sign(
    { sub: userId, userId, tenantId: TENANT_ID, email: `${userId}@e2e.local`, type: 'access', tokenVersion },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
}

async function bootstrapPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const { bankPortsRegistry } = await import('../core/bank/ports-registry');
  const ba = await import('../modules/bank/adapters');
  bankPortsRegistry.setBankAccount(ba.bankAccountAdapter);
  bankPortsRegistry.setBankTransaction(ba.bankTransactionAdapter);
  bankPortsRegistry.setBankTransactionRead(ba.bankTransactionReadAdapter);
  bankPortsRegistry.setBankIntegration(ba.bankIntegrationAdapter);
  bankPortsRegistry.setBankLimit(ba.bankLimitAdapter);

  const { groupsPortsRegistry } = await import('../core/groups/ports-registry');
  const ga = await import('../modules/groups/adapters');
  groupsPortsRegistry.setGroupsRepository(ga.groupsRepositoryAdapter);
}

async function buildMinimalApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  await app.register(groupsModule, { prefix: '/groups' });
  await app.ready();
  return app;
}

// ── Fixtures ────────────────────────────────────────────────────────────────
interface Fixture {
  userAId: string;
  userBId: string;
  groupAId: string;
  groupBId: string;
  ownerActorId: string; // pre-existing actor used as groups owner (not created)
  spoofActorAId: string; // random UUID for spoof test (no DB entry needed, bypass ignores it)
  spoofActorBId: string;
}

async function createFixtures(): Promise<Fixture> {
  const userAId = randomUUID();
  const userBId = randomUUID();
  const groupAId = randomUUID();
  const groupBId = randomUUID();
  // Random UUIDs for spoof — bypass means actionContext is ignored; don't need real actors
  const spoofActorAId = randomUUID();
  const spoofActorBId = randomUUID();

  // Fetch a pre-existing actor to use as owner_actor_id FK (avoids FK chain creation)
  const ownerRow = await pool.query<{ id: string }>(
    `SELECT id::text FROM actors WHERE tenant_id = $1 LIMIT 1`, [TENANT_ID]
  );
  if (!ownerRow.rows[0]) throw new Error('No actors in dev DB — cannot create groups fixture');
  const ownerActorId = ownerRow.rows[0].id;

  // Users: global_user_id is nullable; just provide id/user_id/tenant_id/email/password_hash/token_version
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version)
     VALUES ($1,$1,$2,$3,'x',0), ($4,$4,$2,$5,'x',0)`,
    [userAId, TENANT_ID, `${MARKER}-A-${userAId.slice(0,8)}@e2e.local`,
     userBId, `${MARKER}-B-${userBId.slice(0,8)}@e2e.local`]
  );

  // Groups: owner_actor_id FK → existing actor; no visibility/scope required by schema
  await pool.query(
    `INSERT INTO groups (id, tenant_id, name, owner_actor_id, status, metadata)
     VALUES ($1,$2,$3,$4,'active','{}'), ($5,$2,$6,$4,'active','{}')`,
    [groupAId, TENANT_ID, `${MARKER}-GA`, ownerActorId,
     groupBId, `${MARKER}-GB`]
  );

  // group_members: A→GA, B→GB (A NOT in GB, B NOT in GA)
  // id has no default — must provide; created_at has now() default
  await pool.query(
    `INSERT INTO group_members (id, tenant_id, group_id, user_id, role)
     VALUES ($1,$2,$3,$4,'member'), ($5,$2,$6,$7,'member')`,
    [randomUUID(), TENANT_ID, groupAId, userAId, randomUUID(), groupBId, userBId]
  );

  return { userAId, userBId, groupAId, groupBId, ownerActorId, spoofActorAId, spoofActorBId };
}

async function cleanupFixtures(f: Fixture): Promise<void> {
  await pool.query(`DELETE FROM group_members WHERE tenant_id=$1 AND (group_id=$2 OR group_id=$3)`, [TENANT_ID, f.groupAId, f.groupBId]);
  await pool.query(`DELETE FROM groups WHERE id IN ($1,$2) AND tenant_id=$3`, [f.groupAId, f.groupBId, TENANT_ID]);
  await pool.query(`DELETE FROM users WHERE id IN ($1,$2) AND tenant_id=$3`, [f.userAId, f.userBId, TENANT_ID]);
}

// ── Helper ────────────────────────────────────────────────────────────────────

function acHeader(actorId: string): string {
  return JSON.stringify({ actorId, intent: 'view_groups', source: 'e2e', scope: `tenant:${TENANT_ID}` });
}

async function main(): Promise<void> {
  await bootstrapPorts();

  const app = await buildMinimalApp();
  const fix = await createFixtures();

  try {
    const tokenA = mintToken(fix.userAId, 0);
    const tokenB = mintToken(fix.userBId, 0);

    // ────────────────────────────────────────────────────────────────────────
    console.log('\n— A HTTP comportamental — isolação real A vs B —');
    // ────────────────────────────────────────────────────────────────────────

    // A1: A sem actionContext → 200 + apenas GA
    const r1 = await app.inject({ method: 'GET', url: '/groups/mine', headers: { authorization: `Bearer ${tokenA}` } });
    const b1 = JSON.parse(r1.body);
    const a1GroupIds: string[] = (b1.groups ?? []).map((g: any) => g.groupId ?? g.id);
    record('A1 A sem actionContext → 200', r1.statusCode === 200, `status=${r1.statusCode}`);
    record('A2 A vê grupo GA (membro)', a1GroupIds.includes(fix.groupAId), `ids=${JSON.stringify(a1GroupIds)}`);
    record('A3 A NÃO vê grupo GB (não-membro)', !a1GroupIds.includes(fix.groupBId), `ids=${JSON.stringify(a1GroupIds)}`);

    // A4: B sem actionContext → 200 + apenas GB
    const r4 = await app.inject({ method: 'GET', url: '/groups/mine', headers: { authorization: `Bearer ${tokenB}` } });
    const b4 = JSON.parse(r4.body);
    const a4GroupIds: string[] = (b4.groups ?? []).map((g: any) => g.groupId ?? g.id);
    record('A4 B sem actionContext → 200', r4.statusCode === 200, `status=${r4.statusCode}`);
    record('A5 B vê grupo GB (membro)', a4GroupIds.includes(fix.groupBId), `ids=${JSON.stringify(a4GroupIds)}`);
    record('A6 B NÃO vê grupo GA (não-membro)', !a4GroupIds.includes(fix.groupAId), `ids=${JSON.stringify(a4GroupIds)}`);

    // A7: A com actionContext MALICIOSO apontando para actor de B → resposta IDÊNTICA à de A self
    const r7 = await app.inject({
      method: 'GET', url: '/groups/mine',
      headers: { authorization: `Bearer ${tokenA}`, 'x-action-context': acHeader(fix.spoofActorBId) },
    });
    const b7 = JSON.parse(r7.body);
    const a7GroupIds: string[] = (b7.groups ?? []).map((g: any) => g.groupId ?? g.id);
    record('A7 A com actionContext malicioso (actorId=spoofB) → 200', r7.statusCode === 200, `status=${r7.statusCode}`);
    record('A8 spoof não muda resultado: A ainda vê GA', a7GroupIds.includes(fix.groupAId), `ids=${JSON.stringify(a7GroupIds)}`);
    record('A9 spoof não muda resultado: A ainda NÃO vê GB', !a7GroupIds.includes(fix.groupBId), `ids=${JSON.stringify(a7GroupIds)}`);

    // A10: B com actionContext de A → continua vendo só GB
    const r10 = await app.inject({
      method: 'GET', url: '/groups/mine',
      headers: { authorization: `Bearer ${tokenB}`, 'x-action-context': acHeader(fix.spoofActorAId) },
    });
    const b10 = JSON.parse(r10.body);
    const a10GroupIds: string[] = (b10.groups ?? []).map((g: any) => g.groupId ?? g.id);
    record('A10 B com actionContext de A → ainda vê GB (não GA)', a10GroupIds.includes(fix.groupBId) && !a10GroupIds.includes(fix.groupAId),
      `ids=${JSON.stringify(a10GroupIds)}`);

    // A11: sem autenticação → 401
    const r11 = await app.inject({ method: 'GET', url: '/groups/mine' });
    record('A11 sem autenticação → 401', r11.statusCode === 401, `status=${r11.statusCode}`);

    // A12: contrato { groups: [...] } presente
    record('A12 contrato { groups: [...] } presente nas respostas 200',
      Array.isArray(b1.groups) && Array.isArray(b4.groups),
      `b1.groups type=${typeof b1.groups}, b4.groups type=${typeof b4.groups}`);

    // ────────────────────────────────────────────────────────────────────────
    console.log('\n— A13 — GET não cria estado —');
    // ────────────────────────────────────────────────────────────────────────
    const gmBefore = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM group_members WHERE tenant_id=$1`, [TENANT_ID]);
    const grpBefore = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM groups WHERE tenant_id=$1`, [TENANT_ID]);
    const actBefore = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM actors WHERE tenant_id=$1`, [TENANT_ID]);

    // Chamar mais 2 vezes
    await app.inject({ method: 'GET', url: '/groups/mine', headers: { authorization: `Bearer ${tokenA}` } });
    await app.inject({ method: 'GET', url: '/groups/mine', headers: { authorization: `Bearer ${tokenB}` } });

    const gmAfter = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM group_members WHERE tenant_id=$1`, [TENANT_ID]);
    const grpAfter = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM groups WHERE tenant_id=$1`, [TENANT_ID]);
    const actAfter = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM actors WHERE tenant_id=$1`, [TENANT_ID]);

    record('A13 GET não cria group_members, groups nem actors',
      gmBefore.rows[0].c === gmAfter.rows[0].c &&
      grpBefore.rows[0].c === grpAfter.rows[0].c &&
      actBefore.rows[0].c === actAfter.rows[0].c);

    // ────────────────────────────────────────────────────────────────────────
    console.log('\n— B estrutural — fonte —');
    // ────────────────────────────────────────────────────────────────────────
    const root = process.cwd();
    const groupsSrc = readFileSync(join(root, 'src/modules/groups/groups.routes.ts'), 'utf8');
    const pluginSrc = readFileSync(join(root, 'src/plugins/action-context.plugin.ts'), 'utf8');
    const repoSrc = readFileSync(join(root, 'src/modules/groups/groups.repository.ts'), 'utf8');

    const mineHandler = sliceHandler(groupsSrc, "'/mine',", '* GET /groups');

    record('B1 handler usa req.user?.userId (JWT server-side)', /const userId = req\.user\?\.userId/.test(mineHandler));
    record('B2 handler NÃO usa req.actionContext.actorId como userId', mineHandler.length > 0 && !/const userId = req\.actionContext\.actorId/.test(mineHandler));
    record('B3 guard 401 fail-closed para userId ausente', /reply\.code\(401\)/.test(mineHandler) && /UNAUTHENTICATED/.test(mineHandler));
    record('B4 repository getUserGroups usa gm.user_id = $2', /gm\.user_id = \$2/.test(repoSrc));
    record('B5 bypass em action-context.plugin exato: rawPath === "/groups/mine"', /rawPath === '\/groups\/mine'/.test(pluginSrc));
    record('B6 bypass requer method === "GET" (writes não são isentos)', /req\.method === 'GET' && rawPath === '\/groups\/mine'/.test(pluginSrc));
    record('B7 bypass NÃO usa endsWith nem includes (path exato)', !/endsWith.*groups\/mine/.test(pluginSrc) && !/includes.*groups\/mine/.test(pluginSrc));
    record('B8 /social/actors/available bypass permanece intacto', /endsWith\('\/social\/actors\/available'\)/.test(pluginSrc));
    record('B9 GET /groups/mine NÃO chama ensureUserActor nem getActiveActor', !/ensureUserActor|getActiveActor/.test(mineHandler));
    record('B10 GET /groups/mine é read-only: sem INSERT/UPDATE no handler', !/INSERT|UPDATE/.test(mineHandler));

    // ────────────────────────────────────────────────────────────────────────
    console.log('\n— C schema DB —');
    // ────────────────────────────────────────────────────────────────────────
    const colCheck = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='group_members' AND table_schema='public'`
    );
    const cols = colCheck.rows.map(r => r.column_name);
    record('C1 group_members.user_id existe (FK→users.user_id)', cols.includes('user_id'));
    record('C2 group_members NÃO tem actor_id (user_id é a FK correta)', !cols.includes('actor_id'));

    // ────────────────────────────────────────────────────────────────────────
    // Cleanup + verify
    // ────────────────────────────────────────────────────────────────────────
    await cleanupFixtures(fix);
    const remaining = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM users WHERE email LIKE $1 AND tenant_id=$2`,
      [`${MARKER}%`, TENANT_ID]
    );
    record('D1 cleanup: zero fixtures residuais', remaining.rows[0].c === '0', `residual=${remaining.rows[0].c}`);

  } finally {
    // Safety: always attempt cleanup even on error
    try { await cleanupFixtures(fix); } catch { /* noop on double-cleanup */ }
    await app.close();
  }

  const failed = results.filter(r => !r.ok);
  console.log('\n' + '═'.repeat(60));
  if (failed.length === 0) {
    console.log(`RESULTADO: ${results.length}/${results.length} verdes`);
    console.log('✨ GET /groups/mine — HTTP real: isolação A/B, spoof ignorado, sem actionContext, sem estado. bypass exato.');
  } else {
    console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes — ${failed.length} FALHA(S)`);
    failed.forEach(f => console.log(`  ❌ ${f.label}${f.reason ? ' — ' + f.reason : ''}`));
    await pool.end();
    process.exit(1);
  }

  await pool.end();
}

main().catch(async e => {
  console.error('💥', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
