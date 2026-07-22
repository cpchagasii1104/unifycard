/**
 * E2E — EVENT-ENGINE-COMPLETION · C1a (performer publica oferta contratável de apresentação musical).
 * Prova que um Actor (banda/artista) PUBLICA uma oferta contratável de performance musical REUSANDO o
 * trilho SELADO service_offering, apenas por o concept `apresentacao-musical` nascer GOVERNADO
 * (domain='servicos' + canonical_service global + offer_kind='service' — migration 20260722100000).
 * SEM mudança de código de aplicação. DB efêmera. NUNCA unificard_dev. Bank-free (Δbank=0).
 *
 *   (a) concept apresentacao-musical GOVERNADO (domain='servicos', canonical global, offer_kind='service');
 *   (b) banda declara o concept (PF) → createService(active) → createOffering → ativa → declareAvailability;
 *   (c) descoberta concept-keyed (repo discoverServices por concept + cidade) ENCONTRA o serviço;
 *   (d) predicado de janela (hasCanonicalOfferingFutureAvailability): janela DENTRO → true; FORA → false;
 *   (e) descoberta NÃO casa por concept diferente NEM por cidade diferente (concept-keying material);
 *   (f) autoridade fail-closed: quem NÃO representa o provider → 403 SERVICE_OFFERING_NOT_REPRESENTABLE;
 *   (g) Δbank = 0.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { servicesRepository } from '../modules/services/services.repository';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { ServiceType, ServiceStatus } from '../modules/services/services.types';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/musical|performer|c1a|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 53).padStart(11, '0').slice(-11);
  // KYC-lite civil (global_users cpf+full_name + identities) — exigido pelo gate de ativação PF da oferta.
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `c1a-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // Autoridade (canRepresentActor pool-path) resolve o actor via socialPortsRegistry — wire como as rotas.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Musical Performer C1a E2E', slug: `c1a-${Date.now()}` });
  const band = await mkUserActor(TENANT, 'Banda Aurora');
  const CITY = randomUUID();          // services.city_id é UUID livre (sem FK) — cidade da oferta
  const OTHER_CITY = randomUUID();

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
  const bankBefore = await bankSnap();

  console.log('\n— performer publica oferta de apresentação musical (C1a) —');

  // (a) concept GOVERNADO — resolve concept_id + canonical_service_id do seed 20260722100000.
  const seed = (await pool.query<{ concept_id: string; canonical_id: string; domain: string; offer_kind: string | null }>(
    `SELECT c.concept_id::text AS concept_id, cs.id::text AS canonical_id, c.domain,
            k.offer_kind
       FROM concepts c
       JOIN canonical_services cs ON cs.concept_id = c.concept_id AND cs.tenant_id IS NULL AND cs.scope='global' AND cs.status='active'
       LEFT JOIN concept_offer_kinds k ON k.concept_id = c.concept_id AND k.offer_kind='service'
      WHERE c.slug = 'apresentacao-musical'`
  )).rows[0];
  record('(a) concept apresentacao-musical GOVERNADO (domain=servicos, canonical global, offer_kind=service)',
    !!seed && seed.domain === 'servicos' && !!seed.canonical_id && seed.offer_kind === 'service',
    `domain=${seed?.domain} canonical=${seed?.canonical_id} offer_kind=${seed?.offer_kind}`);
  const CONCEPT = seed.concept_id;
  const CANONICAL = seed.canonical_id;

  // (b) banda declara o concept (PF) → createService(active) → createOffering → ativa → declareAvailability.
  await professionalC1Service.declareConcept(TENANT, band.actorId, { conceptId: CONCEPT, skillLevel: 3 }, band.userId);
  const service = await servicesService.createService(TENANT, band.userId, {
    actorId: band.actorId,
    name: 'Show ao vivo — Banda Aurora',
    serviceType: ServiceType.SERVICE,
    status: ServiceStatus.ACTIVE,
    canonicalServiceId: CANONICAL,
    cityId: CITY,
  });
  const { offering } = await serviceOfferingService.createOffering({
    tenantId: TENANT,
    userId: band.userId,
    providerActorId: band.actorId,
    canonicalServiceId: CANONICAL,
    priceCents: 250000,
    durationMinutes: 90,
  });
  await serviceOfferingService.updateOwnOffering({ tenantId: TENANT, userId: band.userId, offeringId: offering.id, status: 'active' });
  const start = new Date(Date.now() + 7 * 24 * 3600e3);   // daqui a 7 dias
  const end = new Date(Date.now() + 7 * 24 * 3600e3 + 2 * 3600e3);
  await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: band.userId, offeringId: offering.id, startDatetime: start.toISOString(), endDatetime: end.toISOString() });
  // status do serviço = objeto retornado (query crua bateria em RLS sem GUC de tenant); oferta via findById.
  const offAfter = await serviceOfferingService.findById(TENANT, offering.id);
  record('(b) banda declara concept → service(active) + offering(active) + availability publicados',
    service.status === ServiceStatus.ACTIVE && offAfter?.status === 'active' && !!service.serviceId && !!offering.id,
    `service=${service.status} offering=${offAfter?.status}`);

  // (c) descoberta concept-keyed (concept + cidade) ENCONTRA o serviço.
  const foundByConceptCity = await servicesRepository.discoverServices(TENANT, { conceptId: CONCEPT, cityId: CITY });
  record('(c) discoverServices por concept + cidade ENCONTRA a oferta',
    foundByConceptCity.some((s) => s.serviceId === service.serviceId),
    `n=${foundByConceptCity.length}`);

  // (d) predicado de janela: janela DENTRO → true; FORA (posterior) → false.
  const svcRef = { serviceId: service.serviceId, actorId: band.actorId, canonicalServiceId: CANONICAL };
  const inWindow = await servicesRepository.hasCanonicalOfferingFutureAvailability(TENANT, svcRef,
    { windowStart: new Date(Date.now() + 6 * 24 * 3600e3), windowEnd: new Date(Date.now() + 8 * 24 * 3600e3) });
  const outWindow = await servicesRepository.hasCanonicalOfferingFutureAvailability(TENANT, svcRef,
    { windowStart: new Date(Date.now() + 30 * 24 * 3600e3), windowEnd: new Date(Date.now() + 31 * 24 * 3600e3) });
  record('(d) janela: DENTRO → disponível (true); FORA → indisponível (false)', inWindow === true && outWindow === false, `in=${inWindow} out=${outWindow}`);

  // (e) concept-keying material: concept diferente / cidade diferente NÃO casam.
  const byOtherConcept = await servicesRepository.discoverServices(TENANT, { conceptId: randomUUID(), cityId: CITY });
  const byOtherCity = await servicesRepository.discoverServices(TENANT, { conceptId: CONCEPT, cityId: OTHER_CITY });
  record('(e) NÃO casa por concept diferente NEM por cidade diferente',
    !byOtherConcept.some((s) => s.serviceId === service.serviceId) && !byOtherCity.some((s) => s.serviceId === service.serviceId),
    `otherConcept=${byOtherConcept.length} otherCity=${byOtherCity.length}`);

  // (f) autoridade fail-closed: outro user (não representa a banda) tenta criar oferta → 403.
  const stranger = await mkUserActor(TENANT, 'Estranho');
  let authCode = 'NO_THROW';
  try {
    await serviceOfferingService.createOffering({
      tenantId: TENANT, userId: stranger.userId, providerActorId: band.actorId,
      canonicalServiceId: CANONICAL, priceCents: 1, durationMinutes: 1,
    });
  } catch (e: any) { authCode = e?.code || e?.message?.slice(0, 60) || 'THROW'; }
  record('(f) autoridade fail-closed: sem representar o provider → 403 SERVICE_OFFERING_NOT_REPRESENTABLE',
    authCode === 'SERVICE_OFFERING_NOT_REPRESENTABLE', `code=${authCode}`);

  // (g) Δbank = 0.
  const bankAfter = await bankSnap();
  record('(g) Δbank=0', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.stack ?? e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
