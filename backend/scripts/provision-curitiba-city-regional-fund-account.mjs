#!/usr/bin/env node
// B-CITY-1 · BOOTSTRAP GOVERNADO da conta municipal inerte de Curitiba (DECISION-0177 D4/D5/D6).
//
// ATO ÚNICO, ESTREITO, NÃO-REUTILIZÁVEL: cria EXATAMENTE UMA conta bank system inerte
// (owner_type='system', actor_id=NULL, saldo derivado do ledger = 0) e EXATAMENTE UM mapping
// Curitiba→conta em regional_fund_accounts, na MESMA transação. NADA além disso:
// zero ledger, zero transaction, zero split, zero policy, zero saldo, zero capability/delegação.
//
// AUTORIDADE: authority_source='platform_bootstrap' — a autoridade vem da DECISION-0177 SELADA e
// da responsabilidade humana (fundador) resolvida no SSOT Identity/Actor (DECISION-0114 D2).
// Este script é MECANISMO, não autoridade soberana. Não concede poder de movimentar/configurar/
// delegar (DT-REGION-FUND-DELEGATION-MODEL-PENDING permanece OPEN).
//
//   dry-run (default): BEGIN → advisory lock → preflight → INSERTs → postchecks → ROLLBACK.
//   apply:             node ... --apply PROVISION_CURITIBA_CITY_REGIONAL_FUND_ACCOUNT
//   rerun pós-sucesso: preflight detecta conta/mapping existentes → aborta exit 1, zero write
//                      ("already exists" NÃO é sucesso; não repara, não cria segundo mapping).
//
// Sem caminho arbitrário de manifest, sem city/tenant/account por CLI, sem env para cidade.

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const pg = require('pg');

const CONFIRM_TOKEN = 'PROVISION_CURITIBA_CITY_REGIONAL_FUND_ACCOUNT';
const MANIFEST_REL = 'manifests/curitiba-city-regional-fund-bootstrap.manifest.json';
const EXPECTED_MANIFEST_SHA256 = '8dea5d20548575115afac69266e9b1df6524c1d04de2c0b95e1b98bb1e40172b';
// Lock de rito exclusivo (classid 0xB0C17131 arbitrário e fixo desta frente).
const ADVISORY_LOCK_KEY = [0x0b0c1713, 0x00000177];

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRMED = argv.includes(CONFIRM_TOKEN);
if (APPLY && !CONFIRMED) {
  console.error(`ABORT: --apply exige o token literal ${CONFIRM_TOKEN}`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));

function envDatabaseUrl() {
  const m = readFileSync(join(here, '..', '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!m) throw new Error('DATABASE_URL ausente em backend/.env');
  return m.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
}

// Manifest FIXO (caminho e hash embutidos — nenhum input arbitrário).
const manifestRaw = readFileSync(join(here, MANIFEST_REL), 'utf8');
const manifestSha = createHash('sha256').update(manifestRaw).digest('hex');
if (manifestSha !== EXPECTED_MANIFEST_SHA256) {
  console.error(`ABORT: manifest sha256 ${manifestSha} ≠ esperado ${EXPECTED_MANIFEST_SHA256}`);
  process.exit(1);
}
const M = JSON.parse(manifestRaw);

const fails = [];
const must = (label, ok) => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`);
  if (!ok) fails.push(label);
};

async function main() {
  console.log(`== B-CITY-1 bootstrap Curitiba (${APPLY && CONFIRMED ? 'APPLY' : 'DRY-RUN'}) ==`);
  console.log(`manifest v${M.version} sha256=${manifestSha}`);
  const client = new pg.Client({ connectionString: envDatabaseUrl() });
  await client.connect();
  let failed = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', ADVISORY_LOCK_KEY);
    const one = async (sql, p = []) => (await client.query(sql, p)).rows[0];
    const n = async (sql, p = []) => Number((await one(sql, p)).n);

    // ── PREFLIGHT (DECISION-0177 §11 — DIVERGIU, ABORTA SEM WRITE) ──
    console.log('-- preflight --');
    must('tenant canônico existe', (await n('SELECT count(*)::int n FROM tenants WHERE id=$1', [M.tenant_id])) === 1);
    const chain = await one(
      `SELECT c.city_id, c.state_id, s.country_id
         FROM cities c JOIN states s ON s.state_id = c.state_id
        WHERE c.city_id = $1`, [M.city_id]);
    must('Curitiba UUID exato + cadeia Brasil/Paraná coerente por FK',
      !!chain && chain.state_id === M.state_id && chain.country_id === M.country_id);
    must('conta regional Curitiba INEXISTENTE (owner_id do manifest livre)',
      (await n('SELECT count(*)::int n FROM bank_accounts WHERE tenant_id=$1 AND owner_id=$2', [M.tenant_id, M.account.owner_id])) === 0);
    must('mapping Curitiba INEXISTENTE',
      (await n(`SELECT count(*)::int n FROM regional_fund_accounts WHERE tenant_id=$1 AND scope_level='city' AND city_id=$2`, [M.tenant_id, M.city_id])) === 0);
    must(`regional_fund_accounts=${M.expected_baselines.regional_fund_accounts}`,
      (await n('SELECT count(*)::int n FROM regional_fund_accounts')) === M.expected_baselines.regional_fund_accounts);
    must(`bank_accounts=${M.expected_baselines.bank_accounts}`,
      (await n('SELECT count(*)::int n FROM bank_accounts')) === M.expected_baselines.bank_accounts);
    must(`system accounts=${M.expected_baselines.system_accounts}`,
      (await n(`SELECT count(*)::int n FROM bank_accounts WHERE owner_type='system'`)) === M.expected_baselines.system_accounts);
    must('13/13 system com actor_id NULL',
      (await n(`SELECT count(*)::int n FROM bank_accounts WHERE owner_type='system' AND actor_id IS NULL`)) === M.expected_baselines.system_accounts_actor_id_null);
    must('bank_transactions=0', (await n('SELECT count(*)::int n FROM bank_transactions')) === 0);
    must('bank_ledger=0', (await n('SELECT count(*)::int n FROM bank_ledger')) === 0);
    must('bank_splits=0', (await n('SELECT count(*)::int n FROM bank_splits')) === 0);
    must('policy regional ativa=0',
      (await n(`SELECT count(*)::int n FROM economic_policy_lines l JOIN economic_policies p ON p.id=l.policy_id WHERE p.status='active' AND l.line_type='regional_fund'`)) === 0);
    must('N1 20260713140000 NÃO aplicada (dormente)',
      (await n(`SELECT count(*)::int n FROM schema_migrations WHERE filename LIKE '20260713140000%'`)) === 0);
    must('neighborhood mappings=0',
      (await n(`SELECT count(*)::int n FROM regional_fund_accounts WHERE neighborhood_id IS NOT NULL`)) === 0);
    must('responsible human Actor existe e é user',
      (await n(`SELECT count(*)::int n FROM actors WHERE id=$1 AND actor_type='user'`, [M.responsible_human.actor_id])) === 1);
    must('nenhum mapping dangling (conta inexistente)',
      (await n(`SELECT count(*)::int n FROM regional_fund_accounts rfa LEFT JOIN bank_accounts ba ON ba.id=rfa.bank_account_id WHERE ba.id IS NULL`)) === 0);
    // Sink/workers: a dormência default-off é propriedade de ENV do runtime, provada pelos guards
    // (audit-financial-workers-dormancy + sink firewall) — o preflight confirma que este processo
    // não os habilita.
    must('este processo NÃO habilita sink/workers financeiros',
      process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED !== 'true' && process.env.SERVICE_FINANCIAL_RUNTIME_ENABLED !== 'true');

    if (fails.length) throw new Error(`preflight FAIL (${fails.length}): ${fails.join(' | ')}`);

    // ── DML AUTORIZADO (D12): +1 conta e +1 mapping, MESMA transação ──
    console.log('-- DML --');
    const acc = await one(
      `INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type)
       VALUES ($1, 'system', $2, NULL, $3)
       RETURNING id::text`,
      [M.tenant_id, M.account.owner_id, M.account.account_type]
    );
    console.log(`  conta criada: ${acc.id}`);
    await client.query(
      `INSERT INTO regional_fund_accounts (tenant_id, scope_level, country_id, state_id, city_id, neighborhood_id, bank_account_id)
       VALUES ($1, 'city', $2, $3, $4, NULL, $5)`,
      [M.tenant_id, M.country_id, M.state_id, M.city_id, acc.id]
    );
    console.log('  mapping criado: Curitiba → conta');

    // ── POSTCHECKS ──
    console.log('-- postchecks --');
    must('bank_accounts=16', (await n('SELECT count(*)::int n FROM bank_accounts')) === 16);
    must('system=14 e 14/14 actor_id NULL',
      (await n(`SELECT count(*)::int n FROM bank_accounts WHERE owner_type='system'`)) === 14 &&
      (await n(`SELECT count(*)::int n FROM bank_accounts WHERE owner_type='system' AND actor_id IS NULL`)) === 14);
    must('regional_fund_accounts=1 (Curitiba city)',
      (await n(`SELECT count(*)::int n FROM regional_fund_accounts WHERE scope_level='city' AND city_id=$1 AND bank_account_id=$2`, [M.city_id, acc.id])) === 1 &&
      (await n('SELECT count(*)::int n FROM regional_fund_accounts')) === 1);
    must('saldo derivado do ledger = 0 (zero linhas para a conta)',
      (await n('SELECT count(*)::int n FROM bank_ledger WHERE account_id=$1', [acc.id])) === 0);
    must('tx/ledger/splits permanecem 0',
      (await n('SELECT count(*)::int n FROM bank_transactions')) === 0 &&
      (await n('SELECT count(*)::int n FROM bank_ledger')) === 0 &&
      (await n('SELECT count(*)::int n FROM bank_splits')) === 0);

    if (fails.length) throw new Error(`postcheck FAIL (${fails.length}): ${fails.join(' | ')}`);

    if (APPLY && CONFIRMED) {
      await client.query('COMMIT');
      console.log('== COMMIT — conta municipal inerte + mapping Curitiba provisionados ==');
    } else {
      await client.query('ROLLBACK');
      console.log('== DRY-RUN OK — ROLLBACK executado, zero resíduo ==');
    }
  } catch (e) {
    failed = true;
    try { await client.query('ROLLBACK'); } catch {}
    console.error('ABORT (ROLLBACK):', e.message);
  } finally {
    await client.end();
  }
  process.exit(failed ? 1 : 0);
}
main();
