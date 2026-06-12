/**
 * E2E DECISION-0113 canal-5 · availability bookings reads (list + by-id)
 *
 * GET /availability/bookings e /bookings/:id retornavam o compromisso (requester, horários, status, notas)
 * validando só presença de actionContext → IDOR: qualquer caller lia booking alheio por id, ou listava por
 * requesterActorId/availabilityId (hint) sem provar parte. Agora: booking é recurso privado com PARTES reais —
 * requester (`requesterActorId`) e o DONO da availability (`availability.ownerId` = actorId). by-id: representar
 * UMA das partes (helper canReadBookingAsParty) senão 403; 404 preservado. list: exigir filtro por parte
 * representável (requester OU dono da availability), senão 403 — nunca tenant-wide. read-only, zero Bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor decide cada parte (requester / owner / estranho).
 *   B estrutural — by-id resolve booking + gate pelas partes (não params.id, não actionContext); list exige
 *     scope por parte representável; 401/403; sem getActiveActor/ensureUserActor; conflicts/participants/availability intactos.
 *   C service/repo — getBooking/listBookings/getAvailability read-only, zero Bank.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-availability-bookings-authority-f6-5.ts
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
const MARKER = 'E2E-BOOK';

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
  const O = randomUUID();      // owner de availability (page) — dev NÃO representa
  const R = randomUUID();      // requester alheio (page) — dev NÃO representa
  const availId = randomUUID();
  const bookingId = randomUUID();
  let bookingsTableExists = false;
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [O, TENANT_ID, `${MARKER}-owner`, devActor]);
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [R, TENANT_ID, `${MARKER}-requester`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor sobre as PARTES (requester + dono da availability) —');
    record('A1 dev representa o PRÓPRIO actor → true (booking onde ele é requester OU dono passa)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o owner alheio O → false (sozinho não autoriza)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 dev NÃO representa o requester alheio R → false',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, R)) === false);
    record('A4 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

    // behavioral do helper canReadBookingAsParty — requer tabelas availability/bookings.
    const avReg = await pool.query<{ a: string | null; b: string | null }>(
      `SELECT to_regclass('public.availability') AS a, to_regclass('public.bookings') AS b`);
    bookingsTableExists = !!avReg.rows[0].b && !!avReg.rows[0].a;
    if (bookingsTableExists) {
      // availability cujo dono é o devActor; booking cujo requester é R (alheio)
      await pool.query(
        `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
         VALUES ($1,$2,'user',$3,'recurring','active', now()+interval '1 day', now()+interval '1 day 1 hour','America/Sao_Paulo',1, jsonb_build_object('e2e',$4::text))`,
        [availId, TENANT_ID, devActor, MARKER]);
      await pool.query(
        `INSERT INTO bookings (booking_id, tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'requested','{}'::jsonb, now(), now(), now())`,
        [bookingId, TENANT_ID, availId, R]);

      const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
      const booking = await unifiedAvailabilityService.getBooking(TENANT_ID, bookingId);
      // replica a lógica do helper de 1ª mão: requester R (dev não representa) OR owner devActor (dev representa) → true
      const resolvedAvail = await unifiedAvailabilityService.getAvailability(TENANT_ID, booking.availabilityId);
      const ownerOk = await authorizationService.canRepresentActor(TENANT_ID, devUserId, resolvedAvail.ownerId);
      record('A5 booking REAL: dev é DONO da availability do booking → canRepresentActor(owner)=true (lê como parte)',
        ownerOk === true);
      const reqOk = await authorizationService.canRepresentActor(TENANT_ID, devUserId, booking.requesterActorId);
      record('A6 mesmo booking: dev NÃO é o requester (R alheio) → canRepresentActor(requester)=false (autoriza só via owner)',
        reqOk === false);
    } else {
      note('booking REAL = N/A — tabela availability/bookings ausente em DEV; helper coberto estruturalmente (B).');
    }
  } finally {
    if (bookingsTableExists) {
      await pool.query(`DELETE FROM bookings WHERE booking_id=$1`, [bookingId]).catch(() => {});
      await pool.query(`DELETE FROM availability WHERE availability_id=$1`, [availId]).catch(() => {});
    }
    await pool.query(`DELETE FROM actors WHERE id = ANY($1::uuid[])`, [[O, R]]);
  }

  console.log('\n— B estrutural: gate pelas partes reais; list escopada; conflicts/participants/availability intactos —');
  const route = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.routes.ts'), 'utf8');

  const sliceBetween = (a: string, b: string) => { const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length; return i >= 0 ? route.slice(i, j > i ? j : route.length) : ''; };
  const byId = sliceBetween("'/bookings/:id'", "fastify.put<{");
  const list = sliceBetween("}>('/bookings', async", "'/bookings/:id'");

  record('B1 helper canReadBookingAsParty: usa requesterActorId E availability.ownerId (partes reais)',
    /async function canReadBookingAsParty/.test(route)
    && /booking\.requesterActorId/.test(route) && /availability\.ownerId/.test(route));
  record('B2 by-id: resolve booking (getBooking) ANTES de autorizar; gate por canReadBookingAsParty',
    byId.indexOf('getBooking(') >= 0 && byId.indexOf('getBooking(') < byId.indexOf('canReadBookingAsParty(')
    && /canReadBookingAsParty\(req\.tenant\.id, userId, booking\)/.test(byId));
  record('B3 by-id: NÃO gateia em params.id (bookingId ≠ actor); 401 sem user; 403 fail-closed (BOOKING_NOT_REPRESENTABLE)',
    !/canRepresentActor\([^)]*params\.id/.test(byId) && /status\(401\)/.test(byId) && /status\(403\)/.test(byId) && /BOOKING_NOT_REPRESENTABLE/.test(byId));
  // DECISION-0118 D2: o lado owner usa o resolver polimórfico (authority actor).
  record('B4 list: exige parte representável (requester OU autoridade do owner via resolver); sem scope → 403 (não tenant-wide)',
    /canRepresentActor\(req\.tenant\.id, userId, req\.query\.requesterActorId\)/.test(list)
    && /representsAvailabilityOwner\(req\.tenant\.id, userId, availability\)/.test(list)
    && /BOOKING_LIST_SCOPE_REQUIRED/.test(list)
    && list.indexOf('if (!scoped)') < list.indexOf('listBookings('));
  record('B5 NÃO usa actionContext.actorId como autoridade; NÃO getActiveActor/ensureUserActor (sem side-effect em GET)',
    !/canRepresentActor\([^)]*actionContext/.test(byId + list) && !/getActiveActor\(/.test(byId + list) && !/ensureUserActor\(/.test(byId + list));
  record('B6 reads read-only no handler (sem bank_ledger/INSERT/UPDATE/DELETE)',
    !/bank_ledger|bank_transactions|INSERT INTO|UPDATE |DELETE FROM/.test(byId + list));
  // intocados
  const conf = sliceBetween("'/:availabilityId/participants/:actorId/conflicts'", "");
  record('B7 /conflicts permanece selado (canRepresentActor sobre req.params.actorId intacto)',
    /canRepresentActor\(req\.tenant\.id, userId, req\.params\.actorId\)/.test(conf));
  record('B8 participants e availability list/by-id NÃO ganharam gate de parte (intocados — resíduo declarado)',
    !/canReadBookingAsParty/.test(sliceBetween("'/:availabilityId/participants'", "'/participants/:id'"))
    && !/BOOKING_LIST_SCOPE_REQUIRED/.test(sliceBetween("}>('/', async", "'/:id'")));

  console.log('\n— C service/repo: bookings reads read-only, zero Bank —');
  const svc = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.service.ts'), 'utf8');
  record('C1 service availability sem Bank/money (bank_*/payment/amount_cents/payout/settlement)',
    !/bank_ledger|bank_transactions|bank_accounts|payment|amount_cents|payout|settlement/i.test(svc));
  const repo = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.repository.ts'), 'utf8');
  const findById = repo.slice(repo.indexOf('async findBookingById'));
  record('C2 findBookingById = SELECT FROM bookings (read-only)',
    /SELECT \* FROM bookings/.test(findById.slice(0, 300)));
  note('Denominador: esta fatia fecha SÓ os 2 GETs de bookings. O arquivo NÃO está fechado — availability list/by-id (G), participants list/by-id (resíduo A), weekly-template PUT (write-authorship) seguem abertos. /conflicts permanece selado.');

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
  console.log('✨ bookings reads gateados pelas partes reais (requester OU dono da availability); list escopada — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
