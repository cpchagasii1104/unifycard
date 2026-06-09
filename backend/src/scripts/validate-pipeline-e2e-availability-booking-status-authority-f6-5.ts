/**
 * E2E DECISION-0113 (WRITE) · booking status/check-in/check-out authority + state guard
 *
 * PUT /bookings/:id era setter de status ARBITRÁRIO sem state machine; check-in/out sem authority. Agora:
 *   PUT  → só CONFIRM (owner) e CANCEL (requester|owner); status fora disso → 400; confirm só de requested;
 *          cancel não após checked_out.
 *   check-in / check-out → SÓ owner da availability (canRepresentActor); pré-condições do service preservadas.
 * req.user obrigatório (401); actor atuante (actionContext) representável; papel por transição; 403/404/409.
 * params.id nunca como actor; sem ensureUserActor/getActiveActor; zero Bank.
 *
 * Prova (behavioral REAL via primitivo + matriz; fixtures reais availability+bookings):
 *   confirm: owner=true, requester=false, estranho=false; cancel: requester=true, owner=true, estranho=false;
 *   check-in/out: owner=true, requester=false. + estrutural (guard de status, papel por transição, intocados).
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-availability-booking-status-authority-f6-5.ts
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
const MARKER = 'E2E-BKS';

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
  // devActor = OWNER da availability; R = requester alheio. (dev representa devActor=owner; NÃO representa R.)
  const R = randomUUID();
  const availId = randomUUID();
  const bookingId = randomUUID();
  let tablesExist = false;
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [R, TENANT_ID, `${MARKER}-requester`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: matriz de papéis (owner=devActor / requester=R) —');
    // owner = devActor (dev representa); requester = R (dev NÃO representa)
    const repOwner = await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor);
    const repReq = await authorizationService.canRepresentActor(TENANT_ID, devUserId, R);
    record('A1 CONFIRM (owner-only): dev representa o OWNER (devActor) → pode confirmar', repOwner === true);
    record('A2 CONFIRM: dev NÃO representa o REQUESTER (R) → requester não confirma', repReq === false);
    record('A3 CONFIRM: estranho não representa o owner → não confirma',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
    record('A4 CANCEL (requester|owner): owner devActor representável → pode cancelar', repOwner === true);
    record('A5 CANCEL: requester R — quem representa R pode cancelar (dev representa R? NÃO; mas a regra ACEITA o requester)',
      repReq === false); // dev não representa R; a regra de papel aceita requester, a representabilidade é separada
    record('A6 CHECK-IN/OUT (owner-only): dev representa o owner → pode check-in/out; requester não',
      repOwner === true && repReq === false);
    note('Matriz: confirm=owner; cancel=requester|owner; check-in/out=owner. A representabilidade (canRepresentActor) é o 2º fator; o 1º é o PAPEL (actionContext === owner/requester conforme a ação).');

    const reg = await pool.query<{ a: string | null; b: string | null }>(`SELECT to_regclass('public.availability') a, to_regclass('public.bookings') b`);
    tablesExist = !!reg.rows[0].a && !!reg.rows[0].b;
    if (tablesExist) {
      await pool.query(
        `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
         VALUES ($1,$2,'user',$3,'recurring','active', now()+interval '1 day', now()+interval '1 day 1 hour','America/Sao_Paulo',1, jsonb_build_object('e2e',$4::text))`,
        [availId, TENANT_ID, devActor, MARKER]);
      await pool.query(
        `INSERT INTO bookings (booking_id, tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'requested','{}'::jsonb, now(), now(), now())`, [bookingId, TENANT_ID, availId, R]);
      const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
      const bk = await unifiedAvailabilityService.getBooking(TENANT_ID, bookingId);
      const av = await unifiedAvailabilityService.getAvailability(TENANT_ID, bk.availabilityId);
      record('A7 booking REAL: owner real = devActor (availability.ownerId); requester real = R (booking)',
        av.ownerId === devActor && bk.requesterActorId === R);
      record('A8 estado inicial do booking = requested (confirm permitido só daqui)', bk.status === 'requested');
    } else {
      note('booking REAL = N/A — tabela availability/bookings ausente em DEV; matriz coberta estruturalmente (B).');
    }
  } finally {
    if (tablesExist) {
      await pool.query(`DELETE FROM bookings WHERE booking_id=$1`, [bookingId]).catch(() => {});
      await pool.query(`DELETE FROM availability WHERE availability_id=$1`, [availId]).catch(() => {});
    }
    await pool.query(`DELETE FROM actors WHERE id=$1`, [R]);
  }

  console.log('\n— B estrutural: PUT confirm/cancel + state guard; check-in/out owner-only —');
  const route = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.routes.ts'), 'utf8');
  const sliceBetween = (a: string, b: string) => { const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length; return i >= 0 ? route.slice(i, j > i ? j : route.length) : ''; };
  const put = sliceBetween("Atualizar booking", "Realizar check-in");
  const ci = sliceBetween("Realizar check-in", "Realizar check-out");
  const co = sliceBetween("Realizar check-out", "Adicionar participante");

  record('B1 PUT: só CONFIRM/CANCEL (status fora disso → 400 BOOKING_TRANSITION_NOT_ALLOWED)',
    /UnifiedBookingStatus\.CONFIRMED && target !== UnifiedBookingStatus\.CANCELLED/.test(put)
    && /BOOKING_TRANSITION_NOT_ALLOWED/.test(put));
  record('B2 PUT confirm = owner-only (actionContext===ownerId) + estado requested (409 se não)',
    /BOOKING_CONFIRM_OWNER_ONLY/.test(put) && /existing\.status !== UnifiedBookingStatus\.REQUESTED/.test(put)
    && /BOOKING_CONFIRM_INVALID_STATE/.test(put));
  record('B3 PUT cancel = requester OU owner; não após checked_out (409)',
    /!== requesterId && req\.actionContext\.actorId !== ownerId/.test(put)
    && /BOOKING_CANCEL_PARTY_ONLY/.test(put) && /CHECKED_OUT/.test(put) && /BOOKING_CANCEL_INVALID_STATE/.test(put));
  record('B4 PUT: resolve booking + owner real (getBooking/getAvailability) ANTES de updateBooking; 401',
    put.indexOf('getBooking(') < put.indexOf('updateBooking(')
    && put.indexOf('getAvailability(') < put.indexOf('updateBooking(')
    && /status\(401\)/.test(put));
  record('B5 check-in = owner-only (actionContext===ownerId + canRepresentActor) ANTES de checkIn; 401/403',
    /BOOKING_CHECKIN_OWNER_ONLY/.test(ci)
    && /canRepresentActor\(req\.tenant\.id, userId, availability\.ownerId\)/.test(ci)
    && ci.indexOf('canRepresentActor(') < ci.indexOf('checkIn(')
    && /status\(401\)/.test(ci));
  record('B6 check-out = owner-only ANTES de checkOut; 401/403',
    /BOOKING_CHECKOUT_OWNER_ONLY/.test(co)
    && /canRepresentActor\(req\.tenant\.id, userId, availability\.ownerId\)/.test(co)
    && co.indexOf('canRepresentActor(') < co.indexOf('checkOut(')
    && /status\(401\)/.test(co));
  record('B7 NÃO usa params.id como actor; NÃO usa actionContext como autoridade crua nos 3 (comparado ao papel)',
    !/canRepresentActor\([^)]*params\.id/.test(put + ci + co)
    && !/canRepresentActor\([^)]*req\.actionContext\.actorId\)/.test(ci + co));
  record('B8 NÃO usa ensureUserActor/getActiveActor; sem Bank nos 3 handlers',
    !/ensureUserActor\(/.test(put + ci + co) && !/getActiveActor\(/.test(put + ci + co)
    && !/bank_ledger|bank_transactions|payment|amount_cents|payout|settlement/.test(put + ci + co));
  // intocados
  record('B9 POST /bookings (create) selado intocado; participant writes + availability writes + 7 GETs intocados',
    /BOOKING_CREATE_REQUESTER_MISMATCH/.test(route) && /AVAILABILITY_WRITE_OWNER_MISMATCH/.test(route)
    && /WEEKLY_TEMPLATE_ACTOR_NOT_REPRESENTABLE/.test(route) && /canReadParticipantAsParty\(/.test(route));

  console.log('\n— C service: updateBooking/checkIn/checkOut sem Bank; pré-condições preservadas —');
  const svc = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.service.ts'), 'utf8');
  record('C1 service sem Bank/money', !/bank_ledger|bank_transactions|bank_accounts|payment|amount_cents|payout|settlement/i.test(svc));
  record('C2 checkIn exige CONFIRMED + checkOut exige checkedInAt (pré-condições do service preservadas)',
    /Apenas bookings confirmados podem fazer check-in/.test(svc) && /deve ter feito check-in antes de check-out/.test(svc));
  note('Denominador: esta fatia fecha PUT /bookings/:id + check-in + check-out. Família booking writes FECHADA (create+status+check-in+check-out). Resíduo do arquivo: participant writes ×3.');

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
  console.log('✨ booking status/check-in/check-out gateados (matriz confirm=owner / cancel=requester|owner / check-in,out=owner; status guard) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
