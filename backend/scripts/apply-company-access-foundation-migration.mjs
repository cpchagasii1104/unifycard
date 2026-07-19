#!/usr/bin/env node
// DECISION-0189 F2 · APLICAÇÃO SELETIVA GOVERNADA da migration company-access-foundation.
//
// EXCEÇÃO OPERACIONAL ESTREITA (mesmo rito selado de apply-posts-audience-city-migration.mjs —
// NÃO é runner seletivo genérico): o runner canônico (migrate.ts) aplicaria TODAS as pendentes e
// há 7 outras pendentes que DEVEM permanecer não-registradas (2 drift parte-(b) da DT-EPHEMERAL,
// N1 dormante selada, fiscal-4E/treasury-substrate/D9.1/D9.2-A dormentes por selo próprio).
// Este script aplica EXCLUSIVAMENTE 20260719120000, ATÔMICO com o registro em schema_migrations.
//
//   dry-run (default): BEGIN → advisory lock → preflight → DDL → provas → registro → provas → ROLLBACK.
//   --apply "APPLY_COMPANY_ACCESS_FOUNDATION_20260719120000": só então COMMIT.
//   Alvo alternativo: --db <database_url> (provas em CLONE efêmero; default = backend/.env).

import pg from 'pg';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const MIG_NAME = '20260719120000_company_access_authority_foundation.sql';
const EXPECTED_SHA256 = '98dddfbabb7c72f8596cb0f7abc1c78c5a4251b1cea6cf9a62e722daa1754248';
const CONFIRM_TOKEN = 'APPLY_COMPANY_ACCESS_FOUNDATION_20260719120000';
const CATALOG_DIGEST = '936417436c6f65e2ed7f9aeb6e8dc5da6ff9b3ac8530b26df2d11dfa6450e589';
// pendentes que DEVEM permanecer ausentes de schema_migrations — NUNCA tocadas aqui.
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
  if (/^\s*(BEGIN|COMMIT);\s*$/m.test(body)) throw new Error('strip_failed: BEGIN/COMMIT remanescente');
  return { body, sha: shaRawEol };
}

let failed = false;
const log = (m) => console.log(m);
const assert = (cond, label) => { if (cond) log('  OK  ' + label); else { failed = true; log('  XX  ' + label); } };
const int = async (c, q, p = []) => (await c.query(q, p)).rows[0].n;

async function main() {
  const { body, sha } = migrationBody();
  log(`[apply-company-access-foundation] arquivo=${MIG_NAME} sha256=${sha}`);
  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  try {
    const cu = (await client.query('SELECT current_user AS u, current_database() AS d')).rows[0];
    if (cu.u === 'unificard_app') throw new Error('recuso executar como unificard_app — use o papel operacional/owner');
    log(`[apply-company-access-foundation] modo=${APPLY ? (CONFIRMED ? 'APPLY' : 'APPLY-SEM-CONFIRMAÇÃO→recusado') : 'DRY-RUN'} · db=${cu.d} · user=${cu.u}`);
    if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token literal: ${CONFIRM_TOKEN}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`APPLY-MIG:${MIG_NAME}`]);

    // ── PREFLIGHT (fail-closed) ──
    const already = await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]);
    if (already !== 0) throw new Error('already_applied: rerun fail-closed');
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0,
      'as 7 pendentes preservadas AUSENTES de schema_migrations (pré)');
    assert(await int(client, "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='company_users' AND column_name IN ('can_view_financial','can_manage_members','can_publish_feed','can_create_events')") === 0,
      'colunas novas ausentes (pré)');
    assert(await int(client, "SELECT count(*)::int n FROM information_schema.tables WHERE table_name IN ('company_permission_catalog','company_member_relationships','company_member_events')") === 0,
      'tabelas novas ausentes (pré)');
    // Δbank baseline
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_transactions') === 0, 'bank_transactions=0 (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_splits') === 0, 'bank_splits=0 (pré)');
    const cuCount = (await client.query('SELECT count(*)::int n FROM company_users')).rows[0].n;
    const mgrCount = (await client.query('SELECT count(*)::int n FROM company_users WHERE can_manage_company = true')).rows[0].n;
    log(`  ..  company_users=${cuCount} · gestores(can_manage_company)=${mgrCount}`);
    if (failed) throw new Error('preflight_failed');

    // ── DDL EXATO ──
    await client.query(body);

    // ── PROVAS PÓS-DDL ──
    assert(await int(client, 'SELECT count(*)::int n FROM company_permission_catalog WHERE catalog_version=1') === 9, 'catálogo v1 = 9 linhas');
    assert((await client.query('SELECT digest FROM company_permission_catalog_meta WHERE catalog_version=1')).rows[0]?.digest === CATALOG_DIGEST, 'digest do catálogo = código soberano');
    assert(await int(client, "SELECT count(*)::int n FROM company_users WHERE can_manage_company AND NOT (can_view_financial AND can_manage_members AND can_publish_feed AND can_create_events)") === 0,
      'todo gestor (can_manage_company) recebeu SET_V1');
    assert(await int(client, "SELECT count(*)::int n FROM company_users WHERE NOT can_manage_company AND (can_view_financial OR can_manage_members OR can_publish_feed OR can_create_events)") === 0,
      'nenhum não-gestor ganhou grant por inferência');
    assert((await client.query('SELECT count(*)::int n FROM company_member_relationships WHERE valid_to IS NULL')).rows[0].n === cuCount,
      `vínculo vigente por membership (${cuCount})`);
    assert((await client.query("SELECT count(*)::int n FROM company_member_events WHERE event_type='backfill'")).rows[0].n === cuCount + mgrCount,
      'eventos backfill = memberships + gestores');
    assert(await int(client, "SELECT count(*)::int n FROM pg_trigger WHERE tgname='trg_cme_append_only'") === 1, 'trigger append-only vivo');
    assert(await int(client, "SELECT count(*)::int n FROM pg_trigger WHERE tgname LIKE '%exclusivity%'") === 0, 'trigger de exclusividade NÃO ativado (F4)');
    assert(await int(client, "SELECT count(*)::int n FROM pg_proc WHERE proname='fn_company_membership_delegation_exclusivity'") === 1, 'função de exclusividade criada (dormente)');
    // Δbank inalterado
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pós)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_transactions') === 0, 'bank_transactions=0 (pós)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_splits') === 0, 'bank_splits=0 (pós)');

    // ── REGISTRO ATÔMICO ──
    await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING', [MIG_NAME, sha]);
    assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]) === 1, 'registro único em schema_migrations');
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0,
      'as 7 preservadas continuam NÃO registradas');

    if (APPLY && CONFIRMED && !failed) {
      await client.query('COMMIT');
      log(`[apply-company-access-foundation] APPLY COMMIT — ${MIG_NAME} aplicada e registrada atomicamente.`);
    } else {
      await client.query('ROLLBACK');
      log(`[apply-company-access-foundation] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK (nada persistido).`);
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
