#!/usr/bin/env node
// S-CITY-1 · APLICAÇÃO SELETIVA GOVERNADA da migration posts.audience_city_id (DECISION-0176; Opção A aprovada).
//
// EXCEÇÃO OPERACIONAL ESTREITA (NÃO um runner seletivo genérico): o runner canônico (migrate.ts) aplica TODAS
// as pendentes — e há 4 pendentes (2 em drift já-vivo + N1 dormante + esta). Usá-lo violaria a dormência selada
// da N1 e abortaria no drift. Este script aplica EXCLUSIVAMENTE 20260714120000, ATÔMICO com o registro em
// schema_migrations, sem tocar/registrar/simular nenhuma outra migration.
//
//   dry-run (default): BEGIN → advisory lock → preflight → DDL → provas → INSERT schema_migrations → provas → ROLLBACK.
//   --apply "APPLY_POSTS_AUDIENCE_CITY_SNAPSHOT_20260714120000": só então COMMIT (DDL + registro na MESMA tx).
//   rerun após sucesso: already_applied → zero write → exit 1.

import pg from 'pg';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const MIG_NAME = '20260714120000_posts_audience_city_snapshot.sql';
const EXPECTED_SHA256 = 'aab111eb465177925494bcedd8d9da3cbdf788437f9bf37eff3aef6c1542ae6d';
const CONFIRM_TOKEN = 'APPLY_POSTS_AUDIENCE_CITY_SNAPSHOT_20260714120000';
// migrations que DEVEM permanecer ausentes de schema_migrations (2 drift + N1 dormante) — nunca tocadas aqui.
const MUST_STAY_UNREGISTERED = [
  '20260713100000_actor_territorial_assignment_foundation.sql',
  '20260713120000_cities_official_code_scoped_unicity.sql',
  '20260713140000_neighborhood_alias_first_governed_flow.sql',
];

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRMED = argv.includes(CONFIRM_TOKEN);

const here = dirname(fileURLToPath(import.meta.url));
function envDatabaseUrl() {
  const m = readFileSync(join(here, '..', '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!m) throw new Error('DATABASE_URL ausente em backend/.env');
  return m.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
}

// corpo do DDL = arquivo exato SEM o BEGIN/COMMIT dele (aplicado dentro da tx deste rito, junto do registro).
function migrationBody() {
  const raw = readFileSync(join(here, '..', 'migrations', MIG_NAME), 'utf8');
  const sha = createHash('sha256').update(raw.replace(/\r/g, ''), 'utf8').digest('hex');
  const shaRawEol = createHash('sha256').update(raw, 'utf8').digest('hex');
  if (sha !== EXPECTED_SHA256 && shaRawEol !== EXPECTED_SHA256) {
    throw new Error(`file_hash_mismatch: arquivo diverge do hash esperado (${EXPECTED_SHA256}); calculado ${shaRawEol}`);
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
  log(`[apply-audience-city] arquivo=${MIG_NAME} sha256=${sha}`);
  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  try {
    const cu = (await client.query('SELECT current_user AS u')).rows[0].u;
    if (cu === 'unificard_app') throw new Error('recuso executar como unificard_app — use o papel operacional/owner');
    log(`[apply-audience-city] modo=${APPLY ? (CONFIRMED ? 'APPLY' : 'APPLY-SEM-CONFIRMAÇÃO→recusado') : 'DRY-RUN'} · current_user=${cu}`);
    if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token literal: ${CONFIRM_TOKEN}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`APPLY-MIG:${MIG_NAME}`]);

    // ── PREFLIGHT (fail-closed) ──
    // rerun: esta migration já registrada → already_applied, zero write.
    const already = await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]);
    if (already !== 0) throw new Error('already_applied: migration já registrada em schema_migrations — rerun fail-closed');
    // outras 3 pendentes NÃO podem estar registradas (não as tocamos); N1 dormante preservada.
    const others = (await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n;
    assert(others === 0, 'as 3 migrations preservadas continuam AUSENTES de schema_migrations (2 drift + N1 dormante)');
    // coluna/fk/índice futuros ausentes
    assert(await int(client, "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='posts' AND column_name='audience_city_id'") === 0, 'posts.audience_city_id ausente (pré)');
    assert(await int(client, "SELECT count(*)::int n FROM pg_constraint WHERE conname='fk_posts_audience_city'") === 0, 'FK futura ausente (pré)');
    assert(await int(client, "SELECT count(*)::int n FROM pg_indexes WHERE indexname='idx_posts_audience_city'") === 0, 'índice futuro ausente (pré)');
    // cities.city_id é a PK correta
    assert(await int(client, "SELECT count(*)::int n FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid='cities'::regclass AND i.indisprimary AND a.attname='city_id'") === 1, 'cities.city_id é a PK referenciada');
    // baseline territorial/social/bank
    assert(await int(client, 'SELECT count(*)::int n FROM posts') === 10, 'posts=10');
    assert(await int(client, "SELECT count(*)::int n FROM information_schema.tables WHERE table_name LIKE 'neighborhood_alias_%' AND table_name<>'neighborhood_aliases'") === 0, 'casas N1 ausentes');
    assert(await int(client, 'SELECT count(*)::int n FROM neighborhood_aliases') === 0, 'aliases=0');
    assert((await client.query("SELECT tgenabled FROM pg_trigger WHERE tgname='trg_neighborhood_aliases_writer_hold'")).rows[0].tgenabled === 'A', 'HOLD de aliases ENABLE ALWAYS');
    assert(await int(client, "SELECT count(*)::int n FROM neighborhoods") === 75, 'neighborhoods=75');
    assert(await int(client, 'SELECT count(*)::int n FROM addresses') === 3, 'addresses=3');
    assert(await int(client, 'SELECT count(*)::int n FROM address_assignments') === 3, 'assignments=3');
    assert(await int(client, "SELECT count(*)::int n FROM address_assignments WHERE owner_type='actor'") === 0, 'actor-scoped=0');
    assert(await int(client, 'SELECT count(*)::int n FROM regional_fund_accounts') === 0, 'regional_fund_accounts=0');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_accounts') === 15, 'bank_accounts=15');
    const bankSum0 = (await client.query('SELECT coalesce(sum(reconciliation_balance_cents),0)::bigint s FROM bank_accounts')).rows[0].s;
    assert(String(bankSum0) === '0', 'Δbank=0 (baseline)');
    if (failed) throw new Error('preflight_failed');

    // ── DDL EXATO (corpo do arquivo, sem BEGIN/COMMIT) ──
    await client.query(body);

    // ── PROVAS PÓS-DDL ──
    assert(await int(client, "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='posts' AND column_name='audience_city_id' AND data_type='uuid' AND is_nullable='YES' AND column_default IS NULL") === 1, 'audience_city_id uuid NULL sem default');
    assert(await int(client, "SELECT count(*)::int n FROM pg_constraint WHERE conname='fk_posts_audience_city' AND contype='f'") === 1, 'FK fk_posts_audience_city → cities');
    assert(await int(client, "SELECT count(*)::int n FROM pg_indexes WHERE indexname='idx_posts_audience_city'") === 1, 'índice idx_posts_audience_city');
    assert(await int(client, 'SELECT count(*)::int n FROM posts WHERE audience_city_id IS NOT NULL') === 0, 'zero backfill (todos NULL)');
    assert(await int(client, "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='posts' AND column_name='audience_neighborhood_id'") === 0, 'audience_neighborhood_id ausente (bairro bloqueado)');

    // ── REGISTRO ATÔMICO em schema_migrations (mesma tx) ──
    await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING', [MIG_NAME, sha]);

    // ── PROVAS FINAIS ──
    assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [MIG_NAME]) === 1, 'exatamente 1 registro da migration Social em schema_migrations');
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0, 'as 3 preservadas continuam NÃO registradas (drift + N1 intocados)');
    assert(await int(client, "SELECT count(*)::int n FROM information_schema.tables WHERE table_name LIKE 'neighborhood_alias_%' AND table_name<>'neighborhood_aliases'") === 0, 'casas N1 continuam ausentes');
    assert(await int(client, 'SELECT count(*)::int n FROM posts') === 10, 'posts continua 10');
    assert(await int(client, 'SELECT count(*)::int n FROM regional_fund_accounts') === 0 && await int(client, 'SELECT count(*)::int n FROM bank_accounts') === 15, 'rfa=0, bank=15');
    const bankSum1 = (await client.query('SELECT coalesce(sum(reconciliation_balance_cents),0)::bigint s FROM bank_accounts')).rows[0].s;
    assert(String(bankSum1) === '0', 'Δbank=0 (pós)');

    if (APPLY && CONFIRMED && !failed) {
      await client.query('COMMIT');
      log(`[apply-audience-city] APPLY COMMIT — ${MIG_NAME} aplicada e registrada atomicamente.`);
    } else {
      await client.query('ROLLBACK');
      log(`[apply-audience-city] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK (nada persistido).`);
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
