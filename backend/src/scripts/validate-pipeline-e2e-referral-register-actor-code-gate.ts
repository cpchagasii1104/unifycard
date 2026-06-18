/**
 * E2E — F-REFERRAL-REGISTER-ACTOR-CODE-GATE (DECISION-0139). NÃO MOVE DINHEIRO.
 *
 * Prova que a PORTA DE ENTRADA do cadastro reconhece código de indicação ACTOR-SCOPED
 * (actor_referral_codes) E o legado (users.referral_code), via RESOLVER ÚNICO read-only —
 * sem duplicar o writer soberano applyReferralCodeTx (materialização do vínculo continua só nele).
 *
 *   A. /auth/check-referral (semântica do resolver): actor-scoped válido → valid:true; bogus → false.
 *   B. register com código ACTOR-SCOPED (page/banda) → 201; user_referral_links criado na transação.
 *   C. vínculo correto: referrer_actor_id = owner_actor_id do código; referred_actor_id = actor_human do novo user.
 *   D. fallback LEGADO users.referral_code ainda funciona no register.
 *   E. código inválido → 400 ANTES de qualquer escrita (zero global_user/user/identity/actor/link novos).
 *   F. actor_system (linha CRUA em actor_referral_codes) → fail-closed (resolver inválido + register 400, zero vínculo).
 *   G. bank_ledger/bank_transactions/bank_splits intocados.
 *   H. regressão: guards R6.2 social-posts e R6.1 services seguem verdes.
 *
 * 🔒 DB EFÊMERA (run-referral-register-actor-code-gate-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const MARKER = 'e2e-refreg';
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
  if (!/referral|register|actor|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

// CPF válido (11 dígitos com dígitos verificadores corretos) — só p/ usuários que passam por register.
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
  // ports sociais (register → ensureUserActorTx → actor repository).
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

let seq = 0;
async function setTenant(tenantId: string): Promise<void> {
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
}

async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(700000000 + seq * 13 + Date.now() % 1000).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, tax, `${MARKER} ${name}`]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3::uuid,$4,'x',0,true,NOW(),NOW())`, [userId, tenantId, gu, `${MARKER}-${name}-${seq}@e2e.test`]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, `${MARKER} ${name}`, userId, gu])).rows[0].id;
  return { userId, actorId, globalUserId: gu };
}

async function mkPageActor(tenantId: string, responsibleActorId: string, responsibleGlobalUserId: string, name: string): Promise<{ companyId: string; actorId: string }> {
  seq += 1;
  const companyId = (await pool.query<{ id: string }>(`INSERT INTO companies (tenant_id, company_name, cnpj, status, global_user_id) VALUES ($1::uuid,$2,$3,'active',$4::uuid) RETURNING company_id::text AS id`, [tenantId, `${MARKER} ${name}`, String(Date.now() + seq).padStart(14, '0').slice(-14), responsibleGlobalUserId])).rows[0].id;
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true)`, [tenantId, companyId, responsibleGlobalUserId]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, `${MARKER} ${name}`, companyId, responsibleActorId])).rows[0].id;
  return { companyId, actorId };
}

async function mkSystemActor(tenantId: string, name: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name) VALUES ($1::uuid,'system',$2) RETURNING id::text AS id`, [tenantId, `${MARKER} ${name}`])).rows[0].id;
}

async function counts(cpf: string, email: string) {
  const gu = await pool.query(`SELECT global_user_id::text gid FROM global_users WHERE cpf = $1`, [cpf]);
  const usr = await pool.query(`SELECT id::text uid FROM users WHERE email = $1`, [email]);
  const gid = gu.rows[0]?.gid ?? null;
  const uid = usr.rows[0]?.uid ?? null;
  const ident = gid ? await pool.query(`SELECT 1 FROM identities WHERE global_user_id = $1`, [gid]) : { rowCount: 0 };
  const act = uid ? await pool.query(`SELECT 1 FROM actors WHERE user_id = $1 AND actor_type='user'`, [uid]) : { rowCount: 0 };
  const link = uid ? await pool.query(`SELECT referrer_actor_id::text ra, referred_actor_id::text rd, referrer_user_id::text ru FROM user_referral_links WHERE referred_user_id = $1 LIMIT 1`, [uid]) : { rows: [], rowCount: 0 };
  return {
    globalUser: gid, user: uid,
    identity: (ident.rowCount ?? 0) > 0, actor: (act.rowCount ?? 0) > 0,
    link: link.rows[0] ?? null,
  };
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  delete process.env.PILOT_MODE; // cadastro orgânico

  const app = await buildApp();
  const reg = (body: unknown) => app.inject({
    method: 'POST', url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify(body),
  });

  const { referralService } = await import('../core/referral/referral.service');
  const { actorReferralCodeService } = await import('../core/referral/actor-referral-code.service');

  // Tenant institucional (register resolve 'unificard-inicial' SERVER-SIDE).
  const tenantId = (await pool.query<{ id: string }>(`SELECT id::text FROM tenants WHERE slug='unificard-inicial'`)).rows[0]?.id;
  if (!tenantId) throw new Error('unificard-inicial ausente no DB efêmero (MIGRATION_PROFILE=FULL?).');
  await setTenant(tenantId);

  const base = Math.floor(Math.random() * 90000000) + 10000000;
  const bankBefore = {
    ledger: await count(`SELECT count(*)::text n FROM bank_ledger`),
    tx: await count(`SELECT count(*)::text n FROM bank_transactions`),
    splits: await count(`SELECT count(*)::text n FROM bank_splits`),
  };

  try {
    // ── Seeds de substrato (sob unificard-inicial) ──
    const refUser = await mkUserActor(tenantId, 'referrer');                                   // humano gestor
    const banda = await mkPageActor(tenantId, refUser.actorId, refUser.globalUserId, 'banda');  // page (owner econômico)
    const codeBanda = await actorReferralCodeService.ensureActorReferralCode(tenantId, banda.actorId, refUser.actorId, refUser.userId);
    const legacyUser = await mkUserActor(tenantId, 'legacy');
    await pool.query(`UPDATE users SET referral_code = $2 WHERE id = $1`, [legacyUser.userId, 'LEGACY01']);
    const systemActor = await mkSystemActor(tenantId, 'sys');
    // Linha CRUA actor-scoped com owner actor_system (bypassa ensureActorReferralCode, que recusaria).
    await pool.query(
      `INSERT INTO actor_referral_codes (tenant_id, owner_actor_id, code, code_status, created_by_actor_id, created_by_user_id)
       VALUES ($1::uuid,$2::uuid,'SYSCODE01','active',$2::uuid,NULL)`,
      [tenantId, systemActor]
    );

    // ── A — resolver (semântica de /auth/check-referral) ──
    console.log('\n— A: resolver único (check-referral semantics) —');
    const candActor = await referralService.resolveReferralCodeCandidate(tenantId, codeBanda);
    record('A1 código ACTOR-SCOPED → valid:true, kind=actor, owner=banda', candActor.valid && candActor.kind === 'actor' && candActor.ownerActorId === banda.actorId, JSON.stringify(candActor));
    const candLegacy = await referralService.resolveReferralCodeCandidate(tenantId, 'LEGACY01');
    record('A2 código LEGADO → valid:true, kind=legacy', candLegacy.valid && candLegacy.kind === 'legacy', JSON.stringify(candLegacy));
    const candBogus = await referralService.resolveReferralCodeCandidate(tenantId, 'BOGUS9999');
    record('A3 código inexistente → valid:false', candBogus.valid === false && candBogus.kind === null, JSON.stringify(candBogus));
    const candCaseInsensitive = await referralService.resolveReferralCodeCandidate(tenantId, codeBanda.toLowerCase());
    record('A4 actor-scoped case-insensitive (lower) → valid:true', candCaseInsensitive.valid && candCaseInsensitive.kind === 'actor', JSON.stringify(candCaseInsensitive));

    // ── B/C — register com código ACTOR-SCOPED (page) ──
    console.log('\n— B/C: register com código ACTOR-SCOPED (banda) → vínculo correto —');
    const cpfB = genValidCpf(base);
    const emailB = `${MARKER}-b-${base}@e2e.local`;
    const rB = await reg({ email: emailB, password: 'senha123', cpf: cpfB, fullName: `${MARKER} B`, referralCode: codeBanda });
    record('B1 register com actor-code → 201', rB.statusCode === 201, `status ${rB.statusCode}: ${rB.body.slice(0, 140)}`);
    const cB = await counts(cpfB, emailB);
    record('B2 user_referral_links criado na transação de nascimento', !!cB.link, JSON.stringify(cB.link));
    record('C1 referrer_actor_id = owner_actor_id do código (banda)', cB.link?.ra === banda.actorId, `ra=${cB.link?.ra} banda=${banda.actorId}`);
    record('C2 referred_actor_id = actor_human do novo user (server-side)', !!cB.link?.rd && cB.actor, `rd=${cB.link?.rd}`);
    record('C3 referrer_user_id = humano gestor por trás do owner (breadcrumb civil)', cB.link?.ru === refUser.userId, `ru=${cB.link?.ru} expected=${refUser.userId}`);

    // ── D — fallback LEGADO ──
    console.log('\n— D: register com código LEGADO users.referral_code —');
    const cpfD = genValidCpf(base + 1);
    const emailD = `${MARKER}-d-${base}@e2e.local`;
    const rD = await reg({ email: emailD, password: 'senha123', cpf: cpfD, fullName: `${MARKER} D`, referralCode: 'LEGACY01' });
    record('D1 register com código legado → 201', rD.statusCode === 201, `status ${rD.statusCode}: ${rD.body.slice(0, 140)}`);
    const cD = await counts(cpfD, emailD);
    record('D2 vínculo legado: referrer_user_id = dono do código legado', !!cD.link && cD.link?.ru === legacyUser.userId, JSON.stringify(cD.link));
    record('D3 vínculo legado: referrer_actor_id = actor_human do referrer', cD.link?.ra === legacyUser.actorId, `ra=${cD.link?.ra} expected=${legacyUser.actorId}`);

    // ── E — código inválido → 400 ANTES de qualquer escrita ──
    console.log('\n— E: código inválido → 400 + zero estado residual —');
    const cpfE = genValidCpf(base + 2);
    const emailE = `${MARKER}-e-${base}@e2e.local`;
    const rE = await reg({ email: emailE, password: 'senha123', cpf: cpfE, fullName: `${MARKER} E`, referralCode: 'NOPE12345' });
    record('E1 código inválido → 400 INVALID_REFERRAL_CODE', rE.statusCode === 400 && /INVALID_REFERRAL_CODE|indicação inválido/.test(rE.body), `status ${rE.statusCode}: ${rE.body.slice(0, 120)}`);
    const cE = await counts(cpfE, emailE);
    record('E2 zero estado residual (sem user/global_user/identity/actor/link)', !cE.user && !cE.globalUser && !cE.identity && !cE.actor && !cE.link, JSON.stringify(cE));

    // ── F — actor_system → fail-closed ──
    console.log('\n— F: actor_system (linha crua) → fail-closed —');
    const candSys = await referralService.resolveReferralCodeCandidate(tenantId, 'SYSCODE01');
    record('F1 resolver recusa código com owner actor_system (valid:false)', candSys.valid === false, JSON.stringify(candSys));
    const cpfF = genValidCpf(base + 3);
    const emailF = `${MARKER}-f-${base}@e2e.local`;
    const rF = await reg({ email: emailF, password: 'senha123', cpf: cpfF, fullName: `${MARKER} F`, referralCode: 'SYSCODE01' });
    record('F2 register com código actor_system → 400 (fail-closed)', rF.statusCode === 400, `status ${rF.statusCode}: ${rF.body.slice(0, 120)}`);
    const cF = await counts(cpfF, emailF);
    record('F3 zero vínculo/estado residual para código actor_system', !cF.user && !cF.link, JSON.stringify(cF));

    // ── G — Bank intocado ──
    console.log('\n— G: bank_ledger/bank_transactions/bank_splits intocados —');
    const bankAfter = {
      ledger: await count(`SELECT count(*)::text n FROM bank_ledger`),
      tx: await count(`SELECT count(*)::text n FROM bank_transactions`),
      splits: await count(`SELECT count(*)::text n FROM bank_splits`),
    };
    record('G1 bank_ledger inalterado', bankAfter.ledger === bankBefore.ledger, `before=${bankBefore.ledger} after=${bankAfter.ledger}`);
    record('G2 bank_transactions inalterado', bankAfter.tx === bankBefore.tx, `before=${bankBefore.tx} after=${bankAfter.tx}`);
    record('G3 bank_splits inalterado', bankAfter.splits === bankBefore.splits, `before=${bankBefore.splits} after=${bankAfter.splits}`);

    // ── H — regressão R6.2/R6.1 (guards seguem verdes) ──
    console.log('\n— H: regressão R6.2 social-posts + R6.1 services —');
    let r62 = 0; try { execSync('node scripts/audit-social-posts-actor-binding.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { r62 = 1; }
    record('H1 guard R6.2 social-posts verde (não tocado)', r62 === 0);
    let r61 = 0; try { execSync('node scripts/audit-services-actor-binding.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { r61 = 1; }
    record('H2 guard R6.1 services verde (não tocado)', r61 === 0);
    let gateSelf = 0; try { execSync('node scripts/audit-referral-register-actor-code-gate.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { gateSelf = 1; }
    record('H3 guard da frente verde no código final', gateSelf === 0);
  } finally {
    // DB efêmera é dropada pelo runner; encerra pool.
    await app.close();
    await pool.end();
  }

  console.log('\n' + '═'.repeat(64));
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed !== total) {
    console.log('❌ FALHAS:');
    for (const r of results.filter((x) => !x.ok)) console.log(`   - ${r.label}: ${r.reason}`);
    process.exit(1);
  }
  console.log('✨ Porta de entrada do cadastro reconhece código ACTOR-SCOPED e LEGADO via resolver único; writer soberano intocado; actor_system fail-closed; inválido bloqueado antes da escrita; Bank intocado.');
}

main().catch((e) => { console.error('💥', String(e)); process.exit(1); });
