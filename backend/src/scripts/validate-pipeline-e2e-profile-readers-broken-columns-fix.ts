/**
 * E2E — F-PROFILE-READERS-BROKEN-COLUMNS-FIX (DT-PROFILE-PENDING-IMPACT-READERS-BROKEN-COLUMNS).
 * NÃO MOVE DINHEIRO. Prova END-TO-END (HTTP real via app.inject) que os readers de perfil
 * pending-responsibilities e impact-overview PARARAM de quebrar por colunas inexistentes:
 * groups usa PK `id` (não group_id), dono vivo `owner_actor_id` (owner_user_id nunca existiu),
 * `status` 'active'/'inactive' (não is_active), financial_purpose vive em metadata;
 * service_payment_requests usa `requested_at` (não requestedAt camelCase cru).
 *
 *   A GET /me/pending-responsibilities → 200 (antes: 500 por 42703)
 *   B pendingGroups: grupo inativo + grupo com intenção financeira sem finalidade (contrato preservado)
 *   C pendingBookings: user IN + service_offering IN + group IN; legado owner_type='service' OUT
 *   D pendingServices: serviço contado via oferta canônica (branch A2e preservado)
 *   E pendingPayments: payment pendente com requestedAt ISO (requested_at vivo)
 *   F GET /me/impact-overview → 200 (antes: 500)
 *   G peopleWaiting = membros de grupo inativo + requesters distintos (user+oferta+group; legado OUT)
 *   H activeGroups conta grupos status='active'
 *   I drift owner_type='service' continua EXCLUÍDO (booking legado não vaza em nenhum reader)
 *   J Δbank=0 · K guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-profile-readers-broken-columns-fix-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const FUTURE_START = '2026-12-12T12:00:00Z';
const FUTURE_END = '2026-12-12T13:00:00Z';

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/profile|readers|fix|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq * 17).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
}
async function mkGroup(tenantId: string, ownerActorId: string, name: string, status: 'active' | 'inactive', metadata: object = {}): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(`INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status, metadata) VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6::jsonb) RETURNING id::text AS id`, [tenantId, name, `${name.toLowerCase()}-${seq}`, ownerActorId, status, JSON.stringify(metadata)])).rows[0].id;
}
async function mkService(tenantId: string, ownerActorId: string, name: string, canonicalServiceId: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(`INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, service_type, status, currency) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,'service','active','BRL') RETURNING service_id::text AS id`, [tenantId, ownerActorId, name, `${name.toLowerCase()}-${seq}`, canonicalServiceId])).rows[0].id;
}
async function mkOffering(tenantId: string, providerActorId: string, canonicalServiceId: string, serviceId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO service_offerings (tenant_id, canonical_service_id, provider_actor_id, service_id, price_cents, duration_minutes, modality, location, service_area, conditions, status)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,5000,60,'in_person','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'active') RETURNING id::text AS id`,
    [tenantId, canonicalServiceId, providerActorId, serviceId]
  )).rows[0].id;
}
async function mkAvailability(tenantId: string, ownerType: 'service' | 'service_offering' | 'user' | 'group', ownerId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
       VALUES ($1::uuid,$2,$3::uuid,'fixed','active',$4,$5,'America/Sao_Paulo',1,'{}'::jsonb) RETURNING availability_id::text AS id`,
    [tenantId, ownerType, ownerId, new Date(FUTURE_START), new Date(FUTURE_END)]
  )).rows[0].id;
}
async function mkBooking(tenantId: string, availabilityId: string, requesterActorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3::uuid,'requested','{}'::jsonb,NOW(),NOW(),NOW()) RETURNING booking_id::text AS id`, [tenantId, availabilityId, requesterActorId])).rows[0].id;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Profile Readers Broken Columns Fix', slug: `prbcf-${Date.now()}` });
  const canonicalServiceId = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 1`)).rows[0]?.id;
  if (!canonicalServiceId) throw new Error('Sem canonical_services no banco efêmero.');

  const alice = await mkUserActor(TENANT, 'Alice');     // dona dos grupos / provider
  const c1 = await mkUserActor(TENANT, 'Cust1');        // requester oferta canônica
  const c2 = await mkUserActor(TENANT, 'Cust2');        // requester group
  const c3 = await mkUserActor(TENANT, 'Cust3');        // requester user
  const cLeg = await mkUserActor(TENANT, 'CustLeg');    // requester SÓ do legado (deve ficar de fora)
  const member = await mkUserActor(TENANT, 'Member1');  // membro do grupo inativo

  // Grupos de Alice: 1 inativo (pendência + membros aguardando) · 1 ativo c/ intenção financeira sem finalidade
  // (pendência needsFinancialPurpose) · 1 ativo simples (só activeGroups).
  const gInactive = await mkGroup(TENANT, alice.actorId, 'GrpInativo', 'inactive');
  const gFin = await mkGroup(TENANT, alice.actorId, 'GrpFinanceiro', 'active', { hasFinancialIntent: true });
  const gPlain = await mkGroup(TENANT, alice.actorId, 'GrpAtivo', 'active');
  await pool.query(`INSERT INTO group_members (tenant_id, group_id, user_id, role) VALUES ($1::uuid,$2::uuid,$3::uuid,'member')`, [TENANT, gInactive, member.userId]);

  // Serviço + oferta canônica de Alice; bookings requested nos 4 eixos (offering/user/group/legado).
  const serviceId = await mkService(TENANT, alice.actorId, 'SvcAlice', canonicalServiceId);
  const offeringId = await mkOffering(TENANT, alice.actorId, canonicalServiceId, serviceId);
  const availOff = await mkAvailability(TENANT, 'service_offering', offeringId);
  const bookingOff = await mkBooking(TENANT, availOff, c1.actorId);
  const availUser = await mkAvailability(TENANT, 'user', alice.actorId);
  const bookingUser = await mkBooking(TENANT, availUser, c3.actorId);
  const availGrp = await mkAvailability(TENANT, 'group', gInactive);
  const bookingGrp = await mkBooking(TENANT, availGrp, c2.actorId);
  const availLeg = await mkAvailability(TENANT, 'service', serviceId); // LEGADO — deve ficar FORA
  const bookingLeg = await mkBooking(TENANT, availLeg, cLeg.actorId);

  // Eventos de Alice (schema vivo actor-first): 1 draft sem datas (pendente) + 1 published já passado
  // (pendente, com 1 attendee aguardando) — prova actor_id/datetime_start/datetime_end vivos.
  const evDraft = (await pool.query<{ id: string }>(
    `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status) VALUES ($1::uuid,$2::uuid,'user','general','Ev Draft','draft') RETURNING id::text AS id`,
    [TENANT, alice.actorId]
  )).rows[0].id;
  const evPast = (await pool.query<{ id: string }>(
    `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, datetime_start, datetime_end) VALUES ($1::uuid,$2::uuid,'user','general','Ev Past','published', now() - interval '2 hours', now() - interval '1 hour') RETURNING id::text AS id`,
    [TENANT, alice.actorId]
  )).rows[0].id;
  const attendeeGu = (await pool.query<{ gu: string }>(`SELECT global_user_id::text AS gu FROM users WHERE user_id=$1`, [member.userId])).rows[0].gu;
  await pool.query(`INSERT INTO event_attendees (tenant_id, event_id, global_user_id, status) VALUES ($1::uuid,$2::uuid,$3::uuid,'registered')`, [TENANT, evPast, attendeeGu]);

  // Payment request pendente (payer = Alice) — prova requested_at vivo no pendingPayments.
  await pool.query(
    `INSERT INTO service_payment_requests (tenant_id, booking_id, service_id, payer_actor_id, receiver_actor_id, payment_request_status, amount_cents, currency, requested_at)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'pending',5000,'BRL',NOW())`,
    [TENANT, bookingOff, serviceId, alice.actorId, c1.actorId]
  );

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const pendingRoutes = (await import('../core/profile/pending-responsibilities.routes')).default;
  const impactRoutes = (await import('../core/profile/impact-overview.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { userId: req.headers['x-test-user-id'], id: req.headers['x-test-user-id'] };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: req.headers['x-test-actor-id'], intent: 'e2e', source: 'e2e', scope: 'e2e' };
  });
  await app.register(pendingRoutes);
  await app.register(impactRoutes);
  await app.ready();
  const get = (url: string) => app.inject({ method: 'GET', url, headers: { 'x-test-user-id': alice.userId, 'x-test-actor-id': alice.actorId } });

  try {
    console.log('\n— pending-responsibilities END-TO-END —');
    const pr = await get('/me/pending-responsibilities');
    record('A GET /me/pending-responsibilities → 200 (antes: 500 por coluna inexistente)', pr.statusCode === 200, `status=${pr.statusCode}: ${pr.body.slice(0, 200)}`);
    const prBody = pr.statusCode === 200 ? JSON.parse(pr.body) : {};

    const groupIds = new Set((prBody.pendingGroups ?? []).map((g: any) => g.id));
    const gFinRow = (prBody.pendingGroups ?? []).find((g: any) => g.id === gFin);
    const gInactiveRow = (prBody.pendingGroups ?? []).find((g: any) => g.id === gInactive);
    record('B pendingGroups: inativo IN (status inactive) + financeiro-sem-finalidade IN (needsFinancialPurpose) + ativo simples OUT',
      groupIds.has(gInactive) && groupIds.has(gFin) && !groupIds.has(gPlain)
      && gInactiveRow?.status === 'inactive' && gFinRow?.needsFinancialPurpose === true,
      `groups=${JSON.stringify(prBody.pendingGroups)}`);

    const bookingIds = new Set((prBody.pendingBookings ?? []).map((b: any) => b.id));
    record("C pendingBookings: user IN + service_offering IN + group IN; legado owner_type='service' OUT",
      bookingIds.has(bookingUser) && bookingIds.has(bookingOff) && bookingIds.has(bookingGrp) && !bookingIds.has(bookingLeg),
      `user=${bookingIds.has(bookingUser)} off=${bookingIds.has(bookingOff)} grp=${bookingIds.has(bookingGrp)} legado=${bookingIds.has(bookingLeg)}`);

    const svcRow = (prBody.pendingServices ?? []).find((s: any) => s.id === serviceId);
    record('D pendingServices: serviço contado via oferta canônica (A2e preservado)', !!svcRow && svcRow.pendingBookingsCount === 1, `services=${JSON.stringify(prBody.pendingServices)}`);

    const payRow = (prBody.pendingPayments ?? [])[0];
    record('E pendingPayments: payment pendente com requestedAt ISO (requested_at vivo) e amountCents',
      (prBody.pendingPayments ?? []).length === 1 && typeof payRow?.requestedAt === 'string' && !Number.isNaN(Date.parse(payRow.requestedAt)) && Number(payRow?.amountCents) === 5000,
      `payments=${JSON.stringify(prBody.pendingPayments)}`);

    const eventIds = new Set((prBody.pendingEvents ?? []).map((e: any) => e.id));
    record('E2 pendingEvents: draft (sem datas, null-safe) + published passado IN (actor_id/datetime_* vivos)',
      eventIds.has(evDraft) && eventIds.has(evPast),
      `events=${JSON.stringify(prBody.pendingEvents)}`);

    console.log('\n— impact-overview END-TO-END —');
    const io = await get('/me/impact-overview');
    record('F GET /me/impact-overview → 200 (antes: 500 por coluna inexistente)', io.statusCode === 200, `status=${io.statusCode}: ${io.body.slice(0, 200)}`);
    const ioBody = io.statusCode === 200 ? JSON.parse(io.body) : {};

    // peopleWaiting = attendee do evento pendente (1) + membro de grupo inativo (1) + requesters distintos
    // user/oferta/group (c1,c2,c3=3); legado (cLeg) FORA. eventsAffected = draft + published-passado = 2.
    record('G peopleWaiting = 5 (1 attendee + 1 membro grupo inativo + 3 requesters); legado FORA · eventsAffected = 2',
      ioBody?.pendingImpact?.peopleWaiting === 5 && ioBody?.pendingImpact?.eventsAffected === 2,
      `pendingImpact=${JSON.stringify(ioBody?.pendingImpact)}`);
    record("H activeGroups = 2 (status='active')", ioBody?.neutralImpact?.activeGroups === 2, `neutralImpact=${JSON.stringify(ioBody?.neutralImpact)}`);

    // I drift excluído também no dado: booking legado preservado no DB, mas fora dos readers (C e G já provam nos payloads).
    const legPreserved = (await count(`SELECT count(*)::int AS n FROM availability WHERE availability_id=$1 AND owner_type='service'`, [availLeg])) === 1;
    record("I drift owner_type='service' EXCLUÍDO dos readers e dado legado PRESERVADO (contenção ≠ deleção)", legPreserved && !bookingIds.has(bookingLeg));

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('J Δbank=0 (bank_ledger+bank_transactions inalterados)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    let g = 0; try { execSync('node scripts/audit-provider-availability-readers-canonical.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
    record('K guard estrutural verde (A2e + broken-columns ampliado)', g === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ pending-responsibilities + impact-overview rodam END-TO-END (200): colunas vivas (id/owner_actor_id/status/metadata/requested_at); branches user/offering/group vivos; drift owner_type=service segue excluído; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
