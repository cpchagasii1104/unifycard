#!/usr/bin/env node
// DECISION-0189B ETAPA D · APLICAÇÃO SELETIVA GOVERNADA da migration interact_feed.
// MESMO RITO dos apply-* das campanhas (runner canônico segue bloqueado no dev pelo drift
// parte-(b) pré-existente — INTOCADO). dry-run default; --apply + token → COMMIT; --db p/ clone.

import pg from 'pg';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const MIG_NAME = '20260719200000_company_interact_feed_authority.sql';
const EXPECTED_SHA256 = '2b50c50a62b25ae0a7132edd45c7519cb5d5e6116ea1df9bbad2487f2abb7278';
const CONFIRM_TOKEN = 'APPLY_COMPANY_INTERACT_FEED_20260719200000';
const CATALOG_V2_DIGEST = 'b8b592a480641152aac0070815ee4117b3241a65dd48ee0489dd8b8f1cf94d65';
const MUST_STAY_UNREGISTERED = [
  '20260713100000_actor_territorial_assignment_foundation.sql',
  '20260713120000_cities_official_code_scoped_unicity.sql',
  '20260713140000_neighborhood_alias_first_governed_flow.sql',
  '20260716120000_fiscal_tax_reserve_bank_substrate.sql',
  '20260716140000_regional_treasury_authority_grant_substrate.sql',
  '20260717120000_group_institutional_bindings.sql',
  '20260718120000_group_actor_memberships.sql',
];

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRMED = argv.includes(CONFIRM_TOKEN);
const dbFlag = argv.indexOf('--db');
const DB_OVERRIDE = dbFlag >= 0 ? argv[dbFlag + 1] : null;

const here = dirname(fileURLToPath(import.meta.url));
function envDatabaseUrl() {
  if (DB_OVERRIDE) return DB_OVERRIDE;
  const m = readFileSync(join(here, '..', '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!m) throw new Error('DATABASE_URL ausente em backend/.env');
  return m.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
}
function migrationBody() {
  const raw = readFileSync(join(here, '..', 'migrations', MIG_NAME), 'utf8');
  const sha = createHash('sha256').update(raw.replace(/\r/g, ''), 'utf8').digest('hex');
  const shaRawEol = createHash('sha256').update(raw, 'utf8').digest('hex');
  if (sha !== EXPECTED_SHA256 && shaRawEol !== EXPECTED_SHA256) {
    throw new Error(`file_hash_mismatch: esperado ${EXPECTED_SHA256}; calculado ${sha}`);
  }
  // esta migration não tem BEGIN/COMMIT internos; nada a strippar.
  return { body: raw.replace(/\r/g, ''), sha };
}

let failed = false;
const log = (m) => console.log(m);
const assert = (cond, label) => { if (cond) log('  OK  ' + label); else { failed = true; log('  XX  ' + label); } };
const int = async (c, q, p = []) => (await c.query(q, p)).rows[0].n;

async function main() {
  const { body, sha } = migrationBody();
  log(`[apply-interact-feed] arquivo=${MIG_NAME} sha256=${sha}`);
  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  try {
    const cu = (await client.query('SELECT current_user AS u, current_database() AS d')).rows[0];
    if (cu.u === 'unificard_app') throw new Error('recuso executar como unificard_app');
    log(`[apply-interact-feed] modo=${APPLY ? (CONFIRMED ? 'APPLY' : 'APPLY-SEM-CONFIRMAÇÃO→recusado') : 'DRY-RUN'} · db=${cu.d} · user=${cu.u}`);
    if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token literal: ${CONFIRM_TOKEN}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`APPLY-MIG:${MIG_NAME}`]);

    if (await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]) !== 0) {
      throw new Error('already_applied');
    }
    assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1',
      ['20260719180000_company_exclusivity_advisory_lock.sql']) === 1, 'exclusividade advisory-lock registrada (pré-requisito)');
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0,
      'as 7 pendentes preservadas AUSENTES (pré)');
    assert(await int(client, "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='company_users' AND column_name='can_interact_feed'") === 0, 'can_interact_feed AUSENTE (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_transactions') === 0, 'bank_transactions=0 (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_splits') === 0, 'bank_splits=0 (pré)');
    if (failed) throw new Error('preflight_failed');

    await client.query(body);

    assert(await int(client, "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='company_users' AND column_name='can_interact_feed'") === 1, 'coluna can_interact_feed criada');
    assert(await int(client, "SELECT count(*)::int n FROM company_users WHERE can_interact_feed = true") === 0, 'memberships existentes NÃO ganham interação (default false — D4)');
    assert((await client.query("SELECT digest FROM company_permission_catalog_meta WHERE catalog_version=2")).rows[0]?.digest === CATALOG_V2_DIGEST, 'catálogo v2 materializado com o digest do código (R16)');
    assert(await int(client, "SELECT count(*)::int n FROM company_permission_catalog WHERE catalog_version=2 AND permission_key='interact_feed' AND invitable=true AND delegable=true AND protected=false") === 1, 'interact_feed no catálogo v2 (convidável/delegável/não-protegido)');
    assert(await int(client, "SELECT count(*)::int n FROM actor_registry WHERE NOT (capabilities_json ? 'can_interact_feed')") === 0, 'capability de tipo can_interact_feed backfillada em todo registry');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pós)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_transactions') === 0, 'bank_transactions=0 (pós)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_splits') === 0, 'bank_splits=0 (pós)');

    await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING', [MIG_NAME, sha]);
    assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]) === 1, 'registro único em schema_migrations');

    if (APPLY && CONFIRMED && !failed) {
      await client.query('COMMIT');
      log(`[apply-interact-feed] APPLY COMMIT — ${MIG_NAME} aplicada e registrada atomicamente.`);
    } else {
      await client.query('ROLLBACK');
      log(`[apply-interact-feed] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK (nada persistido).`);
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
