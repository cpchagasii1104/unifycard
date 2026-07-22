/**
 * E2E — EVENT-ENGINE-COMPLETION · C1b (facet multi-gênero + descoberta por gênero e data).
 * "Achar banda POR GÊNERO e livre no DIA X". ACOPLA o padrão SELADO event_theme_links (elo m2m) + os
 * gêneros JÁ semeados (shared_subject_concepts) + a regra de data JÁ SELADA (0156). SEM re-semear gênero.
 * DB efêmera. NUNCA unificard_dev. Bank-free (Δbank=0).
 *
 *   (a) rock/funk/samba são subject-concepts GOVERNADOS (shared_subject_concepts);
 *   (b) publica oferta apresentacao-musical (fluxo C1a) + tagueia [rock, funk] (multi) → 2 gêneros;
 *   (c) descoberta por gênero=rock ENCONTRA; por gênero=funk ENCONTRA (mesma banda, multi); por samba NÃO;
 *   (d) DATA selada 0156: gênero=rock + DENTRO da janela → aparece; + FORA → não aparece;
 *   (e) autoridade fail-closed: quem NÃO representa o provider → 403 ao taguear;
 *   (f) governança: gênero não-governado (concept fora do pool) → 422 SERVICE_OFFERING_GENRE_NOT_GOVERNED;
 *   (g) idempotência: retagear rock não duplica;
 *   (h) Δbank = 0.
 *
 * Nota de fidelidade: o exemplo do GO citava "reggae", que NÃO está no pool semeado (§5 "NÃO seed de
 * gênero"). Uso funk (governado) como 2º gênero — mecânica idêntica; NÃO semeei gênero novo.
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
  if (!/genre|c1b|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 59).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `c1b-${seq}@e2e.test`, gu]);
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

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Genre Facet C1b E2E', slug: `c1b-${Date.now()}` });
  const band = await mkUserActor(TENANT, 'Banda Aurora');
  const CITY = randomUUID();

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(`SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`)).rows[0].n;
  const bankBefore = await bankSnap();

  console.log('\n— facet multi-gênero + descoberta por gênero e data (C1b) —');

  // (a) gêneros governados: rock/funk/samba ∈ shared_subject_concepts (JÁ semeados). concept apresentacao-musical.
  const gsel = (await pool.query<{ slug: string; concept_id: string }>(
    `SELECT c.slug, c.concept_id::text AS concept_id
       FROM concepts c JOIN shared_subject_concepts ssc ON ssc.concept_id = c.concept_id AND ssc.enabled = true
      WHERE c.slug IN ('rock','funk','samba')`
  )).rows;
  const GEN = Object.fromEntries(gsel.map((r) => [r.slug, r.concept_id])) as Record<string, string>;
  const seed = (await pool.query<{ concept_id: string; canonical_id: string }>(
    `SELECT c.concept_id::text AS concept_id, cs.id::text AS canonical_id
       FROM concepts c JOIN canonical_services cs ON cs.concept_id=c.concept_id AND cs.tenant_id IS NULL AND cs.scope='global' AND cs.status='active'
      WHERE c.slug='apresentacao-musical'`
  )).rows[0];
  record('(a) rock/funk/samba são subject-concepts GOVERNADOS (shared_subject_concepts)',
    !!GEN.rock && !!GEN.funk && !!GEN.samba, `rock=${!!GEN.rock} funk=${!!GEN.funk} samba=${!!GEN.samba}`);
  const CONCEPT = seed.concept_id, CANONICAL = seed.canonical_id;

  // (b) publica oferta (fluxo C1a) + tagueia [rock, funk] (multi).
  await professionalC1Service.declareConcept(TENANT, band.actorId, { conceptId: CONCEPT, skillLevel: 3 }, band.userId);
  const service = await servicesService.createService(TENANT, band.userId, {
    actorId: band.actorId, name: 'Show ao vivo — Banda Aurora', serviceType: ServiceType.SERVICE,
    status: ServiceStatus.ACTIVE, canonicalServiceId: CANONICAL, cityId: CITY,
  });
  const { offering } = await serviceOfferingService.createOffering({
    tenantId: TENANT, userId: band.userId, providerActorId: band.actorId,
    canonicalServiceId: CANONICAL, priceCents: 250000, durationMinutes: 90,
  });
  await serviceOfferingService.updateOwnOffering({ tenantId: TENANT, userId: band.userId, offeringId: offering.id, status: 'active' });
  const start = new Date(Date.now() + 7 * 24 * 3600e3);
  const end = new Date(Date.now() + 7 * 24 * 3600e3 + 2 * 3600e3);
  await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: band.userId, offeringId: offering.id, startDatetime: start.toISOString(), endDatetime: end.toISOString() });
  await serviceOfferingService.tagOfferingGenres({ tenantId: TENANT, userId: band.userId, offeringId: offering.id, subjectConceptIds: [GEN.rock, GEN.funk] });
  const genres = await serviceOfferingService.listOfferingGenres(TENANT, offering.id);
  record('(b) publica oferta + tagueia [rock, funk] (multi) → 2 gêneros', genres.length === 2 && genres.includes(GEN.rock) && genres.includes(GEN.funk), `genres=${genres.length}`);

  // (c) descoberta por gênero: rock ✓, funk ✓ (mesma banda, multi), samba ✗.
  const hasSvc = (arr: Array<{ serviceId: string }>): boolean => arr.some((s) => s.serviceId === service.serviceId);
  const byRock = await servicesRepository.discoverServices(TENANT, { conceptId: CONCEPT, cityId: CITY, subjectConceptId: GEN.rock });
  const byFunk = await servicesRepository.discoverServices(TENANT, { conceptId: CONCEPT, cityId: CITY, subjectConceptId: GEN.funk });
  const bySamba = await servicesRepository.discoverServices(TENANT, { conceptId: CONCEPT, cityId: CITY, subjectConceptId: GEN.samba });
  record('(c) gênero=rock ENCONTRA · funk ENCONTRA (multi) · samba NÃO',
    hasSvc(byRock) && hasSvc(byFunk) && !hasSvc(bySamba), `rock=${hasSvc(byRock)} funk=${hasSvc(byFunk)} samba=${hasSvc(bySamba)}`);

  // (d) DATA selada 0156: compõe filtro de gênero (repo) + predicado de janela (hasCanonicalOfferingFutureAvailability).
  const svcRef = { serviceId: service.serviceId, actorId: band.actorId, canonicalServiceId: CANONICAL };
  const inW = { windowStart: new Date(Date.now() + 6 * 24 * 3600e3), windowEnd: new Date(Date.now() + 8 * 24 * 3600e3) };
  const outW = { windowStart: new Date(Date.now() + 30 * 24 * 3600e3), windowEnd: new Date(Date.now() + 31 * 24 * 3600e3) };
  const rockInWindow = hasSvc(byRock) && await servicesRepository.hasCanonicalOfferingFutureAvailability(TENANT, svcRef, inW);
  const rockOutWindow = hasSvc(byRock) && await servicesRepository.hasCanonicalOfferingFutureAvailability(TENANT, svcRef, outW);
  record('(d) gênero=rock + DENTRO da janela → aparece; + FORA → não aparece (0156 reusado)',
    rockInWindow === true && rockOutWindow === false, `in=${rockInWindow} out=${rockOutWindow}`);

  // (e) autoridade fail-closed: estranho não tagueia.
  const stranger = await mkUserActor(TENANT, 'Estranho');
  let authCode = 'NO_THROW';
  try { await serviceOfferingService.tagOfferingGenres({ tenantId: TENANT, userId: stranger.userId, offeringId: offering.id, subjectConceptIds: [GEN.samba] }); }
  catch (e: any) { authCode = e?.code || 'THROW'; }
  record('(e) autoridade fail-closed: quem não representa o provider → 403', authCode === 'SERVICE_OFFERING_NOT_REPRESENTABLE', `code=${authCode}`);

  // (f) governança: gênero não-governado (concept apresentacao-musical, fora do pool) → 422.
  let govCode = 'NO_THROW';
  try { await serviceOfferingService.tagOfferingGenres({ tenantId: TENANT, userId: band.userId, offeringId: offering.id, subjectConceptIds: [CONCEPT] }); }
  catch (e: any) { govCode = e?.code || 'THROW'; }
  record('(f) gênero não-governado → 422 SERVICE_OFFERING_GENRE_NOT_GOVERNED', govCode === 'SERVICE_OFFERING_GENRE_NOT_GOVERNED', `code=${govCode}`);

  // (g) idempotência: retagear rock não duplica.
  await serviceOfferingService.tagOfferingGenres({ tenantId: TENANT, userId: band.userId, offeringId: offering.id, subjectConceptIds: [GEN.rock] });
  const genres2 = await serviceOfferingService.listOfferingGenres(TENANT, offering.id);
  record('(g) retagear rock é idempotente (segue 2)', genres2.length === 2, `genres=${genres2.length}`);

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
