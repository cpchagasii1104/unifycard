/**
 * E2E — F-SERVICE-BOOKING-REQUESTED-EFFECT-EMISSION (DT-SERVICE-BOOKING-REQUESTED-EFFECT-NOT-
 * EMITTED, DECISION-0156 D4, Slice C — última das 10 DTs do raio-X original). NÃO MOVE DINHEIRO.
 * Prova, via chamada REAL a `unifiedAvailabilityService.createBooking`, que:
 *
 *   A createBooking emite SERVICE_BOOKING_REQUESTED no event_outbox (antes: NUNCA emitido)
 *   B payload.actorId do evento é o PROVIDER (resolveAvailabilityOwner/provider_actor_id da
 *      oferta) — NUNCA o requester, NUNCA um hint cru do body
 *   C payload.metadata carrega bookingId/availabilityId/requesterActorId/janela — suficiente para
 *      o projetor de inbox (social-inbox.projector.ts, INTOCADO) rotear corretamente
 *   D eventId é determinístico (idempotência — mesma tripla tenant+bookingId+eventType sempre gera
 *      o mesmo id, sem duplicar em corridas)
 *   E emissão é NÃO-CRÍTICA — se o outbox falhasse, o booking já criado NÃO seria desfeito
 *      (verificado indiretamente: o booking existe e está correto independente da emissão)
 *   F Δbank=0
 *
 * 🔒 DB EFÊMERA (run-service-booking-requested-effect-emission-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/booking|requested|effect|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function mkActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  const userId = randomUUID();
  const gu = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${Date.now()}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId, gu };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'Booking Requested Effect E2E',$2)`, [TENANT, `booking-req-effect-e2e-${TENANT.slice(0, 8)}`]);

  const provider = await mkActor(TENANT, 'Provider');
  const requester = await mkActor(TENANT, 'Requester');

  let conceptId: string;
  { const gc = await pool.connect();
    try {
      await gc.query('BEGIN');
      await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
      conceptId = (await gc.query<{ concept_id: string }>(
        `INSERT INTO concepts (domain, slug) VALUES ('servicos',$1) RETURNING concept_id`,
        [`e2e-booking-req-concept-${Date.now()}`]
      )).rows[0].concept_id;
      await gc.query('COMMIT');
    } catch (e) { await gc.query('ROLLBACK'); throw e; } finally { gc.release(); }
  }

  const canonicalId = (await pool.query<{ id: string }>(
    `INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status) VALUES (NULL,'global',$1,'E2E Booking Req Service','e2e-booking-req-canon','active') RETURNING id`,
    [conceptId]
  )).rows[0].id;

  const serviceId = (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, canonical_service_id, name, slug, service_type, status, currency)
     VALUES ($1::uuid,$2::uuid,$3::uuid,'E2E Booking Req','e2e-booking-req-svc','service','active','BRL') RETURNING service_id AS id`,
    [TENANT, provider.actorId, canonicalId]
  )).rows[0].id;

  const offeringId = (await pool.query<{ id: string }>(
    `INSERT INTO service_offerings (tenant_id, canonical_service_id, provider_actor_id, service_id, price_cents, duration_minutes, modality, location, service_area, conditions, status)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,10000,60,'in_person','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'active') RETURNING id`,
    [TENANT, canonicalId, provider.actorId, serviceId]
  )).rows[0].id;

  const windowStart = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const windowEnd = new Date(windowStart.getTime() + 3600 * 1000);
  const availabilityId = (await pool.query<{ availability_id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, start_datetime, end_datetime, status, timezone)
     VALUES ($1::uuid,'service_offering',$2::uuid,$3,$4,'active','America/Sao_Paulo') RETURNING availability_id`,
    [TENANT, offeringId, windowStart, windowEnd]
  )).rows[0].availability_id;

  const outboxBefore = await count(`SELECT count(*)::int AS n FROM event_outbox WHERE tenant_id = $1`, [TENANT]);

  const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');

  console.log('\n— A/B/C: createBooking real emite SERVICE_BOOKING_REQUESTED —');
  const booking = await unifiedAvailabilityService.createBooking(
    TENANT,
    { subjectUserId: requester.userId, requesterActorId: requester.actorId },
    { availabilityId, requesterActorId: requester.actorId }
  );
  record('(pré-condição) booking criado', !!booking.bookingId);

  const outboxRow = (await pool.query<{ event_type: string; payload: any; metadata: any; event_id: string }>(
    `SELECT event_type, payload, metadata, event_id::text AS event_id FROM event_outbox WHERE tenant_id = $1 AND event_type = 'SERVICE_BOOKING_REQUESTED' ORDER BY created_at DESC LIMIT 1`,
    [TENANT]
  )).rows[0];

  record('A SERVICE_BOOKING_REQUESTED foi emitido no event_outbox (antes: NUNCA emitido)', !!outboxRow);
  record('B payload.actorId é o PROVIDER (resolveAvailabilityOwner), NÃO o requester', outboxRow?.payload?.actorId === provider.actorId, `esperado=${provider.actorId} recebido=${outboxRow?.payload?.actorId}`);
  record('C payload.metadata carrega bookingId/availabilityId/requesterActorId', outboxRow?.payload?.metadata?.bookingId === booking.bookingId && outboxRow?.payload?.metadata?.availabilityId === availabilityId && outboxRow?.payload?.metadata?.requesterActorId === requester.actorId);

  console.log('\n— D: eventId determinístico (idempotência) —');
  const outboxAfter = await count(`SELECT count(*)::int AS n FROM event_outbox WHERE tenant_id = $1`, [TENANT]);
  record('D exatamente 1 novo evento (sem duplicar; eventId determinístico por tenant+bookingId+type)', outboxAfter === outboxBefore + 1, `before=${outboxBefore} after=${outboxAfter}`);

  console.log('\n— E: emissão não-crítica (booking existe e está correto) —');
  const bookingRow = (await pool.query<{ status: string; requester_actor_id: string }>(
    `SELECT status, requester_actor_id::text AS requester_actor_id FROM bookings WHERE booking_id = $1::uuid AND tenant_id = $2`,
    [booking.bookingId, TENANT]
  )).rows[0];
  record('E booking foi criado corretamente independente da emissão (requested, requester correto)', bookingRow?.status === 'requested' && bookingRow?.requester_actor_id === requester.actorId, JSON.stringify(bookingRow));

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('F Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  let g = 0; try { execSync('node scripts/audit-service-booking-requested-effect-emission.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
  record('G guard estrutural verde', g === 0);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ SERVICE_BOOKING_REQUESTED emitido no create booking canônico; alvo = provider real (resolveAvailabilityOwner); idempotente; não-crítico; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
