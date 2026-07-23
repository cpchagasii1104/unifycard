#!/usr/bin/env node
// ARCO FUNDAÇÃO EVENTOS · F2 (D9.2-B) — APLICAÇÃO SELETIVA GOVERNADA das 3 migrations de membership
// actor-first no dev, em UMA transação atômica (ordem: D9.1 → D9.2-A → cutover).
// MESMO RITO de apply-company-lifecycle-cutover-migration.mjs (exceção estreita — o runner canônico
// segue bloqueado no dev pelo drift parte-(b) pré-existente, INTOCADO por este ato).
// Autorização: GO de Clayton 2026-07-23 ("Autorizo tudo de uma vez") — blockers B1/B2 do
// GATE_READONLY_D9_2_B_VEREDITO_2026-07-18 satisfeitos; executado pela DIREÇÃO em 1ª pessoa.
//   dry-run (default) → ROLLBACK; --apply "APPLY_GROUP_MEMBERSHIP_CUTOVER_20260723160000" → COMMIT.
//   --db <url> para prova em CLONE efêmero.

import pg from 'pg';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const MIGS = [
  { name: '20260717120000_group_institutional_bindings.sql', sha: '7c59a45d9dd86dca7e4c4fa80ace0a863890f1198cfe87ea8500816efd1346b5' },
  { name: '20260718120000_group_actor_memberships.sql', sha: '1ee543e683fc7e1a027a748a822f243402c39d728b1c0c73f163e7b03cdb1156' },
  { name: '20260723160000_group_membership_actor_first_cutover.sql', sha: '64928ef49ec26730a5c250eb6162da931b1cccaab8134efdc20e1f7f444af1b2' },
];
const CONFIRM_TOKEN = 'APPLY_GROUP_MEMBERSHIP_CUTOVER_20260723160000';
// Recalculada: as 7 preservadas históricas MENOS as duas que ESTE ato aplica (D9.1 + D9.2-A).
const MUST_STAY_UNREGISTERED = [
  '20260713100000_actor_territorial_assignment_foundation.sql',
  '20260713120000_cities_official_code_scoped_unicity.sql',
  '20260713140000_neighborhood_alias_first_governed_flow.sql',
  '20260716120000_fiscal_tax_reserve_bank_substrate.sql',
  '20260716140000_regional_treasury_authority_grant_substrate.sql',
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

function migrationBody(mig) {
  const raw = readFileSync(join(here, '..', 'migrations', mig.name), 'utf8');
  const shaLf = createHash('sha256').update(raw.replace(/\r/g, ''), 'utf8').digest('hex');
  const shaRaw = createHash('sha256').update(raw, 'utf8').digest('hex');
  if (shaLf !== mig.sha && shaRaw !== mig.sha) {
    throw new Error(`file_hash_mismatch em ${mig.name}: esperado ${mig.sha}; calculado ${shaLf}`);
  }
  const body = raw.replace(/\r/g, '').split('\n')
    .map((l) => (l.trim() === 'BEGIN;' || l.trim() === 'COMMIT;') ? '-- [tx control stripped for selective apply]' : l)
    .join('\n');
  if (/^\s*(BEGIN|COMMIT);\s*$/m.test(body)) throw new Error(`strip_failed em ${mig.name}`);
  return { body, sha: shaLf };
}

let failed = false;
const log = (m) => console.log(m);
const assert = (cond, label) => { if (cond) log('  OK  ' + label); else { failed = true; log('  XX  ' + label); } };
const int = async (c, q, p = []) => (await c.query(q, p)).rows[0].n;

async function main() {
  const bodies = MIGS.map((m) => ({ ...m, ...migrationBody(m) }));
  for (const b of bodies) log(`[apply-gmc] arquivo=${b.name} sha256=${b.sha}`);
  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  try {
    const cu = (await client.query('SELECT current_user AS u, current_database() AS d')).rows[0];
    if (cu.u === 'unificard_app') throw new Error('recuso executar como unificard_app');
    log(`[apply-gmc] modo=${APPLY ? (CONFIRMED ? 'APPLY' : 'APPLY-SEM-CONFIRMAÇÃO→recusado') : 'DRY-RUN'} · db=${cu.d} · user=${cu.u}`);
    if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token literal: ${CONFIRM_TOKEN}`);

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['APPLY-MIG:group-membership-cutover-F2']);

    // ── PREFLIGHT ────────────────────────────────────────────────────────────
    for (const b of bodies) {
      const n = await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [b.name]);
      assert(n === 0, `${b.name} ainda NÃO registrada (pré)`);
    }
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0,
      'as 5 pendentes preservadas AUSENTES (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pré)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_transactions') === 0, 'bank_transactions=0 (pré)');
    const legacyRows = await int(client, 'SELECT count(*)::int n FROM group_members');
    const groupCount = await int(client, 'SELECT count(*)::int n FROM groups');
    log(`  ..  estado pré-cutover: groups=${groupCount} · group_members(legado)=${legacyRows}`);
    if (failed) throw new Error('preflight_failed');

    // ── APLICAÇÃO em ordem (D9.1 → D9.2-A → cutover), mesma transação ───────
    for (const b of bodies) {
      log(`[apply-gmc] executando ${b.name} ...`);
      await client.query(b.body);
      log(`[apply-gmc] ${b.name} executada.`);
    }

    // ── PÓS-VERIFICAÇÃO ─────────────────────────────────────────────────────
    assert(await int(client, "SELECT count(*)::int n FROM pg_tables WHERE tablename='group_actor_memberships'") === 1, 'casa nova EXISTE');
    assert(await int(client, `SELECT count(*)::int n FROM pg_proc WHERE proname IN (
        'fn_enter_group_actor_membership','fn_leave_group_actor_membership','fn_remove_group_actor_membership',
        'fn_create_group_membership_intent','fn_accept_group_membership_intent')`) === 5, '5 fns governadas EXISTEM');
    assert((await client.query(`SELECT count(*)::int n FROM information_schema.role_table_grants
        WHERE table_name='group_members' AND grantee='unificard_app' AND privilege_type IN ('INSERT','UPDATE','DELETE')`)).rows[0].n === 0,
      'group_members CONGELADA para unificard_app (0 DML)');
    assert(await int(client, "SELECT count(*)::int n FROM pg_constraint WHERE conname='uq_group_invite'") === 0, 'uq_group_invite legado REMOVIDO');
    // Igualdade: todo grupo tem o dono ATIVO na casa nova (backfill/gênese D8).
    assert(await int(client, `SELECT count(*)::int n FROM groups g
        WHERE g.status='active' AND NOT EXISTS (
          SELECT 1 FROM group_actor_memberships gam
           WHERE gam.tenant_id=g.tenant_id AND gam.group_id=g.id
             AND gam.member_actor_id=g.owner_actor_id AND gam.status='active')`) === 0,
      'D8: todo grupo ativo tem dono ATIVO na casa nova (igualdade pós-backfill)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_ledger') === 0, 'bank_ledger=0 (pós)');
    assert(await int(client, 'SELECT count(*)::int n FROM bank_transactions') === 0, 'bank_transactions=0 (pós)');

    // ── REGISTRO atômico ─────────────────────────────────────────────────────
    for (const b of bodies) {
      await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING', [b.name, b.sha]);
      assert(await int(client, 'SELECT count(*)::int n FROM schema_migrations WHERE filename=$1', [b.name]) === 1, `${b.name} registrada`);
    }
    assert((await client.query('SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)', [MUST_STAY_UNREGISTERED])).rows[0].n === 0,
      'as 5 preservadas continuam NÃO registradas');

    if (APPLY && CONFIRMED && !failed) {
      await client.query('COMMIT');
      log('[apply-gmc] APPLY COMMIT — D9.1 + D9.2-A + cutover aplicadas e registradas ATOMICAMENTE.');
    } else {
      await client.query('ROLLBACK');
      log(`[apply-gmc] ${APPLY ? 'APPLY abortado' : 'DRY-RUN'} → ROLLBACK (nada persistido).`);
    }
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    failed = true;
    log('  XX  ERRO: ' + String(e.message).split('\n')[0]);
  } finally {
    await client.end();
  }
  process.exit(failed ? 1 : 0);
}
main();
