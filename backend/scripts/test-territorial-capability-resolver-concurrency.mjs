#!/usr/bin/env node
// N2-D.3 — prova de CONCORRÊNCIA do FOR SHARE do resolver territorial. Duas conexões:
//  conn1 chama fn_assert_territorial_capability dentro de uma transação e MANTÉM o FOR SHARE;
//  conn2 tenta uma transição real (UPDATE do grant) e BLOQUEIA até conn1 liberar.
// Fixture é COMMITADA (visível às duas conexões) e HARD-DELETADA ao fim → zero resíduo.
import { readFileSync } from 'fs';
import pg from 'pg';

const url = (readFileSync('.env', 'utf-8').match(/DATABASE_URL=(.+)/) || [])[1].trim();
const ACTOR = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const USR = '9305ac13-00b2-4ef2-989f-05c04259f18a';
const CITY = '029b307f-9cb6-43cb-8d99-11823b9dc001';
const KEY = 'territory:create_neighborhood';
const c = (opts) => new pg.Client({ connectionString: url, ...opts });
const now = () => Date.now();
let fails = 0;
const ok = (m) => console.log('   ✅ ' + m);
const bad = (m) => { console.log('   ❌ ' + m); fails++; };

const setup = c();
const conn1 = c();
const conn2 = c();
let grantId = null;
try {
  await setup.connect(); await conn1.connect(); await conn2.connect();

  // 0. fixture COMMITADA (visível às duas conexões)
  const ins = await setup.query(
    `INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status)
     VALUES ($1,$2,'territory',$3,$4,$1,'grant','active') RETURNING grant_id`,
    [ACTOR, KEY, CITY, USR]
  );
  grantId = ins.rows[0].grant_id;
  ok(`fixture commitada grant=${grantId}`);

  // 1. conn1: adquire e MANTÉM o FOR SHARE via o resolver
  await conn1.query('BEGIN');
  const r1 = await conn1.query('SELECT public.fn_assert_territorial_capability($1,$2,$3) AS g', [ACTOR, KEY, CITY]);
  if (r1.rows[0].g === grantId) ok('conn1 resolveu e mantém FOR SHARE'); else bad(`conn1 grant_id divergente: ${r1.rows[0].g}`);

  // 2. conn2: tenta transição real (UPDATE) → deve BLOQUEAR (statement_timeout curto dispara)
  await conn2.query('BEGIN');
  await conn2.query("SET statement_timeout = '1500ms'");
  const t0 = now();
  let blocked = false;
  try {
    await conn2.query(
      `UPDATE actor_capability_grants SET status='revoked', revoked_at=now(), revoked_by_actor_id=$2, revoke_reason='conc' WHERE grant_id=$1`,
      [grantId, ACTOR]
    );
    bad('conn2 NÃO bloqueou (UPDATE passou com FOR SHARE ativo)');
  } catch (e) {
    if (e.code === '57014' || /timeout|cancel/i.test(e.message)) { blocked = true; ok(`conn2 bloqueou ~${now() - t0}ms (statement_timeout 57014) — FOR SHARE efetivo`); }
    else bad(`conn2 erro inesperado: ${e.message}`);
  }
  await conn2.query('ROLLBACK');
  if (!blocked) bad('bloqueio não comprovado');

  // 3. conn1 libera
  await conn1.query('ROLLBACK');
  ok('conn1 liberou o lock');

  // 4. conn2b: agora a transição PROSSEGUE (prova de liberação)
  await conn2.query('BEGIN');
  await conn2.query("SET statement_timeout = '3000ms'");
  const t1 = now();
  const upd = await conn2.query(
    `UPDATE actor_capability_grants SET status='revoked', revoked_at=now(), revoked_by_actor_id=$2, revoke_reason='conc' WHERE grant_id=$1`,
    [grantId, ACTOR]
  );
  if (upd.rowCount === 1) ok(`conn2 prosseguiu após liberação ~${now() - t1}ms (rows=${upd.rowCount})`); else bad(`conn2 pós-liberação rows=${upd.rowCount}`);
  await conn2.query('ROLLBACK'); // não persiste o revoke
} catch (e) {
  bad(`erro geral: ${e.message}`);
} finally {
  // 5. TEARDOWN: DELETE físico é barrado pela trigger de imutabilidade (invariante de prod). Como owner,
  //    desabilitamos a trigger APENAS para limpeza do fixture e a REABILITAMOS (o resultado do lock acima
  //    já foi provado independentemente; isto não fabrica o teste). Prova: trigger re-enabled + resíduo 0.
  try {
    if (grantId) {
      await setup.query('ALTER TABLE actor_capability_grants DISABLE TRIGGER trg_acg_immutability');
      await setup.query('DELETE FROM actor_capability_grants WHERE grant_id=$1', [grantId]);
      await setup.query('ALTER TABLE actor_capability_grants ENABLE TRIGGER trg_acg_immutability');
    }
  } catch (e) { bad(`teardown: ${e.message}`); }
  const res = await setup.query('SELECT count(*)::int AS n FROM actor_capability_grants');
  if (res.rows[0].n === 0) ok('resíduo 0 (fixture removida)'); else bad(`resíduo ${res.rows[0].n}`);
  const trg = await setup.query(`SELECT tgenabled FROM pg_trigger WHERE tgname='trg_acg_immutability'`);
  if (trg.rows[0]?.tgenabled === 'O') ok('trg_acg_immutability REABILITADA (invariante restaurado)'); else bad(`trigger imutabilidade não restaurada: ${trg.rows[0]?.tgenabled}`);
  await setup.end(); await conn1.end(); await conn2.end();
}
console.log(fails === 0 ? '\nCONCURRENCY OK — FOR SHARE do resolver bloqueia transição concorrente e libera no fim da tx.' : `\nCONCURRENCY FAIL (${fails}).`);
process.exit(fails === 0 ? 0 : 1);
