/**
 * E2E — F-PERFORMER-CONTRACTING-POLICY. Prova, POR API DIRETA (camada de serviço REAL — "a verdade vive no
 * backend", nunca via frontend), a POLÍTICA DE CONTRATAÇÃO na oferta `apresentacao-musical`: a banda decide
 * ACEITA-DIRETO ('automatic' — "fechou fechou": booking dentro da distância AUTO-CONFIRMA pelo lock SELADO por
 * provider) × NEGOCIA ('manual' — fica 'requested' até a banda confirmar/recusar). Condição = DISTÂNCIA (raio km
 * OU mesma cidade), reusando o primitivo geo canônico (actor_active_location + haversine_distance_km, DECISION-0030).
 * PREÇO fora. Bank-free (Δbank=0). DB efêmera. NUNCA unificard_dev.
 *
 * SEIS PROVAS:
 *  (1) within-distance + aceita-direto → requestBooking retorna 'confirmed' (passou pelo lock SELADO).
 *  (2) outside-distance + aceita-direto → fica 'requested' (roteado p/ negocia), NÃO confirmado.
 *  (3) negocia (manual) → fica 'requested'; banda confirma pelo caminho owner-only → 'confirmed'; banda recusa
 *      → 'cancelled'.
 *  (4) localização do requester AUSENTE + aceita-direto → fail-closed a 'requested' (negocia).
 *  (5) concorrência: 2 aceita-direto no MESMO slot → exatamente 1 confirma, o outro 409 (BOOKING_PROVIDER_TIME_CONFLICT).
 *  (6) Δbank=0 em todos os caminhos.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { unifiedAvailabilityService } from '../core/availability/unified-availability.service';
import { actorActiveLocationRepository } from '../core/location/actor-active-location.repository';
import { AvailabilityOwnerType, UnifiedBookingStatus } from '../core/availability/unified-availability.types';
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
  if (!/contracting|policy|performer|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 53).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `contracting-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

async function resolveServiceConcept(slug: string): Promise<{ conceptId: string; canonicalId: string }> {
  const r = (await pool.query<{ concept_id: string; canonical_id: string }>(
    `SELECT c.concept_id::text AS concept_id, cs.id::text AS canonical_id
       FROM concepts c
       JOIN canonical_services cs ON cs.concept_id = c.concept_id AND cs.tenant_id IS NULL AND cs.scope='global' AND cs.status='active'
       JOIN concept_offer_kinds k ON k.concept_id = c.concept_id AND k.offer_kind='service'
      WHERE c.slug = $1`,
    [slug]
  )).rows[0];
  if (!r) throw new Error(`concept de serviço governado ausente: ${slug}`);
  return { conceptId: r.concept_id, canonicalId: r.canonical_id };
}

/** Publica um performer com POLÍTICA DE CONTRATAÇÃO: concept → service(active) → offering(active) + policy. */
async function publishPerformer(
  tenantId: string,
  band: { userId: string; actorId: string },
  name: string,
  canonical: { conceptId: string; canonicalId: string },
  cityId: string,
  policy: { bookingApprovalMode: 'manual' | 'automatic'; acceptDirectSameCity?: boolean; acceptDirectRadiusKm?: number | null }
): Promise<{ serviceId: string; offeringId: string }> {
  await professionalC1Service.declareConcept(tenantId, band.actorId, { conceptId: canonical.conceptId, skillLevel: 3 }, band.userId);
  const service = await servicesService.createService(tenantId, band.userId, {
    actorId: band.actorId, name, serviceType: ServiceType.SERVICE, status: ServiceStatus.ACTIVE,
    canonicalServiceId: canonical.canonicalId, cityId,
  });
  const { offering } = await serviceOfferingService.createOffering({
    tenantId, userId: band.userId, providerActorId: band.actorId,
    canonicalServiceId: canonical.canonicalId, priceCents: 250000, durationMinutes: 90,
    bookingApprovalMode: policy.bookingApprovalMode,
    acceptDirectSameCity: policy.acceptDirectSameCity ?? false,
    acceptDirectRadiusKm: policy.acceptDirectRadiusKm ?? null,
  });
  await serviceOfferingService.updateOwnOffering({ tenantId, userId: band.userId, offeringId: offering.id, status: 'active' });
  return { serviceId: service.serviceId, offeringId: offering.id };
}

const setLoc = (tenantId: string, actorId: string, lat: number, lng: number): Promise<unknown> =>
  actorActiveLocationRepository.setActive(tenantId, actorId, { lat, lng, source: 'USER_INPUT_CITY' } as any);

/** localização ATIVA ancorada num ENDEREÇO governado (address_id → addresses.city_id): é o que o gate SAME-CITY
 *  consome de verdade (getActiveHydrated resolve cityId pelo JOIN em addresses). Sem lat/lng → força o ramo cidade. */
const setLocAddr = (tenantId: string, actorId: string, addressId: string): Promise<unknown> =>
  actorActiveLocationRepository.setActive(tenantId, actorId, { addressId, source: 'USER_INPUT_CITY' } as any);

/** Cria a hierarquia territorial governada mínima (country→state) uma vez. Retorna o state_id. */
async function mkGovernedState(): Promise<string> {
  const suffix = randomUUID().slice(0, 6);
  // iso_alpha2 governado: ^[A-Z]{2}$ e UNIQUE — sorteia 2 letras livres (retry defensivo contra seeds reais).
  const rl = (): string => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  let country: string | null = null;
  for (let attempt = 0; attempt < 40 && !country; attempt += 1) {
    try {
      country = (await pool.query<{ id: string }>(
        `INSERT INTO countries (iso_alpha2, name) VALUES ($1, $2) RETURNING country_id::text AS id`,
        [rl() + rl(), `País ${suffix}`]
      )).rows[0].id;
    } catch (e: any) {
      if (!/unique|duplicad/i.test(String(e?.message ?? e))) throw e; // só re-sorteia em colisão de código
    }
  }
  if (!country) throw new Error('mkGovernedState: não achou iso_alpha2 livre.');
  return (await pool.query<{ id: string }>(
    `INSERT INTO states (country_id, name) VALUES ($1::uuid, $2) RETURNING state_id::text AS id`,
    [country, `Estado ${suffix}`]
  )).rows[0].id;
}

/** Cidade GOVERNADA (cities.city_id) sob um state. É o city_id que o gate compara por igualdade. */
async function mkGovernedCity(stateId: string, name: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO cities (state_id, name) VALUES ($1::uuid, $2) RETURNING city_id::text AS id`,
    [stateId, name]
  )).rows[0].id;
}

/** Endereço governado numa cidade (para ancorar actor_active_location.address_id → city_id). */
async function mkAddress(cityId: string, stateId: string): Promise<string> {
  const country = (await pool.query<{ id: string }>(
    `SELECT c.country_id::text AS id FROM cities ci JOIN states s ON s.state_id = ci.state_id JOIN countries c ON c.country_id = s.country_id WHERE ci.city_id = $1::uuid`,
    [cityId]
  )).rows[0].id;
  return (await pool.query<{ id: string }>(
    `INSERT INTO addresses (country_id, state_id, city_id, source) VALUES ($1::uuid, $2::uuid, $3::uuid, 'UX_INPUT') RETURNING address_id::text AS id`,
    [country, stateId, cityId]
  )).rows[0].id;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Performer Contracting Policy E2E', slug: `contracting-${Date.now()}` });
  const CITY = randomUUID();

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
  const bankBefore = await bankSnap();

  const musical = await resolveServiceConcept('apresentacao-musical');

  // ── Geo: Curitiba centro; ~2km (dentro); São Paulo (~330km, fora). ──
  const CTBA = { lat: -25.4284, lng: -49.2733 };
  const NEAR = { lat: -25.4100, lng: -49.2600 };   // ~2.5km do centro
  const FAR = { lat: -23.5505, lng: -46.6333 };    // São Paulo

  // Atores: 2 bandas (aceita-direto e negocia) + contratantes.
  const bandAuto = await mkUserActor(TENANT, 'Banda Aceita-Direto');
  const bandNego = await mkUserActor(TENANT, 'Banda Negocia');
  const barNear = await mkUserActor(TENANT, 'Bar Perto');       // dentro do raio
  const barFar = await mkUserActor(TENANT, 'Bar Longe');        // fora do raio
  const barNoLoc = await mkUserActor(TENANT, 'Bar Sem Local');  // sem localização
  const barNear2 = await mkUserActor(TENANT, 'Bar Perto 2');    // dentro (para a corrida)
  const barNego = await mkUserActor(TENANT, 'Bar Negocia');     // contrata a banda negocia

  // Provider + contratantes com localização (o requester sem local NÃO recebe localização).
  await setLoc(TENANT, bandAuto.actorId, CTBA.lat, CTBA.lng);
  await setLoc(TENANT, bandNego.actorId, CTBA.lat, CTBA.lng);
  await setLoc(TENANT, barNear.actorId, NEAR.lat, NEAR.lng);
  await setLoc(TENANT, barFar.actorId, FAR.lat, FAR.lng);
  await setLoc(TENANT, barNear2.actorId, NEAR.lat, NEAR.lng);
  await setLoc(TENANT, barNego.actorId, NEAR.lat, NEAR.lng);

  // ── SAME-CITY: cidades GOVERNADAS (city_id) + endereços; provider e contratantes ancorados por address_id.
  //    O gate resolve por IGUALDADE DE CIDADE (radius=NULL nesta oferta) — NÃO por raio. ──
  const STATE = await mkGovernedState();
  const CITY_A = await mkGovernedCity(STATE, `Cidade A ${randomUUID().slice(0, 5)}`);
  const CITY_B = await mkGovernedCity(STATE, `Cidade B ${randomUUID().slice(0, 5)}`);
  const addrProviderCityA = await mkAddress(CITY_A, STATE);
  const addrContratanteCityA = await mkAddress(CITY_A, STATE);
  const addrContratanteCityB = await mkAddress(CITY_B, STATE);

  const bandCity = await mkUserActor(TENANT, 'Banda Minha-Cidade');   // automatic + same_city (raio NULL)
  const barSameCity = await mkUserActor(TENANT, 'Bar Mesma Cidade');  // CITY_A (match)
  const barOtherCity = await mkUserActor(TENANT, 'Bar Outra Cidade'); // CITY_B (mismatch, e radius=NULL)
  await setLocAddr(TENANT, bandCity.actorId, addrProviderCityA);
  await setLocAddr(TENANT, barSameCity.actorId, addrContratanteCityA);
  await setLocAddr(TENANT, barOtherCity.actorId, addrContratanteCityB);

  // Ofertas: bandAuto = automatic + raio 50km; bandNego = manual; bandCity = automatic + same_city (raio NULL).
  const autoOff = await publishPerformer(TENANT, bandAuto, 'Show ao vivo — Aceita Direto', musical, CITY, { bookingApprovalMode: 'automatic', acceptDirectRadiusKm: 50 });
  const negoOff = await publishPerformer(TENANT, bandNego, 'Show ao vivo — Negocia', musical, CITY, { bookingApprovalMode: 'manual' });
  const cityOff = await publishPerformer(TENANT, bandCity, 'Show ao vivo — Só Minha Cidade', musical, CITY_A, { bookingApprovalMode: 'automatic', acceptDirectSameCity: true, acceptDirectRadiusKm: null });

  const H = 3600e3;
  const base = Date.now() + 10 * 24 * H;
  const win = (h: number): { s: string; e: string } => ({ s: new Date(base + h * H).toISOString(), e: new Date(base + (h + 1) * H).toISOString() });
  const declare = async (userId: string, offeringId: string, h: number): Promise<string> =>
    (await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId, offeringId, startDatetime: win(h).s, endDatetime: win(h).e })).availabilityId;
  const statusOf = async (bookingId: string): Promise<string> =>
    (await unifiedAvailabilityService.getBooking(TENANT, bookingId)).status;

  // ════════ (1) within + aceita-direto → confirmed ════════
  const s1 = await declare(bandAuto.userId, autoOff.offeringId, 0);
  const r1 = await serviceOfferingService.requestBooking(TENANT, autoOff.offeringId, s1, { subjectUserId: barNear.userId, requesterActorId: barNear.actorId });
  record('(1) within-distance + aceita-direto → confirmed (passou pelo lock SELADO)',
    r1.status === 'confirmed' && r1.autoConfirmed === true, `status=${r1.status} auto=${r1.autoConfirmed} gate=${r1.gateReason}`);

  // ════════ (2) outside + aceita-direto → requested (negocia), NÃO confirmado ════════
  const s2 = await declare(bandAuto.userId, autoOff.offeringId, 1);
  const r2 = await serviceOfferingService.requestBooking(TENANT, autoOff.offeringId, s2, { subjectUserId: barFar.userId, requesterActorId: barFar.actorId });
  record('(2) outside-distance + aceita-direto → requested (roteado p/ negocia), NÃO confirmado',
    r2.status === 'requested' && r2.autoConfirmed === false, `status=${r2.status} auto=${r2.autoConfirmed} gate=${r2.gateReason}`);

  // ════════ (1b) SAME-CITY match + aceita-direto (raio NULL) → confirmed via IGUALDADE DE CIDADE ════════
  const s1b = await declare(bandCity.userId, cityOff.offeringId, 6);
  const r1b = await serviceOfferingService.requestBooking(TENANT, cityOff.offeringId, s1b, { subjectUserId: barSameCity.userId, requesterActorId: barSameCity.actorId });
  // gate REAL retorna reason='same_city' (não 'radius_*') — prova que resolveu por cidade, com radius=NULL.
  record('(1b) same-city (mesma cidade governada) + aceita-direto [radius=NULL] → confirmed (gate por CIDADE, não raio)',
    r1b.status === 'confirmed' && r1b.autoConfirmed === true && r1b.gateReason === 'same_city',
    `status=${r1b.status} auto=${r1b.autoConfirmed} gate=same_city_ok(raw=${r1b.gateReason})`);

  // ════════ (1c) SAME-CITY mismatch (cidade diferente, radius NULL) → requested (negocia) ════════
  const s1c = await declare(bandCity.userId, cityOff.offeringId, 7);
  const r1c = await serviceOfferingService.requestBooking(TENANT, cityOff.offeringId, s1c, { subjectUserId: barOtherCity.userId, requesterActorId: barOtherCity.actorId });
  // cidade diferente + radius=NULL ⇒ sem alcance por cidade e sem raio → fica requested. NÃO é rejeição por raio.
  record('(1c) different-city + aceita-direto [radius=NULL] → requested (roteado p/ negocia; sem alcance por CIDADE)',
    r1c.status === 'requested' && r1c.autoConfirmed === false && !/radius/.test(r1c.gateReason),
    `status=${r1c.status} auto=${r1c.autoConfirmed} gate=same_city_mismatch(raw=${r1c.gateReason})`);

  // ════════ (3) negocia → requested; banda confirma → confirmed; banda recusa → cancelled ════════
  const s3a = await declare(bandNego.userId, negoOff.offeringId, 2);
  const r3a = await serviceOfferingService.requestBooking(TENANT, negoOff.offeringId, s3a, { subjectUserId: barNego.userId, requesterActorId: barNego.actorId });
  const heldOk = r3a.status === 'requested' && r3a.autoConfirmed === false;
  // banda CONFIRMA pelo caminho owner-only (updateBooking → chokepoint de confirm).
  const conf3 = await unifiedAvailabilityService.updateBooking(TENANT, r3a.bookingId, bandNego.userId, { status: UnifiedBookingStatus.CONFIRMED });
  record('(3a) negocia: fica requested; banda confirma pelo owner-only → confirmed',
    heldOk && conf3.status === 'confirmed', `held=${r3a.status} afterConfirm=${conf3.status}`);

  const s3b = await declare(bandNego.userId, negoOff.offeringId, 3);
  const r3b = await serviceOfferingService.requestBooking(TENANT, negoOff.offeringId, s3b, { subjectUserId: barNego.userId, requesterActorId: barNego.actorId });
  const dec3 = await unifiedAvailabilityService.updateBooking(TENANT, r3b.bookingId, bandNego.userId, { status: UnifiedBookingStatus.CANCELLED });
  record('(3b) negocia: banda recusa → cancelled',
    r3b.status === 'requested' && dec3.status === 'cancelled', `held=${r3b.status} afterDecline=${dec3.status}`);

  // ════════ (4) requester SEM localização + aceita-direto → requested (fail-closed) ════════
  const s4 = await declare(bandAuto.userId, autoOff.offeringId, 4);
  const r4 = await serviceOfferingService.requestBooking(TENANT, autoOff.offeringId, s4, { subjectUserId: barNoLoc.userId, requesterActorId: barNoLoc.actorId });
  record('(4) requester location ABSENT + aceita-direto → fail-closed a requested (negocia)',
    r4.status === 'requested' && r4.autoConfirmed === false && /location_absent/.test(r4.gateReason), `status=${r4.status} gate=${r4.gateReason}`);

  // ════════ (5) concorrência: 2 aceita-direto no MESMO slot → 1 confirma, o outro 409 ════════
  const s5 = await declare(bandAuto.userId, autoOff.offeringId, 5);
  const isConflict = (e: any): boolean => /BOOKING_PROVIDER_TIME_CONFLICT/.test(String(e?.message ?? e));
  const race = await Promise.allSettled([
    serviceOfferingService.requestBooking(TENANT, autoOff.offeringId, s5, { subjectUserId: barNear.userId, requesterActorId: barNear.actorId }),
    serviceOfferingService.requestBooking(TENANT, autoOff.offeringId, s5, { subjectUserId: barNear2.userId, requesterActorId: barNear2.actorId }),
  ]);
  const confirmedN = race.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value.status === 'confirmed').length;
  const conflicts = race.filter((r) => r.status === 'rejected' && isConflict((r as PromiseRejectedResult).reason)).length;
  record('(5) concorrência: 2 aceita-direto no MESMO slot → exatamente 1 confirma, o outro 409 (hard-fail)',
    confirmedN === 1 && conflicts === 1, `confirmados=${confirmedN} conflitos=${conflicts}`);

  // ════════ (6) Δbank=0 ════════
  const bankAfter = await bankSnap();
  record('(6) Bank-free: Δbank=0 (bank_ledger:bank_transactions inalterado em todos os caminhos)',
    bankBefore === bankAfter, `before=${bankBefore} after=${bankAfter}`);

  // ── Resumo ──
  const failed = results.filter((r) => !r.ok);
  console.log(`\n──────── RESUMO: ${results.length - failed.length}/${results.length} OK ────────`);
  if (failed.length > 0) { console.error('❌ FALHAS:'); for (const f of failed) console.error(`   - ${f.label}${f.reason ? ` (${f.reason})` : ''}`); process.exit(1); }
  console.log('✅ F-PERFORMER-CONTRACTING-POLICY E2E: TODAS AS PROVAS PASSARAM.');
}

main().then(() => pool.end()).catch(async (e) => { console.error('💥', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
