#!/usr/bin/env node
// PORTA-TERRITORY-ALIASES — operação one-shot governada (DECISION-0174 · N0-D).
// Concede ao Actor humano de Clayton EXATAMENTE 1 grant territorial de curadoria de aliases em Curitiba:
//   territory:manage_neighborhood_aliases → 213f4903 → Curitiba 9d431002
// via o writer governado fn_grant_territorial_capability (mecanismo). A FONTE INSTITUCIONAL da
// autoridade é a decisão explícita de platform_bootstrap registrada na DECISION-0174 — a função é
// apenas o mecanismo fechado de materialização, NÃO uma authority soberana por si só.
//
//   dry-run (default): BEGIN → advisory lock → preflight → chamada real → provas → ROLLBACK real.
//   --apply "GRANT_CURITIBA_NEIGHBORHOOD_ALIAS_CAPABILITY": só então COMMIT, após TODAS as assertions.
//
// Fail-closed: exige exatamente os 2 grants territoriais anteriores (create+approve) e
// manage_neighborhood_aliases=0; rerun após apply falha honestamente (grant já existe →
// precondition_failed; o índice único parcial também protege). Advisory lock serializa. Sem
// ON CONFLICT/UPSERT/DELETE. NÃO abre HOLD, NÃO cria writer/manifest/alias, NÃO toca Social/Bank.

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const CITY_ID = '9d431002-1fd3-4b34-ae82-678f28f64288';          // Curitiba/PR/Brasil
const GRANTEE_ACTOR_ID = '213f4903-d0c3-4c03-aa2f-328e11aac807'; // Actor humano de Clayton
const GRANTED_BY_USER_ID = '9305ac13-00b2-4ef2-989f-05c04259f18a';
const GRANTED_BY_ACTOR_ID = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const CAP = 'territory:manage_neighborhood_aliases'; // EXATAMENTE esta (nunca create/approve/wildcard)
const REASON = 'PORTA-TERRITORY-ALIASES: curadoria de aliases de bairro em Curitiba (DECISION-0174, platform_bootstrap).';
const EVENT_REASON = 'PORTA-TERRITORY-ALIASES: grant one-shot de manage_neighborhood_aliases (DECISION-0174).';
const CONFIRM_TOKEN = 'GRANT_CURITIBA_NEIGHBORHOOD_ALIAS_CAPABILITY';
const OTHER_KEYS = ['territory:correct_neighborhood', 'territory:deactivate_neighborhood', 'territory:register_neighborhood_succession'];

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
    log(`[porta-territory-aliases] modo=${APPLY ? (CONFIRMED ? 'APPLY (confirmado)' : 'APPLY SEM CONFIRMAÇÃO → recusado') : 'DRY-RUN'} · current_user=${cu}`);
    if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token de confirmação explícito: ${CONFIRM_TOKEN}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`PORTA-TERRITORY-ALIASES:${CITY_ID}:${GRANTEE_ACTOR_ID}`]);

    // ── PREFLIGHT (fail-closed; a PORTA NÃO depende do grant que cria) ──
    const cityRow = (await client.query('SELECT city_id, name FROM cities WHERE city_id=$1 FOR SHARE', [CITY_ID])).rows[0];
    assert(cityRow && cityRow.name === 'Curitiba', `city canônica Curitiba (${CITY_ID})`);
    const actorRow = (await client.query('SELECT actor_id, actor_type, tenant_id, user_id FROM actors WHERE actor_id=$1 FOR SHARE', [GRANTEE_ACTOR_ID])).rows[0];
    assert(actorRow && actorRow.actor_type === 'user' && actorRow.tenant_id, `grantee Actor user tenant-bound (${GRANTEE_ACTOR_ID})`);
    assert(actorRow && actorRow.user_id === GRANTED_BY_USER_ID, `grantee vinculado ao user esperado (${GRANTED_BY_USER_ID})`);

    // estado anterior EXATO: 2 grants territoriais (create+approve), manage_aliases=0.
    const nTerr = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory' AND revoked_at IS NULL")).rows[0].n;
    if (nTerr !== 2) throw new Error(`precondition_failed: esperado 2 grants territoriais vivos (create+approve), encontrado ${nTerr}`);
    const nAliasBefore = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory' AND capability_key=$1 AND revoked_at IS NULL", [CAP])).rows[0].n;
    if (nAliasBefore !== 0) throw new Error('already_applied / precondition_failed: territory:manage_neighborhood_aliases já concedido — rerun fail-closed');
    assert(nTerr === 2 && nAliasBefore === 0, 'estado anterior: 2 grants (create+approve), manage_aliases=0');
    // a PORTA não cria bairro nem alias; snapshot de invariância
    const nNbBefore = (await client.query('SELECT count(*)::int n FROM neighborhoods')).rows[0].n;
    const nAliasesBefore = (await client.query('SELECT count(*)::int n FROM neighborhood_aliases')).rows[0].n;
    const nBankBefore = (await client.query('SELECT count(*)::int n FROM bank_accounts')).rows[0].n;
    assert(nNbBefore === 75 && nAliasesBefore === 0 && nBankBefore === 15, 'baseline territorial/bank: neighborhoods=75, aliases=0, bank=15');

    // ── CHAMADA CANÔNICA (única mutação de authority; NUNCA INSERT direto) ──
    const g = (await client.query(
      'SELECT * FROM public.fn_grant_territorial_capability($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [CITY_ID, GRANTEE_ACTOR_ID, CAP, GRANTED_BY_USER_ID, GRANTED_BY_ACTOR_ID, null, REASON, GRANTED_BY_USER_ID, GRANTED_BY_ACTOR_ID, GRANTED_BY_ACTOR_ID, EVENT_REASON]
    )).rows[0];
    assert(
      g.scope_type === 'territory' && g.tenant_id === null && g.scope_actor_id === null && g.scope_city_id === CITY_ID
      && g.grantee_actor_id === GRANTEE_ACTOR_ID && g.status === 'active' && g.valid_until === null
      && g.authority_source === 'platform_bootstrap' && g.capability_key === CAP,
      `grant manage_neighborhood_aliases: shape territorial (tenant NULL, scope_actor NULL, Curitiba, active, valid_until NULL, bootstrap)`
    );

    // exatamente 1 evento 'granted' para este grant
    const nev = (await client.query("SELECT count(*)::int n FROM actor_capability_grant_events WHERE grant_id=$1 AND event_type='granted'", [g.grant_id])).rows[0].n;
    assert(nev === 1, `exatamente 1 evento 'granted' para o novo grant`);

    // pós-estado: 3 grants (create=1, approve=1, manage_aliases=1); nenhuma outra key; mesma city/Actor
    const byKey = (await client.query("SELECT capability_key, count(*)::int n FROM actor_capability_grants WHERE scope_type='territory' AND revoked_at IS NULL GROUP BY 1")).rows;
    const km = Object.fromEntries(byKey.map((r) => [r.capability_key, r.n]));
    assert(km['territory:create_neighborhood'] === 1 && km['territory:approve_neighborhood'] === 1 && km['territory:manage_neighborhood_aliases'] === 1,
      'grants por key: create=1, approve=1, manage_aliases=1');
    const nOther = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory' AND capability_key = ANY($1) AND revoked_at IS NULL", [OTHER_KEYS])).rows[0].n;
    assert(nOther === 0, 'nenhuma das outras 3 capabilities territoriais (correct/deactivate/succession)');
    const nTot = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory' AND revoked_at IS NULL")).rows[0].n;
    assert(nTot === 3, 'exatamente 3 grants territoriais vivos');
    const nBadCity = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory' AND scope_city_id <> $1 AND revoked_at IS NULL", [CITY_ID])).rows[0].n;
    const nBadActor = (await client.query("SELECT count(*)::int n FROM actor_capability_grants WHERE scope_type='territory' AND grantee_actor_id <> $1 AND revoked_at IS NULL", [GRANTEE_ACTOR_ID])).rows[0].n;
    assert(nBadCity === 0 && nBadActor === 0, 'nenhum grant para outra city ou outro Actor');

    // invariância: PORTA não cria bairro/alias, não move Bank
    const nNbAfter = (await client.query('SELECT count(*)::int n FROM neighborhoods')).rows[0].n;
    const nAliasesAfter = (await client.query('SELECT count(*)::int n FROM neighborhood_aliases')).rows[0].n;
    const nBankAfter = (await client.query('SELECT count(*)::int n FROM bank_accounts')).rows[0].n;
    const bankSum = (await client.query('SELECT coalesce(sum(reconciliation_balance_cents),0)::bigint AS s FROM bank_accounts')).rows[0].s;
    assert(nNbAfter === 75 && nAliasesAfter === 0 && nBankAfter === 15 && String(bankSum) === '0',
      'invariância: neighborhoods=75, aliases=0, bank=15, Δbank=0');

    if (APPLY && CONFIRMED && !failed) {
      await client.query('COMMIT');
      log(`[porta-territory-aliases] APPLY COMMIT — grant persistido: ${g.grant_id}`);
    } else {
      await client.query('ROLLBACK');
      log(`[porta-territory-aliases] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK (nada persistido)`);
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
