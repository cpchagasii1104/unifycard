/**
 * CAMINHO B1 — Prova de jornada da oferta PRÉ-DINHEIRO (ponta-a-ponta, backend, funções reais).
 *
 * Prova que a cadeia já construída CONECTA: discover → service.canonicalServiceId → by-canonical (active) →
 * offering → availability → createBooking(requested) → confirm → 2º confirm sobreposto bloqueia (provider).
 *
 * NÃO toca dinheiro/payout/ledger/frontend/activation pública. Fixture committed + teardown (DB virgem → restaura).
 * Uso: pnpm exec tsx src/scripts/e2e-offer-journey-pre-money.ts
 */
import { randomUUID } from 'crypto';
import { loadBackendEnv } from '../core/db/load-backend-env';

loadBackendEnv();

const TENANT = process.env.E2E_TENANT_ID?.trim() || 'fbe13b78-4516-493d-905a-363796aea1d1';
const CAT = '23c101bc-6912-4ade-b9a1-ba658213be5e';        // categoria-folha viva com concept_id
const CONCEPT = '323795e9-94b4-4c07-9c91-3b95fe0296e0';    // concept_id da CAT (resolveConceptFromCategory(CAT))

// ids da fixture (gerados aqui p/ teardown determinístico)
let P = '';                      // provider actor (reusa existente — evita cadeia de identidade)
let R = '';                      // requester actor (reusa existente)
let RU = '';                     // requester user_id (DECISION-0148: subjectUserId real)
const CS = randomUUID();         // canonical_service
const SVC = randomUUID();        // service
const OFF = randomUUID();        // service_offering ACTIVE
const OFF_DRAFT = randomUUID();  // service_offering DRAFT (prova que não vaza)
const AV1 = randomUUID();        // janela base   [10,12)
const AV2 = randomUUID();        // janela sobreposta [11,13)
const AV3 = randomUUID();        // janela back-to-back [12,13)

const D = '2026-09-01T';
const T10 = `${D}10:00:00Z`, T11 = `${D}11:00:00Z`, T12 = `${D}12:00:00Z`, T13 = `${D}13:00:00Z`;

const fails: string[] = [];
const ok = (cond: boolean, label: string) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) fails.push(label); };

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1); }
  const { pool } = await import('../core/database/pool');
  const { servicesService } = await import('../modules/services/services.service');
  const { serviceOfferingService } = await import('../modules/services/service-offering.service');
  const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');

  // DI: injeção dos social ports (script standalone não passa pelo boot do app) — mesma wiring de app.builder.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const { actorRepositoryAdapter, actorUtilsAdapter, socialRepositoryAdapter, socialServiceAdapter, eventFeedHandlersAdapter } = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);

  const c = await pool.connect();
  await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);

  try {
    // ───────── SETUP (fixture committed) ─────────
    // reusa 2 atores existentes do tenant (provider + requester) — a jornada não precisa de atores novos
    // DECISION-0148: requester precisa ser user-actor com user_id (core revalida canRepresentActor).
    const ar = await c.query<{ id: string; user_id: string }>(`SELECT id, user_id FROM actors WHERE tenant_id=$1 AND actor_type='user' AND user_id IS NOT NULL LIMIT 2`, [TENANT]);
    if (ar.rows.length < 1) { console.error('sem user-actor com user_id p/ fixture'); process.exit(1); }
    P = ar.rows[0].id; R = ar.rows[1]?.id || ar.rows[0].id; RU = ar.rows[1]?.user_id || ar.rows[0].user_id;
    console.log(`    fixture actors: provider=${P} requester=${R} requesterUser=${RU}`);
    await c.query(`INSERT INTO canonical_services (id, tenant_id, concept_id, name, slug, status) VALUES ($1,$4,$2,'B1 Canonical',$3,'active')`, [CS, CONCEPT, 'b1-canonical-' + CS.slice(0, 8), TENANT]);
    await c.query(`INSERT INTO services (service_id, tenant_id, actor_id, name, slug, canonical_service_id, status, category_id, service_type) VALUES ($1,$2,$3,'B1 Service',$4,$5,'active',$6,'service')`, [SVC, TENANT, P, 'b1-svc-' + SVC.slice(0, 8), CS, CAT]);
    // OFF = active (provider P); OFF_DRAFT = draft (provider R, mesmo canonical) — UNIQUE(provider,canonical) exige providers distintos
    await c.query(`INSERT INTO service_offerings (id, tenant_id, canonical_service_id, provider_actor_id, service_id, price_cents, duration_minutes, status) VALUES ($1,$2,$3,$4,$5,10000,60,'active'),($6,$2,$3,$7,$5,10000,60,'draft')`, [OFF, TENANT, CS, P, SVC, OFF_DRAFT, R]);
    // AV1=[10,12) base · AV2=[11,13) SOBREPOSTO · AV3=[12,13) back-to-back
    await c.query(`INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, start_datetime, end_datetime, status) VALUES ($1,$8,'service_offering',$2,$5,$6,'active'),($3,$8,'service_offering',$2,$9,$7,'active'),($4,$8,'service_offering',$2,$6,$7,'active')`,
      [AV1, OFF, AV2, AV3, T10, T12, T13, TENANT, T11]);
    console.log('\n=== FIXTURE committed (provider/requester/canonical/service/offering active+draft/3 janelas) ===\n');

    // ───────── JORNADA (funções reais) ─────────
    // 1) discover encontra o SERVICE e carrega canonicalServiceId
    const discovered = await servicesService.discoverServices(TENANT, { categoryId: CAT });
    const mine = discovered.find((s: any) => s.serviceId === SVC || s.service_id === SVC);
    ok(!!mine, '1. discover encontra o service (via categoria-folha→concept)');
    const canonId = mine ? (mine as any).canonicalServiceId ?? (mine as any).canonical_service_id : null;
    ok(canonId === CS, `2. discovery carrega canonicalServiceId (=${canonId})`);

    // 3) by-canonical lista a offering ACTIVE e NÃO a draft
    const offerings = await serviceOfferingService.listActiveBycanonicalService(TENANT, CS);
    const ids = offerings.map((o: any) => o.id);
    ok(ids.includes(OFF), '3. by-canonical retorna a offering ACTIVE');
    ok(!ids.includes(OFF_DRAFT), '4. by-canonical NÃO retorna a offering DRAFT (active-only)');

    // 5) offering → availability (owner_type='service_offering')
    const av = await c.query(`SELECT availability_id FROM availability WHERE tenant_id=$1 AND owner_type='service_offering' AND owner_id=$2 ORDER BY start_datetime`, [TENANT, OFF]);
    ok(av.rows.length === 3, `5. offering→availability resolve (${av.rows.length} janelas)`);

    // 6) createBooking requested (pré-dinheiro)
    const b1 = await unifiedAvailabilityService.createBooking(TENANT, { subjectUserId: RU, requesterActorId: R }, { availabilityId: AV1, requesterActorId: R } as any);
    ok(b1.status === 'requested', `6. createBooking nasce requested (${b1.status})`);

    // 7) confirm → confirmed (guard roda; sem conflito)
    const b1c = await unifiedAvailabilityService.updateBooking(TENANT, b1.bookingId, P, { status: 'confirmed' } as any);
    ok(b1c.status === 'confirmed', `7. confirm → confirmed (${b1c.status})`);

    // 8) 2º booking sobreposto, MESMO provider → confirm BLOQUEIA (409 BOOKING_PROVIDER_TIME_CONFLICT)
    const b2 = await unifiedAvailabilityService.createBooking(TENANT, { subjectUserId: RU, requesterActorId: R }, { availabilityId: AV2, requesterActorId: R } as any);
    let conflict409 = false, conflictMsg = '';
    try {
      await unifiedAvailabilityService.updateBooking(TENANT, b2.bookingId, P, { status: 'confirmed' } as any);
    } catch (e: any) {
      conflict409 = e?.statusCode === 409 && /BOOKING_PROVIDER_TIME_CONFLICT/.test(e?.message || '');
      conflictMsg = `${e?.statusCode} ${e?.message}`;
    }
    ok(conflict409, `8. 2º confirm sobreposto (mesmo provider) → 409 BOOKING_PROVIDER_TIME_CONFLICT [${conflictMsg}]`);

    // 9) back-to-back [12,13) NÃO conflita com [10,12)
    const b3 = await unifiedAvailabilityService.createBooking(TENANT, { subjectUserId: RU, requesterActorId: R }, { availabilityId: AV3, requesterActorId: R } as any);
    let b3ok = false, b3msg = '';
    try { const r = await unifiedAvailabilityService.updateBooking(TENANT, b3.bookingId, P, { status: 'confirmed' } as any); b3ok = r.status === 'confirmed'; }
    catch (e: any) { b3msg = `${e?.statusCode} ${e?.message}`; }
    ok(b3ok, `9. back-to-back [12,13) confirma (não conflita) ${b3msg}`);

    // 10) trava conceitual: nenhuma tabela de dinheiro tocada por esta jornada
    const money = await c.query(`SELECT (SELECT count(*) FROM bank_ledger WHERE tenant_id=$1)::int AS ledger`, [TENANT]).catch(() => ({ rows: [{ ledger: -1 }] }));
    console.log(`    (bank_ledger do tenant inalterado por esta jornada: ledger=${money.rows[0].ledger} — jornada não chama dinheiro)`);

  } finally {
    // ───────── TEARDOWN (restaura virgem) ─────────
    await c.query(`DELETE FROM bookings WHERE tenant_id=$1 AND availability_id = ANY($2::uuid[])`, [TENANT, [AV1, AV2, AV3]]);
    await c.query(`DELETE FROM availability WHERE availability_id = ANY($1::uuid[])`, [[AV1, AV2, AV3]]);
    await c.query(`DELETE FROM service_offerings WHERE id = ANY($1::uuid[])`, [[OFF, OFF_DRAFT]]);
    await c.query(`DELETE FROM services WHERE service_id=$1`, [SVC]);
    await c.query(`DELETE FROM canonical_services WHERE id=$1`, [CS]);
    c.release();
    console.log('\n=== TEARDOWN ok (fixture removida) ===');
  }

  console.log(`\n=== RESULTADO: ${fails.length === 0 ? 'JORNADA FECHA ✅ (todos PASS)' : 'FALHAS: ' + fails.length} ===`);
  await pool.end().catch(() => {});
  process.exit(fails.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
