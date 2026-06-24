/**
 * e2e-rental-resource-conflict.ts — F-RENTAL-RESOURCE-CORE FASE 2b (DECISION-0151).
 *
 * Prova a EXCLUSIVIDADE por resource_id (pré-money, ZERO dinheiro):
 *   rentable_resource → availability(owner_type='rentable_resource') → createBooking(requested) → confirm (resource-lock)
 *   → 2º booking sobreposto no MESMO recurso bloqueia (409 RENTAL_RESOURCE_TIME_CONFLICT)
 *   → back-to-back no mesmo recurso confirma → recurso DIFERENTE no mesmo horário confirma.
 * NÃO toca bank/checkout/order/payment. Fixture committed + teardown determinístico.
 */
import { randomUUID } from 'crypto';
import { loadBackendEnv } from '../core/db/load-backend-env';

loadBackendEnv();

const TENANT = process.env.E2E_TENANT_ID?.trim() || 'fbe13b78-4516-493d-905a-363796aea1d1';
const CONCEPT = '323795e9-94b4-4c07-9c91-3b95fe0296e0';

let P = '';   // owner_actor_id do recurso (reusa actor existente)
let R = '';   // requester actor
let RU = '';  // requester user_id (subject)
const RES = randomUUID();   // recurso alugável A
const RES2 = randomUUID();  // recurso alugável B (mesmo horário, não conflita)
const AV1 = randomUUID();   // RES [10,12) base
const AV2 = randomUUID();   // RES [11,13) SOBREPOSTO
const AV3 = randomUUID();   // RES [12,13) back-to-back
const AV4 = randomUUID();   // RES2 [10,12) outro recurso

const D = '2026-09-02T';
const T10 = `${D}10:00:00Z`, T11 = `${D}11:00:00Z`, T12 = `${D}12:00:00Z`, T13 = `${D}13:00:00Z`;

const fails: string[] = [];
const ok = (cond: boolean, label: string) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) fails.push(label); };

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1); }
  const { pool } = await import('../core/database/pool');
  const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const { actorRepositoryAdapter, actorUtilsAdapter, socialRepositoryAdapter, socialServiceAdapter, eventFeedHandlersAdapter } = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);

  const c = await pool.connect();
  await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);

  // Δbank baseline
  const ledgerBefore = (await c.query(`SELECT count(*)::int n FROM bank_ledger WHERE tenant_id=$1`, [TENANT])).rows[0].n;

  try {
    const ar = await c.query<{ id: string; user_id: string }>(`SELECT id, user_id FROM actors WHERE tenant_id=$1 AND actor_type='user' AND user_id IS NOT NULL LIMIT 2`, [TENANT]);
    if (ar.rows.length < 1) { console.error('sem user-actor com user_id p/ fixture'); process.exit(1); }
    P = ar.rows[0].id; R = ar.rows[1]?.id || ar.rows[0].id; RU = ar.rows[1]?.user_id || ar.rows[0].user_id;
    console.log(`    fixture: owner=${P} requester=${R}`);

    // 2 recursos alugáveis (owner P), concept válido
    await c.query(
      `INSERT INTO rentable_resources (id, tenant_id, owner_actor_id, concept_id, resource_type, label)
       VALUES ($1,$3,$4,$5,'vehicle','Carro A'),($2,$3,$4,$5,'vehicle','Carro B')`,
      [RES, RES2, TENANT, P, CONCEPT]
    );
    // availabilities: RES AV1[10,12) AV2[11,13) AV3[12,13) · RES2 AV4[10,12)
    await c.query(
      `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, start_datetime, end_datetime, status) VALUES
        ($1,$7,'rentable_resource',$5,$8,$10,'active'),
        ($2,$7,'rentable_resource',$5,$9,$11,'active'),
        ($3,$7,'rentable_resource',$5,$10,$11,'active'),
        ($4,$7,'rentable_resource',$6,$8,$10,'active')`,
      [AV1, AV2, AV3, AV4, RES, RES2, TENANT, T10, T11, T12, T13]
    );
    console.log('\n=== FIXTURE committed (2 recursos + 4 janelas) ===\n');

    const subj = { subjectUserId: RU, requesterActorId: R };

    // 1) booking de rental NÃO é mais fail-closed → nasce requested
    const b1 = await unifiedAvailabilityService.createBooking(TENANT, subj, { availabilityId: AV1, requesterActorId: R } as any);
    ok(b1.status === 'requested', `1. createBooking rental nasce requested (não fail-closed) (${b1.status})`);

    // 2) confirm via resource-lock → confirmed (sem conflito)
    const b1c = await unifiedAvailabilityService.updateBooking(TENANT, b1.bookingId, P, { status: 'confirmed' } as any);
    ok(b1c.status === 'confirmed', `2. confirm rental → confirmed (resource-lock) (${b1c.status})`);

    // 3) 2º booking SOBREPOSTO no MESMO recurso → confirm BLOQUEIA (409 RENTAL_RESOURCE_TIME_CONFLICT)
    const b2 = await unifiedAvailabilityService.createBooking(TENANT, subj, { availabilityId: AV2, requesterActorId: R } as any);
    let conflict = false, msg = '';
    try { await unifiedAvailabilityService.updateBooking(TENANT, b2.bookingId, P, { status: 'confirmed' } as any); }
    catch (e: any) { msg = e?.message || ''; conflict = e?.statusCode === 409 && /RENTAL_RESOURCE_TIME_CONFLICT/.test(msg); }
    ok(conflict, `3. 2º confirm sobreposto (mesmo recurso) → 409 RENTAL_RESOURCE_TIME_CONFLICT [${msg.slice(0, 60)}]`);

    // 4) back-to-back [12,13) no mesmo recurso → confirma (não conflita com [10,12))
    const b3 = await unifiedAvailabilityService.createBooking(TENANT, subj, { availabilityId: AV3, requesterActorId: R } as any);
    let b3ok = false; try { const r = await unifiedAvailabilityService.updateBooking(TENANT, b3.bookingId, P, { status: 'confirmed' } as any); b3ok = r.status === 'confirmed'; } catch (e: any) { msg = e?.message || ''; }
    ok(b3ok, `4. back-to-back [12,13) mesmo recurso confirma (não conflita)`);

    // 5) RECURSO DIFERENTE no mesmo horário [10,12) → confirma (conflito é por recurso, não global)
    const b4 = await unifiedAvailabilityService.createBooking(TENANT, subj, { availabilityId: AV4, requesterActorId: R } as any);
    let b4ok = false; try { const r = await unifiedAvailabilityService.updateBooking(TENANT, b4.bookingId, P, { status: 'confirmed' } as any); b4ok = r.status === 'confirmed'; } catch (e: any) { msg = e?.message || ''; }
    ok(b4ok, `5. recurso DIFERENTE no mesmo horário confirma (exclusividade por resource_id)`);

    // 6) Δbank = 0
    const ledgerAfter = (await c.query(`SELECT count(*)::int n FROM bank_ledger WHERE tenant_id=$1`, [TENANT])).rows[0].n;
    ok(ledgerAfter === ledgerBefore, `6. Δbank_ledger = 0 (jornada não chama dinheiro) [${ledgerBefore}→${ledgerAfter}]`);
  } finally {
    await c.query(`DELETE FROM bookings WHERE tenant_id=$1 AND availability_id = ANY($2::uuid[])`, [TENANT, [AV1, AV2, AV3, AV4]]).catch(() => {});
    await c.query(`DELETE FROM availability WHERE availability_id = ANY($1::uuid[])`, [[AV1, AV2, AV3, AV4]]).catch(() => {});
    await c.query(`DELETE FROM rentable_resources WHERE id = ANY($1::uuid[])`, [[RES, RES2]]).catch(() => {});
    c.release();
    console.log('\n=== TEARDOWN ok ===');
  }

  if (fails.length > 0) { console.error(`\n=== FALHAS (${fails.length}) ===`); process.exit(1); }
  console.log('\n=== RESULTADO: EXCLUSIVIDADE POR RECURSO OK ✅ (todos PASS) ===');
  await pool.end().catch(() => {});
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
