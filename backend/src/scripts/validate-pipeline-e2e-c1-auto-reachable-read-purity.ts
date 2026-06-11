/**
 * E2E HTTP REAL — F-C1-AUTO-REACHABLE-READ-PURITY
 *
 * Prova que os GETs AUTO/REQUIRED-REACHABLE do caminho C1 são LEITURA PURA:
 *   - /social/actors/available NÃO cria actor;
 *   - /profile NÃO cria profile (404 honesto);
 *   - /core/profile NÃO cria actor nem gera referral;
 *   - /identity/me NÃO cria profile;
 *   - /referral/code NÃO escreve (GET); POST /referral/code = writer explícito idempotente;
 *   - /profile/progress: erro → 500 observável (gate), sucesso → 200;
 *   - unread-counts: erro estrutural (posts.visibility fantasma) → null (NÃO zero falso).
 * Contagens de estado antes/depois idênticas. Gate + prova negativa.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-c1-auto-reachable-read-purity.ts
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';

const JWT_SECRET = process.env.JWT_SECRET!;
const MARKER = 'e2e-c1rp';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function genValidCpf(seed: number): string {
  const n: number[] = []; let s = seed;
  for (let i = 0; i < 9; i++) { n.push(s % 10); s = Math.floor(s / 10) + 7 * (i + 1); }
  const dv = (a: number[]) => { let sum = 0; const len = a.length + 1; for (let i = 0; i < a.length; i++) sum += a[i] * (len - i); const r = (sum * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = dv(n); const d2 = dv([...n, d1]); return [...n, d1, d2].join('');
}
function mintToken(userId: string, globalUserId: string, tenantId: string, email: string): string {
  return jwt.sign({ sub: userId, userId, globalUserId, tenantId, email, type: 'access', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}
function ac(actorId: string, tenantId: string): Record<string, string> {
  return { 'x-action-context': JSON.stringify({ actorId, intent: 'e2e-rp', source: 'e2e', scope: tenantId }) };
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
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  // Rota pública de cadastro
  const authModule = await import('../core/auth/auth.routes');
  await app.register(authModule.default, { prefix: '/auth' });
  // Escopo protegido (auth + tenant + actionContext + rbac)
  await app.register(async (scope) => {
    const authPlugin = (await import('../core/auth/auth.plugin')).default;
    const { tenantPlugin } = await import('../plugins/tenant.plugin');
    const { actionContextPlugin } = await import('../plugins/action-context.plugin');
    const { rbacPlugin } = await import('../plugins/rbac.plugin');
    await scope.register(tenantPlugin);
    await scope.register(authPlugin);
    await scope.register(actionContextPlugin);
    await scope.register(rbacPlugin);
    const coreModule = (await import('../core/core.routes')).coreRoutes;
    const profileModule = (await import('../core/profile/profile.routes')).default;
    const referralModule = (await import('../core/referral/referral.routes')).default;
    const socialModule = (await import('../modules/social/social.module')).default;
    const identityModule = (await import('../core/identity/identity.routes')).default;
    await scope.register(coreModule, { prefix: '/core' });
    await scope.register(profileModule, { prefix: '/profile' });
    await scope.register(referralModule, { prefix: '/referral' });
    await scope.register(socialModule, { prefix: '/social' });
    await scope.register(identityModule, { prefix: '/identity' });
  });
  await app.ready();
  return app;
}

async function snap(tenantId: string) {
  const a = await pool.query(`SELECT COUNT(*)::int c FROM actors WHERE tenant_id=$1`, [tenantId]);
  const p = await pool.query(`SELECT COUNT(*)::int c FROM profiles WHERE tenant_id=$1`, [tenantId]);
  const i = await pool.query(`SELECT COUNT(*)::int c FROM identities`);
  const r = await pool.query(`SELECT COUNT(*)::int c FROM users WHERE tenant_id=$1 AND referral_code IS NOT NULL`, [tenantId]);
  return { actors: a.rows[0].c, profiles: p.rows[0].c, identities: i.rows[0].c, refcodes: r.rows[0].c };
}
function eq(b: any, a: any) { return b.actors === a.actors && b.profiles === a.profiles && b.identities === a.identities && b.refcodes === a.refcodes; }

async function cleanup(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SET session_replication_role = replica`);
    const us = await client.query(`SELECT id::text id, global_user_id::text gid FROM users WHERE email LIKE $1`, [`${MARKER}-%`]);
    for (const u of us.rows) {
      await client.query(`DELETE FROM actors WHERE user_id=$1`, [u.id]);
      await client.query(`DELETE FROM profiles WHERE user_id=$1`, [u.id]);
      await client.query(`DELETE FROM user_profiles WHERE user_id=$1`, [u.id]);
      await client.query(`DELETE FROM users WHERE id=$1`, [u.id]);
    }
    const gus = await client.query(`SELECT global_user_id::text gid FROM global_users WHERE full_name ILIKE $1`, [`${MARKER}%`]);
    for (const g of gus.rows) {
      await client.query(`DELETE FROM identities WHERE global_user_id=$1`, [g.gid]);
      await client.query(`DELETE FROM global_users WHERE global_user_id=$1`, [g.gid]);
    }
    await client.query(`SET session_replication_role = DEFAULT`);
  } finally { client.release(); }
}

async function main(): Promise<void> {
  delete process.env.PILOT_MODE;
  await bootstrapPorts();
  await cleanup();
  const app = await buildApp();
  const base = Math.floor(Math.random() * 90000000) + 10000000;

  const inst = await pool.query<{ id: string }>(`SELECT id::text FROM tenants WHERE slug='unificard-inicial'`);
  const tenantId = inst.rows[0].id;

  // Cadastro orgânico REAL (nascimento atômico) — actor+profile garantidos.
  const cpfA = genValidCpf(base);
  const emailA = `${MARKER}-a-${base}@e2e.local`;
  const rReg = await app.inject({ method: 'POST', url: '/auth/register', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email: emailA, password: 'senha123', cpf: cpfA, fullName: `${MARKER}A` }) });
  const regData = rReg.statusCode === 201 ? JSON.parse(rReg.body).data : null;

  // dados do usuário A
  const uA = await pool.query<{ id: string; gid: string }>(`SELECT id::text id, global_user_id::text gid FROM users WHERE email=$1`, [emailA]);
  const userA = uA.rows[0];
  const actA = await pool.query<{ id: string }>(`SELECT id::text FROM actors WHERE user_id=$1 AND actor_type='user' LIMIT 1`, [userA.id]);
  const actorA = actA.rows[0]?.id;
  const tokenA = mintToken(userA.id, userA.gid, tenantId, emailA);
  const get = (url: string, actorId?: string) => app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${tokenA}`, ...ac(actorId ?? actorA, tenantId) } });

  try {
    console.log('\n— A: nascimento garante actor+profile —');
    record('A1 register orgânico → 201', rReg.statusCode === 201, `status ${rReg.statusCode}`);
    record('A2 actor humano já existe pós-nascimento', !!actorA);
    const profA = await pool.query(`SELECT 1 FROM profiles WHERE user_id=$1`, [userA.id]);
    record('A3 profiles(cpf) já existe pós-nascimento', (profA.rowCount ?? 0) === 1);
    void regData;

    console.log('\n— B: /social/actors/available LEITURA PURA —');
    const b1 = await snap(tenantId);
    const rAv = await get('/social/actors/available');
    const b2 = await snap(tenantId);
    const avBody = rAv.statusCode === 200 ? JSON.parse(rAv.body) : null;
    record('B1 actors/available → 200', rAv.statusCode === 200, `status ${rAv.statusCode}: ${rAv.body.slice(0,100)}`);
    record('B2 GET não cria actor (contagens idênticas)', eq(b1, b2), `${JSON.stringify(b1)} vs ${JSON.stringify(b2)}`);
    const list = Array.isArray(avBody) ? avBody : (avBody?.data ?? avBody?.actors ?? []);
    record('B3 lista inclui o user-actor de A', Array.isArray(list) && list.some((a: any) => a.actor_id === actorA), JSON.stringify(list)?.slice(0,120));

    console.log('\n— C: usuário legado SEM actor → GET não cura —');
    // cria user+global_user+identity SEM actor
    const cpfC = genValidCpf(base + 1); const emailC = `${MARKER}-c-${base}@e2e.local`;
    const gidC = randomUUID(); const userCId = randomUUID();
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1,$2,$3)`, [gidC, cpfC, `${MARKER}C`]);
    await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,$5,0)`, [userCId, tenantId, gidC, emailC, 'x']);
    await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [gidC, cpfC]);
    const tokenC = mintToken(userCId, gidC, tenantId, emailC);
    const c1 = await snap(tenantId);
    const rAvC = await app.inject({ method: 'GET', url: '/social/actors/available', headers: { authorization: `Bearer ${tokenC}`, ...ac(randomUUID(), tenantId) } });
    const c2 = await snap(tenantId);
    record('C1 legado sem actor: GET não cria actor (contagens idênticas)', c1.actors === c2.actors, `${c1.actors} vs ${c2.actors}`);
    const cList = rAvC.statusCode === 200 ? (() => { const b = JSON.parse(rAvC.body); return Array.isArray(b) ? b : (b?.data ?? b?.actors ?? []); })() : [];
    record('C2 lista de C NÃO contém user-actor (ausência honesta)', !cList.some((a: any) => a.actor_type === 'user'), JSON.stringify(cList)?.slice(0,100));

    console.log('\n— D: /profile LEITURA PURA —');
    const d1 = await snap(tenantId);
    const rProf = await get('/profile');
    const d2 = await snap(tenantId);
    record('D1 /profile (A tem profile) → 200', rProf.statusCode === 200, `status ${rProf.statusCode}`);
    record('D2 GET /profile não cria profile (contagens idênticas)', eq(d1, d2));
    // usuário C tem profile? não (não criamos). GET /profile de C → 404 honesto, sem criar.
    const dC1 = await snap(tenantId);
    const rProfC = await app.inject({ method: 'GET', url: '/profile', headers: { authorization: `Bearer ${tokenC}`, ...ac(randomUUID(), tenantId) } });
    const dC2 = await snap(tenantId);
    record('D3 /profile sem profile → 404 honesto', rProfC.statusCode === 404, `status ${rProfC.statusCode}`);
    record('D4 404 não cria profile (contagens idênticas)', dC1.profiles === dC2.profiles);

    console.log('\n— E: /core/profile LEITURA PURA —');
    const e1 = await snap(tenantId);
    const rCore = await get('/core/profile');
    const e2 = await snap(tenantId);
    record('E1 /core/profile (A) → 200', rCore.statusCode === 200, `status ${rCore.statusCode}`);
    record('E2 GET /core/profile não cria actor/referral (contagens idênticas)', eq(e1, e2), `${JSON.stringify(e1)} vs ${JSON.stringify(e2)}`);
    const coreBody = rCore.statusCode === 200 ? JSON.parse(rCore.body) : null;
    record('E3 /core/profile retorna actor de A (read)', (coreBody?.data?.actor?.actor_id ?? coreBody?.actor?.actor_id) === actorA, JSON.stringify(coreBody)?.slice(0,120));

    console.log('\n— F: /identity/me LEITURA PURA —');
    const f1 = await snap(tenantId);
    const rIdMe = await get('/identity/me', actorA);
    const f2 = await snap(tenantId);
    record('F1 /identity/me (A) → 200', rIdMe.statusCode === 200, `status ${rIdMe.statusCode}: ${rIdMe.body.slice(0,100)}`);
    record('F2 GET /identity/me não cria profile (contagens idênticas)', eq(f1, f2));

    console.log('\n— G: /referral/code GET puro + POST writer —');
    // GET não escreve
    const g1 = await snap(tenantId);
    const rRefGet = await get('/referral/code');
    const g2 = await snap(tenantId);
    record('G1 GET /referral/code → 200', rRefGet.statusCode === 200, `status ${rRefGet.statusCode}`);
    record('G2 GET /referral/code não altera refcodes (contagens idênticas)', g1.refcodes === g2.refcodes, `${g1.refcodes} vs ${g2.refcodes}`);
    // estado do referral_code de A antes
    const beforeCode = (await pool.query<{ rc: string | null }>(`SELECT referral_code rc FROM users WHERE id=$1`, [userA.id])).rows[0].rc;
    const rRefGet2 = await get('/referral/code');
    const afterCode = (await pool.query<{ rc: string | null }>(`SELECT referral_code rc FROM users WHERE id=$1`, [userA.id])).rows[0].rc;
    record('G3 GET repetido não escreve (referral_code estável)', beforeCode === afterCode, `${beforeCode} vs ${afterCode}`); void rRefGet2;
    // POST writer idempotente
    const post = (token: string, actorId: string) => app.inject({ method: 'POST', url: '/referral/code', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...ac(actorId, tenantId) }, payload: '{}' });
    const rPost1 = await post(tokenA, actorA);
    const code1 = rPost1.statusCode === 200 ? JSON.parse(rPost1.body).referralCode : null;
    const rPost2 = await post(tokenA, actorA);
    const code2 = rPost2.statusCode === 200 ? JSON.parse(rPost2.body).referralCode : null;
    record('G4 POST /referral/code → 200 com código', rPost1.statusCode === 200 && !!code1, `status ${rPost1.statusCode}`);
    record('G5 POST idempotente (mesmo código; sem duplicação)', code1 === code2 && rPost2.statusCode === 200, `${code1} vs ${code2}`);

    console.log('\n— H: /profile/progress —');
    const h1 = await snap(tenantId);
    const rProg = await get('/profile/progress');
    const h2 = await snap(tenantId);
    const progBody = rProg.statusCode === 200 ? JSON.parse(rProg.body) : null;
    record('H1 /profile/progress (A) → 200 com objeto de progresso', rProg.statusCode === 200 && progBody?.data && typeof progBody.data.progress === 'number', `status ${rProg.statusCode}`);
    record('H2 /profile/progress não escreve (contagens idênticas)', eq(h1, h2));

    console.log('\n— I: unread-counts: erro estrutural → null (NÃO zero falso) —');
    const i1 = await snap(tenantId);
    const rUnread = await get('/social/unread-counts');
    const i2 = await snap(tenantId);
    const unread = rUnread.statusCode === 200 ? JSON.parse(rUnread.body) : null;
    record('I1 /social/unread-counts → 200', rUnread.statusCode === 200, `status ${rUnread.statusCode}`);
    // feed referencia posts.visibility (coluna fantasma) → erro estrutural → null (não 0 falso)
    record('I2 feed (erro estrutural posts.visibility) → null, NÃO 0 falso', unread?.feed === null, `feed=${JSON.stringify(unread?.feed)}`);
    record('I3 groups (sem erro) → número honesto (0 ou +)', typeof unread?.groups === 'number', `groups=${JSON.stringify(unread?.groups)}`);
    record('I4 unread não escreve (contagens idênticas)', eq(i1, i2));

    console.log('\n— J: bootstrap completo sem cura —');
    const j1 = await snap(tenantId);
    await get('/social/actors/available'); await get('/profile'); await get('/profile/progress');
    const j2 = await snap(tenantId);
    record('J1 bootstrap (actors+profile+progress) zero estado novo', eq(j1, j2), `${JSON.stringify(j1)} vs ${JSON.stringify(j2)}`);

    console.log('\n— GATE: estrutural + prova negativa —');
    let gExit = 0;
    try { execSync('node scripts/audit-c1-auto-reachable-read-purity.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { gExit = 1; }
    record('K1 gate passa no código final (exit 0)', gExit === 0);
    // prova negativa: stub regressivo de /profile route com createProfileIfNotExists
    const fs = await import('fs');
    const realProf = join(process.cwd(), 'src/core/profile/profile.routes.ts');
    const orig = fs.readFileSync(realProf, 'utf8');
    const regressed = orig.replace(
      "return reply.status(404).send({ ok: false, code: 'PROFILE_NOT_FOUND', message: 'Perfil não encontrado' });",
      "const np = await profileService.createProfileIfNotExists(req.tenant.id, userId); return reply.send({ ok: true, data: np });"
    );
    fs.writeFileSync(realProf, regressed);
    let negExit = 0;
    try { execSync('node scripts/audit-c1-auto-reachable-read-purity.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { negExit = 1; }
    fs.writeFileSync(realProf, orig); // restaura
    record('K2 prova negativa: write-on-GET reintroduzido → gate FALHA', negExit === 1);

  } finally {
    await cleanup();
    const left = await pool.query(`SELECT (SELECT COUNT(*) FROM users WHERE email LIKE $1)+(SELECT COUNT(*) FROM global_users WHERE full_name ILIKE $2) total`, [`${MARKER}-%`, `${MARKER}%`]);
    record('Z1 cleanup: zero fixtures residuais', Number(left.rows[0].total) === 0, `restam ${left.rows[0].total}`);
    await app.close();
    await pool.end();
  }

  const passed = results.filter(r => r.ok).length;
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTADO: ${passed}/${results.length} verdes`);
  if (passed !== results.length) { console.log('FALHAS:'); results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.label} — ${r.reason ?? ''}`)); process.exit(1); }
  console.log('✨ GETs auto/required-reachable são leitura pura: zero write/ensure/zero-falso; ausência honesta; unread null; POST writer idempotente; gate verde.');
}

main().catch(e => { console.error(String(e)); process.exit(1); });
