#!/usr/bin/env tsx
// N2-E — provas RUNTIME TS do writer canônico (transaction-service). Fase-1 sem ports: canRepresentActor
// LANÇA → PROPAGA (não vira false/403). Fase-2 com ports: false=deny, happy path cria via withTransaction.
import { readFileSync } from 'fs';
import pg from 'pg';
import { neighborhoodCanonicalWriterService } from '../src/modules/neighborhoods/neighborhood-canonical-writer.service';

const url = (readFileSync('.env', 'utf-8').match(/DATABASE_URL=(.+)/) || [])[1].trim();
const ACTOR = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const USER = '9305ac13-00b2-4ef2-989f-05c04259f18a';
const STRANGER = '00000000-0000-0000-0000-0000000000ff';
const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const CITY = '029b307f-9cb6-43cb-8d99-11823b9dc001';
let fails = 0; const ok = (m: string) => console.log('   ✅ ' + m); const bad = (m: string) => { console.log('   ❌ ' + m); fails++; };
const setup = new pg.Client({ connectionString: url });
const ctx = (u = USER, a = ACTOR, t = TENANT) => ({ tenantId: t, userId: u, granteeActorId: a });
const payload = (name = 'Bairro TS') => ({ cityId: CITY, name, sourceKind: 'internal_curation', sourceReference: 'r', evidence: 'e', reason: 'm' });

async function main() {
  // ── FASE 1: sem social ports → canRepresentActor lança → o service PROPAGA (não 403/false). ──
  try {
    await neighborhoodCanonicalWriterService.createCanonicalNeighborhood(ctx(), payload());
    bad('F1: infra de canRepresentActor não propagou');
  } catch (e: any) {
    (e?.statusCode === 403) ? bad('F1: infra virou 403 (swallow proibido)') : ok(`F1 infra de canRepresentActor PROPAGA (${(e?.message || '').slice(0, 40)})`);
  }
  // validation antes de canRepresentActor: payload vazio → 400 sem tocar canRep
  try {
    await neighborhoodCanonicalWriterService.createCanonicalNeighborhood(ctx(), { ...payload(), name: '' });
    bad('F1b: nome vazio deveria 400');
  } catch (e: any) { (e?.statusCode === 400) ? ok('F1b nome vazio → 400 validation (antes de canRep)') : bad(`F1b → ${e?.statusCode}/${e?.message}`); }

  // ── FASE 2: com ports. ──
  const { socialPortsRegistry } = await import('../src/core/social/ports-registry');
  const { actorRepositoryAdapter, actorUtilsAdapter } = await import('../src/modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  await setup.connect();
  const cg = (await setup.query(`INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status) VALUES ($1,'territory:create_neighborhood','territory',$2,$1,$1,'grant','active') RETURNING grant_id`, [ACTOR, CITY])).rows[0].grant_id;
  const ag = (await setup.query(`INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status) VALUES ($1,'territory:approve_neighborhood','territory',$2,$1,$1,'grant','active') RETURNING grant_id`, [ACTOR, CITY])).rows[0].grant_id;
  let nbId: string | null = null;
  try {
    // T-false: stranger não representa → 403 (deny legítimo), sem criar bairro
    try { await neighborhoodCanonicalWriterService.createCanonicalNeighborhood(ctx(STRANGER), payload()); bad('F2 stranger deveria 403'); }
    catch (e: any) { (e?.statusCode === 403) ? ok('F2 canRepresentActor=false → 403 (deny legítimo)') : bad(`F2 stranger → ${e?.statusCode}/${e?.message}`); }

    // T-happy: representável + grants válidos → cria via withTransaction, retorna só neighborhood_id
    nbId = await neighborhoodCanonicalWriterService.createCanonicalNeighborhood(ctx(), payload('Bairro Runtime TS'));
    (typeof nbId === 'string' && /^[0-9a-f-]{36}$/.test(nbId)) ? ok(`F2 happy path → neighborhood_id (${nbId.slice(0, 8)})`) : bad(`F2 retorno inesperado: ${nbId}`);
    const chk = await setup.query('SELECT count(*)::int n, (SELECT count(*)::int FROM neighborhood_curation_events WHERE neighborhood_id=$1) ev FROM neighborhoods WHERE neighborhood_id=$1', [nbId]);
    (chk.rows[0].n === 1 && chk.rows[0].ev === 2) ? ok('F2 commit real: 1 bairro + 2 eventos') : bad(`F2 estado: nb=${chk.rows[0].n} ev=${chk.rows[0].ev}`);

    // T-conflict: mesmo nome normalizado → 409
    try { await neighborhoodCanonicalWriterService.createCanonicalNeighborhood(ctx(), payload('BAIRRO RUNTIME TS')); bad('F2 conflito deveria 409'); }
    catch (e: any) { (e?.statusCode === 409) ? ok('F2 conflito (mesmo nome) → 409') : bad(`F2 conflito → ${e?.statusCode}/${e?.message}`); }
  } finally {
    // teardown: remover bairro + eventos + grants (desabilitar triggers só p/ limpeza).
    try {
      if (nbId) {
        await setup.query('ALTER TABLE neighborhood_curation_events DISABLE TRIGGER trg_nce_no_delete');
        await setup.query('DELETE FROM neighborhood_curation_events WHERE neighborhood_id=$1', [nbId]);
        await setup.query('ALTER TABLE neighborhood_curation_events ENABLE TRIGGER trg_nce_no_delete');
        await setup.query('ALTER TABLE neighborhoods DISABLE TRIGGER trg_neighborhood_identity_immutability');
        await setup.query('ALTER TABLE neighborhoods DISABLE TRIGGER trg_neighborhoods_canonical_writer_hold');
        await setup.query('DELETE FROM neighborhoods WHERE neighborhood_id=$1', [nbId]);
        await setup.query('ALTER TABLE neighborhoods ENABLE ALWAYS TRIGGER trg_neighborhoods_canonical_writer_hold');
        await setup.query('ALTER TABLE neighborhoods ENABLE TRIGGER trg_neighborhood_identity_immutability');
      }
      await setup.query('ALTER TABLE actor_capability_grants DISABLE TRIGGER trg_acg_immutability');
      await setup.query('DELETE FROM actor_capability_grants WHERE grant_id = ANY($1)', [[cg, ag]]);
      await setup.query('ALTER TABLE actor_capability_grants ENABLE TRIGGER trg_acg_immutability');
    } catch (e: any) { bad(`teardown: ${e.message}`); }
    const r = await setup.query(`SELECT (SELECT count(*) FROM neighborhoods)::int nb,(SELECT count(*) FROM actor_capability_grants WHERE scope_type='territory')::int g,(SELECT count(*) FROM neighborhood_curation_events)::int ev,(SELECT count(*) FROM neighborhood_writer_authorizations)::int tok`);
    const { nb, g, ev, tok } = r.rows[0];
    (nb === 0 && g === 0 && ev === 0 && tok === 0) ? ok(`resíduo 0`) : bad(`resíduo nb=${nb} g=${g} ev=${ev} tok=${tok}`);
    // HOLD restaurado (ENABLE ALWAYS = 'A')
    const h = await setup.query(`SELECT tgenabled FROM pg_trigger WHERE tgname='trg_neighborhoods_canonical_writer_hold'`);
    h.rows[0]?.tgenabled === 'A' ? ok('HOLD ENABLE ALWAYS restaurado') : bad(`HOLD tgenabled=${h.rows[0]?.tgenabled}`);
    await setup.end();
    try { const { pool } = await import('../src/core/database/pool'); await (pool as any)?.end?.(); } catch { /* noop */ }
  }
}
main().then(() => { console.log(fails === 0 ? '\nTS RUNTIME OK — contexto/payload separados; canRepresentActor prevalidation (false=deny, infra propaga); happy path atômico via withTransaction; conflito=409.' : `\nTS RUNTIME FAIL (${fails}).`); process.exit(fails ? 1 : 0); }).catch((e) => { console.error('fatal:', e?.message); process.exit(1); });
