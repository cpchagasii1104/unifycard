#!/usr/bin/env node
// N2-E — concorrência do writer canônico. Fixtures COMMITADAS; teardown desabilita triggers só p/ limpeza.
import { readFileSync } from 'fs';
import pg from 'pg';
const url = (readFileSync('.env', 'utf-8').match(/DATABASE_URL=(.+)/) || [])[1].trim();
const ACTOR = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const USER = '9305ac13-00b2-4ef2-989f-05c04259f18a';
const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const CITY = '029b307f-9cb6-43cb-8d99-11823b9dc001';
const c = () => new pg.Client({ connectionString: url });
let fails = 0; const ok = (m) => console.log('   ✅ ' + m); const bad = (m) => { console.log('   ❌ ' + m); fails++; };
const setup = c(), conn1 = c(), conn2 = c();
const mk = async (cl, key) => (await cl.query(`INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status) VALUES ($1,$2,'territory',$3,$1,'grant','active') RETURNING grant_id`, [ACTOR, key, CITY].flat ? [ACTOR, key, CITY] : [ACTOR, key, CITY])).rows[0].grant_id;
let createG, approveG;
async function main() {
  await setup.connect(); await conn1.connect(); await conn2.connect();
  createG = (await setup.query(`INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status) VALUES ($1,'territory:create_neighborhood','territory',$2,$1,$1,'grant','active') RETURNING grant_id`, [ACTOR, CITY])).rows[0].grant_id;
  approveG = (await setup.query(`INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status) VALUES ($1,'territory:approve_neighborhood','territory',$2,$1,$1,'grant','active') RETURNING grant_id`, [ACTOR, CITY])).rows[0].grant_id;
  ok('fixtures commitadas (2 grants)');

  try {
    // CC1 — writer segura FOR SHARE nos grants; revoke concorrente BLOQUEIA até liberar.
    await conn1.query('BEGIN');
    await conn1.query(`SELECT public.fn_create_canonical_neighborhood($1,$2,$3,$4,'ConcBairroA','internal_curation','r','e','m')`, [TENANT, USER, ACTOR, CITY]);
    await conn2.query('BEGIN'); await conn2.query("SET statement_timeout='1500ms'");
    const t0 = Date.now(); let blocked = false;
    try {
      await conn2.query(`SELECT public.fn_revoke_actor_capability_grant($1,$2,$3,$3,$3,'x')`, [TENANT, createG, USER]);
      bad('CC1 revoke NÃO bloqueou sob FOR SHARE do writer');
    } catch (e) { if (e.code === '57014' || /timeout/i.test(e.message)) { blocked = true; ok(`CC1 revoke do create-grant bloqueou ~${Date.now() - t0}ms (FOR SHARE do writer efetivo)`); } else bad(`CC1 erro inesperado: ${e.message}`); }
    await conn2.query('ROLLBACK');
    await conn1.query('ROLLBACK');
    if (!blocked) bad('CC1 bloqueio não comprovado');

    // CC2 — token não cruza transação/backend: conn1 emite token (uncommitted); conn2 (outra tx/backend)
    //       tenta INSERT direto em neighborhoods → seu próprio consume acha 0 tokens → HOLD.
    await conn1.query('BEGIN');
    await conn1.query(`SELECT public.fn_create_canonical_neighborhood($1,$2,$3,$4,'ConcBairroB','internal_curation','r','e','m')`, [TENANT, USER, ACTOR, CITY]);
    // conn1 consumiu o próprio token no INSERT; a prova é que conn2, mesmo com grants válidos, não vê token de conn1.
    let held = false;
    try {
      await conn2.query('BEGIN');
      await conn2.query(`INSERT INTO neighborhoods (city_id,name,source_kind,source_reference,evidence,created_by_actor_id,approved_by_actor_id,approved_at,valid_from_at) VALUES ($1,'X','internal_curation','r','e',$2,$2,now(),now())`, [CITY, ACTOR]);
      bad('CC2 INSERT de conn2 sem token próprio passou (token cruzou tx/backend)');
    } catch (e) { if (/NEIGHBORHOOD_CANONICAL_WRITER_HOLD/.test(e.message)) { held = true; ok('CC2 token não cruza tx/backend (conn2 sem token → HOLD)'); } else bad(`CC2 erro inesperado: ${e.message}`); }
    await conn2.query('ROLLBACK'); await conn1.query('ROLLBACK');
    if (!held) bad('CC2 isolamento de token não comprovado');

    // CC3 — dois writers, MESMO nome/cidade, serializam pelo índice único (name_normalized).
    await conn1.query('BEGIN');
    await conn1.query(`SELECT public.fn_create_canonical_neighborhood($1,$2,$3,$4,'ConcMesmo','internal_curation','r','e','m')`, [TENANT, USER, ACTOR, CITY]);
    await conn2.query('BEGIN'); await conn2.query("SET statement_timeout='1500ms'");
    let ser = false;
    try {
      await conn2.query(`SELECT public.fn_create_canonical_neighborhood($1,$2,$3,$4,'concmesmo','internal_curation','r','e','m')`, [TENANT, USER, ACTOR, CITY]);
      bad('CC3 segundo writer não serializou');
    } catch (e) { if (e.code === '57014' || /timeout/i.test(e.message)) { ser = true; ok(`CC3 segundo writer (mesmo nome) serializou/bloqueou ~1.5s no índice único`); } else if (/unique/i.test(e.message)) { ser = true; ok('CC3 segundo writer → unique_violation (serialização)'); } else bad(`CC3 erro inesperado: ${e.message}`); }
    await conn2.query('ROLLBACK'); await conn1.query('ROLLBACK');
    if (!ser) bad('CC3 serialização não comprovada');
  } catch (e) { bad(`erro geral: ${e.message}`); }
  finally {
    // teardown: nada foi commitado (todos ROLLBACK); só os 2 grants fixtures persistem → remover.
    try {
      await setup.query('ALTER TABLE actor_capability_grants DISABLE TRIGGER trg_acg_immutability');
      await setup.query('DELETE FROM actor_capability_grants WHERE grant_id = ANY($1)', [[createG, approveG]]);
      await setup.query('ALTER TABLE actor_capability_grants ENABLE TRIGGER trg_acg_immutability');
    } catch (e) { bad(`teardown: ${e.message}`); }
    const r = await setup.query(`SELECT (SELECT count(*) FROM neighborhoods)::int nb,(SELECT count(*) FROM actor_capability_grants WHERE scope_type='territory')::int g,(SELECT count(*) FROM neighborhood_curation_events)::int ev,(SELECT count(*) FROM neighborhood_writer_authorizations)::int tok`);
    const { nb, g, ev, tok } = r.rows[0];
    (nb === 0 && g === 0 && ev === 0 && tok === 0) ? ok(`resíduo 0 (nb=${nb} grants=${g} ev=${ev} tok=${tok})`) : bad(`resíduo nb=${nb} g=${g} ev=${ev} tok=${tok}`);
    const trg = await setup.query(`SELECT tgenabled FROM pg_trigger WHERE tgname='trg_acg_immutability'`);
    trg.rows[0]?.tgenabled === 'O' ? ok('trg_acg_immutability restaurada') : bad('trigger imutabilidade não restaurada');
    await setup.end(); await conn1.end(); await conn2.end();
  }
}
main().then(() => { console.log(fails === 0 ? '\nCONCURRENCY OK — locks do writer (grants FOR SHARE), token não cruza tx/backend, mesmo-nome serializa.' : `\nCONCURRENCY FAIL (${fails}).`); process.exit(fails ? 1 : 0); }).catch((e) => { console.error('fatal:', e.message); process.exit(1); });
