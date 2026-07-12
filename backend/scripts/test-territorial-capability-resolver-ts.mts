#!/usr/bin/env tsx
// N2-D.3 — provas RUNTIME TS do resolver territorial + REMEDIAÇÃO error-flow de canRepresentActor.
// Fase 1 (SEM social ports): canRepresentActor LANÇA (getActorRepository indisponível) → o resolver deve
//   PROPAGAR o erro de infra (has/assert throw), nunca convertê-lo em false/null/403. repository não é atingido.
// Fase 2 (COM ports): canRepresentActor retorna boolean → false = deny legítimo; true + grant válido = aprova.
// Fixture COMMITADA via pg (owner); teardown desabilita/reabilita a trigger de imutabilidade → resíduo 0.
import { readFileSync } from 'fs';
import pg from 'pg';
import { actorCapabilityGrantRepository } from '../src/modules/authority/actor-capability-grant.repository';
import { hasTerritorialCapability, assertTerritorialCapability, TERRITORIAL_CAPABILITY_DENIED } from '../src/modules/authority/territorial-capability-resolver';

const url = (readFileSync('.env', 'utf-8').match(/DATABASE_URL=(.+)/) || [])[1].trim();
const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const ACTOR = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const USER = '9305ac13-00b2-4ef2-989f-05c04259f18a';
const STRANGER = '00000000-0000-0000-0000-0000000000ff';
const CITYA = '029b307f-9cb6-43cb-8d99-11823b9dc001';
const CITYB = '058705b4-7d87-4cdd-aa8e-0bc15fa29fa4';
const KEY = 'territory:create_neighborhood';
let fails = 0;
const ok = (m: string) => console.log('   ✅ ' + m);
const bad = (m: string) => { console.log('   ❌ ' + m); fails++; };
const isDenied = (e: any) => e?.statusCode === 403 && e?.message === TERRITORIAL_CAPABILITY_DENIED;
const setup = new pg.Client({ connectionString: url });

async function main() {
  // ── FASE 1: SEM ports → canRepresentActor lança (infra). PROPAGAÇÃO obrigatória. ──
  // T3/T4/T5: key territorial válida → alcança canRepresentActor → LANÇA → has/assert PROPAGAM (não 403/false).
  try {
    await hasTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYA });
    bad('T3 has: infra de canRepresentActor NÃO propagou (virou boolean)');
  } catch (e: any) {
    isDenied(e) ? bad('T4 has: infra virou 403 DENIED (swallow proibido)') : ok(`has: infra de canRepresentActor PROPAGA (${(e?.message || '').slice(0, 40)})`);
  }
  try {
    await assertTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYA });
    bad('T5 assert: infra NÃO propagou');
  } catch (e: any) {
    isDenied(e) ? bad('T5 assert: infra virou 403 DENIED (swallow proibido)') : ok('assert: infra de canRepresentActor PROPAGA (não 403)');
  }
  // T8: key inválida → gate de key ANTES de canRepresentActor → false SEM lançar (mesmo sem ports).
  try {
    const h = await hasTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: 'territory:hack', scopeCityId: CITYA });
    h === false ? ok('T8 has: key inválida → false sem tocar canRepresentActor/DB') : bad(`T8 has key inválida → ${h}`);
  } catch (e: any) { bad(`T8 key inválida lançou (gate de key não precede canRep): ${e?.message}`); }

  // ── FASE 2: COM ports → canRepresentActor retorna boolean. ──
  const { socialPortsRegistry } = await import('../src/core/social/ports-registry');
  const { actorRepositoryAdapter, actorUtilsAdapter } = await import('../src/modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);

  await setup.connect();
  const ins = await setup.query(
    `INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status)
     VALUES ($1,$2,'territory',$3,$4,$1,'grant','active') RETURNING grant_id`, [ACTOR, KEY, CITYA, USER]);
  const grantId = ins.rows[0].grant_id as string;
  try {
    // T1: canRepresentActor=false (stranger) → repository não aprova → has=false, assert=403 uniforme
    const hFalse = await hasTerritorialCapability({ tenantId: TENANT, userId: STRANGER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYA });
    hFalse === false ? ok('T1 has: canRepresentActor=false → false (deny legítimo)') : bad(`T1 has false → ${hFalse}`);
    try { await assertTerritorialCapability({ tenantId: TENANT, userId: STRANGER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYA }); bad('T1 assert false deveria 403'); }
    catch (e: any) { isDenied(e) ? ok('T1 assert: false → 403 uniforme') : bad(`T1 assert false → ${e?.message}`); }

    // T2: canRepresentActor=true + grant válido → has=true, assert=grant_id
    const hTrue = await hasTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYA });
    hTrue === true ? ok('T2 has: representável + grant válido → true') : bad(`T2 has true → ${hTrue}`);
    const a = await assertTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYA });
    a === grantId ? ok('T2 assert: válido → grant_id') : bad(`T2 assert → ${a}`);

    // T6: representável + denial SQL (cidade errada) → has=false, assert=403
    const hCity = await hasTerritorialCapability({ tenantId: TENANT, userId: USER, granteeActorId: ACTOR, capabilityKey: KEY, scopeCityId: CITYB });
    hCity === false ? ok('T6 has: denial SQL (cidade errada) → false') : bad(`T6 has cidade → ${hCity}`);

    // T9: false (deny) e infra (throw) são observavelmente diferentes (já provado por fase1 throw vs T1 false)
    ok('T9 false=deny (retorna) vs infra=throw (propaga) são observavelmente distintos');
  } finally {
    await setup.query('ALTER TABLE actor_capability_grants DISABLE TRIGGER trg_acg_immutability');
    await setup.query('DELETE FROM actor_capability_grants WHERE grant_id=$1', [grantId]);
    await setup.query('ALTER TABLE actor_capability_grants ENABLE TRIGGER trg_acg_immutability');
    const res = await setup.query('SELECT count(*)::int AS n FROM actor_capability_grants');
    res.rows[0].n === 0 ? ok('resíduo 0') : bad(`resíduo ${res.rows[0].n}`);
    await setup.end();
    try { const { pool } = await import('../src/core/database/pool'); await (pool as any)?.end?.(); } catch { /* noop */ }
  }
}
main().then(() => { console.log(fails === 0 ? '\nTS RUNTIME OK — false=deny legítimo; infra de canRepresentActor PROPAGA (não vira false/null/403).' : `\nTS RUNTIME FAIL (${fails}).`); process.exit(fails === 0 ? 0 : 1); })
  .catch((e) => { console.error('erro fatal (não esperado nesta fase):', e?.message); process.exit(1); });
