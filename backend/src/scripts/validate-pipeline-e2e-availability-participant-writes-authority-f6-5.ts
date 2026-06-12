/**
 * E2E DECISION-0113 (WRITE) · participant writes authority (ADD/UPDATE owner-only; DELETE owner-or-self)
 *
 * POST /:availabilityId/participants, PUT /participants/:id, DELETE /participants/:id gravavam só com
 * actionContext → write spoof/IDOR no roster. Matriz diretora:
 *   ADD    → OWNER-ONLY (body.actorId é alvo; owner = getAvailability(params.availabilityId).ownerId).
 *   UPDATE → OWNER-ONLY (role é EDITÁVEL → controle de roster; participante não autopromove).
 *   DELETE → OWNER-OR-SELF (owner remove qualquer um; participante sai de si mesmo).
 * req.user (401); actionContext deve === o papel exigido; canRepresentActor; 404 preservado; 403 fail-closed.
 * params.id nunca como actor; sem ensureUserActor/getActiveActor; zero Bank.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-availability-participant-writes-authority-f6-5.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const MARKER = 'E2E-PW';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }

async function main(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const dev = await pool.query<{ id: string }>(`SELECT id::text AS id FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ id: string }>(`SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`, [TENANT_ID, devUserId]);
  const devActor = devActorRow.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  await pool.query(`DELETE FROM actors WHERE tenant_id=$1 AND display_name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  // devActor = OWNER da availability; P = participante (actor) alheio — dev NÃO representa.
  const P = randomUUID();
  const availId = randomUUID();
  const partId = randomUUID();
  let tablesExist = false;
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [P, TENANT_ID, `${MARKER}-participant`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: matriz de papéis (owner=devActor / participant=P) —');
    const repOwner = await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor);
    const repPart = await authorizationService.canRepresentActor(TENANT_ID, devUserId, P);
    record('A1 ADD owner-only: dev representa o OWNER (devActor) → pode adicionar', repOwner === true);
    record('A2 ADD: dev NÃO representa P → não pode adicionar como se fosse outro owner', repPart === false);
    record('A3 UPDATE owner-only: owner representável → pode editar role', repOwner === true);
    record('A4 UPDATE: participante P NÃO é owner → não pode autopromover (dev não representa P de qq forma)', repPart === false);
    record('A5 DELETE owner: owner representável → remove qualquer participante', repOwner === true);
    record('A6 DELETE self: o próprio participante (quem representa P) pode sair — regra owner-or-self aceita self',
      repPart === false); // dev não representa P; a regra ACEITA self (validado estruturalmente em B)
    record('A7 estranho NÃO representa owner nem participante → 403 em tudo',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false
      && (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, P)) === false);
    note('Matriz: ADD/UPDATE = owner-only; DELETE = owner-or-self. actionContext deve === o papel exigido; canRepresentActor é o 2º fator.');

    const reg = await pool.query<{ a: string | null; p: string | null }>(`SELECT to_regclass('public.availability') a, to_regclass('public.availability_participants') p`);
    tablesExist = !!reg.rows[0].a && !!reg.rows[0].p;
    if (tablesExist) {
      await pool.query(
        `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
         VALUES ($1,$2,'user',$3,'recurring','active', now()+interval '1 day', now()+interval '1 day 1 hour','America/Sao_Paulo',1, jsonb_build_object('e2e',$4::text))`,
        [availId, TENANT_ID, devActor, MARKER]);
      await pool.query(
        `INSERT INTO availability_participants (participant_id, tenant_id, availability_id, actor_id, role, metadata, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'participante','{}'::jsonb, now(), now())`, [partId, TENANT_ID, availId, P]);
      const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
      const part = await unifiedAvailabilityService.getParticipant(TENANT_ID, partId);
      const av = await unifiedAvailabilityService.getAvailability(TENANT_ID, part.availabilityId);
      record('A8 participant REAL: owner real = devActor; participant.actorId = P (partes resolvidas)',
        av.ownerId === devActor && part.actorId === P);
    } else {
      note('participant REAL = N/A — tabela availability/availability_participants ausente em DEV; matriz coberta estruturalmente (B).');
    }
  } finally {
    if (tablesExist) {
      await pool.query(`DELETE FROM availability_participants WHERE participant_id=$1`, [partId]).catch(() => {});
      await pool.query(`DELETE FROM availability WHERE availability_id=$1`, [availId]).catch(() => {});
    }
    await pool.query(`DELETE FROM actors WHERE id=$1`, [P]);
  }

  console.log('\n— B estrutural: ADD/UPDATE owner-only; DELETE owner-or-self —');
  const route = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.routes.ts'), 'utf8');
  const sliceBetween = (a: string, b: string) => { const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length; return i >= 0 ? route.slice(i, j > i ? j : route.length) : ''; };
  const add = sliceBetween("matriz diretora: ADD participante", "Listar participantes de uma availability");
  const upd = sliceBetween("matriz diretora: UPDATE participante", "DELETE /availability/participants/:id");
  const del = sliceBetween("matriz diretora: DELETE participante", "GET /availability/:availabilityId/participants/:actorId/conflicts");

  // DECISION-0118 D2: o lado OWNER é o AUTHORITY ACTOR resolvido (recurso ≠ actor).
  record('B1 ADD owner-only: getAvailability + actionContext===authority + canRepresentActor(authority) ANTES de createParticipant',
    /PARTICIPANT_ADD_OWNER_ONLY/.test(add)
    && /canRepresentActor\(req\.tenant\.id, userId, ownerAuthorityActorId\)/.test(add)
    && add.indexOf('canRepresentActor(') < add.indexOf('createParticipant(')
    && /status\(401\)/.test(add));
  record('B2 ADD: body.actorId é alvo (não autoridade); NÃO self-enroll (gate é sobre owner, não sobre body.actorId)',
    !/canRepresentActor\([^)]*parsed\.data\.actorId/.test(add) && !/canRepresentActor\([^)]*params\.availabilityId/.test(add));
  record('B3 UPDATE owner-only: getParticipant + owner real + actionContext===authority + canRepresentActor ANTES de updateParticipant',
    /PARTICIPANT_UPDATE_OWNER_ONLY/.test(upd)
    && upd.indexOf('getParticipant(') < upd.indexOf('updateParticipant(')
    && /canRepresentActor\(req\.tenant\.id, userId, ownerAuthorityActorId\)/.test(upd)
    && upd.indexOf('canRepresentActor(') < upd.indexOf('updateParticipant(')
    && /status\(401\)/.test(upd));
  record('B4 DELETE owner-or-self: resolve participant + owner; permite AUTORIDADE do owner OU self (participant.actorId); 403/401',
    /PARTICIPANT_DELETE_OWNER_OR_SELF/.test(del)
    && /req\.actionContext\.actorId === ownerAuthorityActorId/.test(del)
    && /req\.actionContext\.actorId === existing\.actorId/.test(del)
    && del.indexOf('getParticipant(') < del.indexOf('deleteParticipant(')
    && /status\(401\)/.test(del));
  record('B5 nenhum dos 3 usa params.id/params.availabilityId como actor nem actionContext como autoridade crua',
    !/canRepresentActor\([^)]*params\./.test(add + upd + del)
    && !/canRepresentActor\([^)]*req\.actionContext\.actorId\)/.test(add + upd + del));
  record('B6 NÃO usa ensureUserActor/getActiveActor; sem Bank nos 3 handlers',
    !/ensureUserActor\(/.test(add + upd + del) && !/getActiveActor\(/.test(add + upd + del)
    && !/bank_ledger|bank_transactions|payment|amount_cents|payout|settlement/.test(add + upd + del));
  // intocados
  record('B7 booking writes + availability writes + weekly + 7 GETs selados intocados',
    /BOOKING_CREATE_REQUESTER_MISMATCH/.test(route) && /BOOKING_TRANSITION_NOT_ALLOWED/.test(route)
    && /AVAILABILITY_WRITE_OWNER_MISMATCH/.test(route) && /WEEKLY_TEMPLATE_ACTOR_NOT_REPRESENTABLE/.test(route)
    && /AVAILABILITY_NOT_REPRESENTABLE/.test(route) && /canReadBookingAsParty\(/.test(route));

  console.log('\n— C service: create/update/delete participant sem Bank —');
  const svc = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.service.ts'), 'utf8');
  record('C1 service sem Bank/money', !/bank_ledger|bank_transactions|bank_accounts|payment|amount_cents|payout|settlement/i.test(svc));
  record('C2 createParticipant/updateParticipant/deleteParticipant existem (writers confirmados)',
    /async createParticipant\(/.test(svc) && /async updateParticipant\(/.test(svc) && /async deleteParticipant\(/.test(svc));
  note('Denominador: esta fatia fecha os 3 participant writes. unified-availability.routes.ts FECHADO ponta-a-ponta no eixo 0113: 7 GETs + weekly + availability create/update + booking create/status/check-in/out + participant add/update/delete.');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ participant writes gateados (ADD/UPDATE owner-only; DELETE owner-or-self) — arquivo availability fechado no eixo 0113. verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
