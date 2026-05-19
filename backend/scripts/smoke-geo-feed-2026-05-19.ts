// Script CIRURGICO de smoke do feed com filtro geográfico (F6 do plano).
// Atravessa: addresses → posts → active_location → 4 cenários de scope.
//
// PATTERN: service-direct (precedente: energize-circuit-2026-05-17.ts,
// smoke-supply-chain-2026-05-17.ts).
// SEM HTTP, SEM JWT, SEM mock, SEM disable trigger.
// APPEND-ONLY: nenhum DELETE no script.
//
// REVERSIBILIDADE: todas rows criadas têm metadata.test_geo = 'smoke_geo_feed_2026_05_19'.
// Cleanup futuro (se autorizado): DELETE FROM <tabela> WHERE metadata->>'test_geo' = ...
//
// IDEMPOTÊNCIA: cada seed (address / post / active_location) verifica marker antes
// de criar; reusa se existir.

import 'dotenv/config';
import { pool } from '../src/core/database/pool';
import { socialPortsRegistry } from '../src/core/social/ports-registry';
import { actorActiveLocationRepository } from '../src/core/location/actor-active-location.repository';
import { feedProximityService } from '../src/core/location/feed-proximity.service';

async function bootstrap() {
  const {
    actorRepositoryAdapter,
    actorUtilsAdapter,
    socialRepositoryAdapter,
    socialServiceAdapter,
    eventFeedHandlersAdapter,
  } = await import('../src/modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);
}

// Constantes — reuso do tenant Clínica Sorrisos (energize-circuit-2026-05-17)
const TENANT = 'fbe13b78-4516-493d-905a-363796aea1d1';
const JOAO_USER = 'a733e66f-b8bd-4bd2-a888-bec820f55339';
const JOAO_ACTOR = '3198eb58-7478-4e29-bade-456f6ea5b217'; // actor_type='user'

// Geografia canônica (verificada via SELECT em cities)
const CITY_CURITIBA = '5916470a-ca17-494c-b890-dfa223eb7841';
const CITY_SP = 'b8fab354-9e8e-42f4-b79f-ebc4adff2bc9';
const STATE_PR = '70d10a8b-5beb-4695-9fe0-1f64b946dbdd';
const STATE_SP = 'a85a26e9-01d6-41d8-86e7-a3088208b73f';
const LAT_CURITIBA = -25.4284;
const LNG_CURITIBA = -49.2733;
const LAT_SP = -23.5505;
const LNG_SP = -46.6333;
// Curitiba → SP distância ~339 km (validado em F1)

const TEST_MARKER = 'smoke_geo_feed_2026_05_19';

interface SeededAddress {
  addressId: string;
  cityId: string;
  lat: number;
  lng: number;
  label: string;
}

async function findOrCreateAddress(
  cityId: string,
  stateId: string,
  lat: number,
  lng: number,
  label: string
): Promise<SeededAddress> {
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);

  // BR country resolvido via state
  const countryRow = await pool.query<{ country_id: string }>(
    `SELECT country_id FROM states WHERE state_id = $1`,
    [stateId]
  );
  const countryId = countryRow.rows[0]?.country_id;
  if (!countryId) throw new Error(`country_id não resolvido para state ${stateId}`);

  // Marker via campo "reference" (TEXT) — addresses não tem metadata jsonb
  const reference = `${TEST_MARKER}_${label}`;

  // Idempotência via reference
  const existing = await pool.query<{ address_id: string }>(
    `SELECT address_id FROM addresses
     WHERE country_id = $1 AND state_id = $2 AND city_id = $3 AND reference = $4
     LIMIT 1`,
    [countryId, stateId, cityId, reference]
  );
  if (existing.rows.length > 0) {
    console.log(`  REUSO addressId=${existing.rows[0].address_id} (${label})`);
    return { addressId: existing.rows[0].address_id, cityId, lat, lng, label };
  }

  // Criar address novo (CHECK addresses_geocoded_consistency: is_geocoded=true
  // exige geocoded_at IS NOT NULL — passar NOW() junto)
  const inserted = await pool.query<{ address_id: string }>(
    `
    INSERT INTO addresses (
      country_id, state_id, city_id, lat, lng, is_geocoded, geocoded_at,
      geocode_provider, source, reference, created_by_tenant_id
    ) VALUES ($1, $2, $3, $4, $5, true, NOW(), 'smoke_seed', 'MANUAL_OVERRIDE', $6, $7)
    RETURNING address_id
    `,
    [countryId, stateId, cityId, lat, lng, reference, TENANT]
  );
  const id = inserted.rows[0]!.address_id;
  console.log(`  CRIADO addressId=${id} (${label}, lat=${lat}, lng=${lng})`);
  return { addressId: id, cityId, lat, lng, label };
}

interface SeededPost {
  postId: string;
  addressId: string | null;
  label: string;
}

async function findOrCreatePost(
  actorId: string,
  content: string,
  addressId: string | null,
  label: string
): Promise<SeededPost> {
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM posts
     WHERE tenant_id = $1 AND actor_id = $2
       AND metadata->>'test_geo' = $3 AND metadata->>'label' = $4
     LIMIT 1`,
    [TENANT, actorId, TEST_MARKER, label]
  );
  if (existing.rows.length > 0) {
    console.log(`  REUSO postId=${existing.rows[0].id} (${label})`);
    return { postId: existing.rows[0].id, addressId, label };
  }

  const inserted = await pool.query<{ id: string }>(
    `
    INSERT INTO posts (tenant_id, actor_id, content, post_type, address_id, metadata)
    VALUES ($1, $2, $3, 'standard', $4, $5::jsonb)
    RETURNING id
    `,
    [
      TENANT,
      actorId,
      content,
      addressId,
      JSON.stringify({ test_geo: TEST_MARKER, label }),
    ]
  );
  const id = inserted.rows[0]!.id;
  console.log(`  CRIADO postId=${id} (${label})`);
  return { postId: id, addressId, label };
}

async function countPostsMatchingFilter(actorId: string, scope: string, value: number | undefined, includeGlobal: boolean): Promise<{ count: number; description: string }> {
  // Usa feed-proximity.service para resolver filtro e roda SELECT manual
  // (não usa social2Service.getFeed para não acoplar com toda a lógica de ranking — smoke focado)
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);
  const resolved = await feedProximityService.resolveFilter(
    TENANT,
    actorId,
    {
      scope: scope as 'radius_km' | 'city' | 'state' | 'unlimited',
      value,
      includeGlobal,
    },
    1 // offset 1 → params começam em $2 (porque $1 é o tenant_id)
  );

  // Query base: posts marcados com test_geo (isolar do resto do feed)
  const sql = `
    SELECT COUNT(*)::int AS c
    FROM posts p
    WHERE p.tenant_id = $1
      AND p.metadata->>'test_geo' = '${TEST_MARKER}'
      AND (${resolved.sqlFragment})
  `;
  const result = await pool.query<{ c: number }>(sql, [TENANT, ...resolved.params]);
  return {
    count: Number(result.rows[0]?.c ?? 0),
    description: resolved.description,
  };
}

async function main() {
  await bootstrap();
  console.log('=== SMOKE GEO FEED ===');
  console.log(`Tenant:    ${TENANT}`);
  console.log(`Actor:     ${JOAO_ACTOR} (João Silva, user)`);
  console.log(`Marker:    ${TEST_MARKER}`);
  console.log('');

  // ELO 1: SEED addresses
  console.log('[ELO 1] addresses (idempotente)');
  const addrCwb = await findOrCreateAddress(
    CITY_CURITIBA,
    STATE_PR,
    LAT_CURITIBA,
    LNG_CURITIBA,
    'curitiba_centro'
  );
  const addrSp = await findOrCreateAddress(
    CITY_SP,
    STATE_SP,
    LAT_SP,
    LNG_SP,
    'sao_paulo_centro'
  );

  // ELO 2: SEED posts (1 sem geo, 2 com geo — Curitiba e SP)
  console.log('[ELO 2] posts (idempotente)');
  const postGlobal = await findOrCreatePost(
    JOAO_ACTOR,
    'Post global sem localização (test geo feed)',
    null,
    'global_no_geo'
  );
  const postCwb = await findOrCreatePost(
    JOAO_ACTOR,
    'Post em Curitiba (test geo feed)',
    addrCwb.addressId,
    'curitiba_post'
  );
  const postSp = await findOrCreatePost(
    JOAO_ACTOR,
    'Post em São Paulo (test geo feed)',
    addrSp.addressId,
    'sao_paulo_post'
  );

  // ELO 3: setActive localização do JOAO em Curitiba
  console.log('[ELO 3] setActive localização JOAO em Curitiba');
  const activeLoc = await actorActiveLocationRepository.setActive(
    TENANT,
    JOAO_ACTOR,
    {
      addressId: addrCwb.addressId,
      lat: LAT_CURITIBA,
      lng: LNG_CURITIBA,
      source: 'USER_INPUT_CITY',
      scopeLevel: 'CITY',
      metadata: { test_geo: TEST_MARKER, label: 'joao_em_curitiba' },
    }
  );
  console.log(`  OK locationId=${activeLoc.id} (lat=${activeLoc.lat}, lng=${activeLoc.lng})`);

  // ELO 4: VERIFICAÇÕES — 4 cenários
  console.log('');
  console.log('[ELO 4] verificações via feedProximityService.resolveFilter');
  console.log('');

  const scenarios = [
    { label: 'unlimited (sem filtro geo)', scope: 'unlimited', value: undefined, includeGlobal: false, expected: 3 },
    { label: 'radius_km value=10 (só Curitiba; SP fica fora dos 10km)', scope: 'radius_km', value: 10, includeGlobal: false, expected: 1 },
    { label: 'radius_km value=10 + include_global=true (Curitiba + global)', scope: 'radius_km', value: 10, includeGlobal: true, expected: 2 },
    { label: 'radius_km value=400 (Curitiba + SP cabem em 400km)', scope: 'radius_km', value: 400, includeGlobal: false, expected: 2 },
    { label: 'city (só posts da city_id de Curitiba)', scope: 'city', value: undefined, includeGlobal: false, expected: 1 },
    { label: 'city + include_global=true (Curitiba + global)', scope: 'city', value: undefined, includeGlobal: true, expected: 2 },
    { label: 'state (PR — só Curitiba neste smoke)', scope: 'state', value: undefined, includeGlobal: false, expected: 1 },
  ];

  let allPass = true;
  for (const s of scenarios) {
    const { count, description } = await countPostsMatchingFilter(
      JOAO_ACTOR,
      s.scope,
      s.value,
      s.includeGlobal
    );
    const ok = count === s.expected;
    const symbol = ok ? '✓' : '✗';
    console.log(`  ${symbol} ${s.label}`);
    console.log(`     description: ${description}`);
    console.log(`     count=${count} esperado=${s.expected}`);
    if (!ok) allPass = false;
  }

  console.log('');
  if (allPass) {
    console.log('=== SMOKE GEO FEED OK — TODOS OS 7 CENÁRIOS PASS ===');
  } else {
    throw new Error('SMOKE GEO FEED: pelo menos 1 cenário falhou');
  }

  console.log('');
  console.log(
    `Reverter (se autorizado): DELETE FROM <tabela> WHERE metadata->>'test_geo'='${TEST_MARKER}'`
  );
  console.log(
    `Tabelas tocadas: addresses, posts, actor_active_location`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('');
    console.error('=== FALHA ===');
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    pool.end().catch(() => {});
  });
