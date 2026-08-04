/**
 * E2E HTTP REAL — F-REGISTER-PRELAUNCH-BLOCKERS-CLOSURE (A1/A2/A3).
 *
 * A1 (backend funcional): endpoint PÚBLICO GET /auth/check-referral resolve
 *   `unificard-inicial` server-side, ignora x-tenant-id do cliente, tem rate
 *   limit equivalente ao check-cpf, responde { valid } e NUNCA exige tenant
 *   pré-sessão. Fluxo de cadastro: referral válido cadastra; inválido → erro
 *   honesto (400 INVALID_REFERRAL_CODE); sem referral cadastra.
 * A1/A2/A3 (frontend estrutural): validateReferralCode usa apiFetchPublic
 *   contra /auth/check-referral e não trata erro técnico como inválido;
 *   pós-cadastro navega por SPA (sem window.location.href) preservando
 *   auth-changed; SocialLayout sem actor expõe CTAs sem cura por GET.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-register-prelaunch-blockers.ts
 * NÃO toca Bank. Limpa só fixtures próprias. unificard-inicial preservado.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';

const MARKER = 'e2e-prelaunch';
const REPO = join(process.cwd(), '..');
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

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

async function buildApp(): Promise<FastifyInstance> {
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

async function cleanup(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SET session_replication_role = replica`);
    const users = await client.query(`SELECT id::text id FROM users WHERE email LIKE $1`, [`${MARKER}-%`]);
    for (const u of users.rows) {
      await client.query(`DELETE FROM actors WHERE user_id = $1`, [u.id]);
      await client.query(`DELETE FROM profiles WHERE user_id = $1`, [u.id]);
      await client.query(`DELETE FROM users WHERE id = $1`, [u.id]);
    }
    const gus = await client.query(`SELECT global_user_id::text gid FROM global_users WHERE full_name ILIKE $1`, [`${MARKER}%`]);
    for (const g of gus.rows) {
      await client.query(`DELETE FROM identities WHERE global_user_id = $1`, [g.gid]);
      await client.query(`DELETE FROM global_users WHERE global_user_id = $1`, [g.gid]);
    }
    await client.query(`SET session_replication_role = DEFAULT`);
  } finally { client.release(); }
}

async function main(): Promise<void> {
  // 🔴 CORRIGIDO 2026-08-04 — mesmo achado de `validate-pipeline-e2e-c1-birth-minimum-atomic-
  // organic.ts` (ver REMEDIATION_DT_LOG.md): este E2E também faz múltiplos POST /auth/register
  // em sequência, no mesmo processo/IP, e tropeçava no rate limiter (3/min) antes de chegar em
  // T(3). Mesma válvula, mesmo lugar: setado ANTES de `buildApp()` importar `auth.routes`
  // dinamicamente. Processo próprio deste script — não afeta servidor dev nem produção.
  process.env.RATE_LIMIT_AUTH_REGISTER ??= '50';

  delete process.env.PILOT_MODE; // organic
  await cleanup();
  const app = await buildApp();
  const base = Math.floor(Math.random() * 90000000) + 10000000;

  const reg = (body: unknown, headers: Record<string, string> = {}) => app.inject({
    method: 'POST', url: '/auth/register',
    headers: { 'content-type': 'application/json', ...headers },
    payload: JSON.stringify(body),
  });
  const checkReferral = (code: string, headers: Record<string, string> = {}) => app.inject({
    method: 'GET', url: `/auth/check-referral?code=${encodeURIComponent(code)}`, headers,
  });

  const instRow = await pool.query<{ id: string }>(`SELECT id::text FROM tenants WHERE slug='unificard-inicial'`);
  const instId = instRow.rows[0]?.id;

  let bankBefore = 0;
  try {
    bankBefore = Number((await pool.query<{ n: string }>(`SELECT (count(*))::text n FROM bank_ledger`)).rows[0].n);

    // ── Fundador A: cadastra organicamente e obtém referral_code ──────────────
    const cpfA = genValidCpf(base);
    const emailA = `${MARKER}-a-${base}@e2e.local`;
    const rA = await reg({ email: emailA, password: 'senha123', cpf: cpfA, fullName: `${MARKER}A Founder` });
    record('setup A organic → 201', rA.statusCode === 201, `status ${rA.statusCode}: ${rA.body.slice(0, 140)}`);
    const aUser = await pool.query<{ referral_code: string; tenant_id: string }>(
      `SELECT referral_code, tenant_id::text FROM users WHERE email=$1`, [emailA]);
    const codeA = aUser.rows[0]?.referral_code;
    record('setup A em unificard-inicial com referral_code próprio', aUser.rows[0]?.tenant_id === instId && !!codeA, `code=${codeA}`);

    console.log('\n— A1 endpoint público /auth/check-referral —');
    // Teste 4: pré-sessão NÃO exige tenant (sem JWT, sem x-tenant-id).
    const rValid = await checkReferral(codeA);
    const bValid = rValid.statusCode === 200 ? JSON.parse(rValid.body) : null;
    record('T(4) check-referral SEM auth e SEM x-tenant-id → 200 (nunca TENANT_ID_REQUIRED)',
      rValid.statusCode === 200 && !/tenant/i.test(rValid.body), `status=${rValid.statusCode} body=${rValid.body.slice(0, 100)}`);
    record('check-referral código VÁLIDO → { valid: true }', bValid?.valid === true, JSON.stringify(bValid));

    // Código formatado mas inexistente → valid:false honesto (não erro).
    const rUnknown = await checkReferral('ZZZZ9999INEXISTENTE');
    record('check-referral código inexistente → 200 { valid: false } (honesto, não erro)',
      rUnknown.statusCode === 200 && JSON.parse(rUnknown.body).valid === false, `status=${rUnknown.statusCode}`);

    // Teste 5: tenant do cliente NÃO é autoridade — header forjado é ignorado.
    const rForgedTenant = await checkReferral(codeA, { 'x-tenant-id': randomUUID() });
    record('T(5) x-tenant-id forjado IGNORADO: código de unificard-inicial ainda { valid: true }',
      rForgedTenant.statusCode === 200 && JSON.parse(rForgedTenant.body).valid === true, rForgedTenant.body.slice(0, 100));
    // E código válido NÃO vaza com tenant do cliente sem o code certo (formato inválido).
    const rBadFormat = await checkReferral('!!', { 'x-tenant-id': randomUUID() });
    record('check-referral formato inválido → 400 (validação de formato reusada)', rBadFormat.statusCode === 400);

    // Teste 6: rate limit existe (estrutural: config + uso na rota).
    const rlSrc = readFileSync(join(process.cwd(), 'src/core/rate-limiting/auth-rate-limit.service.ts'), 'utf8');
    const routeSrc = readFileSync(join(process.cwd(), 'src/core/auth/auth.routes.ts'), 'utf8');
    record('T(6) rate limit de check-referral existe (action configurada + checkRateLimit na rota)',
      /'auth\.check-referral':/.test(rlSrc) &&
      /checkRateLimit\(\s*'auth\.check-referral'/.test(routeSrc) && /RateLimitError/.test(routeSrc));
    record('endpoint resolve unificard-inicial server-side (getTenantBySlug), não confia no header',
      /getTenantBySlug\(\s*['"]unificard-inicial['"]\s*\)/.test(routeSrc) &&
      /\/check-referral/.test(routeSrc));

    console.log('\n— A1 fluxo de cadastro com/sem referral —');
    // Teste 1: novo usuário com referral VÁLIDO cadastra.
    const cpfB = genValidCpf(base + 11);
    const rB = await reg({ email: `${MARKER}-b-${base}@e2e.local`, password: 'senha123', cpf: cpfB, fullName: `${MARKER}B Indicado`, referralCode: codeA });
    record('T(1) novo usuário com referral VÁLIDO → 201 (não bloqueia)', rB.statusCode === 201, `status=${rB.statusCode}: ${rB.body.slice(0, 120)}`);

    // Teste 2: referral INVÁLIDO → erro honesto (400 INVALID_REFERRAL_CODE), sem cadastro.
    const cpfC = genValidCpf(base + 22);
    const emailC = `${MARKER}-c-${base}@e2e.local`;
    const rC = await reg({ email: emailC, password: 'senha123', cpf: cpfC, fullName: `${MARKER}C BadRef`, referralCode: 'CODIGOINEXISTENTE99' });
    const cCreated = await pool.query(`SELECT 1 FROM users WHERE email=$1`, [emailC]);
    record('T(2) referral INVÁLIDO → erro honesto 400 e usuário NÃO criado (zero estado parcial)',
      rC.statusCode === 400 && /INVALID_REFERRAL_CODE|indica/i.test(rC.body) && cCreated.rowCount === 0, `status=${rC.statusCode}`);

    // Teste 3: sem referral cadastra normalmente.
    const cpfD = genValidCpf(base + 33);
    const rD = await reg({ email: `${MARKER}-d-${base}@e2e.local`, password: 'senha123', cpf: cpfD, fullName: `${MARKER}D SemRef` });
    record('T(3) novo usuário SEM referral → 201', rD.statusCode === 201, `status=${rD.statusCode}`);

    console.log('\n— A1/A2/A3 estrutural frontend —');
    const fe = (rel: string) => readFileSync(join(REPO, 'frontend/src', rel), 'utf8');
    const authTs = fe('api/auth.ts');
    record('T(4-fe) validateReferralCode usa apiFetchPublic contra /auth/check-referral (não /referral/validate logado)',
      /apiFetchPublic\(`\/auth\/check-referral/.test(authTs) && !/validateReferralCode[\s\S]{0,200}?apiFetch\(`\/referral\/validate/.test(authTs));
    record('T(4-fe) erro técnico (≠400) PROPAGA (throw) — não vira inválido confirmado',
      /check-referral falhou: HTTP/.test(authTs) && /response\.status === 400/.test(authTs));

    const registerTsx = fe('components/Register.tsx');
    record('T(7) pós-cadastro SEM window.location.href (navegação SPA via onRegisterSuccess)',
      !/window\.location\.href\s*=/.test(registerTsx) && /onRegisterSuccess\(\{\s*requiresOnboarding\s*\}\)/.test(registerTsx));
    record('T(8) auth-changed disparado ANTES da navegação (bootstrap preservado)',
      /dispatchEvent\(new CustomEvent\('auth-changed'\)\)[\s\S]{0,400}?onRegisterSuccess\(/.test(registerTsx));
    record('T(2-fe) debounce: erro técnico → idle (não invalido), só 200/400 confirmam inválido',
      /setReferralStatus\('idle'\)/.test(registerTsx) && /erro TÉCNICO/i.test(registerTsx));

    const appTsx = fe('App.tsx');
    record('T(7-fe) AuthWrapper decide rota SPA pós-cadastro (/perfil vs /home via navigate)',
      /requiresOnboarding\s*\?\s*'\/perfil'\s*:\s*'\/home'/.test(appTsx) && /navigate\(/.test(appTsx));

    const socialLayout = fe('components/layout/SocialLayout.tsx');
    record('T(9) SocialLayout sem actor expõe CTAs (recarregar/perfil/sair) — não beco sem saída',
      /Recarregar contexto/.test(socialLayout) && /navigate\('\/perfil'\)/.test(socialLayout) && /Sair e entrar novamente/.test(socialLayout));
    record('T(10) CTA recarregar usa refreshActors (refetch/read) — NÃO cria actor por GET',
      /refreshActors\(\)/.test(socialLayout) &&
      !/ensureUserActor|findOrCreateUserActor|INSERT\s+INTO\s+actors/.test(socialLayout));

    // ── invariantes financeiras: zero Bank tocado ─────────────────────────────
    const bankAfter = Number((await pool.query<{ n: string }>(`SELECT (count(*))::text n FROM bank_ledger`)).rows[0].n);
    record('zero Bank writer (bank_ledger inalterado)', bankAfter === bankBefore, `${bankBefore}→${bankAfter}`);
    // unificard-inicial preservado.
    const instStill = await pool.query(`SELECT COUNT(*)::int c FROM tenants WHERE slug='unificard-inicial'`);
    record('unificard-inicial preservado (exatamente 1)', instStill.rows[0].c === 1);
  } finally {
    await cleanup();
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Bloqueadores A1/A2/A3 do cadastro PF fechados — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
