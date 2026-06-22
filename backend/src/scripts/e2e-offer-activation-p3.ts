/**
 * P3 / DECISION-0147 — E2E de ativação segura (gate + cascata + booking-gate). Funções REAIS; fixture
 * committed + teardown (DB virgem restaurado). PRÉ-DINHEIRO. Cobre o caminho PF + cascata + booking-gate;
 * o caminho PJ-KYB e o civil-null (mutação de global_user dedicado) ficam p/ a reseal da IA-YALA.
 * Uso: pnpm exec tsx src/scripts/e2e-offer-activation-p3.ts
 */
import { randomUUID } from 'crypto';
import { loadBackendEnv } from '../core/db/load-backend-env';
loadBackendEnv();

const TENANT = process.env.E2E_TENANT_ID?.trim() || 'fbe13b78-4516-493d-905a-363796aea1d1';
let PF = '';                 // provider PF (user-actor existente, com global_user/full_name)
let REQ = '';                // requester (outro actor)
const CS = randomUUID();     // canonical_service (concept C)
const SVC = randomUUID();    // service
const OFF = randomUUID();    // offering draft (provider PF)
let CONCEPT = '';

const fails: string[] = [];
const ok = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails.push(l); };
const threw = async (fn: () => Promise<any>, codeRe: RegExp): Promise<string> => {
  try { await fn(); return ''; } catch (e: any) { return `${e?.statusCode ?? ''} ${e?.code ?? ''} ${e?.message ?? ''}`.match(codeRe) ? 'OK' : `WRONG:${e?.message}`; }
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1); }
  const { pool } = await import('../core/database/pool');
  const { assertOfferingActivationEligibility } = await import('../modules/services/services-offering-activation-gate');
  const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const { actorRepositoryAdapter, actorUtilsAdapter, socialRepositoryAdapter, socialServiceAdapter, eventFeedHandlersAdapter } = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter); socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter); socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);

  const c = await pool.connect();
  await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);

  try {
    // PF = user-actor existente com global_user (full_name presente); REQ = outro actor.
    const ar = await c.query<{ id: string }>(
      `SELECT a.id FROM actors a JOIN global_users gu ON gu.global_user_id=a.global_user_id
        WHERE a.tenant_id=$1 AND a.actor_type='user' AND gu.cpf IS NOT NULL AND gu.full_name IS NOT NULL LIMIT 2`, [TENANT]);
    if (ar.rows.length < 1) { console.error('sem user-actor com civil mínimo p/ fixture'); process.exit(1); }
    PF = ar.rows[0].id; REQ = ar.rows[1]?.id || PF;
    const conc = await c.query<{ concept_id: string }>(`SELECT concept_id FROM concepts LIMIT 1`);
    CONCEPT = conc.rows[0].concept_id;
    console.log(`    fixture PF=${PF} concept=${CONCEPT}`);

    // canonical(C) + service(PF) + offering DRAFT(PF) + declaração PF ACTIVE
    await c.query(`INSERT INTO canonical_services (id,tenant_id,concept_id,name,slug,status) VALUES ($1,$4,$2,'P3 Canon',$3,'active')`, [CS, CONCEPT, 'p3-canon-'+CS.slice(0,8), TENANT]);
    await c.query(`INSERT INTO services (service_id,tenant_id,actor_id,name,slug,canonical_service_id,status,service_type) VALUES ($1,$2,$3,'P3 Svc',$4,$5,'active','service')`, [SVC, TENANT, PF, 'p3-svc-'+SVC.slice(0,8), CS]);
    await c.query(`INSERT INTO service_offerings (id,tenant_id,canonical_service_id,service_id,provider_actor_id,price_cents,duration_minutes,status) VALUES ($1,$2,$3,$4,$5,10000,60,'draft')`, [OFF, TENANT, CS, SVC, PF]);
    await c.query(`INSERT INTO actor_professional_concepts (tenant_id,actor_id,concept_id,skill_level,is_active,declared_at) VALUES ($1,$2,$3,3,true,now())`, [TENANT, PF, CONCEPT]);
    console.log('\n=== FIXTURE committed ===\n');

    // 1) GATE PF válido (declaração ACTIVE + civil + sem ATL) → passa
    let r1 = await threw(() => assertOfferingActivationEligibility({ tenantId: TENANT, providerActorId: PF, companyId: null, conceptId: CONCEPT }), /./);
    ok(r1 === '', `1. gate PF válido passa (sem erro)`);

    // 2) GATE PF sem declaração → DECLARATION_REQUIRED
    await c.query(`UPDATE actor_professional_concepts SET is_active=false, retired_at=now() WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3`, [TENANT, PF, CONCEPT]);
    ok((await threw(() => assertOfferingActivationEligibility({ tenantId: TENANT, providerActorId: PF, companyId: null, conceptId: CONCEPT }), /DECLARATION_REQUIRED/)) === 'OK', `2. gate PF sem declaração → DECLARATION_REQUIRED`);
    await c.query(`UPDATE actor_professional_concepts SET is_active=true, retired_at=NULL WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3`, [TENANT, PF, CONCEPT]);

    // 3) GATE PF em ATL → ACTOR_BLOCKED
    await c.query(`INSERT INTO atl_blocked_actors (tenant_id, actor_id, blocked_reason) VALUES ($1,$2,'e2e_p3_test') ON CONFLICT DO NOTHING`, [TENANT, PF]);
    ok((await threw(() => assertOfferingActivationEligibility({ tenantId: TENANT, providerActorId: PF, companyId: null, conceptId: CONCEPT }), /ACTOR_BLOCKED/)) === 'OK', `3. gate PF em atl_blocked_actors → ACTOR_BLOCKED`);
    await c.query(`DELETE FROM atl_blocked_actors WHERE tenant_id=$1 AND actor_id=$2`, [TENANT, PF]);

    // 4) GATE PJ sem publicação → PUBLICATION_REQUIRED (companyId fake; só prova o branch PJ)
    ok((await threw(() => assertOfferingActivationEligibility({ tenantId: TENANT, providerActorId: PF, companyId: randomUUID(), conceptId: CONCEPT }), /PUBLICATION_REQUIRED/)) === 'OK', `4. gate PJ sem publicação → PUBLICATION_REQUIRED`);

    // 5) CASCATA PF (SQL real do service): offering ACTIVE → declaração retirada suspende
    await c.query(`UPDATE service_offerings SET status='active' WHERE id=$1`, [OFF]);
    await c.query(`UPDATE service_offerings so SET status='suspended', updated_at=now() FROM canonical_services cs
                    WHERE so.canonical_service_id=cs.id AND so.tenant_id=$1 AND so.provider_actor_id=$2 AND cs.concept_id=$3 AND so.status='active'`, [TENANT, PF, CONCEPT]);
    const st = await c.query<{ status: string }>(`SELECT status FROM service_offerings WHERE id=$1`, [OFF]);
    ok(st.rows[0].status === 'suspended', `5. cascata PF: base revogada suspende offering active (status=${st.rows[0].status})`);

    // 6) BOOKING-GATE: offering DRAFT → availability → createBooking deve recusar (OFFERING_NOT_ACTIVE)
    await c.query(`UPDATE service_offerings SET status='draft' WHERE id=$1`, [OFF]);
    const AV = randomUUID();
    await c.query(`INSERT INTO availability (availability_id,tenant_id,owner_type,owner_id,start_datetime,end_datetime,status) VALUES ($1,$2,'service_offering',$3,'2026-10-01T10:00:00Z','2026-10-01T11:00:00Z','active')`, [AV, TENANT, OFF]);
    const bgate = await threw(() => unifiedAvailabilityService.createBooking(TENANT, REQ, { availabilityId: AV, requesterActorId: REQ } as any), /OFFERING_NOT_ACTIVE/);
    ok(bgate === 'OK', `6. booking-gate: createBooking em offering draft → OFFERING_NOT_ACTIVE [${bgate}]`);
    await c.query(`DELETE FROM bookings WHERE availability_id=$1`, [AV]);
    await c.query(`DELETE FROM availability WHERE availability_id=$1`, [AV]);

  } finally {
    await c.query(`DELETE FROM actor_professional_concepts WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3`, [TENANT, PF, CONCEPT]).catch(()=>{});
    await c.query(`DELETE FROM service_offerings WHERE id=$1`, [OFF]).catch(()=>{});
    await c.query(`DELETE FROM services WHERE service_id=$1`, [SVC]).catch(()=>{});
    await c.query(`DELETE FROM canonical_services WHERE id=$1`, [CS]).catch(()=>{});
    c.release();
    console.log('\n=== TEARDOWN ok ===');
  }
  console.log(`\n=== RESULTADO: ${fails.length === 0 ? 'P3 GATE+CASCATA+BOOKING-GATE OK ✅' : 'FALHAS: '+fails.length} ===`);
  await pool.end().catch(() => {});
  process.exit(fails.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
