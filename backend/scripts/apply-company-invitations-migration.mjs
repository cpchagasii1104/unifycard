#!/usr/bin/env node
// DECISION-0189 F5 · APLICAÇÃO SELETIVA GOVERNADA da migration company_access_invitations.
// MESMO RITO dos apply-* da campanha (runner canônico segue bloqueado no dev pelo drift
// parte-(b) pré-existente — INTOCADO). dry-run default; --apply + token literal → COMMIT.

import pg from 'pg';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const MIG_NAME = '20260719160000_company_access_invitations.sql';
const EXPECTED_SHA256 = 'c6a4e03e3561a6f5993ece6210a183e5e5102508549209259b2dcc48906e3ed9';
const CONFIRM_TOKEN = 'APPLY_COMPANY_INVITATIONS_20260719160000';
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
    throw new Error(`file_hash_mismatch: esperado ${EXPECTED_SHA256}; calculado ${shaRawEol}`);
  }
  const body = raw.replace(/\r/g, '').split('\n')
    .map((l) => (l.trim() === 'BEGIN;' || l.trim() === 'COMMIT;') ? '-- [tx control stripped for selective apply]' : l)
    .join('\n');
  if (/^\s*(BEGIN|COMMIT);\s*$/m.test(body)) throw new Error('strip_failed');
  return { body, sha: shaRawEol };
}

let failed = false;
const log = (m) => console.log(m);
const assert = (cond, label) => { if (cond) log('  OK  ' + label); else { failed = true; log('  XX  ' + label); } };
const int = async (c, q, p = []) => (await c.query(q, p)).rows[0].n;

async function main() {
  const { body, sha } = migrationBody();
  log(`[apply-invitations] arquivo=${MIG_NAME} sha256=${sha}`);
  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  try {
    const cu = (await client.query('SELECT current_user AS u, current_database() AS d')).rows[0];
    if (cu.u === 'unificard_app') throw new Error('recuso executar como unificard_app');
    log(`[apply-invitations] modo=${APPLY ? (CONFIRMED ? 'APPLY' : 'APPLY-SEM-CONFIRMAÇÃO→recusado') : 'DRY-RUN'} · db=${cu.d} · user=${cu.u}`);
    if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token literal: ${CONFIRM_TOKEN}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`APPLY-MIG:${MIG_NAME}`]);

    if (await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]) !== 0) {
      throw new Error('already_applied');
    }
    assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1',
      ['20260719140000_company_membership_lifecycle_cutover.sql']) === 1, 'F4 registrada (pré-requisito)');
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0,
      'as 7 pendentes preservadas AUSENTES (pré)');
    assert(await int(client, "SELECT count(*)::int n FROM information_schema.tables WHERE table_name IN ('company_access_invitations','company_access_invitation_permissions')") === 0,
      'tabelas de convite ausentes (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_transactions') === 0, 'bank_transactions=0 (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_splits') === 0, 'bank_splits=0 (pré)');
    if (failed) throw new Error('preflight_failed');

    await client.query(body);

    assert(await int(client, "SELECT count(*)::int n FROM information_schema.tables WHERE table_name IN ('company_access_invitations','company_access_invitation_permissions')") === 2, 'tabelas criadas');
    assert(await int(client, "SELECT count(*)::int n FROM pg_indexes WHERE indexname IN ('uq_cai_token_hash','uq_cai_idempotency','uq_cai_pending_per_target')") === 3, 'índices únicos (token/idempotência/pendente) presentes');
    assert(await int(client, "SELECT count(*)::int n FROM pg_trigger WHERE tgname='trg_caip_immutable'") === 1, 'permissões de convite IMUTÁVEIS (trigger)');
    assert(await int(client, "SELECT count(*)::int n FROM pg_policies WHERE tablename='company_access_invitations'") >= 1, 'RLS ativa');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pós)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_transactions') === 0, 'bank_transactions=0 (pós)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_splits') === 0, 'bank_splits=0 (pós)');

    await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING', [MIG_NAME, sha]);
    assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]) === 1, 'registro único em schema_migrations');
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0,
      'as 7 preservadas continuam NÃO registradas');

    if (APPLY && CONFIRMED && !failed) {
      await client.query('COMMIT');
      log(`[apply-invitations] APPLY COMMIT — ${MIG_NAME} aplicada e registrada atomicamente.`);
    } else {
      await client.query('ROLLBACK');
      log(`[apply-invitations] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK (nada persistido).`);
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
