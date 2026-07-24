/**
 * SEED DE DEMO LOCAL — cria, no banco `unificard_local`, o mínimo para um HUMANO clicar o
 * raio-x do performer no navegador:
 *   1. um usuário logável (email+senha) via o CAMINHO REAL de auth (authService.register →
 *      bcrypt + nascimento atômico global_user→user→identity→user-actor). NUNCA SQL cru de senha.
 *   2. um serviço canônico `apresentacao-musical` + uma OFERTA ATIVA no user-actor (provider SOLO),
 *      compondo os writers SELADOS (declareConcept → createService → createOffering → activate) —
 *      a MESMA cadeia dos E2Es selados (ex.: band-group-actor-provider), só que provider = user-actor.
 *   3. um EVENTO em rascunho (status `draft`) do MESMO user-actor, com cidade GOVERNADA no local,
 *      para o humano abrir o painel do organizador (/events/:id) e editar de imediato. Compõe os
 *      writers SELADOS eventService.createEvent → updateEvent (mesma cadeia do E2E selado
 *      validate-pipeline-e2e-venue-enrichment). NUNCA SQL cru em `events`.
 *
 *      POR QUE `draft` (e não `published`): updateEvent só libera edição ampla enquanto o evento
 *      é rascunho — em `published` a lista de campos liberados é restrita (event.service.ts).
 *      Publicar aqui deixaria o painel do organizador travado, que é o oposto do objetivo.
 *
 * Bank-free (Δbank=0) · não move dinheiro · NUNCA toca unificard_dev (guard fail-closed).
 * Idempotente: re-rodar reusa o usuário/serviço/oferta existentes (não duplica).
 *
 * Rodado pelo launcher scripts/seed-local-demo.mjs (que aponta DATABASE_URL=unificard_local).
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { authService } from '../core/auth/auth.service';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { ServiceType, ServiceStatus } from '../modules/services/services.types';
import { eventService } from '../core/events/event.service';
import { randomUUID } from 'crypto';

// ── Credenciais fixas da demo (dev local; sem segredo real) ──
const DEMO_EMAIL = 'fundador@demo.local';
const DEMO_PASSWORD = 'DemoUnificard!2026';
const DEMO_NAME = 'Fundador Demo';
const DEMO_BIRTHDATE = '1990-01-01';
const SERVICE_NAME = 'Voz e violão — show ao vivo (demo)';
/** Título do evento de demo — chave de idempotência (tenant + actor + título). */
const EVENT_TITLE = 'Show da comunidade (demo — edite este evento)';
const EVENT_MAX_ATTENDEES = 5000;
const EVENT_VENUE_NAME = 'Casa da Cultura (demo)';
const DEMO_CITY_NAME = 'Curitiba';

function cpfCheckDigit(nums: number[]): number {
  const len = nums.length;
  let sum = 0;
  for (let i = 0; i < len; i += 1) sum += nums[i] * (len + 1 - i);
  const rem = sum % 11;
  return rem < 2 ? 0 : 11 - rem;
}

/** Gera um CPF com dígitos verificadores válidos (aceito por validateCpfOrThrow). */
function genValidCpf(): string {
  let base: number[];
  do {
    base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  } while (base.every((d) => d === base[0])); // evita sequências rejeitadas (ex.: 000...)
  const d1 = cpfCheckDigit(base);
  const d2 = cpfCheckDigit([...base, d1]);
  return [...base, d1, d2].join('');
}

async function assertLocalDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (db !== 'unificard_local') throw new Error(`ABORT: banco "${db}" ≠ "unificard_local". Aponte DATABASE_URL para unificard_local.`);
  console.log(`🔒 DB confirmada: ${db}`);
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
  if (!r) throw new Error(`concept de serviço governado ausente: ${slug} (migrations aplicadas?)`);
  return { conceptId: r.concept_id, canonicalId: r.canonical_id };
}

/**
 * Cidade GOVERNADA (linha real em `cities`) para o local do evento — é o `city_id` que o writer de
 * venue resolve pela CTE geo. REUSA a cidade existente quando já houver (o banco local nasce com o
 * catálogo territorial das migrations); só cria a hierarquia country→state→city se não houver
 * nenhuma. Mesma composição do E2E selado validate-pipeline-e2e-venue-enrichment.
 */
async function resolveGovernedCity(): Promise<{ cityId: string; cityName: string; created: boolean }> {
  const preferred = (await pool.query<{ id: string; name: string }>(
    `SELECT city_id::text AS id, name FROM cities WHERE name = $1 ORDER BY city_id LIMIT 1`,
    [DEMO_CITY_NAME]
  )).rows[0];
  if (preferred) return { cityId: preferred.id, cityName: preferred.name, created: false };

  const any = (await pool.query<{ id: string; name: string }>(
    `SELECT city_id::text AS id, name FROM cities ORDER BY city_id LIMIT 1`
  )).rows[0];
  if (any) return { cityId: any.id, cityName: any.name, created: false };

  // Nenhuma cidade governada no banco — cria a hierarquia mínima (country → state → city).
  const rl = (): string => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  let countryId: string | null = null;
  for (let attempt = 0; attempt < 40 && !countryId; attempt += 1) {
    try {
      countryId = (await pool.query<{ id: string }>(
        `INSERT INTO countries (iso_alpha2, name) VALUES ($1, $2) RETURNING country_id::text AS id`,
        [rl() + rl(), 'Brasil (demo)']
      )).rows[0].id;
    } catch (e: any) {
      if (!/unique|duplicad/i.test(String(e?.message ?? e))) throw e;
    }
  }
  if (!countryId) throw new Error('resolveGovernedCity: não achou iso_alpha2 livre.');
  const stateId = (await pool.query<{ id: string }>(
    `INSERT INTO states (country_id, name) VALUES ($1::uuid, $2) RETURNING state_id::text AS id`,
    [countryId, 'Paraná (demo)']
  )).rows[0].id;
  const cityId = (await pool.query<{ id: string }>(
    `INSERT INTO cities (state_id, name) VALUES ($1::uuid, $2) RETURNING city_id::text AS id`,
    [stateId, DEMO_CITY_NAME]
  )).rows[0].id;
  return { cityId, cityName: DEMO_CITY_NAME, created: true };
}

/** Formato de evento GOVERNADO (event_format_concepts habilitado). null se o catálogo não tiver. */
async function resolveEventFormatConcept(slug: string): Promise<string | null> {
  return (await pool.query<{ id: string }>(
    `SELECT c.concept_id::text AS id
       FROM concepts c
       JOIN event_format_concepts efc ON efc.concept_id = c.concept_id AND efc.enabled = true
      WHERE c.slug = $1
      LIMIT 1`,
    [slug]
  )).rows[0]?.id ?? null;
}

async function main(): Promise<void> {
  await assertLocalDb();

  // Wire dos ports sociais — canRepresentActor pool-path (mesma amarração das rotas/E2Es).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  // Necessário para o nascimento de evento (efeitos de feed), como nos E2Es de evento.
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
  const bankBefore = await bankSnap();

  // ── 1) usuário logável via caminho REAL (idempotente) ──
  let userId: string;
  let tenantId: string;
  const existing = (await pool.query<{ id: string; tenant_id: string }>(
    `SELECT id::text AS id, tenant_id::text AS tenant_id FROM users WHERE email = $1 LIMIT 1`,
    [DEMO_EMAIL]
  )).rows[0];
  if (existing) {
    userId = existing.id;
    tenantId = existing.tenant_id;
    console.log(`ℹ️  Usuário demo já existia — reusando (${DEMO_EMAIL}).`);
  } else {
    const cpf = genValidCpf();
    const reg = await authService.register(undefined, DEMO_EMAIL, DEMO_PASSWORD, cpf, DEMO_NAME, DEMO_BIRTHDATE, undefined);
    userId = reg.user.userId;
    tenantId = reg.tenantId;
    console.log(`✅ Usuário demo criado via authService.register (bcrypt). tenant=${tenantId.slice(0, 8)} cpf=${cpf}`);
  }

  // user-actor resolvível pela listagem de actors do usuário (rota social de actors)
  const actorId = (await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM actors
      WHERE tenant_id = $1 AND user_id = $2 AND actor_type IN ('user','person','actor_human')
      LIMIT 1`,
    [tenantId, userId]
  )).rows[0]?.id;
  if (!actorId) throw new Error('user-actor não resolvido após register (nascimento atômico falhou?)');
  console.log(`✅ user-actor: ${actorId}`);

  // ── 2) serviço canônico + oferta ATIVA no user-actor (SOLO) ──
  const musical = await resolveServiceConcept('apresentacao-musical');

  // idempotência: já existe oferta ativa desse provider no canônico?
  const existingOffering = (await pool.query<{ offering_id: string; service_id: string; status: string }>(
    `SELECT id::text AS offering_id, service_id::text AS service_id, status
       FROM service_offerings
      WHERE provider_actor_id = $1 AND canonical_service_id = $2
      ORDER BY (status='active') DESC
      LIMIT 1`,
    [actorId, musical.canonicalId]
  )).rows[0];

  let serviceId: string;
  let offeringId: string;
  if (existingOffering) {
    serviceId = existingOffering.service_id;
    offeringId = existingOffering.offering_id;
    if (existingOffering.status !== 'active') {
      await serviceOfferingService.updateOwnOffering({ tenantId, userId, offeringId, status: 'active' });
      console.log('ℹ️  Oferta existente reativada.');
    } else {
      console.log('ℹ️  Oferta ativa já existia — reusando.');
    }
  } else {
    // declareConcept (idempotente-ish: pode já estar declarado)
    try {
      await professionalC1Service.declareConcept(tenantId, actorId, { conceptId: musical.conceptId, skillLevel: 3 }, userId);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/ALREADY|already|DUPLICAT|duplicad/i.test(msg)) console.log('ℹ️  Concept já declarado — seguindo.');
      else throw e;
    }
    const CITY = randomUUID(); // cidade não-FK neste caminho (mesma disciplina dos E2Es selados)
    const service = await servicesService.createService(tenantId, userId, {
      actorId,
      name: SERVICE_NAME,
      serviceType: ServiceType.SERVICE,
      status: ServiceStatus.ACTIVE,
      canonicalServiceId: musical.canonicalId,
      cityId: CITY,
    });
    serviceId = service.serviceId;
    const { offering } = await serviceOfferingService.createOffering({
      tenantId, userId, providerActorId: actorId,
      canonicalServiceId: musical.canonicalId, priceCents: 250000, durationMinutes: 90,
    });
    offeringId = offering.id;
    await serviceOfferingService.updateOwnOffering({ tenantId, userId, offeringId, status: 'active' });
    console.log('✅ serviço + oferta ATIVA publicados (declareConcept → createService → createOffering → activate).');
  }

  // ── 3) EVENTO em rascunho, pronto para o painel do organizador (idempotente) ──
  const city = await resolveGovernedCity();
  console.log(`✅ cidade governada p/ o local: ${city.cityName} (${city.cityId})${city.created ? ' [criada]' : ' [reusada]'}`);

  const existingEvent = (await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM events WHERE tenant_id = $1::uuid AND actor_id = $2::uuid AND title = $3 LIMIT 1`,
    [tenantId, actorId, EVENT_TITLE]
  )).rows[0];

  let eventId: string;
  if (existingEvent) {
    eventId = existingEvent.id;
    console.log('ℹ️  Evento demo já existia — reusando.');
  } else {
    // Janela FUTURA (o painel edita datas; começa daqui a 30 dias, dura 3h).
    const start = new Date(Date.now() + 30 * 24 * 3600e3);
    const end = new Date(start.getTime() + 3 * 3600e3);
    const created = await eventService.createEvent(tenantId, {
      actorId,
      actorType: 'user',
      title: EVENT_TITLE,
      description: 'Evento de demonstração criado pelo seed local. Edite tudo pelo painel do organizador.',
      datetimeStart: start.toISOString(),
      datetimeEnd: end.toISOString(),
    } as Parameters<typeof eventService.createEvent>[1]);
    eventId = created.id;

    // Capacidade primeiro (setores reconciliam contra max_attendees), depois o local governado.
    await eventService.updateEvent(
      tenantId,
      eventId,
      { maxAttendees: EVENT_MAX_ATTENDEES } as Parameters<typeof eventService.updateEvent>[2],
      actorId
    );

    const formatConceptId = await resolveEventFormatConcept('show');
    const venuePatch: Record<string, unknown> = {
      venueCityId: city.cityId,
      venueStreet: 'Rua XV de Novembro',
      venueNumber: '100',
      locationName: EVENT_VENUE_NAME,
    };
    if (formatConceptId) venuePatch.eventFormatConceptId = formatConceptId;
    else console.log('ℹ️  formato de evento "show" ausente no catálogo — evento fica sem formato (editável no painel).');

    await eventService.updateEvent(
      tenantId,
      eventId,
      venuePatch as Parameters<typeof eventService.updateEvent>[2],
      actorId
    );
    console.log('✅ evento criado em RASCUNHO (createEvent → updateEvent capacidade → updateEvent local).');
  }

  // Verificação final
  const off = (await pool.query<{ status: string; provider_actor_id: string }>(
    `SELECT status, provider_actor_id::text AS provider_actor_id FROM service_offerings WHERE id = $1::uuid`,
    [offeringId]
  )).rows[0];
  // Verificação do evento: dono, status editável, capacidade e cidade GOVERNADA (join real).
  const ev = (await pool.query<{
    status: string; actor_id: string; max_attendees: number | null;
    venue_city_id: string | null; city_name: string | null;
  }>(
    `SELECT e.status,
            e.actor_id::text AS actor_id,
            e.max_attendees,
            a.city_id::text  AS venue_city_id,
            ct.name          AS city_name
       FROM events e
       LEFT JOIN address_assignments aa
              ON aa.owner_type = 'event' AND aa.owner_id = e.id AND aa.valid_until_at IS NULL
       LEFT JOIN addresses a ON a.address_id = aa.address_id
       LEFT JOIN cities   ct ON ct.city_id = a.city_id
      WHERE e.id = $1::uuid`,
    [eventId]
  )).rows[0];
  const eventEditable = ev?.status === 'draft';

  const bankAfter = await bankSnap();

  console.log('\n────────────────────────────────────────────────────────');
  console.log('  DEMO LOCAL PRONTA');
  console.log('────────────────────────────────────────────────────────');
  console.log(`  Login:     ${DEMO_EMAIL}`);
  console.log(`  Senha:     ${DEMO_PASSWORD}`);
  console.log(`  user-actor:${actorId}`);
  console.log(`  serviceId: ${serviceId}`);
  console.log(`  offeringId:${offeringId}  (status=${off?.status}, provider ${off?.provider_actor_id === actorId ? 'OK' : 'DIVERGE'})`);
  console.log(`  Raio-x:    /services/${serviceId}/offering`);
  console.log('  ──');
  console.log(`  eventId:   ${eventId}`);
  console.log(`  status:    ${ev?.status}  ${eventEditable ? '(editável no painel ✅)' : '(⚠️ NÃO é draft)'}`);
  console.log(`  dono:      ${ev?.actor_id === actorId ? 'user-actor da demo OK' : '⚠️ DIVERGE'}`);
  console.log(`  capacidade:${ev?.max_attendees ?? '—'}`);
  console.log(`  cidade:    ${ev?.city_name ?? '—'} (${ev?.venue_city_id ?? 'sem local'})`);
  console.log(`  PAINEL DO ORGANIZADOR:  /events/${eventId}`);
  console.log(`  Δbank:     ${bankBefore} → ${bankAfter}  ${bankBefore === bankAfter ? '(=0 ✅)' : '(⚠️ MUDOU)'}`);
  console.log('────────────────────────────────────────────────────────');

  if (off?.status !== 'active') throw new Error('oferta não ficou ativa');
  if (!ev) throw new Error('evento demo não encontrado após o seed');
  if (ev.actor_id !== actorId) throw new Error('evento demo não pertence ao user-actor da demo');
  if (!eventEditable) throw new Error(`evento demo em status '${ev.status}' — painel do organizador ficaria travado`);
  if (ev.max_attendees !== EVENT_MAX_ATTENDEES) throw new Error('evento demo sem a capacidade esperada');
  if (!ev.venue_city_id || !ev.city_name) throw new Error('local do evento sem cidade GOVERNADA resolvida');
  if (bankBefore !== bankAfter) throw new Error('Δbank ≠ 0');

  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.stack ?? e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
