#!/usr/bin/env node
// FISCAL 4D-1 (+ 4D-1-R) · APLICAÇÃO SELETIVA GOVERNADA das migrations da família fiscal-provision
// (GO material D9.7; remediação Yala Veredito C evolui o mesmo mecanismo — §10 do envelope).
//
// EXCEÇÃO OPERACIONAL ESTREITA (NÃO é runner genérico): o runner canônico (migrate.ts) aplica
// TODAS as pendentes — e há 2 alheias (drift já-vivas) + N1 dormante selada. Usá-lo acordaria a
// N1 e registraria drift. Este script aplica EXCLUSIVAMENTE as migrations desta família (lista
// FIXA abaixo, cada uma com hash fixo), PENDENTE por PENDENTE, atômico com o registro em
// schema_migrations, sem tocar nenhuma outra.
//
//   dry-run (default): BEGIN → advisory lock → preflight → aplica só as PENDENTES desta família →
//                      provas → INSERTs em schema_migrations → provas → ROLLBACK.
//   apply:             node ... --apply APPLY_FISCAL_4D1_MIGRATIONS  → COMMIT único.
//   rerun pós-sucesso: zero pendente → already_applied → zero write → exit 1 (fail-closed).
// Sem caminho arbitrário de migration; nomes e hashes FIXOS; membership só cresce por edição
// deste arquivo (evolução governada), nunca por input externo.

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const pg = require('pg');

const CONFIRM_TOKEN = 'APPLY_FISCAL_4D1_MIGRATIONS';
const MIGS = [
  { name: '20260714220000_tax_rules_rounding_mode.sql', sha256: '6cf941c9a68806edaa3db303023499d764168174d82042fa25d5efbf5fdcca9d' },
  { name: '20260714230000_create_fiscal_provision_logs.sql', sha256: '76db12f904b8d0968101da395e7a0ac75df2e97c28121429e65a264a60e5723c' },
  // FISCAL 4D-1-R (remediação Yala Veredito C): enforcement de banco (constraint + trigger reforçada).
  { name: '20260715100000_tax_rules_active_rounding_mode_enforcement.sql', sha256: '5372836f70a54d8993902fa439b425699d4cca3ca941e61d164cb7b6053fe598' },
];
const MUST_STAY_UNREGISTERED = [
  '20260713100000_actor_territorial_assignment_foundation.sql',
  '20260713120000_cities_official_code_scoped_unicity.sql',
  '20260713140000_neighborhood_alias_first_governed_flow.sql',
];
const ADVISORY_LOCK_KEY = [0x0f15ca17, 0x000004d1];

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRMED = argv.includes(CONFIRM_TOKEN);
if (APPLY && !CONFIRMED) { console.error(`ABORT: --apply exige o token literal ${CONFIRM_TOKEN}`); process.exit(1); }

const here = dirname(fileURLToPath(import.meta.url));
function envDatabaseUrl() {
  const m = readFileSync(join(here, '..', '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!m) throw new Error('DATABASE_URL ausente em backend/.env');
  return m.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
}
const stripTx = (sql) => sql.replace(/^\s*BEGIN;\s*$/gim, '').replace(/^\s*COMMIT;\s*$/gim, '');

async function main() {
  console.log(`== FISCAL 4D-1 família apply seletivo (${APPLY && CONFIRMED ? 'APPLY' : 'DRY-RUN'}) ==`);
  const withBodies = MIGS.map((m) => {
    const raw = readFileSync(join(here, '..', 'migrations', m.name), 'utf8');
    const sha = createHash('sha256').update(raw).digest('hex');
    if (sha !== m.sha256) { console.error(`ABORT: ${m.name} sha256 ${sha} ≠ esperado ${m.sha256}`); process.exit(1); }
    return { ...m, body: stripTx(raw) };
  });

  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  let failed = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', ADVISORY_LOCK_KEY);
    const n = async (sql, p = []) => Number((await client.query(sql, p)).rows[0].n);
    const rows = async (sql, p = []) => (await client.query(sql, p)).rows;

    // preflight: descobre PENDENTES desta família; rerun (0 pendentes) é fail-closed
    const alreadyRows = await rows(`SELECT filename FROM schema_migrations WHERE filename = ANY($1)`, [MIGS.map((m) => m.name)]);
    const alreadySet = new Set(alreadyRows.map((r) => r.filename));
    const pending = withBodies.filter((m) => !alreadySet.has(m.name));
    if (pending.length === 0) {
      throw new Error(`already_applied: as ${MIGS.length} migration(s) desta família já estão registradas — rerun é fail-closed, zero write.`);
    }
    console.log(`  pendentes: ${pending.map((m) => m.name).join(', ')}`);
    console.log(`  já aplicadas (preservadas, não re-tocadas): ${[...alreadySet].join(', ') || '(nenhuma)'}`);

    for (const f of MUST_STAY_UNREGISTERED) {
      if ((await n(`SELECT count(*)::int n FROM schema_migrations WHERE filename = $1`, [f])) !== 0) {
        throw new Error(`preflight: migration alheia ${f} REGISTRADA — estado divergente do selado; abortar.`);
      }
    }
    // objetos da(s) pendente(s) não podem já existir sem registro (estado inconsistente)
    if (pending.some((m) => m.name.startsWith('20260714220000') || m.name.startsWith('20260715100000'))) {
      if (!alreadySet.has('20260714220000_tax_rules_rounding_mode.sql')) {
        if ((await n(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='tax_rules' AND column_name='rounding_mode'`)) !== 0) {
          throw new Error('preflight: tax_rules.rounding_mode já existe sem registro — estado inconsistente.');
        }
      }
    }
    if (pending.some((m) => m.name.startsWith('20260714230000')) && !alreadySet.has('20260714230000_create_fiscal_provision_logs.sql')) {
      if ((await n(`SELECT count(*)::int n FROM information_schema.tables WHERE table_name='fiscal_provision_logs'`)) !== 0) {
        throw new Error('preflight: fiscal_provision_logs já existe sem registro — estado inconsistente.');
      }
    }
    if (pending.some((m) => m.name.startsWith('20260715100000'))) {
      if ((await n(`SELECT count(*)::int n FROM pg_constraint WHERE conname='chk_tax_rules_active_requires_rounding'`)) !== 0) {
        throw new Error('preflight: chk_tax_rules_active_requires_rounding já existe sem registro — estado inconsistente.');
      }
    }
    console.log('  preflight OK (rerun fail-closed; N1/drift preservadas; objetos pendentes inexistentes)');

    for (const m of pending) {
      await client.query(m.body);
      await client.query(`INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [m.name, m.sha256]);
      console.log(`  aplicada + registrada: ${m.name}`);
    }

    // postchecks (cobrem a família inteira, presente após esta rodada)
    const ok = (label, cond) => { console.log(`  ${cond ? 'OK  ' : 'FAIL'} ${label}`); if (!cond) throw new Error('postcheck FAIL: ' + label); };
    ok('rounding_mode presente', (await n(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='tax_rules' AND column_name='rounding_mode'`)) === 1);
    ok('CHECK chk_tax_rules_rounding_mode presente', (await n(`SELECT count(*)::int n FROM pg_constraint WHERE conname='chk_tax_rules_rounding_mode'`)) === 1);
    ok('fiscal_provision_logs presente + RLS FORCE', (await n(`SELECT count(*)::int n FROM pg_class WHERE relname='fiscal_provision_logs' AND relrowsecurity AND relforcerowsecurity`)) === 1);
    ok('triggers no_update/no_delete presentes', (await n(`SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='fiscal_provision_logs'::regclass AND NOT tgisinternal`)) === 2);
    ok('fiscal_provision_logs=0 (baseline zero, sem backfill)', (await n(`SELECT count(*)::int n FROM fiscal_provision_logs`)) === 0);
    ok('tax_rules=0 (sem backfill/criação)', (await n(`SELECT count(*)::int n FROM tax_rules`)) === 0);
    ok('chk_tax_rules_active_requires_rounding presente e VALIDADA', (await n(`SELECT count(*)::int n FROM pg_constraint WHERE conname='chk_tax_rules_active_requires_rounding' AND NOT convalidated`)) === 0 &&
      (await n(`SELECT count(*)::int n FROM pg_constraint WHERE conname='chk_tax_rules_active_requires_rounding'`)) === 1);
    ok('trigger de imutabilidade protege rounding_mode (pg_get_functiondef)', (await rows(`SELECT pg_get_functiondef('enforce_tax_rules_immutability'::regproc) AS d`))[0].d.includes('rounding_mode'));
    ok(`schema_migrations Δ família = ${MIGS.length} exatas`, (await n(`SELECT count(*)::int n FROM schema_migrations WHERE filename = ANY($1)`, [MIGS.map((m) => m.name)])) === MIGS.length);
    ok('N1 permanece dormente', (await n(`SELECT count(*)::int n FROM schema_migrations WHERE filename LIKE '20260713140000%'`)) === 0);
    ok('bank intocado (tx/ledger/splits=0)', (await n(`SELECT count(*)::int n FROM bank_transactions`)) === 0 && (await n(`SELECT count(*)::int n FROM bank_ledger`)) === 0 && (await n(`SELECT count(*)::int n FROM bank_splits`)) === 0);

    if (APPLY && CONFIRMED) { await client.query('COMMIT'); console.log(`== COMMIT — ${pending.length} migration(s) aplicada(s) e registrada(s) ==`); }
    else { await client.query('ROLLBACK'); console.log('== DRY-RUN OK — ROLLBACK executado, zero resíduo =='); }
  } catch (e) {
    failed = true;
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    console.error('ABORT (ROLLBACK):', e.message);
  } finally {
    await client.end();
  }
  process.exit(failed ? 1 : 0);
}
main();
