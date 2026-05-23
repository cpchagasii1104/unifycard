// Script CIRURGICO de energização do circuito operacional minimo.
// Atravessa 5 elos (createMember staff -> delegation auto -> availability page-owned
// -> booking -> confirm -> checkIn -> checkOut) usando services reais.
//
// Reversibilidade: todas rows criadas tem metadata.test_energization = 'energization_2026_05_17'.
// DELETE via WHERE metadata->>'test_energization' = 'energization_2026_05_17' em cada tabela.
//
// NAO toca bank_*, ledger. NAO usa context='event_ticket' ou 'service_booking'.
// Booking simples sem split engine.

import 'dotenv/config';
import { companyMembersService } from '../src/core/companies/company-members.service';
import { CompanyMemberRole, CompanyMemberStatus } from '../src/core/companies/company-members.types';
import { unifiedAvailabilityService } from '../src/core/availability/unified-availability.service';
import { UnifiedBookingStatus } from '../src/core/availability/unified-availability.types';
import type { AvailabilityOwnerType } from '../src/core/availability/unified-availability.types';
import { pool } from '../src/core/database/pool';
import { socialPortsRegistry } from '../src/core/social/ports-registry';

// Bootstrap minimo: injetar adapters do social no registry (mesma logica do app.builder)
async function bootstrap() {
  const {
    actorRepositoryAdapter,
    actorUtilsAdapter,
    socialRepositoryAdapter,
    socialServiceAdapter,
    eventFeedHandlersAdapter,
  } = await import('../src/modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);
}

const TENANT = 'fbe13b78-4516-493d-905a-363796aea1d1'; // Clínica Sorrisos tenant
const COMPANY = '3b895bb8-9bf8-4a36-9164-fb54923bbd16'; // Clínica Sorrisos
const PAGE_ACTOR = 'ad5a60b7-7ea1-4d79-a7f4-4c86438ea73a'; // page actor da clínica
const OWNER_USER = 'a733e66f-b8bd-4bd2-a888-bec820f55339'; // dono (admin que convida)
const STAFF_ACTOR = '751a4fe0-2f33-4053-bfa8-3dcad39b3b30'; // user externo (dentista)
const STAFF_USER_ID = 'beb7b5e4-2d22-4782-83c9-6e006da53713'; // user_id correspondente

const TEST_MARKER = 'energization_2026_05_17';

async function main() {
  await bootstrap();
  console.log('=== ENERGIZAÇÃO CIRÚRGICA DO CIRCUITO OPERACIONAL ===');
  console.log(`Tenant: ${TENANT}`);
  console.log(`Company: Clínica Sorrisos (${COMPANY})`);
  console.log(`Owner (admin): user=${OWNER_USER}`);
  console.log(`Staff convidado: user=${STAFF_USER_ID}, actor=${STAFF_ACTOR}`);
  console.log(`Marker reversibilidade: metadata.test_energization='${TEST_MARKER}'`);
  console.log('');

  // ELO 1: criar member staff
  console.log('[ELO 1] createMember(role=staff, status=active)');
  const member = await companyMembersService.createMember(TENANT, OWNER_USER, {
    companyId: COMPANY,
    actorId: STAFF_ACTOR,
    role: CompanyMemberRole.STAFF,
    status: CompanyMemberStatus.ACTIVE,
    metadata: { test_energization: TEST_MARKER },
  });
  console.log(`  OK memberId=${member.memberId} role=${member.role} status=${member.status}`);

  // ELO 2: verificar delegação auto-criada
  console.log('[ELO 2] verificar actor_delegations row criada automaticamente');
  const delegations = await pool.query<{
    delegation_id: string;
    scopes_json: any;
    status: string;
  }>(
    `SELECT delegation_id, scopes_json, status FROM actor_delegations
     WHERE tenant_id = $1 AND user_actor_id = $2 AND institutional_actor_id = $3`,
    [TENANT, STAFF_ACTOR, PAGE_ACTOR]
  );
  if (delegations.rows.length === 0) {
    throw new Error('ELO 2 FALHOU: delegation nao foi criada automaticamente');
  }
  console.log(`  OK delegationCount=${delegations.rows.length} scopes=${JSON.stringify(delegations.rows[0].scopes_json)} status=${delegations.rows[0].status}`);

  // ELO 3: createAvailability page-owned (primeira do tipo em runtime)
  console.log('[ELO 3] createAvailability(owner_type=page, owner_id=clinica_actor)');
  const now = new Date();
  const start = new Date(now.getTime() + 86400000); // +1 dia
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 3600000); // +1h
  const availability = await unifiedAvailabilityService.createAvailability(TENANT, OWNER_USER, {
    ownerType: 'page' as AvailabilityOwnerType,
    ownerId: PAGE_ACTOR,
    startDatetime: start,
    endDatetime: end,
    metadata: { test_energization: TEST_MARKER, scenario: 'clinica_consulta' },
  });
  console.log(`  OK availabilityId=${availability.availabilityId} owner=${availability.ownerType}/${availability.ownerId} window=${start.toISOString()}..${end.toISOString()}`);

  // ELO 4: createBooking (requester=staff actuando como representante)
  console.log('[ELO 4] createBooking(requester=staff)');
  const booking = await unifiedAvailabilityService.createBooking(TENANT, OWNER_USER, {
    availabilityId: availability.availabilityId,
    requesterActorId: STAFF_ACTOR,
    metadata: { test_energization: TEST_MARKER },
  });
  console.log(`  OK bookingId=${booking.bookingId} status=${booking.status}`);

  // ELO 4b: confirm booking
  console.log('[ELO 4b] updateBooking -> CONFIRMED');
  const confirmedBooking = await unifiedAvailabilityService.updateBooking(TENANT, booking.bookingId, OWNER_USER, {
    status: UnifiedBookingStatus.CONFIRMED,
    metadata: { test_energization: TEST_MARKER },
  });
  console.log(`  OK status=${confirmedBooking.status}`);

  // ELO 5: checkIn
  console.log('[ELO 5] checkIn');
  const checkedIn = await unifiedAvailabilityService.checkIn(TENANT, booking.bookingId, OWNER_USER, {
    metadata: { test_energization: TEST_MARKER },
  });
  console.log(`  OK status=${checkedIn.status} checkedInAt=${checkedIn.checkedInAt}`);

  // ELO 5b: checkOut
  console.log('[ELO 5b] checkOut');
  const checkedOut = await unifiedAvailabilityService.checkOut(TENANT, booking.bookingId, OWNER_USER, {
    metadata: { test_energization: TEST_MARKER },
  });
  console.log(`  OK status=${checkedOut.status} checkedOutAt=${checkedOut.checkedOutAt}`);

  console.log('');
  console.log('=== CIRCUITO FECHADO ===');
  console.log(`memberId: ${member.memberId}`);
  console.log(`delegationCount: ${delegations.rows.length}`);
  console.log(`availabilityId: ${availability.availabilityId}`);
  console.log(`bookingId: ${booking.bookingId}`);
  console.log(`Final booking status: ${checkedOut.status}`);
  console.log('');
  console.log('Reverter: DELETE FROM <tabela> WHERE metadata->>\'test_energization\'=\'' + TEST_MARKER + '\'');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('');
    console.error('=== FALHA ===');
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
