/**
 * E2E — ARCO FUNDAÇÃO EVENTOS · FATIA 1 · BANDA NASCE COMO GRUPO-ACTOR PROVIDER. Prova, POR API DIRETA
 * (camada de serviço/repositório REAL — "a verdade vive no backend", nunca via frontend), que uma BANDA é
 * uma linha de `groups` com seu grupo-actor 1:1 (nascimento ansioso via groupsService.createGroup →
 * ensureGroupActor) e que a oferta `apresentacao-musical` da banda pendura no GRUPO-ACTOR como
 * provider_actor_id. Bank-free (Δbank=0). ZERO tabelas novas — composição de writers SELADOS
 * (createGroup → declareConcept(grupo-actor) → createService → createOffering → updateOwnOffering active).
 * DB efêmera. NUNCA unificard_dev.
 *
 * NOVE PROVAS:
 *  (1) NASCIMENTO: createGroup REAL → groups.actor_id NOT NULL; actors.actor_type='group';
 *      responsible_actor_id = actor do dono (âncora civil, nascimento ansioso).
 *  (2) DESBLOQUEIO COLETIVO: dono declara `apresentacao-musical` NO grupo-actor → createService(actorId=
 *      grupo-actor) passa (Blocker-1: ramo COLETIVO em assertDeclarationEligibility) → createOffering
 *      (provider=grupo-actor) → updateOwnOffering 'active' passa (Blocker-2: mínimo civil via ÂNCORA
 *      responsible_actor_id no gate de ativação). Pré-declaração falha DECLARATION_REQUIRED (ramo vivo).
 *  (3) FACET+AGENDA: tagOfferingGenres + declareAvailability multi-janela na oferta do grupo-actor —
 *      writers selados aceitam provider coletivo.
 *  (4) DESCOBERTA gênero+data acha a banda (0156 intacto); banda sem janela no range fica oculta.
 *  (5) PROVIDER-LOCK: 2 confirms concorrentes no MESMO slot da banda → exatamente 1 confirmado + 1
 *      BOOKING_PROVIDER_TIME_CONFLICT (C-AGENDA inalterado com provider grupo).
 *  (6) "UM HOMEM, MUITOS ATOS" (DECISION-0145): o user-actor do PRÓPRIO dono publica oferta SOLO no MESMO
 *      canônico → as duas ofertas coexistem (providers distintos); confirmar o slot da BANDA NÃO conflita
 *      o slot SOLO do dono no mesmo horário (provider-locks distintos) — vocalista em dois atos.
 *  (7) NEGATIVOS: não-dono → 403 em declareConcept(grupo-actor) e createOffering(provider=grupo-actor)
 *      (canRepresentActor fail-closed); grupo-actor DESCARTÁVEL com âncora sem mínimo civil (full_name da
 *      âncora anulado por SQL direto — cpf é fisicamente NOT NULL, identity é FK-presa por actors e
 *      responsible_actor_id é trigger-preso; o elo civil quebrável do MESMO predicado é o nome civil) →
 *      ativação falha OFFERING_ACTIVATION_CIVIL_MINIMUM_REQUIRED.
 *  (8) retireConcept NO grupo-actor suspende SÓ a oferta da BANDA (oferta solo do dono intocada).
 *  (9) Δbank=0 em tudo.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { groupsService } from '../modules/groups/groups.service';
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
  if (!/band|group|actor|provider|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 53).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `band-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, globalUserId: gu };
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

/** Banda REAL: createGroup canônico → devolve groupId + grupo-actor (nascimento ansioso). */
async function bornBand(tenantId: string, ownerUserId: string, name: string): Promise<{ groupId: string; groupActorId: string }> {
  const group = await groupsService.createGroup(tenantId, ownerUserId, {
    name,
    description: `Banda coletiva ${name} — fatia 1 do arco fundação eventos (grupo-actor provider).`,
  });
  const row = (await pool.query<{ actor_id: string | null }>(
    `SELECT actor_id::text AS actor_id FROM groups WHERE id = $1::uuid`,
    [group.groupId]
  )).rows[0];
  if (!row?.actor_id) throw new Error(`groups.actor_id NULL após createGroup (${name})`);
  return { groupId: group.groupId, groupActorId: row.actor_id };
}

/** Publica um provider (user OU grupo-actor): declara concept → service(active) → offering(active). */
async function publishProvider(
  tenantId: string,
  operatorUserId: string,
  providerActorId: string,
  name: string,
  canonical: { conceptId: string; canonicalId: string },
  cityId: string,
  opts?: { skipActivate?: boolean }
): Promise<{ serviceId: string; offeringId: string }> {
  await professionalC1Service.declareConcept(tenantId, providerActorId, { conceptId: canonical.conceptId, skillLevel: 3 }, operatorUserId);
  const service = await servicesService.createService(tenantId, operatorUserId, {
    actorId: providerActorId,
    name,
    serviceType: ServiceType.SERVICE,
    status: ServiceStatus.ACTIVE,
    canonicalServiceId: canonical.canonicalId,
    cityId,
  });
  const { offering } = await serviceOfferingService.createOffering({
    tenantId, userId: operatorUserId, providerActorId,
    canonicalServiceId: canonical.canonicalId, priceCents: 250000, durationMinutes: 90,
  });
  if (!opts?.skipActivate) {
    await serviceOfferingService.updateOwnOffering({ tenantId, userId: operatorUserId, offeringId: offering.id, status: 'active' });
  }
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
  await tenantService.createTenant({ id: TENANT, name: 'Band Group-Actor Provider E2E', slug: `band-${Date.now()}` });
  const CITY = randomUUID();

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
  const bankBefore = await bankSnap();

  const musical = await resolveServiceConcept('apresentacao-musical');
  const ROCK = await resolveGenre('rock');

  // Atores humanos
  const ana = await mkUserActor(TENANT, 'Ana Vocalista');       // dona da banda + ato SOLO (prova 6)
  const beto = await mkUserActor(TENANT, 'Beto Descartável');   // dono do grupo DESCARTÁVEL (prova 7b)
  const diana = await mkUserActor(TENANT, 'Diana Eclipse');     // dona da banda SEM janela no range (prova 4)
  const intruso = await mkUserActor(TENANT, 'Carlos Intruso');  // não-dono (prova 7a)
  const barZe = await mkUserActor(TENANT, 'Bar do Zé');         // contratante A
  const barLua = await mkUserActor(TENANT, 'Bar da Lua');       // contratante B (corrida)

  // Ancoragem temporal da "noite" (10 dias à frente), janelas meio-abertas [start,end).
  const H = 3600e3;
  const nightBase = Date.now() + 10 * 24 * H;
  const t19 = new Date(nightBase);
  const t21 = new Date(nightBase + 2 * H);
  const t23 = new Date(nightBase + 4 * H);
  const iso = (d: Date): string => d.toISOString();

  console.log('\n— (1) banda nasce como grupo-actor via createGroup REAL —');
  const banda = await bornBand(TENANT, ana.userId, 'Banda Fable');
  const gActor = (await pool.query<{ actor_type: string; group_id: string | null; responsible_actor_id: string | null }>(
    `SELECT actor_type, group_id::text AS group_id, responsible_actor_id::text AS responsible_actor_id
       FROM actors WHERE id = $1::uuid`,
    [banda.groupActorId]
  )).rows[0];
  record('(1) NASCIMENTO ansioso: groups.actor_id NOT NULL · actor_type=group · responsible = actor da dona',
    !!banda.groupActorId && gActor?.actor_type === 'group' && gActor?.group_id === banda.groupId && gActor?.responsible_actor_id === ana.actorId,
    `type=${gActor?.actor_type} resp=${gActor?.responsible_actor_id?.slice(0, 8)} dona=${ana.actorId.slice(0, 8)}`);

  console.log('\n— (2) desbloqueio COLETIVO: declaração no grupo-actor → service → offering → active —');
  // 2-pre: SEM declaração, createService no grupo-actor deve falhar DECLARATION_REQUIRED (ramo COLETIVO vivo,
  // não SUBJECT_UNSUPPORTED e não sucesso).
  let preMsg = 'NO_THROW';
  try {
    await servicesService.createService(TENANT, ana.userId, {
      actorId: banda.groupActorId, name: 'pré-declaração', serviceType: ServiceType.SERVICE,
      status: ServiceStatus.ACTIVE, canonicalServiceId: musical.canonicalId, cityId: CITY,
    });
  } catch (e: any) { preMsg = String(e?.message ?? e); }
  record('(2-pre) grupo-actor SEM declaração → SERVICE_ELIGIBILITY_DECLARATION_REQUIRED (ramo COLETIVO checa de verdade)',
    /SERVICE_ELIGIBILITY_DECLARATION_REQUIRED/.test(preMsg) && !/SUBJECT_UNSUPPORTED/.test(preMsg), preMsg.slice(0, 90));

  const bandaPub = await publishProvider(TENANT, ana.userId, banda.groupActorId, 'Show ao vivo — Banda Fable', musical, CITY);
  const bandaStatus = (await pool.query<{ status: string; provider_actor_id: string; company_id: string | null }>(
    `SELECT status, provider_actor_id::text AS provider_actor_id, company_id::text AS company_id
       FROM service_offerings WHERE id = $1::uuid`,
    [bandaPub.offeringId]
  )).rows[0];
  record('(2) Blocker-1+2 provados: declareConcept(grupo-actor) → createService → createOffering(provider=grupo-actor) → ACTIVE via âncora civil',
    bandaStatus?.status === 'active' && bandaStatus?.provider_actor_id === banda.groupActorId && bandaStatus?.company_id === null,
    `status=${bandaStatus?.status} provider=${bandaStatus?.provider_actor_id?.slice(0, 8)}`);

  console.log('\n— (3) facet de gênero + agenda multi-janela no grupo-actor —');
  await serviceOfferingService.tagOfferingGenres({ tenantId: TENANT, userId: ana.userId, offeringId: bandaPub.offeringId, subjectConceptIds: [ROCK] });
  const slotA = await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: ana.userId, offeringId: bandaPub.offeringId, startDatetime: iso(t19), endDatetime: iso(t21) });
  const slotB = await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: ana.userId, offeringId: bandaPub.offeringId, startDatetime: iso(t21), endDatetime: iso(t23) });
  const windows = await unifiedAvailabilityService.listAvailabilities(TENANT, { ownerType: AvailabilityOwnerType.SERVICE_OFFERING, ownerId: bandaPub.offeringId, status: UnifiedAvailabilityStatus.ACTIVE });
  record('(3) writers selados aceitam provider coletivo: gênero taggeado + 2 janelas (19–21, 21–23) na oferta do grupo-actor',
    windows.length === 2 && !!slotA.availabilityId && !!slotB.availabilityId, `janelas=${windows.length}`);

  console.log('\n— (4) descoberta por gênero+data (0156 intacto) —');
  // Banda de Diana: rock, mas janela SÓ a 40 dias — deve ficar OCULTA no range da noite-alvo.
  const eclipse = await bornBand(TENANT, diana.userId, 'Eclipse Coletivo');
  const eclipsePub = await publishProvider(TENANT, diana.userId, eclipse.groupActorId, 'Eclipse Coletivo ao vivo', musical, CITY);
  await serviceOfferingService.tagOfferingGenres({ tenantId: TENANT, userId: diana.userId, offeringId: eclipsePub.offeringId, subjectConceptIds: [ROCK] });
  const farStart = new Date(Date.now() + 40 * 24 * H);
  await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: diana.userId, offeringId: eclipsePub.offeringId, startDatetime: iso(farStart), endDatetime: iso(new Date(farStart.getTime() + 2 * H)) });
  const found = await servicesService.discoverServices(TENANT, {
    subjectConceptId: ROCK,
    startDate: iso(new Date(nightBase - 1 * H)),
    endDate: iso(t23),
  });
  const ids = new Set(found.map((s) => s.serviceId));
  record('(4) gênero+data ACHA a banda com janela na noite e ESCONDE a banda sem janela no range',
    ids.has(bandaPub.serviceId) && !ids.has(eclipsePub.serviceId),
    `n=${found.length} fable=${ids.has(bandaPub.serviceId)} eclipse=${ids.has(eclipsePub.serviceId)}`);

  console.log('\n— (5) provider-lock com provider grupo-actor —');
  const mkBooking = async (availabilityId: string, requesterActorId: string): Promise<string> =>
    (await unifiedAvailabilityRepository.createBooking(TENANT, { availabilityId, requesterActorId })).bookingId;
  const isConflict = (e: any): boolean => /BOOKING_PROVIDER_TIME_CONFLICT/.test(String(e?.message ?? e));
  const bkA1 = await mkBooking(slotA.availabilityId, barZe.actorId);
  const bkA2 = await mkBooking(slotA.availabilityId, barLua.actorId);
  const race = await Promise.allSettled([
    unifiedAvailabilityRepository.confirmBookingWithProviderLock(TENANT, bkA1, banda.groupActorId, iso(t19), iso(t21)),
    unifiedAvailabilityRepository.confirmBookingWithProviderLock(TENANT, bkA2, banda.groupActorId, iso(t19), iso(t21)),
  ]);
  const confirmed = race.filter((r) => r.status === 'fulfilled').length;
  const conflicts = race.filter((r) => r.status === 'rejected' && isConflict((r as PromiseRejectedResult).reason)).length;
  record('(5) 2 confirms concorrentes no MESMO slot da banda → exatamente 1 confirmado + 1 BOOKING_PROVIDER_TIME_CONFLICT',
    confirmed === 1 && conflicts === 1, `confirmados=${confirmed} conflitos=${conflicts}`);

  console.log('\n— (6) "um homem, muitos atos" — SOLO da dona coexiste com a BANDA (DECISION-0145) —');
  const solo = await publishProvider(TENANT, ana.userId, ana.actorId, 'Voz e violão — Ana solo', musical, CITY);
  const both = (await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM service_offerings
      WHERE canonical_service_id = $1::uuid AND status = 'active'
        AND provider_actor_id IN ($2::uuid, $3::uuid)`,
    [musical.canonicalId, banda.groupActorId, ana.actorId]
  )).rows[0].n;
  record('(6a) as DUAS ofertas ativas coexistem no MESMO canônico (providers distintos: grupo-actor × user-actor)',
    both === '2', `ativas=${both}`);
  // Slot SOLO no MESMO horário 19–21 da banda (que JÁ tem confirm no slotA) → confirma: locks por provider distinto.
  const soloSlot = await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId: ana.userId, offeringId: solo.offeringId, startDatetime: iso(t19), endDatetime: iso(t21) });
  const bkSolo = await mkBooking(soloSlot.availabilityId, barLua.actorId);
  let soloConfirmed = false; let soloReason = '';
  try { await unifiedAvailabilityRepository.confirmBookingWithProviderLock(TENANT, bkSolo, ana.actorId, iso(t19), iso(t21)); soloConfirmed = true; }
  catch (e: any) { soloReason = String(e?.message ?? e); }
  record('(6b) confirm da BANDA 19–21 NÃO conflita o SOLO da dona 19–21 (provider-locks distintos — vocalista em 2 atos)',
    soloConfirmed, soloReason.slice(0, 90));

  console.log('\n— (7) negativos fail-closed —');
  // 7a — não-dono: declareConcept no grupo-actor → 403; createOffering(provider=grupo-actor) → 403.
  let n1 = 'NO_THROW';
  try { await professionalC1Service.declareConcept(TENANT, banda.groupActorId, { conceptId: musical.conceptId, skillLevel: 2 }, intruso.userId); }
  catch (e: any) { n1 = `${e?.statusCode ?? e?.status ?? '?'}:${String(e?.message ?? e)}`; }
  let n2 = 'NO_THROW';
  try {
    await serviceOfferingService.createOffering({
      tenantId: TENANT, userId: intruso.userId, providerActorId: banda.groupActorId,
      canonicalServiceId: musical.canonicalId, priceCents: 100, durationMinutes: 60,
    });
  } catch (e: any) { n2 = `${e?.statusCode ?? '?'}:${e?.code ?? String(e?.message ?? e)}`; }
  record('(7a) não-dono → 403 no declareConcept(grupo-actor) E no createOffering(provider=grupo-actor)',
    /^403:/.test(n1) && n2 === '403:SERVICE_OFFERING_NOT_REPRESENTABLE', `decl=${n1.slice(0, 50)} off=${n2.slice(0, 60)}`);

  // 7b — grupo DESCARTÁVEL: cadeia completa até draft; QUEBRA do mínimo civil da âncora por SQL direto:
  // full_name da âncora anulado (cpf é fisicamente NOT NULL; identities é FK-presa por actors.fk_actor_identity;
  // responsible_actor_id é preso pelo trigger §4.8 — o elo do MESMO predicado civil que É quebrável é o nome
  // civil). Gate NÃO afrouxado → ativação falha CIVIL_MINIMUM (revalidação VIVA no momento da ativação).
  const descartavel = await bornBand(TENANT, beto.userId, 'Grupo Descartável');
  const descPub = await publishProvider(TENANT, beto.userId, descartavel.groupActorId, 'Show descartável', musical, CITY, { skipActivate: true });
  await pool.query(`UPDATE global_users SET full_name = NULL WHERE global_user_id = $1::uuid`, [beto.globalUserId]);
  let n3 = 'NO_THROW';
  try { await serviceOfferingService.updateOwnOffering({ tenantId: TENANT, userId: beto.userId, offeringId: descPub.offeringId, status: 'active' }); }
  catch (e: any) { n3 = String(e?.message ?? e); }
  record('(7b) âncora sem mínimo civil (full_name anulado por SQL no grupo descartável) → OFFERING_ACTIVATION_CIVIL_MINIMUM_REQUIRED',
    /OFFERING_ACTIVATION_CIVIL_MINIMUM_REQUIRED/.test(n3), n3.slice(0, 90));

  console.log('\n— (8) retireConcept no grupo-actor suspende SÓ a oferta da banda —');
  await professionalC1Service.retireConcept(TENANT, banda.groupActorId, musical.conceptId, ana.userId);
  const after = (await pool.query<{ id: string; status: string }>(
    `SELECT id::text AS id, status FROM service_offerings WHERE id IN ($1::uuid, $2::uuid)`,
    [bandaPub.offeringId, solo.offeringId]
  )).rows;
  const bandaAfter = after.find((r) => r.id === bandaPub.offeringId)?.status;
  const soloAfter = after.find((r) => r.id === solo.offeringId)?.status;
  record('(8) cascata Q5 por PROVIDER: oferta da BANDA suspended · oferta SOLO da dona segue active',
    bandaAfter === 'suspended' && soloAfter === 'active', `banda=${bandaAfter} solo=${soloAfter}`);

  console.log('\n— (9) Δbank —');
  const bankAfter = await bankSnap();
  record('(9) Δbank=0 — nenhum lançamento financeiro', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

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
