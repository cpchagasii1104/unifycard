#!/usr/bin/env node
// DECISION-0189 F4 · APLICAÇÃO SELETIVA GOVERNADA da migration lifecycle-cutover.
// MESMO RITO de apply-company-access-foundation-migration.mjs (exceção estreita — runner
// canônico segue bloqueado no dev pelo drift parte-(b) pré-existente, INTOCADO).
//   dry-run (default) → ROLLBACK; --apply "APPLY_COMPANY_LIFECYCLE_CUTOVER_20260719140000" → COMMIT.
//   --db <url> para provas em CLONE efêmero.

import pg from 'pg';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const MIG_NAME = '20260719140000_company_membership_lifecycle_cutover.sql';
const EXPECTED_SHA256 = 'd1c2da5c7554941f6757f2be35449626e8a869c80462f0093e04b553b0178cf1';
const CONFIRM_TOKEN = 'APPLY_COMPANY_LIFECYCLE_CUTOVER_20260719140000';
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
  log(`[apply-lifecycle-cutover] arquivo=${MIG_NAME} sha256=${sha}`);
  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  try {
    const cu = (await client.query('SELECT current_user AS u, current_database() AS d')).rows[0];
    if (cu.u === 'unificard_app') throw new Error('recuso executar como unificard_app');
    log(`[apply-lifecycle-cutover] modo=${APPLY ? (CONFIRMED ? 'APPLY' : 'APPLY-SEM-CONFIRMAÇÃO→recusado') : 'DRY-RUN'} · db=${cu.d} · user=${cu.u}`);
    if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token literal: ${CONFIRM_TOKEN}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`APPLY-MIG:${MIG_NAME}`]);

    const already = await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]);
    if (already !== 0) throw new Error('already_applied');
    assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1',
      ['20260719120000_company_access_authority_foundation.sql']) === 1, 'F2 registrada (pré-requisito)');
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0,
      'as 7 pendentes preservadas AUSENTES (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_transactions') === 0, 'bank_transactions=0 (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_splits') === 0, 'bank_splits=0 (pré)');
    const delegAtivas = (await client.query("SELECT count(*)::int n FROM actor_delegations WHERE status='active'")).rows[0].n;
    log(`  ..  delegações ativas (pré-cutover) = ${delegAtivas}`);
    if (failed) throw new Error('preflight_failed');

    await client.query(body);

    assert(await int(client, "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='company_users' AND column_name='is_active'") === 0, 'is_active DROPADA');
    assert(await int(client, "SELECT count(*)::int n FROM pg_trigger WHERE tgname='trg_actor_delegations_company_exclusivity'") === 1, 'trigger exclusividade (delegations) ATIVO');
    assert(await int(client, "SELECT count(*)::int n FROM pg_trigger WHERE tgname='trg_company_users_delegation_exclusivity'") === 1, 'trigger exclusividade (company_users) ATIVO');
    assert((await client.query("SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname='chk_company_users_member_status_valid'")).rows[0].d.includes("'revoked'") &&
           !(await client.query("SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname='chk_company_users_member_status_valid'")).rows[0].d.includes("'invited'"),
      "CHECK member_status sem 'invited'");
    assert(await int(client, `SELECT count(*)::int n FROM actor_delegations ad
        JOIN actors pa ON pa.tenant_id=ad.tenant_id AND pa.id=ad.institutional_actor_id AND pa.company_id IS NOT NULL
        JOIN actors ua ON ua.tenant_id=ad.tenant_id AND ua.id=ad.user_actor_id
        JOIN users u ON u.user_id=ua.user_id AND u.tenant_id=ua.tenant_id
        JOIN company_users cu2 ON cu2.tenant_id=ad.tenant_id AND cu2.company_id=pa.company_id
             AND cu2.global_user_id=u.global_user_id AND cu2.member_status='active'
       WHERE ad.status='active'`) === 0, 'zero delegação de membership viva pós-cutover');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pós)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_transactions') === 0, 'bank_transactions=0 (pós)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_splits') === 0, 'bank_splits=0 (pós)');

    await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING', [MIG_NAME, sha]);
    assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]) === 1, 'registro único em schema_migrations');
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0,
      'as 7 preservadas continuam NÃO registradas');

    if (APPLY && CONFIRMED && !failed) {
      await client.query('COMMIT');
      log(`[apply-lifecycle-cutover] APPLY COMMIT — ${MIG_NAME} aplicada e registrada atomicamente.`);
    } else {
      await client.query('ROLLBACK');
      log(`[apply-lifecycle-cutover] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK (nada persistido).`);
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
