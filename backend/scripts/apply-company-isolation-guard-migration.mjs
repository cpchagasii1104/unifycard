#!/usr/bin/env node
// DECISION-0189B ETAPA E · APLICAÇÃO SELETIVA GOVERNADA da guarda de isolamento.
// MESMO RITO dos apply-* (runner canônico bloqueado no dev pelo drift parte-(b) — INTOCADO).

import pg from 'pg';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const MIG_NAME = '20260719220000_company_exclusivity_isolation_guard.sql';
const EXPECTED_SHA256 = '3bb53527fd45660747c23981491646ec1a305665bc15af4a4dac83208e793174';
const CONFIRM_TOKEN = 'APPLY_COMPANY_ISOLATION_GUARD_20260719220000';
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
  if (sha !== EXPECTED_SHA256 && shaRawEol !== EXPECTED_SHA256) throw new Error(`file_hash_mismatch: esperado ${EXPECTED_SHA256}; calculado ${sha}`);
  const body = raw.replace(/\r/g, '').split('\n')
    .map((l) => (l.trim() === 'BEGIN;' || l.trim() === 'COMMIT;') ? '-- [tx control stripped for selective apply]' : l).join('\n');
  if (/^\s*(BEGIN|COMMIT);\s*$/m.test(body)) throw new Error('strip_failed');
  return { body, sha };
}

let failed = false;
const log = (m) => console.log(m);
const assert = (cond, label) => { if (cond) log('  OK  ' + label); else { failed = true; log('  XX  ' + label); } };
const int = async (c, q, p = []) => (await c.query(q, p)).rows[0].n;

async function main() {
  const { body, sha } = migrationBody();
  log(`[apply-isolation-guard] arquivo=${MIG_NAME} sha256=${sha}`);
  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  try {
    const cu = (await client.query('SELECT current_user AS u, current_database() AS d')).rows[0];
    if (cu.u === 'unificard_app') throw new Error('recuso executar como unificard_app');
    log(`[apply-isolation-guard] modo=${APPLY ? (CONFIRMED ? 'APPLY' : 'APPLY-SEM-CONFIRMAÇÃO→recusado') : 'DRY-RUN'} · db=${cu.d} · user=${cu.u}`);
    if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token literal: ${CONFIRM_TOKEN}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`APPLY-MIG:${MIG_NAME}`]);

    if (await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]) !== 0) throw new Error('already_applied');
    assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', ['20260719200000_company_interact_feed_authority.sql']) === 1, 'interact_feed registrada (pré-requisito)');
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0, 'as 7 pendentes preservadas AUSENTES (pré)');
    assert(await int(client, "SELECT count(*)::int n FROM pg_proc WHERE proname='fn_company_relation_advisory_lock'") === 1, 'função de lock presente (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pré)');
    if (failed) throw new Error('preflight_failed');

    await client.query(body);

    assert((await client.query("SELECT prosrc FROM pg_proc WHERE proname='fn_company_membership_delegation_exclusivity'")).rows[0].prosrc.includes('EXCLUSIVITY_UNSAFE_ISOLATION'), 'guarda de isolamento no lado delegações');
    assert((await client.query("SELECT prosrc FROM pg_proc WHERE proname='fn_company_users_delegation_exclusivity'")).rows[0].prosrc.includes('EXCLUSIVITY_UNSAFE_ISOLATION'), 'guarda de isolamento no lado company_users');
    assert(await int(client, "SELECT count(*)::int n FROM pg_trigger WHERE tgname IN ('trg_actor_delegations_company_exclusivity','trg_company_users_delegation_exclusivity')") === 2, 'triggers preservados (2/2)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pós)');

    await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING', [MIG_NAME, sha]);
    assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]) === 1, 'registro único em schema_migrations');

    if (APPLY && CONFIRMED && !failed) { await client.query('COMMIT'); log(`[apply-isolation-guard] APPLY COMMIT — ${MIG_NAME} aplicada e registrada.`); }
    else { await client.query('ROLLBACK'); log(`[apply-isolation-guard] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK.`); }
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    failed = true; log('  XX  ERRO: ' + String(e.message).split('\n')[0]);
  } finally { await client.end(); }
  process.exit(failed ? 1 : 0);
}
main();
