/**
 * E2E — F-CIVIL-IDENTITY-CONFIRMATION-SSOT-SEPARATION (DECISION-0120).
 *
 * Prova a separação: (1) aviso visto ≠ (2) confirmação civil ≠ (4) trava civil; e que a
 * AUTORIDADE da trava migrou de profiles para a camada identity (evento auditável append-only).
 *
 *   T1  recém-cadastrado: aviso NÃO visto (modal apareceria).
 *   T2  "Entendi, continuar" (confirmFirstAccess) marca SOMENTE aviso visto.
 *   T3  após aviso visto, dados civis ainda NÃO confirmados.
 *   T4  após aviso visto, canEditPersonalData continua true (sem confirmação civil).
 *   T5  confirmação civil explícita grava evento em identity_civil_confirmation_events.
 *   T6  após confirmação civil, canEditPersonalData passa a false.
 *   T7  write path real (updateGlobalIdentity) respeita a trava civil (fullName não muda).
 *   T8  profiles NÃO é autoridade: flag legada em profiles não altera canEditPersonalData.
 *   T9  backfill: estado legado profile_personal_confirmed vira evento civil.
 *   T10 profiles.profile_personal_confirmed/metadata não volta a ser fonte decisória.
 *   T15 zero Bank.
 *   + estrutural: rotas e frontend separam aviso/confirmação/trava.
 *
 * 🔒 DB EFÊMERA (wrapper run-civil-identity-confirmation-ephemeral.ps1). Zero Bank.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const REPO = join(process.cwd(), '..');
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

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
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/civil|identity|test|ephemeral/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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

async function main(): Promise<void> {
  await assertEphemeralDb();
  delete process.env.PILOT_MODE;
  const app = await buildApp();
  const base = Math.floor(Math.random() * 90000000) + 10000000;

  const instRow = await pool.query<{ id: string }>(`SELECT id::text FROM tenants WHERE slug='unificard-inicial'`);
  const tenantId = instRow.rows[0]?.id;

  const { profileService } = await import('../core/profile/profile.service');
  const { identityCivilConfirmationService } = await import('../core/identity/identity-civil-confirmation.service');
  const { identityService } = await import('../core/identity/identity.service');

  const bankBefore = await count(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_accounts))::text n`);

  try {
    // ── Cadastro HTTP de A (com nome+nascimento civis) ────────────────────────
    const emailA = `e2e-civil-a-${base}@e2e.local`;
    const rA = await app.inject({
      method: 'POST', url: '/auth/register', headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: emailA, password: 'senha123', cpf: genValidCpf(base), fullName: 'Civil A Teste', birthdate: '1990-05-04', gender: 'male' }),
    });
    record('setup A cadastrado (201)', rA.statusCode === 201, `status=${rA.statusCode}: ${rA.body.slice(0, 120)}`);
    const aUser = await pool.query<{ id: string; global_user_id: string }>(`SELECT id::text, global_user_id::text FROM users WHERE email=$1`, [emailA]);
    const aId = aUser.rows[0].id;
    const aGid = aUser.rows[0].global_user_id;

    // T1 — recém-cadastrado: aviso NÃO visto.
    record('T1 recém-cadastrado: aviso de primeiro acesso NÃO visto (modal apareceria)',
      (await profileService.hasSeenFirstAccessNotice(tenantId, aId)) === false);

    // T2 — "Entendi, continuar" marca SOMENTE aviso visto.
    await profileService.confirmFirstAccess(tenantId, aId);
    record('T2 "Entendi, continuar" marca aviso visto (first_access_notice_seen_at)',
      (await profileService.hasSeenFirstAccessNotice(tenantId, aId)) === true);

    // T3 — após aviso visto, dados civis ainda NÃO confirmados.
    const stateAfterNotice = await identityCivilConfirmationService.getState(tenantId, aId);
    record('T3 após aviso visto, dados civis NÃO confirmados (sem evento civil)',
      stateAfterNotice.civilDataConfirmed === false &&
      (await count(`SELECT count(*)::text n FROM identity_civil_confirmation_events WHERE global_user_id=$1`, [aGid])) === 0);

    // T4 — após aviso visto, canEditPersonalData continua true.
    record('T4 após aviso visto, canEditPersonalData = true (sem confirmação civil)',
      (await profileService.canEditPersonalData(tenantId, aId)) === true);

    // T5 — confirmação civil explícita grava evento.
    const aActor = await pool.query<{ id: string }>(`SELECT id::text FROM actors WHERE user_id=$1 AND actor_type='user' LIMIT 1`, [aId]);
    await identityCivilConfirmationService.confirmCivilData(tenantId, aId, aActor.rows[0]?.id ?? null);
    const evt = await pool.query<{ confirmed_by_user_id: string; event_type: string; payload_snapshot: any }>(
      `SELECT confirmed_by_user_id::text, event_type, payload_snapshot FROM identity_civil_confirmation_events WHERE global_user_id=$1`, [aGid]);
    record('T5 confirmação civil grava evento auditável (event_type/confirmed_by; CPF só por hash/parcial)',
      evt.rowCount === 1 && evt.rows[0].event_type === 'civil_data_confirmed' && evt.rows[0].confirmed_by_user_id === aId &&
      !('cpf' in (evt.rows[0].payload_snapshot || {})) && typeof evt.rows[0].payload_snapshot?.taxIdHash === 'string',
      JSON.stringify(evt.rows[0]?.payload_snapshot));

    // T6 — após confirmação civil, canEditPersonalData passa a false.
    record('T6 após confirmação civil, canEditPersonalData = false',
      (await profileService.canEditPersonalData(tenantId, aId)) === false &&
      (await identityCivilConfirmationService.getState(tenantId, aId)).civilDataConfirmed === true);

    // T7 — write path real respeita a trava: tentar mudar fullName é ignorado.
    const before = await identityService.getGlobalIdentity(aGid);
    await identityService.updateGlobalIdentity(tenantId, aGid, { fullName: 'NOME ALTERADO INDEVIDO' });
    const after = await identityService.getGlobalIdentity(aGid);
    record('T7 write path (updateGlobalIdentity) respeita a trava civil: full_name NÃO muda',
      after?.fullName === before?.fullName && after?.fullName === 'Civil A Teste', `after=${after?.fullName}`);

    // T8/T10 — profiles NÃO é autoridade: mexer nas flags legadas não altera canEditPersonalData.
    await pool.query(`UPDATE profiles SET metadata = COALESCE(metadata,'{}'::jsonb) || '{"personal_data_locked":false,"profile_personal_confirmed":false}'::jsonb, is_profile_personal_confirmed=false WHERE user_id=$1`, [aId]);
    record('T8/T10 flag legada em profiles (locked=false/confirmed=false) NÃO reabre edição (identity é autoridade)',
      (await profileService.canEditPersonalData(tenantId, aId)) === false);
    // E removendo o evento civil, canEdit volta a true mesmo com profiles "confirmado".
    await pool.query(`UPDATE profiles SET is_profile_personal_confirmed=true, metadata = COALESCE(metadata,'{}'::jsonb) || '{"personal_data_locked":true}'::jsonb WHERE user_id=$1`, [aId]);
    await pool.query(`DELETE FROM identity_civil_confirmation_events WHERE global_user_id=$1`, [aGid]);
    record('T10 sem evento civil, canEditPersonalData = true mesmo com profiles "confirmado/locked" (profiles não decide)',
      (await profileService.canEditPersonalData(tenantId, aId)) === true);

    // T9 — backfill: estado legado vira evento civil (executa o INSERT da migration).
    const mig = readFileSync(join(REPO, 'backend/migrations/20260613130000_identity_civil_confirmation_events.sql'), 'utf8');
    const backfillInsert = mig.slice(mig.indexOf('INSERT INTO identity_civil_confirmation_events'), mig.indexOf('-- Aviso visto'));
    await pool.query(backfillInsert);
    record('T9 backfill: profile legado (is_profile_personal_confirmed) gera evento civil',
      (await count(`SELECT count(*)::text n FROM identity_civil_confirmation_events WHERE global_user_id=$1`, [aGid])) === 1 &&
      (await profileService.canEditPersonalData(tenantId, aId)) === false);

    // T15 — zero Bank.
    const bankAfter = await count(
      `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_accounts))::text n`);
    record('T15 zero Bank (ledger/transactions/accounts inalterados)', bankAfter === bankBefore, `${bankBefore}→${bankAfter}`);

    // ── Estrutural: rotas/frontend separam aviso / confirmação / trava ────────
    const idRoutes = readFileSync(join(REPO, 'backend/src/core/identity/identity.routes.ts'), 'utf8');
    record('S1 rota /identity/confirm-civil-data existe e usa identityCivilConfirmationService.confirmCivilData',
      /\/confirm-civil-data/.test(idRoutes) && /identityCivilConfirmationService\.confirmCivilData/.test(idRoutes));
    record('S2 confirm-first-access NÃO chama mais profileService.confirmFirstAccess como "confirma/trava" (D2 só aviso visto)',
      /first_access_notice_seen/.test(idRoutes) && /D2/.test(idRoutes));
    const profSvc = readFileSync(join(REPO, 'backend/src/core/profile/profile.service.ts'), 'utf8');
    record('S3 canEditPersonalData delega à camada identity (não lê personal_data_locked/profilePersonalConfirmed como autoridade)',
      /identityCivilConfirmationService\.canEditCivilData/.test(profSvc) &&
      !/const personalDataLocked = profile\.metadata\?\.personal_data_locked === true;\s*\n\s*if \(personalDataLocked\) return false/.test(profSvc));
    const profileTsx = readFileSync(join(REPO, 'frontend/src/components/Profile.tsx'), 'utf8');
    record('S4 frontend: lock deriva de can_edit_personal_data/civil_data_confirmed; modal de first_access_notice_seen; ação confirm-civil',
      /can_edit_personal_data === false/.test(profileTsx) && /first_access_notice_seen === true/.test(profileTsx) &&
      /handleConfirmCivilData/.test(profileTsx) && /confirmCivilData\(\)/.test(profileTsx));
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
  console.log('✨ Confirmação/trava de identidade civil separada e auditável (identity SSOT) — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
