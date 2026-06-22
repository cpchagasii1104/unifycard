/**
 * F-BOOKING-CORE-SUBJECT-MODEL-MATERIALIZATION — E2E negativo (DECISION-0148). Prova que o core
 * createBooking REVALIDA autoridade via BookingSubject normalizado. Fixture committed + teardown; ZERO dinheiro.
 *   pnpm exec tsx src/scripts/e2e-booking-subject-authority.ts
 */
import { randomUUID } from 'crypto';
import { loadBackendEnv } from '../core/db/load-backend-env';
loadBackendEnv();

const TENANT = process.env.E2E_TENANT_ID?.trim() || 'fbe13b78-4516-493d-905a-363796aea1d1';
const fails: string[] = [];
const ok = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails.push(l); };
const threw = async (fn: () => Promise<any>, re: RegExp): Promise<string> => {
  try { await fn(); return 'NO_THROW'; } catch (e: any) { const s = `${e?.statusCode ?? ''} ${e?.code ?? ''} ${e?.message ?? ''}`; return re.test(s) ? 'OK' : `WRONG:${e?.message}`; }
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1); }
  const { pool } = await import('../core/database/pool');
  const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const a = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter); socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(a.socialRepositoryAdapter); socialPortsRegistry.setSocialService(a.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(a.eventFeedHandlersAdapter);

  const c = await pool.connect();
  await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);
  const AV = randomUUID();
  const count = async () => Number((await c.query(`SELECT count(*)::int n FROM bank_ledger WHERE tenant_id=$1`, [TENANT])).rows[0].n);
  try {
    // R = user-actor com user_id + global_user_id; X = outro actor (provider/divergente)
    const rr = await c.query<{ id: string; user_id: string; global_user_id: string }>(
      `SELECT id, user_id, global_user_id FROM actors WHERE tenant_id=$1 AND actor_type='user' AND user_id IS NOT NULL AND global_user_id IS NOT NULL LIMIT 1`, [TENANT]);
    const xr = await c.query<{ id: string }>(`SELECT id FROM actors WHERE tenant_id=$1 AND id <> $2 LIMIT 1`, [TENANT, rr.rows[0]?.id ?? '']);
    if (!rr.rows[0] || !xr.rows[0]) { console.error('fixture: precisa de 1 user-actor com user_id+global_user_id e 1 outro actor'); process.exit(1); }
    const R = rr.rows[0].id, RU = rr.rows[0].user_id, RG = rr.rows[0].global_user_id, X = xr.rows[0].id;
    console.log(`    R=${R} RU=${RU} RG=${RG} X=${X}`);
    // availability bookável (owner_type user = X; sem service_offering p/ não bater no offering-gate; sem purpose)
    await c.query(`INSERT INTO availability (availability_id,tenant_id,owner_type,owner_id,start_datetime,end_datetime,status) VALUES ($1,$2,'user',$3,'2026-11-01T10:00:00Z','2026-11-01T11:00:00Z','active')`, [AV, TENANT, X]);
    const ledgerBefore = await count();

    const sub = (su: string, ra: string) => ({ subjectUserId: su, requesterActorId: ra });
    const inp = (ra: string) => ({ availabilityId: AV, requesterActorId: ra } as any);

    // 1) subject VÁLIDO (RU representa R) → cria
    let created = '';
    try { const b = await unifiedAvailabilityService.createBooking(TENANT, sub(RU, R), inp(R)); created = b.status; } catch (e: any) { created = `THROW:${e?.message}`; }
    ok(created === 'requested', `1. subject válido {subjectUserId=user_id, requesterActorId=R} → cria (${created})`);

    // 2) subjectUserId = ACTORID (R) em vez de user_id → fail-closed
    ok((await threw(() => unifiedAvailabilityService.createBooking(TENANT, sub(R, R), inp(R)), /BOOKING_SUBJECT_NOT_AUTHORIZED/)) === 'OK', `2. subjectUserId = actorId → BOOKING_SUBJECT_NOT_AUTHORIZED`);

    // 3) subjectUserId = GLOBAL_USER_ID (RG) em vez de user_id → fail-closed
    ok((await threw(() => unifiedAvailabilityService.createBooking(TENANT, sub(RG, R), inp(R)), /BOOKING_SUBJECT_NOT_AUTHORIZED/)) === 'OK', `3. subjectUserId = global_user_id → BOOKING_SUBJECT_NOT_AUTHORIZED`);

    // 4) requester divergente: subject.requesterActorId=R, input.requesterActorId=X → mismatch
    ok((await threw(() => unifiedAvailabilityService.createBooking(TENANT, sub(RU, R), inp(X)), /BOOKING_SUBJECT_REQUESTER_MISMATCH/)) === 'OK', `4. input.requesterActorId ≠ subject → BOOKING_SUBJECT_REQUESTER_MISMATCH`);

    // 5) subject ausente/vazio → required
    ok((await threw(() => unifiedAvailabilityService.createBooking(TENANT, sub('', R), inp(R)), /BOOKING_SUBJECT_REQUIRED/)) === 'OK', `5. subjectUserId vazio → BOOKING_SUBJECT_REQUIRED`);

    // 6) zero dinheiro
    ok((await count()) === ledgerBefore, `6. zero escrita em bank_ledger (Δ=${(await count()) - ledgerBefore})`);
  } finally {
    await c.query(`DELETE FROM bookings WHERE availability_id=$1`, [AV]).catch(() => {});
    await c.query(`DELETE FROM availability WHERE availability_id=$1`, [AV]).catch(() => {});
    c.release();
    console.log('\n=== TEARDOWN ok ===');
  }
  console.log(`\n=== RESULTADO: ${fails.length === 0 ? 'BOOKING SUBJECT AUTHORITY OK ✅ (core revalida; zero dinheiro)' : 'FALHAS: ' + fails.length} ===`);
  await pool.end().catch(() => {});
  process.exit(fails.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
