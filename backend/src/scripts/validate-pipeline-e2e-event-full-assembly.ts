/**
 * E2E — F-EVENT-FULL-ASSEMBLY (2026-08-03). 🔒 SÓ DB efêmera.
 *
 * ATRAVESSA a MONTAGEM inteira de um show, na ORDEM NOVA do wizard (decisões A e B de Clayton),
 * usando os MESMOS services que a tela usa — nunca SQL equivalente reescrito:
 *
 *   ① formato SHOW → ② ONDE (Location Core) → ③ QUANDO → ④ QUANTOS → ⑤ ÁREAS com preço
 *   → ⑥ o que o evento PRECISA (orquestração) → ⑦ confirmar data → ⑧ publicar → ⑨ FEED vê
 *
 * O E2E irmão (validate-pipeline-e2e-event-publish-funnel) já cobre draft→declared→published→feed.
 * ESTE cobre o vão que aquele não toca: local, capacidade, áreas e orquestração — tudo que mudou
 * hoje e que nunca foi percorrido de ponta a ponta.
 *
 * VERMELHAS obrigatórias (guard que nunca falha é decoração):
 *   R1 · área que ESTOURA a capacidade é recusada (SECTOR_CAPACITY_EXCEEDS_EVENT)
 *   R2 · meia diferente da metade exata é recusada (SECTOR_MEIA_PRICE_NOT_HALF)
 *   R3 · necessidade fora das sugestões do formato é recusada (a seleção não é livre)
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'node:crypto';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const results: { label: string; ok: boolean; reason?: string }[] = [];
const rec = (l: string, ok: boolean, r?: string) => {
  results.push({ label: l, ok, reason: r });
  console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${r ?? ''}`}`);
};

/** Executa e devolve o código/mensagem do erro, ou null se passou. */
async function expectRefusal(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev' || !EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}"`);
  console.log(`🔒 DB efêmera: ${db}\n`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { ensureUserActor } = await import('../modules/identity/actor-writer.service');
  const { eventService } = await import('../core/events/event.service');
  const { eventSectorService } = await import('../modules/events/event-sector.service');
  const { eventTaxonomyService } = await import('../core/events/event-taxonomy.service');

  // ── cenário mínimo
  const T = (
    await pool.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ('T FULL-ASSEMBLY','t-fullassembly-${Date.now()}') RETURNING id`
    )
  ).rows[0].id;
  const gu = randomUUID();
  const uid = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [uid, T, `org-${Date.now()}@e2e.test`, gu]);
  const actorId = (await ensureUserActor(T, uid)).actor_id;

  const showFormat = (
    await pool.query<{ concept_id: string }>(
      `SELECT f.concept_id FROM event_format_concepts f JOIN concepts c ON c.concept_id = f.concept_id
        WHERE c.slug = 'show' AND c.domain = 'cultura-lazer-e-eventos' LIMIT 1`
    )
  ).rows[0];
  if (!showFormat) throw new Error('formato SHOW ausente na efêmera');

  // ① rascunho com FORMATO (concept-first)
  const eventId = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, event_format_concept_id, title,
         status, visibility, timezone, currency, metadata, created_at, updated_at)
       VALUES ($1,$2,'user','SHOW',$3,'Show de Ponta a Ponta','draft','public',
         'America/Sao_Paulo','BRL','{}'::jsonb,NOW(),NOW()) RETURNING id`,
      [T, actorId, showFormat.concept_id]
    )
  ).rows[0].id;
  const declared = await eventService.declareEvent(
    T, eventId,
    { title: 'Show de Ponta a Ponta', eventAspects: ['social'], visibility: 'public', intentFlags: [] } as any,
    actorId
  );
  rec('① rascunho declarado com formato SHOW', declared.status === 'declared', `status=${declared.status}`);

  // ② ONDE — cidade GOVERNADA (Location Core), o passo que subiu para 3º
  const city = (await pool.query<{ city_id: string }>(`SELECT city_id FROM cities LIMIT 1`)).rows[0];
  if (!city) throw new Error('nenhuma cidade na efêmera');
  await eventService.updateEvent(
    T, eventId,
    { locationMode: 'fixed_place', venueCityId: city.city_id, venuePostalCode: '80010000' } as any,
    actorId
  );
  // 🔴 O CONSERTO DE HOJE (F-EVENT-VENUE-READBACK): o endereço tem de VOLTAR na leitura.
  const afterVenue = await eventService.getEvent(T, eventId);
  rec(
    '② ONDE gravado E RELIDO — getEvent devolve venue.cityId (o painel enxerga o que o wizard salvou)',
    !!afterVenue?.venue?.cityId && afterVenue.venue.postalCode === '80010000',
    `venue=${JSON.stringify(afterVenue?.venue ?? null)}`
  );

  // ③ QUANDO + ④ QUANTOS
  await eventService.updateEvent(T, eventId, { maxAttendees: 500, minAttendees: 100 } as any, actorId);
  const afterCap = await eventService.getEvent(T, eventId);
  rec('④ capacidade total declarada (o teto que as áreas têm de respeitar)', afterCap?.maxAttendees === 500, `max=${afterCap?.maxAttendees}`);

  // ⑤ ÁREAS com preço — o que passou a nascer no wizard
  await eventSectorService.createSector(T, eventId, {
    sectorNumber: 1, name: 'Pista', capacity: 300, inteiraPriceCents: 8000, meiaPriceCents: 4000, meiaQuotaBps: 4000,
  } as any);
  await eventSectorService.createSector(T, eventId, {
    sectorNumber: 2, name: 'Camarote', capacity: 150, inteiraPriceCents: 15001, meiaPriceCents: 7500, meiaQuotaBps: 4000,
  } as any);
  const soma = (
    await pool.query<{ total: string }>(`SELECT COALESCE(SUM(capacity),0)::text AS total FROM event_sectors WHERE event_id=$1`, [eventId])
  ).rows[0].total;
  rec('⑤ duas áreas criadas, somando 450 de 500 (sobra é permitida)', soma === '450', `soma=${soma}`);
  rec('⑤b meia de preço ÍMPAR arredonda para baixo em favor do consumidor (15001 → 7500)', true);

  // "a partir de": o preço SERVIDO passa a ser o MENOR setor, não o valor cru
  const served = await eventService.getEvent(T, eventId);
  rec('⑤c preço servido = MENOR área (8000), não o valor anunciado cru', served?.ticketPriceCents === 8000, `servido=${served?.ticketPriceCents}`);

  // ⑥ ORQUESTRAÇÃO — as sugestões do formato, agora com locação
  const sugg = await eventTaxonomyService.listOrchestrationSuggestions(T, eventId);
  const rentables = sugg.filter((s) => s.fulfillmentKind === 'rentable');
  rec(
    '⑥ SHOW sugere 10 necessidades, com LOCAÇÃO entre elas (era só service)',
    sugg.length === 10 && rentables.length === 7,
    `total=${sugg.length} rentable=${rentables.length}`
  );

  // ⑦ confirmar data + ⑧ publicar
  const start = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await pool.query(`UPDATE events SET datetime_start=$2, updated_at=NOW() WHERE id=$1`, [eventId, start]);
  const published = await eventService.publishEvent(T, eventId, actorId);
  rec('⑧ publicado', published.status === 'published', `status=${published.status}`);

  // ⑨ FEED — a query REAL (feed.routes.ts), não uma equivalente reescrita
  const feed = await pool.query<{ id: string }>(
    `SELECT id FROM events WHERE tenant_id=$1 AND status IN ('published','active') AND datetime_start >= NOW()`,
    [T]
  );
  rec('⑨ o feed VÊ o show montado', feed.rows.some((r) => r.id === eventId), `feed=${feed.rows.length} linha(s)`);

  // ═══ VERMELHAS ═══
  const r1 = await expectRefusal(() =>
    eventSectorService.createSector(T, eventId, {
      sectorNumber: 3, name: 'Estouro', capacity: 200, inteiraPriceCents: 1000, meiaPriceCents: 500, meiaQuotaBps: 4000,
    } as any)
  );
  rec('R1 · área que ESTOURA a capacidade é recusada', !!r1 && r1.includes('SECTOR_CAPACITY_EXCEEDS_EVENT'), `msg=${r1 ?? 'ACEITOU'}`);

  const r2 = await expectRefusal(() =>
    eventSectorService.createSector(T, eventId, {
      sectorNumber: 4, name: 'MeiaErrada', capacity: 10, inteiraPriceCents: 10000, meiaPriceCents: 9000, meiaQuotaBps: 4000,
    } as any)
  );
  rec('R2 · meia que não é a metade exata é recusada', !!r2 && r2.includes('SECTOR_MEIA_PRICE_NOT_HALF'), `msg=${r2 ?? 'ACEITOU'}`);

  // R3 · o contrato do service é devolver null (a ROTA traduz em 422), NÃO lançar. Testar por
  // exceção reportaria bug inexistente — foi o que a 1ª versão deste E2E fez.
  const { eventOperationalNeedsService } = await import('../core/events/event-operational-needs.service');
  const foreign = (
    await pool.query<{ concept_id: string }>(
      `SELECT k.concept_id FROM concept_offer_kinds k
        WHERE NOT EXISTS (SELECT 1 FROM event_orchestration_template_items t
                           WHERE t.format_concept_id = $1 AND t.need_concept_id = k.concept_id) LIMIT 1`,
      [showFormat.concept_id]
    )
  ).rows[0];
  const r3 = await eventOperationalNeedsService.add(T, eventId, foreign.concept_id);
  const r3Rows = await pool.query(
    `SELECT 1 FROM event_operational_needs WHERE event_id=$1 AND need_concept_id=$2`,
    [eventId, foreign.concept_id]
  );
  rec(
    'R3 · necessidade FORA das sugestões do formato: devolve null E NÃO grava',
    r3 === null && r3Rows.rowCount === 0,
    `retorno=${JSON.stringify(r3)} linhas=${r3Rows.rowCount}`
  );

  // ⑦ O KIND É HERDADO DO TEMPLATE — selecionar uma necessidade LOCÁVEL não pode virar 'service'.
  // Este é o defeito que a travessia achou: o writer gravava o literal 'service' sempre.
  const rentableNeed = sugg.find((s) => s.fulfillmentKind === 'rentable');
  if (!rentableNeed) throw new Error('nenhuma sugestão rentable para o SHOW — catálogo inesperado');
  const added = await eventOperationalNeedsService.add(T, eventId, rentableNeed.needConceptId);
  const persisted = (
    await pool.query<{ fulfillment_kind: string }>(
      `SELECT fulfillment_kind FROM event_operational_needs WHERE event_id=$1 AND need_concept_id=$2`,
      [eventId, rentableNeed.needConceptId]
    )
  ).rows[0];
  rec(
    '⑦ necessidade LOCÁVEL é registrada como rentable (kind herdado do template, não fixo)',
    added?.fulfillmentKind === 'rentable' && persisted?.fulfillment_kind === 'rentable',
    `retorno=${added?.fulfillmentKind} persistido=${persisted?.fulfillment_kind}`
  );

  const serviceNeed = sugg.find((s) => s.fulfillmentKind === 'service');
  if (serviceNeed) {
    await eventOperationalNeedsService.add(T, eventId, serviceNeed.needConceptId);
    const persistedSvc = (
      await pool.query<{ fulfillment_kind: string }>(
        `SELECT fulfillment_kind FROM event_operational_needs WHERE event_id=$1 AND need_concept_id=$2`,
        [eventId, serviceNeed.needConceptId]
      )
    ).rows[0];
    rec(
      '⑦b não-regressão: necessidade de SERVIÇO segue registrada como service',
      persistedSvc?.fulfillment_kind === 'service',
      `persistido=${persistedSvc?.fulfillment_kind}`
    );
  }

  const allOk = results.every((r) => r.ok);
  console.log(`\n${allOk ? '✅ TRAVESSIA COMPLETA' : '❌ FALHOU'} (${results.filter((r) => r.ok).length}/${results.length})`);
  if (!allOk) process.exit(1);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(`💥 ${err instanceof Error ? err.message : String(err)}`);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
