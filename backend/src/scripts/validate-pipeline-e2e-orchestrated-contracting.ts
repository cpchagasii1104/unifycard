/**
 * E2E — F-ORCHESTRATED-CONTRACTING (C3). Fecha o loop propose→accept→BIND por API DIRETA (camada de serviço
 * REAL — "a verdade vive no backend"). O ORGANIZADOR descobre a banda (real discoverServices) e RESERVA amarrando
 * a reserva ao SEU evento (context={eventId, configId}); no CONFIRM (chokepoint ÚNICO) o PERFORMER (o PROVIDER da
 * oferta, DERIVADO server-side — nunca o requester) é VINCULADO ao ELENCO via o writer SELADO createCommitment.
 * Bank-free (Δbank=0; porta-01 FORA). DB efêmera. NUNCA unificard_dev.
 *
 * OITO PROVAS:
 *  (1) aceita-direto amarra automaticamente: discover por gênero+data+audiência → requestBooking(context) em oferta
 *      automatic+dentro-do-alcance → confirmed autoConfirmed=true E NOVA linha event_staff (responsible_actor_id=PROVIDER,
 *      role='artist', source='v2') para aquele eventId. (Prova ANTI-HOLLOW: o bind ACONTECEU de fato.)
 *  (2) negocia fecha ao evento: oferta manual → requested, SEM elenco ainda → banda confirma (owner-only updateBooking)
 *      → linha de elenco AGORA aparece (mesmo chokepoint dispara).
 *  (3) distância-fora → negocia: automatic mas raio excedido → requested, sem elenco.
 *  (4) idempotência: replay do bind → EXATAMENTE UMA linha event_staff.
 *  (5) provider não é requester: o actor vinculado é o PROVIDER; o requester (organizador) NÃO é vinculado.
 *  (6) contenção intacta / sem porta-01: zero linhas de service_payment_request no loop; acceptQuote ainda 403.
 *  (7) validação de config: configId de OUTRA oferta → rejeitado no propose.
 *  (8) Δbank=0.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { serviceOfferingConfigService } from '../modules/services/service-offering-config.service';
import { unifiedAvailabilityService } from '../core/availability/unified-availability.service';
import { bindConfirmedPerformerToEvent } from '../core/availability/performer-event-binding';
import { actorActiveLocationRepository } from '../core/location/actor-active-location.repository';
import { UnifiedBookingStatus } from '../core/availability/unified-availability.types';
import { ServiceType, ServiceStatus } from '../modules/services/services.types';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${reason ? ` — ${reason}` : ''}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/orchestrated|contracting|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 71).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `orch-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, userId, gu]
  )).rows[0].id;
  return { userId, actorId };
}

// Evento pertencente ao ORGANIZADOR (actor 'user'). O organizador tem manage_attendees sobre o próprio actor
// (ownership) — a mesma chave exigida pelo POST /events/:id/v2/commitments (EDGE C-1).
async function mkEvent(tenantId: string, ownerActorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, timezone, created_at, updated_at)
     VALUES (gen_random_uuid(),$1::uuid,$2::uuid,'user','social','Festival da Praça','published','UTC',NOW(),NOW()) RETURNING id::text AS id`,
    [tenantId, ownerActorId]
  )).rows[0].id;
}

function resolveSeed(): Promise<{ conceptId: string; canonicalId: string; genreRock: string; genreFunk: string }> {
  return (async () => {
    const seed = (await pool.query<{ concept_id: string; canonical_id: string }>(
      `SELECT c.concept_id::text AS concept_id, cs.id::text AS canonical_id
         FROM concepts c
         JOIN canonical_services cs ON cs.concept_id=c.concept_id AND cs.tenant_id IS NULL AND cs.scope='global' AND cs.status='active'
         JOIN concept_offer_kinds k ON k.concept_id=c.concept_id AND k.offer_kind='service'
        WHERE c.slug='apresentacao-musical'`
    )).rows[0];
    if (!seed) throw new Error('concept apresentacao-musical governado ausente.');
    const genres = (await pool.query<{ slug: string; concept_id: string }>(
      `SELECT c.slug, c.concept_id::text AS concept_id
         FROM concepts c JOIN shared_subject_concepts ssc ON ssc.concept_id=c.concept_id AND ssc.enabled=true
        WHERE c.slug IN ('rock','funk')`
    )).rows;
    const g = Object.fromEntries(genres.map((r) => [r.slug, r.concept_id])) as Record<string, string>;
    if (!g.rock || !g.funk) throw new Error('gêneros governados rock/funk ausentes.');
    return { conceptId: seed.concept_id, canonicalId: seed.canonical_id, genreRock: g.rock, genreFunk: g.funk };
  })();
}

/** Publica uma banda (actor 'user' auto-representável) com política + faixa de público + gênero taggeado. */
async function publishBand(
  tenantId: string,
  band: { userId: string; actorId: string },
  name: string,
  seed: { conceptId: string; canonicalId: string },
  cityId: string,
  genreId: string,
  policy: { bookingApprovalMode: 'manual' | 'automatic'; acceptDirectRadiusKm?: number | null }
): Promise<{ serviceId: string; offeringId: string }> {
  await professionalC1Service.declareConcept(tenantId, band.actorId, { conceptId: seed.conceptId, skillLevel: 3 }, band.userId);
  const service = await servicesService.createService(tenantId, band.userId, {
    actorId: band.actorId, name, serviceType: ServiceType.SERVICE, status: ServiceStatus.ACTIVE,
    canonicalServiceId: seed.canonicalId, cityId,
  });
  const { offering } = await serviceOfferingService.createOffering({
    tenantId, userId: band.userId, providerActorId: band.actorId,
    canonicalServiceId: seed.canonicalId, priceCents: 250000, durationMinutes: 90,
    bookingApprovalMode: policy.bookingApprovalMode,
    acceptDirectSameCity: false,
    acceptDirectRadiusKm: policy.acceptDirectRadiusKm ?? null,
    audienceMin: 20, audienceMax: 5000,
  } as any);
  await serviceOfferingService.updateOwnOffering({ tenantId, userId: band.userId, offeringId: offering.id, status: 'active' });
  await serviceOfferingService.tagOfferingGenres({ tenantId, userId: band.userId, offeringId: offering.id, subjectConceptIds: [genreId] });
  return { serviceId: service.serviceId, offeringId: offering.id };
}

const setLoc = (tenantId: string, actorId: string, lat: number, lng: number): Promise<unknown> =>
  actorActiveLocationRepository.setActive(tenantId, actorId, { lat, lng, source: 'USER_INPUT_CITY' } as any);

const elencoRows = async (tenantId: string, eventId: string): Promise<Array<{ responsible_actor_id: string; role: string; source: string }>> =>
  (await pool.query<{ responsible_actor_id: string; role: string; source: string }>(
    `SELECT responsible_actor_id::text AS responsible_actor_id, role, source FROM event_staff WHERE tenant_id=$1::uuid AND event_id=$2::uuid`,
    [tenantId, eventId]
  )).rows;

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Orchestrated Contracting E2E', slug: `orchestrated-${Date.now()}` });
  const CITY = randomUUID();
  const seed = await resolveSeed();

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(`SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`)).rows[0].n;
  const sprCount = async (): Promise<number> =>
    Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM service_payment_requests`)).rows[0].n);
  const bankBefore = await bankSnap();
  const sprBefore = await sprCount();

  // Geo: Curitiba centro (banda) + perto (organizador, ~2.5km) + longe (São Paulo, ~330km).
  const CTBA = { lat: -25.4284, lng: -49.2733 };
  const NEAR = { lat: -25.4100, lng: -49.2600 };
  const FAR = { lat: -23.5505, lng: -46.6333 };

  // Atores.
  const bandAuto = await mkUserActor(TENANT, 'Banda Aceita-Direto');   // automatic + raio 50
  const bandNego = await mkUserActor(TENANT, 'Banda Negocia');         // manual
  const bandOther = await mkUserActor(TENANT, 'Banda Outra');          // dona da config "estrangeira" (proof 7)
  const organizer = await mkUserActor(TENANT, 'Organizador Festival'); // dono do evento; requester; perto
  const organizerFar = await mkUserActor(TENANT, 'Organizador Longe'); // dono de evento; requester; longe

  await setLoc(TENANT, bandAuto.actorId, CTBA.lat, CTBA.lng);
  await setLoc(TENANT, bandNego.actorId, CTBA.lat, CTBA.lng);
  await setLoc(TENANT, organizer.actorId, NEAR.lat, NEAR.lng);
  await setLoc(TENANT, organizerFar.actorId, FAR.lat, FAR.lng);

  const autoOff = await publishBand(TENANT, bandAuto, 'Show — Aceita Direto', seed, CITY, seed.genreRock, { bookingApprovalMode: 'automatic', acceptDirectRadiusKm: 50 });
  const negoOff = await publishBand(TENANT, bandNego, 'Show — Negocia', seed, CITY, seed.genreRock, { bookingApprovalMode: 'manual' });
  const otherOff = await publishBand(TENANT, bandOther, 'Show — Outra', seed, CITY, seed.genreFunk, { bookingApprovalMode: 'automatic', acceptDirectRadiusKm: 50 });

  // Config de CADA oferta (a de autoOff é válida; a de otherOff é a "estrangeira" da proof 7).
  const cfgAuto = await serviceOfferingConfigService.createConfig({ tenantId: TENANT, userId: bandAuto.userId, offeringId: autoOff.offeringId, label: 'Trio', teamSize: 3 });
  const cfgOther = await serviceOfferingConfigService.createConfig({ tenantId: TENANT, userId: bandOther.userId, offeringId: otherOff.offeringId, label: 'Quarteto', teamSize: 4 });

  // Eventos dos organizadores.
  const eventA = await mkEvent(TENANT, organizer.actorId);
  const eventNego = await mkEvent(TENANT, organizer.actorId);
  const eventFar = await mkEvent(TENANT, organizerFar.actorId);

  const H = 3600e3;
  const base = Date.now() + 12 * 24 * H;
  const win = (h: number): { s: string; e: string } => ({ s: new Date(base + h * H).toISOString(), e: new Date(base + (h + 1) * H).toISOString() });
  const declare = async (userId: string, offeringId: string, h: number): Promise<string> =>
    (await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId, offeringId, startDatetime: win(h).s, endDatetime: win(h).e })).availabilityId;

  console.log('\n— C3: propose → accept → BIND ao elenco —');

  // ════════ (1) DISCOVER (real) + aceita-direto amarra ao elenco AUTOMATICAMENTE ════════
  const s1 = await declare(bandAuto.userId, autoOff.offeringId, 0);
  const discovered = await servicesService.discoverServices(TENANT, {
    subjectConceptId: seed.genreRock, audienceSize: 100, cityId: CITY,
    startDate: win(0).s, endDate: win(0).e, hasAvailability: true,
  });
  const bandDiscovered = discovered.some((s) => s.serviceId === autoOff.serviceId);
  const r1 = await serviceOfferingService.requestBooking(
    TENANT, autoOff.offeringId, s1,
    { subjectUserId: organizer.userId, requesterActorId: organizer.actorId },
    { eventId: eventA, configId: cfgAuto.id }
  );
  const rowsA = await elencoRows(TENANT, eventA);
  const boundRow = rowsA.find((r) => r.responsible_actor_id === bandAuto.actorId && r.role === 'artist');
  record('(1) discover(real)+aceita-direto → confirmed autoConfirmed E linha event_staff (PROVIDER, artist, v2)',
    bandDiscovered && r1.status === 'confirmed' && r1.autoConfirmed === true
      && rowsA.length === 1 && !!boundRow && boundRow.source === 'v2',
    `discovered=${bandDiscovered} status=${r1.status} auto=${r1.autoConfirmed} elenco=${rowsA.length} src=${boundRow?.source}`);

  // ════════ (2) NEGOCIA → requested, SEM elenco; banda confirma → elenco aparece ════════
  const s2 = await declare(bandNego.userId, negoOff.offeringId, 1);
  const r2 = await serviceOfferingService.requestBooking(
    TENANT, negoOff.offeringId, s2,
    { subjectUserId: organizer.userId, requesterActorId: organizer.actorId },
    { eventId: eventNego }
  );
  const rowsNegoBefore = await elencoRows(TENANT, eventNego);
  const conf2 = await unifiedAvailabilityService.updateBooking(TENANT, r2.bookingId, bandNego.userId, { status: UnifiedBookingStatus.CONFIRMED });
  const rowsNegoAfter = await elencoRows(TENANT, eventNego);
  record('(2) negocia: requested + SEM elenco → banda confirma (owner-only) → elenco AGORA aparece (mesmo chokepoint)',
    r2.status === 'requested' && rowsNegoBefore.length === 0
      && conf2.status === 'confirmed' && rowsNegoAfter.length === 1 && rowsNegoAfter[0].responsible_actor_id === bandNego.actorId,
    `held=${r2.status} before=${rowsNegoBefore.length} after=${rowsNegoAfter.length}`);

  // ════════ (3) DISTÂNCIA-FORA → negocia (requested), sem elenco ════════
  const s3 = await declare(bandAuto.userId, autoOff.offeringId, 2);
  const r3 = await serviceOfferingService.requestBooking(
    TENANT, autoOff.offeringId, s3,
    { subjectUserId: organizerFar.userId, requesterActorId: organizerFar.actorId },
    { eventId: eventFar }
  );
  const rowsFar = await elencoRows(TENANT, eventFar);
  record('(3) distância-fora + aceita-direto → requested (negocia), SEM elenco',
    r3.status === 'requested' && r3.autoConfirmed === false && rowsFar.length === 0,
    `status=${r3.status} gate=${r3.gateReason} elenco=${rowsFar.length}`);

  // ════════ (4) IDEMPOTÊNCIA: replay do bind → EXATAMENTE UMA linha ════════
  const replay = await bindConfirmedPerformerToEvent({
    tenantId: TENANT, eventId: eventA, performerActorId: bandAuto.actorId,
    bookingId: r1.bookingId, startIso: win(0).s, endIso: win(0).e,
  });
  const rowsAafter = await elencoRows(TENANT, eventA);
  record('(4) idempotência: replay do bind → EXATAMENTE UMA linha event_staff (skip already_bound)',
    replay.bound === false && replay.reason === 'already_bound' && rowsAafter.length === 1,
    `replay=${replay.reason} elenco=${rowsAafter.length}`);

  // ════════ (5) PROVIDER não é REQUESTER: vinculado = PROVIDER; requester NÃO vinculado ════════
  const requesterBound = rowsAafter.some((r) => r.responsible_actor_id === organizer.actorId);
  record('(5) provider≠requester: actor vinculado é o PROVIDER (banda); o requester (organizador) NÃO é vinculado',
    boundRow?.responsible_actor_id === bandAuto.actorId && !requesterBound,
    `bound=${boundRow?.responsible_actor_id === bandAuto.actorId ? 'PROVIDER' : 'OUTRO'} requesterBound=${requesterBound}`);

  // ════════ (6) CONTENÇÃO / porta-01: zero service_payment_requests no loop; acceptQuote ainda 403 ════════
  const sprAfter = await sprCount();
  let acceptQuote403 = false;
  try {
    const { eventRFQRoutes } = await import('../modules/events/event-rfq.routes');
    const Fastify = (await import('fastify')).default;
    const app = Fastify();
    app.decorateRequest('user', null); app.decorateRequest('tenant', null); app.decorateRequest('actionContext', null);
    app.addHook('onRequest', async (req: any) => {
      req.user = { userId: organizer.userId, id: organizer.userId };
      req.tenant = { id: TENANT };
      req.actionContext = { actorId: organizer.actorId, intent: 'e2e', source: 'e2e', scope: `e2e-${TENANT}` };
    });
    await app.register(eventRFQRoutes as any); await app.ready();
    const resp = await app.inject({ method: 'POST', url: `/events/${randomUUID()}/rfqs/${randomUUID()}/quotes/${randomUUID()}/accept`, headers: { 'content-type': 'application/json' }, payload: {} });
    acceptQuote403 = resp.statusCode === 403;
    await app.close();
  } catch { acceptQuote403 = false; }
  record('(6) contenção: zero service_payment_requests criados no loop; acceptQuote ainda 403 (porta-01 FORA)',
    sprAfter === sprBefore && acceptQuote403, `spr=${sprBefore}→${sprAfter} acceptQuote403=${acceptQuote403}`);

  // ════════ (7) CONFIG de OUTRA oferta → rejeitado no PROPOSE ════════
  const s7 = await declare(bandAuto.userId, autoOff.offeringId, 3);
  let cfgCode = 'NO_THROW';
  try {
    await serviceOfferingService.requestBooking(
      TENANT, autoOff.offeringId, s7,
      { subjectUserId: organizer.userId, requesterActorId: organizer.actorId },
      { eventId: eventA, configId: cfgOther.id } // config da otherOff, NÃO da autoOff
    );
  } catch (e: any) { cfgCode = e?.code || 'THROW'; }
  record('(7) configId de OUTRA oferta → rejeitado no propose (SERVICE_OFFERING_CONFIG_MISMATCH)',
    cfgCode === 'SERVICE_OFFERING_CONFIG_MISMATCH', `code=${cfgCode}`);

  // ════════ (8) Δbank=0 ════════
  const bankAfter = await bankSnap();
  record('(8) Bank-free: Δbank=0 (bank_ledger:bank_transactions inalterado)', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n──────── RESUMO: ${results.length - failed.length}/${results.length} OK ────────`);
  if (failed.length > 0) { console.error('❌ FALHAS:'); for (const f of failed) console.error(`   - ${f.label}${f.reason ? ` (${f.reason})` : ''}`); await pool.end(); process.exit(1); }
  console.log('✅ F-ORCHESTRATED-CONTRACTING C3 E2E: TODAS AS 8 PROVAS PASSARAM.');
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => { console.error('💥', e?.stack ?? e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
