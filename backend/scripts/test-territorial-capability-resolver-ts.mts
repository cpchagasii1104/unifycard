#!/usr/bin/env tsx
// N2-D.3 — provas RUNTIME TS do resolver territorial (caminho TS→SQL real + composição do wrapper).
// Fixture COMMITADA via conexão pg (owner); teardown desabilita/reabilita a trigger de imutabilidade.
import { readFileSync } from 'fs';
import pg from 'pg';
import { actorCapabilityGrantRepository } from '../src/modules/authority/actor-capability-grant.repository';
import { hasTerritorialCapability, assertTerritorialCapability } from '../src/modules/authority/territorial-capability-resolver';

const url = (readFileSync('.env', 'utf-8').match(/DATABASE_URL=(.+)/) || [])[1].trim();
const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const ACTOR = '213f4903-d0c3-4c03-aa2f-328e11aac807';      // user actor, user_id abaixo, tenant-bound
const USER = '9305ac13-00b2-4ef2-989f-05c04259f18a';        // dono do ACTOR (canRepresentActor → true)
const STRANGER = '00000000-0000-0000-0000-0000000000ff';    // não representa o ACTOR
const CITYA = '029b307f-9cb6-43cb-8d99-11823b9dc001';
const CITYB = '058705b4-7d87-4cdd-aa8e-0bc15fa29fa4';
const KEY = 'territory:create_neighborhood';

let fails = 0;
const ok = (m: string) => console.log('   ✅ ' + m);
const bad = (m: string) => { console.log('   ❌ ' + m); fails++; };
const setup = new pg.Client({ connectionString: url });

async function wirePorts() {
  const { socialPortsRegistry } = await import('../src/core/social/ports-registry');
  const { actorRepositoryAdapter, actorUtilsAdapter } = await import('../src/modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
}

async function main() {
  await wirePorts(); // habilita canRepresentActor (actor repository) fora do boot do app
  await setup.connect();
  const ins = await setup.query(
    `INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status)
     VALUES ($1,$2,'territory',$3,$4,$1,'grant','active') RETURNING grant_id`,
    [ACTOR, KEY, CITYA, USER]
  );
  const grantId = ins.rows[0].grant_id as string;

  try {
    // A. repository (TS→SQL) — mapeia DENIED→null, retorna grant_id no válido
    const rValid = await actorCapabilityGrantRepository.assertTerritorialCapability(TENANT, ACTOR, KEY, CITYA);
    rValid === grantId ? ok(`repo válido → grant_id (${rValid.slice(0, 8)})`) : bad(`repo válido → ${rValid} (esperado ${grantId})`);
    const rCity = await actorCapabilityGrantRepository.assertTerritorialCapability(TENANT, ACTOR, KEY, CITYB);
    rCity === null ? ok('repo cidade errada → null') : bad(`repo cidade errada → ${rCity}`);
    const rKey = await actorCapabilityGrantRepository.assertTerritorialCapability(TENANT, ACTOR, 'calendar:block', CITYA);
    rKey === null ? ok('repo key actor-scoped → null') : bad(`repo key actor → ${rKey}`);

    // B. resolver has* — representável + grant válido → true
    const h1 = await hasTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYA });
    h1 === true ? ok('has: representável + grant válido → true') : bad(`has válido → ${h1}`);

    // C. resolver has* — NÃO representável (stranger) → false (não chega a aprovar)
    const h2 = await hasTerritorialCapability({ tenantId: TENANT, userId: STRANGER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYA });
    h2 === false ? ok('has: não-representável → false') : bad(`has não-representável → ${h2}`);

    // D. resolver has* — representável + key inválida → false (sem tocar DB/grant)
    const h3 = await hasTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: 'territory:hack', scopeCityId: CITYA });
    h3 === false ? ok('has: key inválida → false') : bad(`has key inválida → ${h3}`);

    // E. resolver has* — representável + cidade errada → false
    const h4 = await hasTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYB });
    h4 === false ? ok('has: cidade errada → false') : bad(`has cidade errada → ${h4}`);

    // F. resolver assert* — válido retorna grant_id; negação lança 403 uniforme sem vazar grant
    const a1 = await assertTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYA });
    a1 === grantId ? ok('assert: válido → grant_id') : bad(`assert válido → ${a1}`);
    try {
      await assertTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYB });
      bad('assert: cidade errada deveria lançar 403');
    } catch (e: any) {
      const uniform = e?.statusCode === 403 && e?.message === 'TERRITORIAL_CAPABILITY_DENIED' && !/[0-9a-f]{8}-/.test(e.message);
      uniform ? ok('assert: negação → 403 uniforme não-vazante') : bad(`assert negação não-uniforme: sc=${e?.statusCode} msg=${e?.message}`);
    }
  } finally {
    await setup.query('ALTER TABLE actor_capability_grants DISABLE TRIGGER trg_acg_immutability');
    await setup.query('DELETE FROM actor_capability_grants WHERE grant_id=$1', [grantId]);
    await setup.query('ALTER TABLE actor_capability_grants ENABLE TRIGGER trg_acg_immutability');
    const res = await setup.query('SELECT count(*)::int AS n FROM actor_capability_grants');
    res.rows[0].n === 0 ? ok('resíduo 0') : bad(`resíduo ${res.rows[0].n}`);
    await setup.end();
    // encerra o pool do app para o processo terminar
    try { const { pool } = await import('../src/core/database/pool'); await (pool as any)?.end?.(); } catch { /* noop */ }
  }
}

main().then(() => {
  console.log(fails === 0 ? '\nTS RUNTIME OK — repository TS→SQL + composição has/assert (representabilidade + capability) provados.' : `\nTS RUNTIME FAIL (${fails}).`);
  process.exit(fails === 0 ? 0 : 1);
}).catch((e) => { console.error('erro fatal:', e); process.exit(1); });
