#!/usr/bin/env node
// PORTA-TERRITORY-1 — operação one-shot versionada de bootstrap territorial de Curitiba.
// Concede ao Actor pessoal de Clayton exatamente 2 grants territoriais (create + approve) para Curitiba,
// via o writer governado fn_grant_territorial_capability. Sem rota/HTTP. IDs fixos e governados.
//
//   dry-run (default): abre transação, cria os 2 grants, valida tudo, e faz ROLLBACK (nada persiste).
//   --apply "PORTA-TERRITORY-1-CURITIBA": só então COMMIT, após TODAS as assertions.
//
// Fail-closed: exige estado territorial inicial ZERO; rerun após apply falha honestamente (índice único
// parcial uidx_actor_capability_grants_territory_active). Advisory lock transacional serializa. Sem
// ON CONFLICT/UPSERT/reconciliação/DELETE. Conecta com o papel owner (não unificard_app).

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const CITY_ID = '9d431002-1fd3-4b34-ae82-678f28f64288';          // Curitiba/PR/Brasil (M-2)
const GRANTEE_ACTOR_ID = '213f4903-d0c3-4c03-aa2f-328e11aac807'; // Actor pessoal de Clayton (M-1)
const GRANTED_BY_USER_ID = '9305ac13-00b2-4ef2-989f-05c04259f18a';
const GRANTED_BY_ACTOR_ID = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const CAPS = ['territory:create_neighborhood', 'territory:approve_neighborhood']; // M-3 (só estas 2)
const REASON = 'Bootstrap territorial inicial de Curitiba autorizado por Clayton (PORTA-TERRITORY-1).';
const EVENT_REASON = 'PORTA-TERRITORY-1: bootstrap one-shot da autoridade territorial de Curitiba.';
const CONFIRM_TOKEN = 'PORTA-TERRITORY-1-CURITIBA';
const OTHER_CAPS = ['territory:correct_neighborhood', 'territory:deactivate_neighborhood', 'territory:manage_neighborhood_aliases', 'territory:register_neighborhood_succession'];

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRMED = argv.includes(CONFIRM_TOKEN);

function envDatabaseUrl() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const m = readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!m) throw new Error('DATABASE_URL ausente em backend/.env');
  return m.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
}

let failed = false;
const log = (m) => console.log(m);
const assert = (cond, label) => { if (cond) log('  OK  ' + label); else { failed = true; log('  XX  ' + label); } };

async function main() {
  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  try {
    const cu = (await client.query('SELECT current_user AS u')).rows[0].u;
    if (cu === 'unificard_app') throw new Error('recuso executar como unificard_app (papel de runtime da app) — use o papel operacional/owner');
    log(`[porta-territory-1] modo=${APPLY ? (CONFIRMED ? 'APPLY (confirmado)' : 'APPLY SEM CONFIRMAÇÃO → recusado') : 'DRY-RUN'} · current_user=${cu}`);
    if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token de confirmação explícito: ${CONFIRM_TOKEN}`);

    await client.query('BEGIN');
    // advisory lock transacional específico da PORTA/city/Actor (serializa execuções concorrentes)
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`PORTA-TERRITORY-1:${CITY_ID}:${GRANTEE_ACTOR_ID}`]);
    // lock city + Actor (revalidação sob lock)
    const cityRow = (await client.query('SELECT city_id, name FROM cities WHERE city_id=$1 FOR SHARE', [CITY_ID])).rows[0];
    assert(cityRow && cityRow.name === 'Curitiba', `city canônica Curitiba (${CITY_ID})`);
    const actorRow = (await client.query('SELECT actor_id, actor_type, tenant_id FROM actors WHERE actor_id=$1 FOR SHARE', [GRANTEE_ACTOR_ID])).rows[0];
    assert(actorRow && actorRow.actor_type === 'user' && actorRow.tenant_id, `grantee Actor user tenant-bound (${GRANTEE_ACTOR_ID})`);
    // estado territorial inicial ESTRITAMENTE ZERO (fail-closed)
    const n0 = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory'")).rows[0].n;
    if (n0 !== 0) throw new Error(`estado inicial NÃO-ZERO: ${n0} grants territoriais já existem — fail-closed (sem reconciliação)`);
    assert(n0 === 0, 'estado territorial inicial ZERO');

    // criar os 2 grants via o writer governado
    const ids = [];
    for (const cap of CAPS) {
      const g = (await client.query(
        'SELECT * FROM public.fn_grant_territorial_capability($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [CITY_ID, GRANTEE_ACTOR_ID, cap, GRANTED_BY_USER_ID, GRANTED_BY_ACTOR_ID, null, REASON, GRANTED_BY_USER_ID, GRANTED_BY_ACTOR_ID, GRANTED_BY_ACTOR_ID, EVENT_REASON]
      )).rows[0];
      ids.push(g.grant_id);
      assert(g.scope_type === 'territory' && g.tenant_id === null && g.scope_actor_id === null && g.scope_city_id === CITY_ID
        && g.status === 'active' && g.valid_until === null && g.authority_source === 'platform_bootstrap' && g.capability_key === cap,
        `grant ${cap}: shape territorial (tenant NULL, scope_actor NULL, city Curitiba, active, valid_until NULL, bootstrap)`);
    }
    assert(ids.length === 2 && ids[0] !== ids[1], `2 grant_ids distintos (${ids.join(', ')})`);

    // 2 eventos 'granted'
    const nev = (await client.query("SELECT count(*)::int n FROM actor_capability_grant_events WHERE grant_id = ANY($1) AND event_type='granted'", [ids])).rows[0].n;
    assert(nev === 2, `2 eventos 'granted'`);

    // ausência das outras 4 capabilities / outra city / outro Actor
    const nother = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory' AND capability_key = ANY($1)", [OTHER_CAPS])).rows[0].n;
    assert(nother === 0, 'nenhuma das outras 4 capabilities territoriais');
    const nbadcity = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory' AND scope_city_id <> $1", [CITY_ID])).rows[0].n;
    assert(nbadcity === 0, 'nenhum grant para outra city');
    const nbadactor = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory' AND grantee_actor_id <> $1", [GRANTEE_ACTOR_ID])).rows[0].n;
    assert(nbadactor === 0, 'nenhum grant para outro Actor');
    const ntot = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory'")).rows[0].n;
    assert(ntot === 2, 'exatamente 2 grants territoriais');

    // zero neighborhood; Bank intacto (nenhuma escrita em bank aqui) → Δbank=0
    const nnb = (await client.query('SELECT count(*)::int n FROM neighborhoods')).rows[0].n;
    assert(nnb === 0, 'neighborhoods=0 (a PORTA não cria bairro)');

    if (APPLY && CONFIRMED && !failed) {
      await client.query('COMMIT');
      log(`[porta-territory-1] APPLY COMMIT — grants persistidos: ${ids.join(', ')}`);
    } else {
      await client.query('ROLLBACK');
      log(`[porta-territory-1] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK (nada persistido)`);
    }
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    failed = true;
    log('  XX  ERRO: ' + String(e.message).split('\n')[0]);
  } finally {
    await client.end();
  }
  process.exit(failed ? 1 : 0);
}
main();
