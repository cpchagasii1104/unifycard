/**
 * E2E — ARCO FUNDAÇÃO EVENTOS · FATIA 4 (A ÚLTIMA) · AVISO SUAVE DE CONFLITO POR PESSOA (cross-membership).
 * Prova, POR API DIRETA (chokepoint REAL de confirm — unifiedAvailabilityService.updateBooking), que
 * quando um booking CONFIRMA para o provider P, o sistema detecta compromissos confirmados SOBREPOSTOS
 * de qualquer PESSOA ligada a P nas OUTRAS dimensões dela (outras bandas via memberships ativas; solo
 * via o próprio user-actor) e emite AVISO SUAVE no event_outbox (sink OP-2: effect
 * AVAILABILITY_CONFLICT_DETECTED com metadata.source='booking_confirm_cross_membership') — NUNCA
 * bloqueando. Doutrina: "a agenda é universal (por pessoa), mas sem engessar — NOTIFICAÇÃO, nunca
 * bloqueio duro." Bank-free (Δbank=0). ZERO migrations. DB efêmera. NUNCA unificard_dev.
 *
 * PROVAS:
 *  (1) vocalista V membro das bandas A e B REAIS (createGroup + intent bilateral invite/accept);
 *      as duas bandas + o ato SOLO de V publicados (cadeia selada declare→service→offering→active)
 *      com availabilities declaradas.
 *  (2) confirm A@19-21 → confirmed; ZERO avisos (nenhum compromisso prévio).
 *  (3) confirm B@20-22 (sobrepõe A) → AMBOS confirmados (SEM bloqueio!); outbox ganha 2 avisos:
 *      destinatários = V (pessoa em conflito) + dono da banda B (cujo booking acabou de confirmar);
 *      payload/dedupeKey com par ordenado de bookings + memberActorId corretos.
 *  (4) back-to-back B2@22-24 → confirmed, ZERO avisos novos (meio-aberto + hard-lock intacto).
 *  (5) direção SOLO: confirm solo V@21-23 → sobrepõe B@20-22 e B2@22-24 → 2 avisos (destinatário
 *      único V: pessoa == dono do ato solo, colapsado por event_id determinístico); fronteira
 *      MEIO-ABERTA provada: NENHUM aviso do par com A@19-21 (termina exatamente às 21).
 *      E o REVERSO: booking de banda A@22:30-23:30 sobrepondo o solo confirmado de V (e B2) →
 *      4 avisos (pares A2~S1 e A2~B2 × destinatários V + dona da banda A).
 *  (6) DEDUP: re-rodar a detecção do MESMO confirm → outbox NÃO ganha linha (ON CONFLICT event_id).
 *  (7) selado intacto + não-crítico REAL: 2º confirm no MESMO slot do MESMO provider → 409
 *      BOOKING_PROVIDER_TIME_CONFLICT (ANTES de qualquer aviso); e com a detecção QUEBRADA de
 *      verdade (tabela de memberships renomeada temporariamente) o confirm SUCEDE mesmo assim.
 *  (8) Δbank=0.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { unifiedAvailabilityRepository } from '../core/availability/unified-availability.repository';
import { unifiedAvailabilityService } from '../core/availability/unified-availability.service';
import { detectAndEmitCrossMembershipSoftConflict } from '../core/availability/booking-soft-conflict';
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
  if (!/band|group|actor|provider|conflict|membership|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `soft-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, globalUserId: gu };
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

/** Publica um provider (user OU grupo-actor): declara concept → service(active) → offering → active. */
async function publishProvider(
  tenantId: string,
  operatorUserId: string,
  providerActorId: string,
  name: string,
  canonical: { conceptId: string; canonicalId: string },
  cityId: string
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
  await serviceOfferingService.updateOwnOffering({ tenantId, userId: operatorUserId, offeringId: offering.id, status: 'active' });
  return { serviceId: service.serviceId, offeringId: offering.id };
}

const codeOf = (e: any): string => `${e?.statusCode ?? '?'}:${String(e?.message ?? e).slice(0, 80)}`;

async function main(): Promise<void> {
  await assertEphemeralDb();

  // Autoridade + ports de groups — wire como as rotas fazem (molde F3).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { groupsPortsRegistry } = await import('../core/groups/ports-registry');
  const ga = await import('../modules/groups/adapters');
  groupsPortsRegistry.setGroupsRepository(ga.groupsRepositoryAdapter);
  const { groupsService } = await import('../modules/groups/groups.service');

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Band Soft-Conflict E2E', slug: `soft-${Date.now()}` });
  const CITY = randomUUID();

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
  const bankBefore = await bankSnap();

  type SoftRow = { event_id: string; payload: any; metadata: any };
  const softRows = async (): Promise<SoftRow[]> =>
    (await pool.query<SoftRow>(
      `SELECT event_id::text AS event_id, payload, metadata
         FROM event_outbox
        WHERE tenant_id = $1::uuid AND event_type = 'AVAILABILITY_CONFLICT_DETECTED'
          AND metadata->>'source' = 'booking_confirm_cross_membership'
        ORDER BY id ASC`,
      [TENANT]
    )).rows;

  const musical = await resolveServiceConcept('apresentacao-musical');

  // Atores humanos
  const ana = await mkUserActor(TENANT, 'Ana Dona da Banda A');
  const bob = await mkUserActor(TENANT, 'Bob Dono da Banda B');
  const vic = await mkUserActor(TENANT, 'Vic Vocalista');   // a PESSOA nas duas bandas + solo
  const barZe = await mkUserActor(TENANT, 'Bar do Zé');     // contratante 1
  const barLua = await mkUserActor(TENANT, 'Bar da Lua');   // contratante 2

  // Ancoragem temporal (10 dias à frente); janelas meio-abertas [start,end).
  const H = 3600e3;
  const nightBase = Date.now() + 10 * 24 * H;
  const t = (h: number): string => new Date(nightBase + (h - 19) * H).toISOString();

  console.log('\n— (1) duas bandas reais + V membro de ambas por intent bilateral + 3 providers publicados —');
  const grpA = await groupsService.createGroup(TENANT, ana.userId, { name: 'Banda A', description: 'Banda A do E2E da fatia 4 — aviso suave cross-membership.' });
  const grpB = await groupsService.createGroup(TENANT, bob.userId, { name: 'Banda B', description: 'Banda B do E2E da fatia 4 — aviso suave cross-membership.' });
  const actorOfGroup = async (groupId: string): Promise<string> => {
    const r = (await pool.query<{ actor_id: string | null }>(`SELECT actor_id::text AS actor_id FROM groups WHERE id = $1::uuid`, [groupId])).rows[0];
    if (!r?.actor_id) throw new Error('groups.actor_id NULL após createGroup');
    return r.actor_id;
  };
  const bandA = await actorOfGroup(grpA.groupId);
  const bandB = await actorOfGroup(grpB.groupId);
  const invA = await groupsService.createInvite(TENANT, grpA.groupId, vic.actorId, ana.userId);
  await groupsService.acceptInvite(TENANT, invA.inviteId, vic.userId);
  const invB = await groupsService.createInvite(TENANT, grpB.groupId, vic.actorId, bob.userId);
  await groupsService.acceptInvite(TENANT, invB.inviteId, vic.userId);
  const activeOf = async (groupId: string): Promise<string> =>
    (await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM group_actor_memberships WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND status='active'`,
      [TENANT, groupId]
    )).rows[0].n;
  const pubA = await publishProvider(TENANT, ana.userId, bandA, 'Show — Banda A', musical, CITY);
  const pubB = await publishProvider(TENANT, bob.userId, bandB, 'Show — Banda B', musical, CITY);
  const pubS = await publishProvider(TENANT, vic.userId, vic.actorId, 'Voz e violão — Vic solo', musical, CITY);
  record('(1) bandas A e B reais (2 memberships ativas cada: dono-gênese + V) + 3 providers ativos (A, B, solo V)',
    (await activeOf(grpA.groupId)) === '2' && (await activeOf(grpB.groupId)) === '2' && !!pubA.offeringId && !!pubB.offeringId && !!pubS.offeringId,
    `A=${await activeOf(grpA.groupId)} B=${await activeOf(grpB.groupId)}`);

  // Availabilities (todas meio-abertas)
  const declare = async (userId: string, offeringId: string, hs: number, he: number) =>
    (await serviceOfferingService.declareAvailability({ tenantId: TENANT, userId, offeringId, startDatetime: t(hs), endDatetime: t(he) })).availabilityId;
  const avA1 = await declare(ana.userId, pubA.offeringId, 19, 21);
  const avA2 = await declare(ana.userId, pubA.offeringId, 22.5, 23.5);
  const avB1 = await declare(bob.userId, pubB.offeringId, 20, 22);
  const avB2 = await declare(bob.userId, pubB.offeringId, 22, 24);
  const avS1 = await declare(vic.userId, pubS.offeringId, 21, 23);
  const avS2 = await declare(vic.userId, pubS.offeringId, 24, 26);

  const mkBooking = async (availabilityId: string, requesterActorId: string): Promise<string> =>
    (await unifiedAvailabilityRepository.createBooking(TENANT, { availabilityId, requesterActorId })).bookingId;
  const confirm = async (bookingId: string, operatorUserId: string) =>
    unifiedAvailabilityService.updateBooking(TENANT, bookingId, operatorUserId, { status: UnifiedBookingStatus.CONFIRMED });

  console.log('\n— (2) confirm A@19-21: sem compromissos prévios → zero avisos —');
  const bkA1 = await mkBooking(avA1, barZe.actorId);
  const cA1 = await confirm(bkA1, ana.userId);
  const rows2 = await softRows();
  record('(2) A@19-21 confirmado pelo chokepoint; ZERO avisos cross-membership',
    cA1.status === UnifiedBookingStatus.CONFIRMED && rows2.length === 0, `avisos=${rows2.length}`);

  console.log('\n— (3) confirm B@20-22 sobrepondo A: AMBOS confirmados (sem bloqueio!) + 2 avisos —');
  const bkB1 = await mkBooking(avB1, barLua.actorId);
  const cB1 = await confirm(bkB1, bob.userId);
  const rows3 = await softRows();
  const pairOf = (r: SoftRow): string => [r.metadata.bookingId, r.metadata.otherBookingId].sort().join('~');
  const expectPair31 = [bkA1, bkB1].sort().join('~');
  const recips3 = new Set(rows3.map((r) => r.payload.actorId));
  record('(3a) B@20-22 CONFIRMADO mesmo com V já comprometida na banda A (aviso, NUNCA bloqueio)',
    cB1.status === UnifiedBookingStatus.CONFIRMED, `status=${cB1.status}`);
  record('(3b) outbox ganha 2 avisos do par A~B: destinatários = V (pessoa) + dono da banda B',
    rows3.length === 2 && rows3.every((r) => pairOf(r) === expectPair31 && r.metadata.memberActorId === vic.actorId)
      && recips3.has(vic.actorId) && recips3.has(bob.actorId),
    `n=${rows3.length} recips=${[...recips3].map((x) => String(x).slice(0, 8)).join(',')}`);
  record('(3c) payload/dedupe honestos: effect governado, availability do confirm como sourceId, dedupeKey com par ordenado',
    rows3.every((r) => r.payload.sourceId === avB1 && r.metadata.availabilityId === avB1
      && String(r.metadata.dedupeKey).includes(expectPair31) && r.metadata.otherProviderActorId === bandA),
    rows3[0] ? String(rows3[0].metadata.dedupeKey).slice(0, 60) : 'sem linha');

  console.log('\n— (4) back-to-back B2@22-24: hard-lock passa (meio-aberto) e zero avisos novos —');
  const bkB2 = await mkBooking(avB2, barZe.actorId);
  const cB2 = await confirm(bkB2, bob.userId);
  const rows4 = await softRows();
  record('(4) B2@22-24 confirmado (back-to-back com B@20-22) e NENHUM aviso novo (A 19-21 não sobrepõe)',
    cB2.status === UnifiedBookingStatus.CONFIRMED && rows4.length === rows3.length, `avisos=${rows4.length}`);

  console.log('\n— (5) direção SOLO + fronteira meio-aberta + reverso banda→solo —');
  const bkS1 = await mkBooking(avS1, barLua.actorId);
  const cS1 = await confirm(bkS1, vic.userId);
  const rows5a = await softRows();
  const newRows5a = rows5a.slice(rows4.length);
  const pairsS1 = new Set(newRows5a.map(pairOf));
  record('(5a) solo V@21-23 confirmado → 2 avisos (pares S1~B1 e S1~B2); destinatário ÚNICO V (pessoa==dono colapsado por event_id)',
    cS1.status === UnifiedBookingStatus.CONFIRMED && newRows5a.length === 2
      && pairsS1.has([bkS1, bkB1].sort().join('~')) && pairsS1.has([bkS1, bkB2].sort().join('~'))
      && newRows5a.every((r) => r.payload.actorId === vic.actorId && r.metadata.memberActorId === vic.actorId),
    `novos=${newRows5a.length}`);
  record('(5b) MEIO-ABERTO provado na detecção: NENHUM aviso do par S1~A1 (A termina exatamente às 21, solo começa às 21)',
    !rows5a.some((r) => pairOf(r) === [bkS1, bkA1].sort().join('~')));
  const bkA2 = await mkBooking(avA2, barZe.actorId);
  const cA2 = await confirm(bkA2, ana.userId);
  const rows5c = await softRows();
  const newRows5c = rows5c.slice(rows5a.length);
  const pairsA2 = new Set(newRows5c.map(pairOf));
  const recips5c = new Set(newRows5c.map((r) => r.payload.actorId));
  record('(5c) REVERSO: banda A@22:30-23:30 sobrepondo solo confirmado (e B2) → 4 avisos (2 pares × V + dona da banda A)',
    cA2.status === UnifiedBookingStatus.CONFIRMED && newRows5c.length === 4
      && pairsA2.has([bkA2, bkS1].sort().join('~')) && pairsA2.has([bkA2, bkB2].sort().join('~'))
      && recips5c.has(vic.actorId) && recips5c.has(ana.actorId),
    `novos=${newRows5c.length} recips=${[...recips5c].map((x) => String(x).slice(0, 8)).join(',')}`);

  console.log('\n— (6) DEDUP: re-rodar a detecção do MESMO confirm não duplica —');
  const emitted6 = await detectAndEmitCrossMembershipSoftConflict({
    tenantId: TENANT, providerActorId: bandA, bookingId: bkA2, availabilityId: avA2,
    startIso: t(22.5), endIso: t(23.5),
  });
  const rows6 = await softRows();
  record('(6) re-detecção idêntica: candidatos re-emitidos idempotentes e outbox SEM linha nova (ON CONFLICT event_id)',
    emitted6 === 4 && rows6.length === rows5c.length, `candidatos=${emitted6} total=${rows6.length}`);

  console.log('\n— (7) selado intacto + não-crítico de VERDADE —');
  const bkA1b = await mkBooking(avA1, barLua.actorId);
  let hard = 'NO_THROW';
  try { await confirm(bkA1b, ana.userId); } catch (e: any) { hard = codeOf(e); }
  const rows7a = await softRows();
  record('(7a) 2º confirm no MESMO slot do MESMO provider → 409 BOOKING_PROVIDER_TIME_CONFLICT ANTES de qualquer aviso (zero linha nova)',
    /^409:/.test(hard) && /BOOKING_PROVIDER_TIME_CONFLICT/.test(hard) && rows7a.length === rows6.length, hard.slice(0, 70));
  // injeção REAL de falha na detecção: renomeia a tabela de memberships SÓ durante este confirm
  // (o hard-lock não a toca; a detecção SEMPRE a referencia → 42P01 dentro do helper).
  await pool.query(`ALTER TABLE group_actor_memberships RENAME TO gam_probe_off`);
  let cS2status = 'NOT_CONFIRMED';
  try {
    const bkS2 = await mkBooking(avS2, barZe.actorId);
    const cS2 = await confirm(bkS2, vic.userId);
    cS2status = String(cS2.status);
  } finally {
    await pool.query(`ALTER TABLE gam_probe_off RENAME TO group_actor_memberships`);
  }
  const rows7b = await softRows();
  record('(7b) NÃO-CRÍTICO provado: detecção QUEBRADA (tabela renomeada → erro real no helper) e o confirm SUCEDE; zero aviso',
    cS2status === UnifiedBookingStatus.CONFIRMED && rows7b.length === rows7a.length, `status=${cS2status} avisos=${rows7b.length}`);

  console.log('\n— (8) Δbank —');
  const bankAfter = await bankSnap();
  record('(8) Δbank=0 — nenhum lançamento financeiro', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

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
