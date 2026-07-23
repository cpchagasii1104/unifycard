/**
 * E2E — EVENT-ENGINE-COMPLETION · C1c-a (raio-x: facet de EQUIPAMENTO + capacidade de público).
 * (1) checklist de equipamento próprio como FACET governado da oferta (espelha C1b); (2) capacidade
 * ("atende até N pessoas") como atributo validado em conditions. ACOPLA o pool de equipamento existente
 * (produtos-e-comercio + offer_kind='rentable') + o gear musical semeado. DB efêmera. NUNCA unificard_dev.
 * Bank-free (Δbank=0).
 *
 *   (a) caixa-de-som (existente) + guitarra (semeado) são equipamento GOVERNADO (pool);
 *   (b) publica oferta (fluxo C1a) + tagueia [guitarra, caixa-de-som] (multi: semeado+existente) → 2;
 *   (c) descoberta por equipamento=caixa-de-som ENCONTRA; por microfone (não tagueado) NÃO;
 *   (d) equipamento não-governado (concept fora do pool) → 422 SERVICE_OFFERING_EQUIPMENT_NOT_GOVERNED;
 *   (e) autoridade fail-closed: quem NÃO representa o provider → 403 ao taguear;
 *   (f) capacidade de público: audience_capacity=200 aceito e persistido; ≤0 → 400 CAPACITY_INVALID;
 *   (g) idempotência: retaguear guitarra não duplica;
 *   (h) Δbank = 0.
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
  if (!/equip|c1ca|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 61).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `c1ca-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, userId, gu]
  )).rows[0].id;
  return { userId, actorId };
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
  await tenantService.createTenant({ id: TENANT, name: 'Equipment Facet C1c-a E2E', slug: `c1ca-${Date.now()}` });

  // concept apresentacao-musical + canonical (fluxo C1a).
  const seed = (await pool.query<{ concept_id: string; canonical_id: string }>(
    `SELECT c.concept_id::text AS concept_id, cs.id::text AS canonical_id
       FROM concepts c JOIN canonical_services cs ON cs.concept_id=c.concept_id AND cs.tenant_id IS NULL AND cs.scope='global' AND cs.status='active'
      WHERE c.slug='apresentacao-musical'`
  )).rows[0];
  const CONCEPT = seed.concept_id, CANONICAL = seed.canonical_id;

  // equipamentos: existentes + semeados.
  const eq = Object.fromEntries((await pool.query<{ slug: string; concept_id: string }>(
    `SELECT c.slug, c.concept_id::text AS concept_id
       FROM concepts c JOIN concept_offer_kinds k ON k.concept_id=c.concept_id AND k.offer_kind='rentable'
      WHERE c.domain='produtos-e-comercio' AND c.slug IN ('caixa-de-som','microfone','guitarra','bateria')`
  )).rows.map((r) => [r.slug, r.concept_id])) as Record<string, string>;

  const publishOffering = async (name: string, conditions?: Record<string, unknown>) => {
    const band = await mkUserActor(TENANT, name);
    const CITY = randomUUID();
    await professionalC1Service.declareConcept(TENANT, band.actorId, { conceptId: CONCEPT, skillLevel: 3 }, band.userId);
    const service = await servicesService.createService(TENANT, band.userId, {
      actorId: band.actorId, name: `Show — ${name}`, serviceType: ServiceType.SERVICE,
      status: ServiceStatus.ACTIVE, canonicalServiceId: CANONICAL, cityId: CITY,
    });
    const { offering } = await serviceOfferingService.createOffering({
      tenantId: TENANT, userId: band.userId, providerActorId: band.actorId,
      canonicalServiceId: CANONICAL, priceCents: 250000, durationMinutes: 90, conditions: conditions ?? null,
    });
    await serviceOfferingService.updateOwnOffering({ tenantId: TENANT, userId: band.userId, offeringId: offering.id, status: 'active' });
    await serviceOfferingService.declareAvailability({
      tenantId: TENANT, userId: band.userId, offeringId: offering.id,
      startDatetime: new Date(Date.now() + 7 * 24 * 3600e3).toISOString(),
      endDatetime: new Date(Date.now() + 7 * 24 * 3600e3 + 2 * 3600e3).toISOString(),
    });
    return { band, service, offering, CITY };
  };

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(`SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`)).rows[0].n;
  const bankBefore = await bankSnap();

  console.log('\n— facet de equipamento + capacidade (C1c-a) —');

  // (a) governança do pool.
  record('(a) caixa-de-som (existente) + guitarra (semeado) são equipamento GOVERNADO (pool produtos-e-comercio/rentable)',
    !!eq['caixa-de-som'] && !!eq['guitarra'] && !!eq['microfone'], `caixa=${!!eq['caixa-de-som']} guitarra=${!!eq['guitarra']} micro=${!!eq['microfone']}`);

  // (b) publica + tagueia [guitarra(semeado), caixa-de-som(existente)] (multi).
  const b1 = await publishOffering('Banda Aurora');
  await serviceOfferingService.tagOfferingEquipment({ tenantId: TENANT, userId: b1.band.userId, offeringId: b1.offering.id, equipmentConceptIds: [eq['guitarra'], eq['caixa-de-som']] });
  const list = await serviceOfferingService.listOfferingEquipment(TENANT, b1.offering.id);
  record('(b) publica oferta + tagueia [guitarra, caixa-de-som] (multi: semeado+existente) → 2',
    list.length === 2 && list.includes(eq['guitarra']) && list.includes(eq['caixa-de-som']), `list=${list.length}`);

  // (c) descoberta por equipamento.
  const hasSvc = (arr: Array<{ serviceId: string }>): boolean => arr.some((s) => s.serviceId === b1.service.serviceId);
  const byCaixa = await servicesRepository.discoverServices(TENANT, { conceptId: CONCEPT, cityId: b1.CITY, equipmentConceptId: eq['caixa-de-som'] });
  const byMicro = await servicesRepository.discoverServices(TENANT, { conceptId: CONCEPT, cityId: b1.CITY, equipmentConceptId: eq['microfone'] });
  record('(c) descoberta por equipamento=caixa-de-som ENCONTRA; por microfone (não tagueado) NÃO',
    hasSvc(byCaixa) && !hasSvc(byMicro), `caixa=${hasSvc(byCaixa)} micro=${hasSvc(byMicro)}`);

  // (d) equipamento não-governado (concept apresentacao-musical, domain servicos) → 422.
  let govCode = 'NO_THROW';
  try { await serviceOfferingService.tagOfferingEquipment({ tenantId: TENANT, userId: b1.band.userId, offeringId: b1.offering.id, equipmentConceptIds: [CONCEPT] }); }
  catch (e: any) { govCode = e?.code || 'THROW'; }
  record('(d) equipamento não-governado → 422 SERVICE_OFFERING_EQUIPMENT_NOT_GOVERNED', govCode === 'SERVICE_OFFERING_EQUIPMENT_NOT_GOVERNED', `code=${govCode}`);

  // (e) autoridade fail-closed.
  const stranger = await mkUserActor(TENANT, 'Estranho');
  let authCode = 'NO_THROW';
  try { await serviceOfferingService.tagOfferingEquipment({ tenantId: TENANT, userId: stranger.userId, offeringId: b1.offering.id, equipmentConceptIds: [eq['bateria']] }); }
  catch (e: any) { authCode = e?.code || 'THROW'; }
  record('(e) autoridade fail-closed: quem não representa o provider → 403', authCode === 'SERVICE_OFFERING_NOT_REPRESENTABLE', `code=${authCode}`);

  // (f) capacidade de público: válido persiste; inválido (≤0) → 400.
  const b2 = await publishOffering('Banda Capacidade', { audience_capacity: 200 });
  const cap = (await pool.query<{ c: number | null }>(`SELECT (conditions->>'audience_capacity')::int AS c FROM service_offerings WHERE id=$1`, [b2.offering.id])).rows[0]?.c;
  let capCode = 'NO_THROW';
  const b3 = await mkUserActor(TENANT, 'Banda CapInvalida');
  await professionalC1Service.declareConcept(TENANT, b3.actorId, { conceptId: CONCEPT, skillLevel: 3 }, b3.userId);
  await servicesService.createService(TENANT, b3.userId, { actorId: b3.actorId, name: 'Show — inv', serviceType: ServiceType.SERVICE, status: ServiceStatus.ACTIVE, canonicalServiceId: CANONICAL, cityId: randomUUID() });
  try { await serviceOfferingService.createOffering({ tenantId: TENANT, userId: b3.userId, providerActorId: b3.actorId, canonicalServiceId: CANONICAL, priceCents: 1000, durationMinutes: 60, conditions: { audience_capacity: 0 } }); }
  catch (e: any) { capCode = e?.code || 'THROW'; }
  record('(f) capacidade: audience_capacity=200 persistido; ≤0 → 400 SERVICE_OFFERING_CAPACITY_INVALID',
    cap === 200 && capCode === 'SERVICE_OFFERING_CAPACITY_INVALID', `persisted=${cap} invalidCode=${capCode}`);

  // (g) idempotência.
  await serviceOfferingService.tagOfferingEquipment({ tenantId: TENANT, userId: b1.band.userId, offeringId: b1.offering.id, equipmentConceptIds: [eq['guitarra']] });
  const list2 = await serviceOfferingService.listOfferingEquipment(TENANT, b1.offering.id);
  record('(g) retaguear guitarra é idempotente (segue 2)', list2.length === 2, `list=${list2.length}`);

  // (h) Δbank=0.
  const bankAfter = await bankSnap();
  record('(h) Δbank=0', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

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
