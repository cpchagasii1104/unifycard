/**
 * E2E HTTP REAL — F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC
 *
 * Prova o nascimento humano orgânico tenant-bound e atômico:
 *   - cadastro orgânico → tenant `unificard-inicial` resolvido SERVER-SIDE;
 *   - x-tenant-id do cliente NÃO escolhe tenant;
 *   - zero tenant `user-*` novo;
 *   - global_user → user → identity → actor numa ÚNICA transação;
 *   - token só após COMMIT;
 *   - falha intermediária (CPF dup) → ROLLBACK total, sem estado residual;
 *   - PILOT_MODE permanece fail-closed (rejeita antes de qualquer escrita);
 *   - gate estrutural detecta regressão (prova negativa).
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-c1-birth-minimum-atomic-organic.ts
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';

const MARKER = 'e2e-c1birth';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

// Gera um CPF válido (11 dígitos com dígitos verificadores corretos).
function genValidCpf(seed: number): string {
  const n: number[] = [];
  let s = seed;
  for (let i = 0; i < 9; i++) { n.push(s % 10); s = Math.floor(s / 10) + 7 * (i + 1); }
  const dv = (arr: number[]) => {
    let sum = 0; const len = arr.length + 1;
    for (let i = 0; i < arr.length; i++) sum += arr[i] * (len - i);
    const r = (sum * 10) % 11; return r === 10 ? 0 : r;
  };
  const d1 = dv(n); const d2 = dv([...n, d1]);
  return [...n, d1, d2].join('');
}

function decodeJwt(token: string): any {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
}

async function buildApp(): Promise<FastifyInstance> {
  // ports sociais (ensureUserActorTx → actor repository)
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const app = Fastify({ logger: false });
  await app.register(sensible);
  const authModule = await import('../core/auth/auth.routes');
  await app.register(authModule.default, { prefix: '/auth' });
  await app.ready();
  return app;
}

async function counts(cpf: string, email: string) {
  const gu = await pool.query(`SELECT global_user_id::text gid FROM global_users WHERE cpf = $1`, [cpf]);
  const usr = await pool.query(`SELECT id::text uid, tenant_id::text tid FROM users WHERE email = $1`, [email]);
  const gid = gu.rows[0]?.gid ?? null;
  const ident = gid ? await pool.query(`SELECT 1 FROM identities WHERE global_user_id = $1`, [gid]) : { rowCount: 0 };
  const uid = usr.rows[0]?.uid ?? null;
  const act = uid ? await pool.query(`SELECT 1 FROM actors WHERE user_id = $1 AND actor_type='user'`, [uid]) : { rowCount: 0 };
  return {
    globalUser: gid, user: uid, tenant: usr.rows[0]?.tid ?? null,
    identity: (ident.rowCount ?? 0) > 0, actor: (act.rowCount ?? 0) > 0,
  };
}

async function cleanup(): Promise<void> {
  // Remove SÓ fixtures deste teste (por email/cpf marcados). NUNCA toca unificard-dev nem user-cpchagasii.
  const client = await pool.connect();
  try {
    await client.query(`SET session_replication_role = replica`);
    const users = await client.query(`SELECT id::text id, global_user_id::text gid FROM users WHERE email LIKE $1`, [`${MARKER}-%`]);
    for (const u of users.rows) {
      await client.query(`DELETE FROM actors WHERE user_id = $1`, [u.id]);
      await client.query(`DELETE FROM profiles WHERE user_id = $1`, [u.id]);
      await client.query(`DELETE FROM users WHERE id = $1`, [u.id]);
    }
    // global_users / identities dos CPFs do teste (marcador no full_name)
    const gus = await client.query(`SELECT global_user_id::text gid FROM global_users WHERE full_name ILIKE $1`, [`${MARKER}%`]);
    for (const g of gus.rows) {
      await client.query(`DELETE FROM identities WHERE global_user_id = $1`, [g.gid]);
      await client.query(`DELETE FROM global_users WHERE global_user_id = $1`, [g.gid]);
    }
    await client.query(`SET session_replication_role = DEFAULT`);
  } finally { client.release(); }
}

async function main(): Promise<void> {
  delete process.env.PILOT_MODE; // organic por padrão
  await cleanup();
  const app = await buildApp();
  const reg = (body: unknown, headers: Record<string, string> = {}) => app.inject({
    method: 'POST', url: '/auth/register',
    headers: { 'content-type': 'application/json', ...headers },
    payload: JSON.stringify(body),
  });
  const base = Math.floor(Math.random() * 90000000) + 10000000;

  // unificard-inicial id (referência)
  const instRow = await pool.query<{ id: string }>(`SELECT id::text FROM tenants WHERE slug='unificard-inicial'`);
  const instId = instRow.rows[0]?.id;

  try {
    console.log('\n— A: tenant institucional —');
    const inst = await pool.query(`SELECT id::text, name FROM tenants WHERE slug='unificard-inicial'`);
    record('A1 unificard-inicial existe exatamente 1', inst.rowCount === 1 && !!instId, `rows=${inst.rowCount}`);
    record('A2 name canônico "Comunidade Inicial Unificard"', inst.rows[0]?.name === 'Comunidade Inicial Unificard');

    console.log('\n— B/C: cadastro orgânico (2 usuários) → unificard-inicial —');
    const userTenantsBefore = (await pool.query(`SELECT COUNT(*)::int c FROM tenants WHERE slug LIKE 'user-%'`)).rows[0].c;

    const cpfA = genValidCpf(base);
    const emailA = `${MARKER}-a-${base}@e2e.local`;
    // NOTA: gender está FORA do escopo desta fatia (DT-GENDER divergence) — não enviado aqui.
    const rA = await reg({ email: emailA, password: 'senha123', cpf: cpfA, fullName: `${MARKER}A Teste` });
    const bodyA = rA.statusCode === 201 ? JSON.parse(rA.body) : null;
    record('B1 organic A → 201', rA.statusCode === 201, `status ${rA.statusCode}: ${rA.body.slice(0, 120)}`);
    const cA = await counts(cpfA, emailA);
    record('B2 A: global_user+user+identity+actor existem', !!cA.globalUser && !!cA.user && cA.identity && cA.actor, JSON.stringify(cA));
    record('B3 A: tenant = unificard-inicial', cA.tenant === instId, `tenant=${cA.tenant}`);
    const jwtA = bodyA?.data?.tokens?.accessToken ? decodeJwt(bodyA.data.tokens.accessToken) : null;
    record('B4 A: JWT tenantId = unificard-inicial + globalUserId presente', jwtA?.tenantId === instId && !!jwtA?.globalUserId, JSON.stringify({ t: jwtA?.tenantId, g: !!jwtA?.globalUserId }));
    record('B5 A: requiresOnboarding = true', bodyA?.data?.requiresOnboarding === true);

    const cpfB = genValidCpf(base + 1);
    const emailB = `${MARKER}-b-${base}@e2e.local`;
    const rB = await reg({ email: emailB, password: 'senha123', cpf: cpfB, fullName: `${MARKER}B Teste` });
    record('C1 organic B (outro CPF/email) → 201', rB.statusCode === 201, `status ${rB.statusCode}`);
    const cB = await counts(cpfB, emailB);
    record('C2 B: mesmo tenant unificard-inicial; entidades distintas de A', cB.tenant === instId && cB.user !== cA.user && cB.globalUser !== cA.globalUser && cB.actor && cB.identity, JSON.stringify(cB));

    console.log('\n— D: x-tenant-id arbitrário NÃO escolhe tenant —');
    const cpfD = genValidCpf(base + 2);
    const emailD = `${MARKER}-d-${base}@e2e.local`;
    const rD = await reg({ email: emailD, password: 'senha123', cpf: cpfD, fullName: `${MARKER}D Teste` }, { 'x-tenant-id': randomUUID() });
    const cD = await counts(cpfD, emailD);
    record('D1 register com x-tenant-id alheio → 201', rD.statusCode === 201, `status ${rD.statusCode}`);
    record('D2 cadastro caiu em unificard-inicial (não no header)', cD.tenant === instId, `tenant=${cD.tenant}`);

    console.log('\n— H: referral inválido → 400 ANTES de qualquer escrita —');
    const cpfH = genValidCpf(base + 3);
    const emailH = `${MARKER}-h-${base}@e2e.local`;
    const rH = await reg({ email: emailH, password: 'senha123', cpf: cpfH, fullName: `${MARKER}H Teste`, referralCode: 'ZZZNOPE99' });
    const cH = await counts(cpfH, emailH);
    record('H1 referral inválido → 400 INVALID_REFERRAL_CODE', rH.statusCode === 400 && /INVALID_REFERRAL_CODE|indicação inválido/.test(rH.body), `status ${rH.statusCode}: ${rH.body.slice(0,100)}`);
    record('H2 zero estado residual (sem user/global_user/identity/actor)', !cH.user && !cH.globalUser && !cH.identity && !cH.actor, JSON.stringify(cH));

    console.log('\n— ROLLBACK: falha forçada de ACTOR no meio da transação → ROLLBACK total —');
    // Falha controlada e TRANSIENTE (só no E2E, sem hook permanente em produção): substitui o
    // writer de actor por um stub que lança DENTRO da transação. Prova que global_user/user/
    // identity/actor são revertidos (atomicidade) e que NÃO há token nem estado residual.
    const { socialPortsRegistry } = await import('../core/social/ports-registry');
    const realRepo = socialPortsRegistry.getActorRepository();
    const origFn = realRepo.findOrCreateUserActorTx.bind(realRepo);
    (realRepo as any).findOrCreateUserActorTx = async () => { throw new Error('FORCED_ACTOR_FAILURE_E2E'); };
    const cpfR = genValidCpf(base + 5);
    const emailR = `${MARKER}-rollback-${base}@e2e.local`;
    const rR = await reg({ email: emailR, password: 'senha123', cpf: cpfR, fullName: `${MARKER}R Teste` });
    (realRepo as any).findOrCreateUserActorTx = origFn; // restaura imediatamente
    const cR = await counts(cpfR, emailR);
    record('R1 falha de actor → register NÃO 201 (sem token)', rR.statusCode !== 201, `status ${rR.statusCode}`);
    record('R2 ROLLBACK total: zero global_user/user/identity/actor residual', !cR.globalUser && !cR.user && !cR.identity && !cR.actor, JSON.stringify(cR));

    console.log('\n— M/N: zero tenant user-* novo + histórico intacto —');
    const userTenantsAfter = (await pool.query(`SELECT COUNT(*)::int c FROM tenants WHERE slug LIKE 'user-%'`)).rows[0].c;
    record('M1 zero tenant user-* novo (count estável)', userTenantsAfter === userTenantsBefore, `before=${userTenantsBefore} after=${userTenantsAfter}`);
    const hist = await pool.query(`SELECT 1 FROM tenants WHERE slug='user-cpchagasii-1780115896426'`);
    record('N1 tenant histórico user-cpchagasii-* intacto', (hist.rowCount ?? 0) === 1);

    console.log('\n— PILOT_MODE: fail-closed (rejeita ANTES de qualquer escrita) —');
    process.env.PILOT_MODE = 'true';
    const cpfP = genValidCpf(base + 4);
    const emailP = `${MARKER}-pilot-${base}@e2e.local`;
    const rP = await reg({ email: emailP, password: 'senha123', cpf: cpfP, fullName: `${MARKER}P Teste` });
    const cP = await counts(cpfP, emailP);
    record('P1 PILOT_MODE sem convite → rejeitado (não 201)', rP.statusCode !== 201, `status ${rP.statusCode}`);
    record('P2 PILOT_MODE: zero estado residual (sem user/global_user/identity/actor)', !cP.user && !cP.globalUser && !cP.identity && !cP.actor, JSON.stringify(cP));
    delete process.env.PILOT_MODE;

    console.log('\n— ESTRUTURAL: register atômico + tenant server-side —');
    const svc = readFileSync(join(process.cwd(), 'src/core/auth/auth.service.ts'), 'utf8');
    const regSrc = svc.slice(svc.indexOf('async register('), svc.indexOf('async login('));
    record('S1 register resolve getTenantBySlug(unificard-inicial)', /getTenantBySlug\(\s*['"]unificard-inicial['"]/.test(regSrc));
    record('S2 register NÃO cria tenant (sem createTenant / user-${)', !/createTenant\(/.test(regSrc) && !/`user-\$\{/.test(regSrc));
    record('S3 register usa withTransaction + ensureUserActorTx + ensureIdentityRowForGlobalUserTx', /withTransaction\(/.test(regSrc) && /ensureUserActorTx\(/.test(regSrc) && /ensureIdentityRowForGlobalUserTx\(/.test(regSrc));
    record('S4 token (generateTokens) DEPOIS do withTransaction', regSrc.indexOf('this.generateTokens(') > regSrc.indexOf('withTransaction('));
    record('S5 sem best-effort "retentado no próximo acesso" / ensureUserActor não-Tx', !/retentado no próximo acesso/.test(regSrc) && !/await ensureUserActor\(/.test(regSrc));
    record('S6 PILOT_MODE checa unificard-inicial (não cross-tenant)', /hasValidInvite\(finalTenantId/.test(regSrc) && !/findPendingByEmailAcrossTenants|AcrossTenants/.test(regSrc));

    console.log('\n— GATE: estrutural + prova negativa —');
    let gateExit = 0;
    try { execSync('node scripts/audit-register-birth-atomicity.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { gateExit = 1; }
    record('G1 gate passa no código final (exit 0)', gateExit === 0);
    // Prova negativa: quebrar um invariante via arquivo sintético temporário NÃO é viável (gate lê o
    // arquivo real). Em vez disso, copio o gate apontando para um stub regressivo e provo a falha.
    const stubPath = join(process.cwd(), 'src/core/auth/_e2e_regress_stub.ts');
    // stub que simula register SEM withTransaction/Tx (regressão best-effort + tenant-per-signup)
    writeFileSync(stubPath, [
      'async register() {',
      "  const tenantSlug = `user-${'x'}-${Date.now()}`; void tenantSlug;",
      "  const { tenantService } = 0 as any; await tenantService.createTenant({});",
      '  // sem withTransaction; sem ensureUserActorTx; token antes',
      '  this.generateTokens();',
      '}',
      'async login() {}',
    ].join('\n'));
    // roda uma cópia do gate apontando para o stub
    const gateSrc = readFileSync(join(process.cwd(), 'scripts/audit-register-birth-atomicity.mjs'), 'utf8')
      .replace("core/auth/auth.service.ts", "core/auth/_e2e_regress_stub.ts");
    const tmpGate = join(process.cwd(), 'scripts/_e2e_tmp_gate.mjs');
    writeFileSync(tmpGate, gateSrc);
    let negExit = 0;
    try { execSync('node scripts/_e2e_tmp_gate.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { negExit = 1; }
    const fs = await import('fs');
    fs.unlinkSync(stubPath); fs.unlinkSync(tmpGate);
    record('G2 prova negativa: register regressivo (sem tx / best-effort / tenant-per-signup) → gate FALHA', negExit === 1);

  } finally {
    await cleanup();
    const leftover = await pool.query(
      `SELECT (SELECT COUNT(*) FROM users WHERE email LIKE $1) + (SELECT COUNT(*) FROM global_users WHERE full_name ILIKE $2) AS total`,
      [`${MARKER}-%`, `${MARKER}%`]
    );
    record('Z1 cleanup: zero fixtures residuais', Number(leftover.rows[0].total) === 0, `restam ${leftover.rows[0].total}`);
    // segurança extra: unificard-inicial e histórico permanecem
    const safe = await pool.query(`SELECT COUNT(*)::int c FROM tenants WHERE slug IN ('unificard-inicial','unificard-dev','user-cpchagasii-1780115896426')`);
    record('Z2 tenants institucional/dev/histórico intactos', safe.rows[0].c === 3, `c=${safe.rows[0].c}`);
    await app.close();
    await pool.end();
  }

  const passed = results.filter(r => r.ok).length;
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTADO: ${passed}/${results.length} verdes`);
  if (passed !== results.length) { console.log('FALHAS:'); results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.label} — ${r.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Nascimento orgânico tenant-bound e atômico: unificard-inicial server-side; x-tenant-id ignorado; transação única; token pós-commit; rollback total; PILOT fail-closed; gate verde.');
}

main().catch(e => { console.error(String(e)); process.exit(1); });
