/**
 * E2E HTTP REAL — F-REFERRAL-LINK-MATERIALIZATION-AND-SPLIT-CONTRACT (DECISION-0119).
 *
 * Prova o vínculo de indicação A→B como RELAÇÃO PURA, atômica ao nascimento,
 * engine-neutra e SEM escrita Bank:
 *   T1 A nasce sem referral e recebe referral_code próprio.
 *   T2 B cadastra com código de A → 201.
 *   T3 vínculo persiste em user_referral_links (tenant/referrer=A/referred=B/code).
 *   T4 getActiveReferral(tenant, B) === A.
 *   T5 código inválido → 400; B não existe em users/identities/actors/profiles.
 *   T6 autoindicação falha e não cria vínculo.
 *   T7 cross-tenant não resolve o vínculo fora do tenant correto.
 *   T8 reaplicação/idempotência não duplica vínculo.
 *   T9 falha forçada na gravação do vínculo (tabela ausente) com código válido
 *      → ROLLBACK total (B não existe em users/identities/actors/profiles).
 *   T10 cadastro com referral NÃO cria bank_ledger/transactions/splits/accounts.
 *   T11 split não dispara no cadastro.
 *   T12 percentual/política financeira (split-engine) inalterados e lendo a fonte pura.
 *
 * 🔒 DB EFÊMERA (wrapper run-referral-link-materialization-ephemeral.ps1).
 * unificard-inicial vem da migration de seed; T9 dropa/recria a tabela na efêmera.
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

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
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

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/referral|test|ephemeral/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
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

const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);

/** B existe em ALGUMA das estruturas de nascimento? (para provas de rollback). */
async function userFootprint(email: string): Promise<{ users: number; identities: number; actors: number; profiles: number }> {
  const u = await pool.query<{ id: string; gid: string }>(`SELECT id::text id, global_user_id::text gid FROM users WHERE email=$1`, [email]);
  const uid = u.rows[0]?.id ?? null;
  const gid = u.rows[0]?.gid ?? null;
  return {
    users: u.rowCount ?? 0,
    identities: gid ? await count(`SELECT count(*)::text n FROM identities WHERE global_user_id=$1`, [gid]) : 0,
    actors: uid ? await count(`SELECT count(*)::text n FROM actors WHERE user_id=$1`, [uid]) : 0,
    profiles: uid ? await count(`SELECT count(*)::text n FROM profiles WHERE user_id=$1`, [uid]) : 0,
  };
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  delete process.env.PILOT_MODE;
  const app = await buildApp();
  const base = Math.floor(Math.random() * 90000000) + 10000000;
  const reg = (body: unknown) => app.inject({
    method: 'POST', url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify(body),
  });

  const instRow = await pool.query<{ id: string }>(`SELECT id::text FROM tenants WHERE slug='unificard-inicial'`);
  const instId = instRow.rows[0]?.id;

  const bankBefore = await count(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::text n`);

  try {
    record('setup unificard-inicial presente (seed migration)', !!instId);

    // T1 — A nasce sem referral, recebe referral_code próprio.
    const emailA = `e2e-rl-a-${base}@e2e.local`;
    const rA = await reg({ email: emailA, password: 'senha123', cpf: genValidCpf(base), fullName: 'RL A Founder' });
    const aRow = await pool.query<{ id: string; referral_code: string }>(`SELECT id::text, referral_code FROM users WHERE email=$1`, [emailA]);
    const aId = aRow.rows[0]?.id;
    const codeA = aRow.rows[0]?.referral_code;
    record('T1 A nasce sem referral (201) e recebe referral_code próprio', rA.statusCode === 201 && !!codeA, `status=${rA.statusCode} code=${codeA}`);

    // T2 — B cadastra com código de A.
    const emailB = `e2e-rl-b-${base}@e2e.local`;
    const rB = await reg({ email: emailB, password: 'senha123', cpf: genValidCpf(base + 11), fullName: 'RL B Indicado', referralCode: codeA });
    const bId = (await pool.query<{ id: string }>(`SELECT id::text FROM users WHERE email=$1`, [emailB])).rows[0]?.id;
    record('T2 B cadastra com código de A → 201', rB.statusCode === 201 && !!bId, `status=${rB.statusCode}`);

    // T3 — vínculo puro persiste com os campos certos.
    const link = await pool.query<{ tenant_id: string; referrer_user_id: string; referred_user_id: string; referral_code_used: string }>(
      `SELECT tenant_id::text, referrer_user_id::text, referred_user_id::text, referral_code_used
         FROM user_referral_links WHERE referred_user_id=$1`, [bId]);
    const L = link.rows[0];
    record('T3 vínculo A→B em user_referral_links (tenant/referrer=A/referred=B/code)',
      !!L && L.tenant_id === instId && L.referrer_user_id === aId && L.referred_user_id === bId && L.referral_code_used === codeA,
      JSON.stringify(L));

    // T4 — getActiveReferral resolve A (DECISION-0139: devolve owner actor + breadcrumb user).
    const { getActiveReferral } = await import('../core/referral/referral-helper.service');
    const active = await getActiveReferral(instId, bId);
    record('T4 getActiveReferral(tenant, B).referrerUserId === A', active?.referrerUserId === aId, `got=${JSON.stringify(active)}`);

    // T5 — código inválido → 400, B2 não nasce.
    const emailB2 = `e2e-rl-b2-${base}@e2e.local`;
    const rBad = await reg({ email: emailB2, password: 'senha123', cpf: genValidCpf(base + 22), fullName: 'RL Bad Ref', referralCode: 'CODIGOINEXISTENTE9' });
    const fpBad = await userFootprint(emailB2);
    record('T5 código inválido → 400; B não existe em users/identities/actors/profiles',
      rBad.statusCode === 400 && fpBad.users === 0 && fpBad.identities === 0 && fpBad.actors === 0 && fpBad.profiles === 0,
      `status=${rBad.statusCode} fp=${JSON.stringify(fpBad)}`);

    // T6 — autoindicação falha e não cria vínculo (A indicando A).
    const { referralService } = await import('../core/referral/referral.service');
    let selfErr: unknown = null;
    try { await referralService.applyReferralCode(instId, aId, codeA); } catch (e) { selfErr = e; }
    const selfLink = await count(`SELECT count(*)::text n FROM user_referral_links WHERE referred_user_id=$1 AND referrer_user_id=$1`, [aId]);
    record('T6 autoindicação lança e NÃO cria vínculo (referrer<>referred)',
      selfErr instanceof Error && /[Aa]utoindica/.test(selfErr.message) && selfLink === 0, String(selfErr));

    // T7 — cross-tenant não resolve o vínculo fora do tenant correto.
    const otherTenantRow = await pool.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ('RL Other Tenant', $1) RETURNING id::text`, [`rl-other-${base}`]);
    const otherTenant = otherTenantRow.rows[0].id;
    const activeOther = await getActiveReferral(otherTenant, bId);
    record('T7 cross-tenant: getActiveReferral(outroTenant, B) === null (vínculo é tenant-safe)', activeOther === null, `got=${activeOther}`);

    // T8 — idempotência: reaplicar não duplica.
    const before8 = await count(`SELECT count(*)::text n FROM user_referral_links WHERE referred_user_id=$1`, [bId]);
    await referralService.applyReferralCode(instId, bId, codeA);
    const after8 = await count(`SELECT count(*)::text n FROM user_referral_links WHERE referred_user_id=$1`, [bId]);
    record('T8 reaplicação idempotente: vínculo não duplica (1→1)', before8 === 1 && after8 === 1, `${before8}→${after8}`);

    // T11/T10/T12 (antes do T9 destrutivo): zero Bank + split não dispara + política intacta.
    const bankAfter = await count(
      `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::text n`);
    record('T10 cadastro NÃO cria bank_ledger/transactions/splits/accounts', bankAfter === bankBefore, `${bankBefore}→${bankAfter}`);
    record('T11 split não dispara no cadastro (bank_splits = 0)', (await count(`SELECT count(*)::text n FROM bank_splits`)) === 0);
    const splitEngine = readFileSync(join(REPO, 'backend/src/modules/bank/bank-split-engine.service.ts'), 'utf8');
    record('T12 percentual/política inalterados: split-engine mantém 5% e lê a fonte pura (getActiveReferral)',
      /REFERRAL_PERCENTAGE\s*=\s*0\.05/.test(splitEngine) && /getActiveReferral\(/.test(splitEngine));

    // T9 — falha forçada (tabela ausente) com código VÁLIDO → ROLLBACK total.
    // DROP na efêmera; register de C com código válido deve abortar TUDO.
    await pool.query(`DROP TABLE user_referral_links`);
    const emailC = `e2e-rl-c-${base}@e2e.local`;
    const rC = await reg({ email: emailC, password: 'senha123', cpf: genValidCpf(base + 33), fullName: 'RL C Rollback', referralCode: codeA });
    const fpC = await userFootprint(emailC);
    record('T9 falha de gravação do vínculo (código válido) → ROLLBACK total (C inexiste em users/identities/actors/profiles)',
      rC.statusCode >= 400 && fpC.users === 0 && fpC.identities === 0 && fpC.actors === 0 && fpC.profiles === 0,
      `status=${rC.statusCode} fp=${JSON.stringify(fpC)}`);
    // restaura a tabela (cosmético; DB é efêmera).
    const mig = readFileSync(join(REPO, 'backend/migrations/20260613120000_user_referral_links.sql'), 'utf8');
    await pool.query(mig);
    record('T9 tabela recriada na efêmera (cosmético)', (await count(`SELECT count(*)::text n FROM information_schema.tables WHERE table_name='user_referral_links'`)) === 1);
  } finally {
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
  console.log('✨ Vínculo de indicação A→B puro, atômico e engine-neutro — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
