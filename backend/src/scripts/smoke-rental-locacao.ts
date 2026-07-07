import { pool } from '@core/database/pool';
import { rentableResourceService } from '@modules/rentals/rentable-resource.service';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';

async function main() {
  // DI dos ports sociais (padrão dos smokes standalone)
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const t = await pool.query(`SELECT id::text FROM tenants WHERE slug='unificard-inicial'`);
  const tenantId = t.rows[0].id;
  const u = await pool.query(`SELECT user_id::text FROM users WHERE email='dev@unificard.local'`);
  const devUserId = u.rows[0].user_id;
  const a = await pool.query(`SELECT a.id::text FROM actors a JOIN users u ON u.user_id=a.user_id WHERE u.email='dev@unificard.local' AND a.actor_type='user'`);
  const devPF = a.rows[0].id;
  const c = await pool.query(`SELECT concept_id::text FROM concepts WHERE slug='jardinagem'`);

  const r = await rentableResourceService.create(tenantId, devPF, {
    conceptId: c.rows[0].concept_id, resourceType: 'equipment',
    label: 'Betoneira 400L (smoke)', description: null,
    pricingUnit: 'por_dia', priceCents: 15000,
  } as any);
  console.log('✅ recurso criado c/ cobrança:', r.pricingUnit, r.priceCents);

  const w = await unifiedAvailabilityService.createAvailability(tenantId, devUserId, {
    ownerType: 'rentable_resource' as any, ownerId: r.id,
    startDatetime: '2026-08-10T08:00:00', endDatetime: '2026-08-12T18:00:00',
  } as any);
  console.log('✅ janela na Agenda universal criada');
  const w2 = await unifiedAvailabilityService.createAvailability(tenantId, devUserId, {
    ownerType: 'rentable_resource' as any, ownerId: r.id,
    startDatetime: '2026-08-11T08:00:00', endDatetime: '2026-08-13T18:00:00',
  } as any);
  const cl = await pool.query(`SELECT a.id::text FROM actors a JOIN users u ON u.user_id=a.user_id WHERE u.email='cpchagasii@hotmail.com' AND a.actor_type='user'`);
  const clayPF = cl.rows[0].id;
  const clu = await pool.query(`SELECT user_id::text FROM users WHERE email='cpchagasii@hotmail.com'`);
  const subject = { subjectUserId: clu.rows[0].user_id, requesterActorId: clayPF };
  const b1 = await unifiedAvailabilityService.createBooking(tenantId, subject, { availabilityId: (w as any).id ?? (w as any).availabilityId, requesterActorId: clayPF } as any);
  await unifiedAvailabilityService.updateBooking(tenantId, (b1 as any).id ?? (b1 as any).bookingId, clu.rows[0].user_id, { status: 'confirmed' } as any);
  console.log('✅ reserva 1 CONFIRMADA (recurso ocupado 10-12/08)');
  const b2 = await unifiedAvailabilityService.createBooking(tenantId, subject, { availabilityId: (w2 as any).id ?? (w2 as any).availabilityId, requesterActorId: clayPF } as any);
  try {
    await unifiedAvailabilityService.updateBooking(tenantId, (b2 as any).id ?? (b2 as any).bookingId, clu.rows[0].user_id, { status: 'confirmed' } as any);
    console.log('❌ DUPLO-ALUGUEL PASSOU (falha!)');
  } catch (e: any) {
    console.log('✅ duplo-aluguel BARRADO:', (e.message || '').slice(0, 90));
  }
  await pool.query(`DELETE FROM bookings WHERE tenant_id=$1 AND availability_id IN (SELECT availability_id FROM availability WHERE owner_type='rentable_resource' AND owner_id=$2)`, [tenantId, r.id]);


  // limpeza
  await pool.query(`DELETE FROM unified_availability WHERE owner_type='rentable_resource' AND owner_id=$1`, [r.id]).catch(()=>pool.query(`DELETE FROM availability WHERE owner_type='rentable_resource' AND owner_id=$1`, [r.id]));
  await pool.query(`DELETE FROM rentable_resources WHERE id=$1`, [r.id]);
  const bank = await pool.query(`SELECT count(*)::int n FROM bank_ledger`);
  console.log('✅ Δbank check — linhas:', bank.rows[0].n);
  await pool.end();
}
main().catch((e) => { console.error('SMOKE FAIL:', e.message); process.exit(1); });
