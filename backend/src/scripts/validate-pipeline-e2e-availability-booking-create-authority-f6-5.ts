/**
 * E2E DECISION-0113 (WRITE) · availability booking CREATE authority
 *
 * POST /availability/bookings gravava requesterActorId = body.requesterActorId (client-declared) só com
 * presença de actionContext → write spoof: usuário criava reserva em nome de requester alheio. Agora: req.user
 * obrigatório (401) → actionContext.actorId DEVE === body.requesterActorId (autoria coincide) → canRepresentActor(
 * userId, body.requesterActorId) ANTES de createBooking → 403 fail-closed. NÃO exige representar o owner da
 * availability (cliente reserva slot de prestador terceiro). Não toca Bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor(requester) decide; owner da availability pode ser terceiro.
 *   B estrutural — gate sobre body.requesterActorId ANTES de createBooking; 401/403; mismatch; NÃO exige owner;
 *     sem ensureUserActor/getActiveActor; sem Bank; demais booking writes + selados intocados.
 *   C service — createBooking writer, sem Bank.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-availability-booking-create-authority-f6-5.ts
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
const MARKER = 'E2E-BKC';

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
  const PROVIDER = randomUUID(); // dono da availability (terceiro) — dev NÃO representa, mas PODE reservar nele
  const R = randomUUID();        // requester alheio — dev NÃO representa
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [PROVIDER, TENANT_ID, `${MARKER}-provider`, devActor]);
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [R, TENANT_ID, `${MARKER}-requester`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor sobre o REQUESTER (não o owner) —');
    record('A1 dev representa o PRÓPRIO actor (requester=devActor) → true (cria a própria reserva)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o requester alheio R → false (criar booking com requester R → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, R)) === false);
    record('A3 dev NÃO representa o PROVIDER (owner da availability) → false — MAS isso NÃO bloqueia criar reserva (owner é terceiro)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, PROVIDER)) === false);
    record('A4 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
    note('Regra: gate é sobre o REQUESTER (representável), NÃO sobre o owner da availability (que pode ser terceiro — A3 prova que dev NÃO representa o provider, e ainda assim a regra permite reservar como requester=devActor).');
  } finally {
    await pool.query(`DELETE FROM actors WHERE id = ANY($1::uuid[])`, [[PROVIDER, R]]);
  }

  console.log('\n— B estrutural: gate sobre body.requesterActorId ANTES de createBooking —');
  const route = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.routes.ts'), 'utf8');
  const sliceBetween = (a: string, b: string) => { const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length; return i >= 0 ? route.slice(i, j > i ? j : route.length) : ''; };
  const post = sliceBetween("Criar novo booking", "Listar bookings com filtros");

  record('B1 gate canRepresentActor(req.tenant.id, userId, parsed.data.requesterActorId) ANTES de createBooking',
    /canRepresentActor\(req\.tenant\.id, userId, parsed\.data\.requesterActorId\)/.test(post)
    && post.indexOf('canRepresentActor(') < post.indexOf('createBooking('));
  record('B2 mismatch actionContext.actorId !== body.requesterActorId → 403 (REQUESTER_MISMATCH); 401/403',
    /req\.actionContext\.actorId !== parsed\.data\.requesterActorId/.test(post)
    && /BOOKING_CREATE_REQUESTER_MISMATCH/.test(post) && /status\(401\)/.test(post)
    && /BOOKING_CREATE_REQUESTER_NOT_REPRESENTABLE/.test(post));
  record('B3 NÃO exige representar o owner da availability (sem canRepresentActor sobre ownerId no create)',
    !/getAvailability\(/.test(post) && !/availability\.ownerId/.test(post));
  record('B4 NÃO usa actionContext.actorId como autoridade crua (é comparado ao requester, não usado como gate)',
    !/canRepresentActor\([^)]*actionContext/.test(post));
  record('B5 NÃO usa ensureUserActor/getActiveActor no handler',
    !/ensureUserActor\(/.test(post) && !/getActiveActor\(/.test(post));
  record('B6 create sem Bank no handler',
    !/bank_ledger|bank_transactions|payment|amount_cents|payout|settlement/.test(post));
  // intocados
  record('B7 PUT /bookings/:id + check-in + check-out NÃO ganharam gate de parte nesta fatia',
    !/canReadBookingAsParty/.test(sliceBetween("PUT /availability/bookings/:id", "POST /availability/bookings/:id/check-in"))
    && !/BOOKING_CREATE_REQUESTER/.test(sliceBetween("check-in", "check-out")));
  record('B8 availability writes + weekly-template + 7 GETs selados intocados',
    /AVAILABILITY_WRITE_OWNER_MISMATCH/.test(route) && /WEEKLY_TEMPLATE_ACTOR_NOT_REPRESENTABLE/.test(route)
    && /canReadBookingAsParty\(/.test(route) && /canReadParticipantAsParty\(/.test(route));

  console.log('\n— C service: createBooking writer, sem Bank —');
  const svc = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.service.ts'), 'utf8');
  record('C1 service availability sem Bank/money', !/bank_ledger|bank_transactions|bank_accounts|payment|amount_cents|payout|settlement/i.test(svc));
  record('C2 createBooking existe (writer confirmado)', /async createBooking\(/.test(svc));
  note('Denominador: esta fatia fecha SÓ POST /availability/bookings. Resíduos: PUT /bookings/:id (status arbitrário + state machine = G/integridade), check-in, check-out, participant writes ×3.');

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
  console.log('✨ booking create gateado (canRepresentActor sobre body.requesterActorId; owner pode ser terceiro) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
