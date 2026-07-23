/**
 * E2E — EVENT-ENGINE-COMPLETION · PERFORMER AGENDA COUPLING (first slice). Prova, POR API DIRETA (camada de
 * serviço/repositório REAL — "a verdade vive no backend", nunca via frontend), que uma banda/artista ABRE a
 * PRÓPRIA agenda na sua oferta `apresentacao-musical` e é descoberta/reservada COERENTEMENTE. Bank-free
 * (Δbank=0). ZERO tabelas novas — puro wiring sobre peças SELADAS (service_offering + Unified Availability +
 * provider-lock + facet de gênero governado). DB efêmera. NUNCA unificard_dev.
 *
 * TRÊS PROVAS:
 *  (1) MULTI-JANELA na MESMA NOITE — declareAvailability owner_type='service_offering' aceita 19–21, 21–23
 *      (back-to-back) e 23–01 (madrugada) na mesma oferta; agenda opt-in, NÃO bloqueia.
 *  (2) FIRST-COME fecha a data; back-to-back coexiste; rollup CROSS-OFERTA por provider —
 *      dois confirms concorrentes no MESMO slot → exatamente 1 confirma via confirmBookingWithProviderLock,
 *      o outro fail-closed BOOKING_PROVIDER_TIME_CONFLICT; 19–21 e 21–23 (limite [start,end) meio-aberto)
 *      AMBOS confirmam; uma 2ª oferta do MESMO provider com janela SOBREPOSTA NÃO confirma (não pode se
 *      auto-duplo-agendar entre duas ofertas suas).
 *  (3) DESCOBERTA por GÊNERO + DATA esconde quem não tem agenda — discoverServices(subjectConceptId=<gênero
 *      governado> + janela) só retorna performer com janela FUTURA sobrepondo o range (DECISION-0156 D2/D3,
 *      via hasCanonicalOfferingFutureAvailability). Banda sem janela naquele dia NÃO aparece; gênero errado
 *      NÃO casa.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { servicesRepository } from '../modules/services/services.repository';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { unifiedAvailabilityRepository } from '../core/availability/unified-availability.repository';
import { unifiedAvailabilityService } from '../core/availability/unified-availability.service';
import { AvailabilityOwnerType, UnifiedAvailabilityStatus } from '../core/availability/unified-availability.types';
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
  if (!/agenda|musical|performer|coupling|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `agenda-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

/** Resolve concept_id + canonical_service_id global de um slug de serviço GOVERNADO já semeado por migration. */
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

/** Resolve concept_id de um GÊNERO governado (shared_subject_concepts) por slug já semeado. */
async function resolveGenre(slug: string): Promise<string> {
  const r = (await pool.query<{ concept_id: string }>(
    `SELECT s.concept_id::text AS concept_id
       FROM shared_subject_concepts s JOIN concepts c ON c.concept_id = s.concept_id
      WHERE s.enabled = true AND c.slug = $1`,
    [slug]
  )).rows[0];
  if (!r) throw new Error(`gênero governado ausente: ${slug}`);
  return r.concept_id;
}

/** Publica uma banda completa: declara concept → service(active) → offering(active). Retorna ids. */
async function publishPerformer(tenantId: string, band: { userId: string; actorId: string }, name: string, canonical: { conceptId: string; canonicalId: string }, cityId: string): Promise<{ serviceId: string; offeringId: string }> {
  await professionalC1Service.declareConcept(tenantId, band.actorId, { conceptId: canonical.conceptId, skillLevel: 3 }, band.userId);
  const service = await servicesService.createService(tenantId, band.userId, {
    actorId: band.actorId,
    name,
    serviceType: ServiceType.SERVICE,
    status: ServiceStatus.ACTIVE,
    canonicalServiceId: canonical.canonicalId,
    cityId,
  });
  const { offering } = await serviceOfferingService.createOffering({
    tenantId, userId: band.userId, providerActorId: band.actorId,
    canonicalServiceId: canonical.canonicalId, priceCents: 250000, durationMinutes: 90,
  });
  await serviceOfferingService.updateOwnOffering({ tenantId, userId: band.userId, offeringId: offering.id, status: 'active' });
  return { serviceId: service.serviceId, offeringId: offering.id };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // Autoridade (canRepresentActor pool-path) — wire os ports como as rotas fazem.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Performer Agenda Coupling E2E', slug: `agenda-${Date.now()}` });
  const CITY = randomUUID();

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
  const bankBefore = await bankSnap();

  const musical = await resolveServiceConcept('apresentacao-musical');
  const photo = await resolveServiceConcept('fotografia-de-eventos'); // 2ª oferta do MESMO provider (cross-oferta)
  const ROCK = await resolveGenre('rock');
  const SAMBA = await resolveGenre('samba');

  // Atores
  const band = await mkUserActor(TENANT, 'Banda Aurora');           // performer principal (rock, com agenda)
  const bandNoAgenda = await mkUserActor(TENANT, 'Grupo Eclipse');   // rock, mas janela FORA do range
  const bandSamba = await mkUserActor(TENANT, 'Roda de Samba');      // samba (gênero diferente), com agenda
  const barZe = await mkUserActor(TENANT, 'Bar do Zé');             // contratante A
  const barLua = await mkUserActor(TENANT, 'Bar da Lua');           // contratante B (para a corrida)

  // ── Ancoragem temporal da "noite" (10 dias à frente), janelas meio-abertas [start,end).
  const H = 3600e3;
  const nightBase = Date.now() + 10 * 24 * H;      // referência = "19:00" da noite-alvo
  const t19 = new Date(nightBase);
  const t20 = new Date(nightBase + 1 * H);
  const t21 = new Date(nightBase + 2 * H);
  const t22 = new Date(nightBase + 3 * H);
  const t23 = new Date(nightBase + 4 * H);
  const t01 = new Date(nightBase + 6 * H);         // madrugada (mesma noite)
  const iso = (d: Date): string => d.toISOString();

  console.log('\n— performer abre a própria agenda na oferta de apresentação musical —');

  // Publica o performer principal (apresentacao-musical) e a 2ª oferta (fotografia) do MESMO provider.
  const main1 = await publishPerformer(TENANT, band, 'Show ao vivo — Banda Aurora', musical, CITY);
  const off2 = await publishPerformer(TENANT, band, 'Registro fotográfico — Banda Aurora', photo, CITY);
  // Taggeia o gênero rock na oferta musical (facet governado).
  await serviceOfferingService.tagOfferingGenres({ tenantId: TENANT, userId: band.userId, offeringId: main1.offeringId, subjectConceptIds: [ROCK] });

  // ════════ PROVA 1 — MULTI-JANELA na MESMA NOITE (19–21, 21–23 back-to-back, 23–01) ════════
  const slotA = await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: band.userId, offeringId: main1.offeringId, startDatetime: iso(t19), endDatetime: iso(t21) });
  const slotB = await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: band.userId, offeringId: main1.offeringId, startDatetime: iso(t21), endDatetime: iso(t23) });
  const slotC = await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: band.userId, offeringId: main1.offeringId, startDatetime: iso(t23), endDatetime: iso(t01) });
  const windows = await unifiedAvailabilityService.listAvailabilities(TENANT, { ownerType: AvailabilityOwnerType.SERVICE_OFFERING, ownerId: main1.offeringId, status: UnifiedAvailabilityStatus.ACTIVE });
  record('(1) MULTI-JANELA mesma noite: 3 janelas opt-in na mesma oferta (19–21, 21–23, 23–01)',
    windows.length === 3 && !!slotA.availabilityId && !!slotB.availabilityId && !!slotC.availabilityId,
    `janelas=${windows.length}`);

  // 2ª oferta (fotografia) do MESMO provider: janela 20–22 (SOBREPÕE slotA 19–21) — para prova cross-oferta.
  const slotD = await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: band.userId, offeringId: off2.offeringId, startDatetime: iso(t20), endDatetime: iso(t22) });

  // ════════ PROVA 2 — FIRST-COME + back-to-back + rollup cross-oferta ════════
  const mkBooking = async (availabilityId: string, requesterActorId: string): Promise<string> =>
    (await unifiedAvailabilityRepository.createBooking(TENANT, { availabilityId, requesterActorId })).bookingId;
  const isConflict = (e: any): boolean => /BOOKING_PROVIDER_TIME_CONFLICT/.test(String(e?.message ?? e));

  // 2a — dois bookings no MESMO slotA, confirms CONCORRENTES → exatamente 1 confirma, o outro 409.
  const bkA1 = await mkBooking(slotA.availabilityId, barZe.actorId);
  const bkA2 = await mkBooking(slotA.availabilityId, barLua.actorId);
  const race = await Promise.allSettled([
    unifiedAvailabilityRepository.confirmBookingWithProviderLock(TENANT, bkA1, band.actorId, iso(t19), iso(t21)),
    unifiedAvailabilityRepository.confirmBookingWithProviderLock(TENANT, bkA2, band.actorId, iso(t19), iso(t21)),
  ]);
  const confirmed = race.filter((r) => r.status === 'fulfilled').length;
  const conflicts = race.filter((r) => r.status === 'rejected' && isConflict((r as PromiseRejectedResult).reason)).length;
  record('(2a) FIRST-COME: 2 confirms concorrentes no MESMO slot → exatamente 1 confirma, o outro BOOKING_PROVIDER_TIME_CONFLICT',
    confirmed === 1 && conflicts === 1, `confirmados=${confirmed} conflitos=${conflicts}`);

  // 2b — back-to-back: slotB (21–23) toca slotA (…–21) no limite [start,end) → confirma (meio-aberto).
  const bkB = await mkBooking(slotB.availabilityId, barZe.actorId);
  let bBackToBack = false; let bReason = '';
  try { await unifiedAvailabilityRepository.confirmBookingWithProviderLock(TENANT, bkB, band.actorId, iso(t21), iso(t23)); bBackToBack = true; }
  catch (e: any) { bReason = String(e?.message ?? e); }
  record('(2b) BACK-TO-BACK coexiste: 21–23 confirma apesar de 19–21 confirmado (intervalo meio-aberto)',
    bBackToBack, bReason);

  // 2c — madrugada: slotC (23–01) da MESMA noite também confirma.
  const bkC = await mkBooking(slotC.availabilityId, barLua.actorId);
  let cConfirmed = false; let cReason = '';
  try { await unifiedAvailabilityRepository.confirmBookingWithProviderLock(TENANT, bkC, band.actorId, iso(t23), iso(t01)); cConfirmed = true; }
  catch (e: any) { cReason = String(e?.message ?? e); }
  record('(2c) MESMA NOITE múltiplos shows: 23–01 também confirma (agenda densa coexiste)',
    cConfirmed, cReason);

  // 2d — CROSS-OFERTA: booking na 2ª oferta (fotografia, slotD 20–22 sobrepõe slotA já confirmado) →
  //      NÃO confirma. O rollup é por PROVIDER (via availability→service_offering→provider_actor_id), não
  //      pela oferta isolada: a banda não pode se auto-duplo-agendar entre duas ofertas suas no mesmo instante.
  const bkD = await mkBooking(slotD.availabilityId, barZe.actorId);
  let dConflict = false; let dReason = 'NO_THROW';
  try { await unifiedAvailabilityRepository.confirmBookingWithProviderLock(TENANT, bkD, band.actorId, iso(t20), iso(t22)); }
  catch (e: any) { dReason = String(e?.message ?? e); dConflict = isConflict(e); }
  record('(2d) ROLLUP CROSS-OFERTA por provider: 2ª oferta com janela sobreposta → BOOKING_PROVIDER_TIME_CONFLICT',
    dConflict, dReason.slice(0, 80));

  // ════════ PROVA 3 — DESCOBERTA por GÊNERO + DATA esconde quem não tem agenda ════════
  // bandSamba: gênero samba, COM janela no range (isola o efeito do gênero — não é filtrada por data).
  const sambaPub = await publishPerformer(TENANT, bandSamba, 'Samba na Praça', musical, CITY);
  await serviceOfferingService.tagOfferingGenres({ tenantId: TENANT, userId: bandSamba.userId, offeringId: sambaPub.offeringId, subjectConceptIds: [SAMBA] });
  await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: bandSamba.userId, offeringId: sambaPub.offeringId, startDatetime: iso(t19), endDatetime: iso(t21) });

  // bandNoAgenda: gênero rock (passa o filtro de gênero), mas janela FORA do range pedido (30 dias à frente).
  const noAgendaPub = await publishPerformer(TENANT, bandNoAgenda, 'Eclipse Rock', musical, CITY);
  await serviceOfferingService.tagOfferingGenres({ tenantId: TENANT, userId: bandNoAgenda.userId, offeringId: noAgendaPub.offeringId, subjectConceptIds: [ROCK] });
  const farStart = new Date(Date.now() + 40 * 24 * H);
  await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: bandNoAgenda.userId, offeringId: noAgendaPub.offeringId, startDatetime: iso(farStart), endDatetime: iso(new Date(farStart.getTime() + 2 * H)) });

  // Descoberta: gênero ROCK + janela da noite-alvo.
  const rockInRange = await servicesService.discoverServices(TENANT, {
    subjectConceptId: ROCK,
    startDate: iso(new Date(nightBase - 1 * H)),
    endDate: iso(t01),
  });
  const ids = new Set(rockInRange.map((s) => s.serviceId));
  record('(3a) discoverServices(gênero=rock + data) ENCONTRA a banda com janela na noite',
    ids.has(main1.serviceId), `n=${rockInRange.length} ids=${[...ids].map((x) => x.slice(0, 8)).join(',')}`);
  record('(3b) ESCONDE quem não tem agenda no range: banda rock com janela só a 40 dias NÃO aparece',
    !ids.has(noAgendaPub.serviceId), `eclipse=${noAgendaPub.serviceId.slice(0, 8)} presente=${ids.has(noAgendaPub.serviceId)}`);
  record('(3c) GÊNERO material: banda de samba (com agenda) NÃO casa na busca por rock',
    !ids.has(sambaPub.serviceId), `samba=${sambaPub.serviceId.slice(0, 8)} presente=${ids.has(sambaPub.serviceId)}`);

  // Simetria: busca por SAMBA no mesmo range casa a banda de samba e NÃO a de rock.
  const sambaInRange = await servicesService.discoverServices(TENANT, {
    subjectConceptId: SAMBA,
    startDate: iso(new Date(nightBase - 1 * H)),
    endDate: iso(t01),
  });
  const sIds = new Set(sambaInRange.map((s) => s.serviceId));
  record('(3d) SIMETRIA: busca por samba casa a roda de samba e NÃO a banda de rock',
    sIds.has(sambaPub.serviceId) && !sIds.has(main1.serviceId), `n=${sambaInRange.length}`);

  // ════════ Δbank = 0 ════════
  const bankAfter = await bankSnap();
  record('(bank) Δbank=0 — nenhum lançamento financeiro', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

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
