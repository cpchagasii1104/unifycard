/**
 * E2E — F-MIGRATION-RUNNER-TEST-HOOK-ISOLATION-CLOSURE (GO §8, P1–P10).
 *
 * Achado Yala (DT-MIGRATION-RUNNER-TEST-HOOK-PRODUCTION-TRUNCATION): o hook
 * MIGRATION_STOP_BEFORE vivia no runner PRODUTIVO — sob NODE_ENV=production
 * permitia schema PARCIAL com exit 0 e mensagem de sucesso total.
 *
 * Este e2e prova o estado-alvo:
 *   RUNNER PRODUTIVO (core/db/migrate.ts): variável antiga NÃO altera
 *   comportamento (P1); aplica sempre TODAS as pendentes (P2); falha alto e
 *   NUNCA declara sucesso total com pending > 0 (P10).
 *   TOOLING TEST-ONLY (test-support/apply-migrations-before-for-test):
 *   prepara estado histórico com target EXATO (P3); recusa fail-closed target
 *   inexistente (P4), vazio/malformado (P5), NODE_ENV≠test (P6),
 *   unificard_dev (P7), EXPECTED divergente (P8), target já aplicado (P9).
 *
 * 🔒 DBs EFÊMERAS (wrapper run-migration-runner-isolation-ephemeral.ps1).
 * Zero Bank. unificard_dev NUNCA é alvo de conexão deste e2e.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { Pool } from 'pg';

import { getMigrationFiles, shouldExecuteMigration } from '../core/db/migration-runner-core';

dotenv.config({ path: join(process.cwd(), '.env') });

const URL_1 = process.env.RUNNER_ISO_DB1_URL || '';
const NAME_1 = process.env.RUNNER_ISO_DB1_NAME || '';
const URL_2 = process.env.RUNNER_ISO_DB2_URL || '';
const NAME_2 = process.env.RUNNER_ISO_DB2_NAME || '';

const MIG_374 = '20260612100000_media_asset_contextual_identity.sql';
const MIG_376 = '20260612120000_media_context_identity_v2.sql';
const MIGRATIONS_DIR = join(process.cwd(), 'migrations');
const BROKEN_MIG = join(MIGRATIONS_DIR, '29991231235959_e2e_broken_runner_proof.sql');
const PROD_SUCCESS = 'Todas as migrações pendentes foram EXECUTADAS';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

function assertEphemeralNames(): void {
  for (const [name, url] of [[NAME_1, URL_1], [NAME_2, URL_2]] as const) {
    if (!name || !url) throw new Error('ABORT: RUNNER_ISO_DB{1,2}_{URL,NAME} são obrigatórios.');
    if (name === 'unificard_dev' || /unificard_dev/.test(url)) throw new Error('ABORT: alvo é unificard_dev.');
    if (!/(test|e2e|ephemeral|backfill)/i.test(name)) throw new Error(`ABORT: nome "${name}" não parece efêmero.`);
  }
  console.log(`🔒 DBs efêmeras confirmadas: ${NAME_1} · ${NAME_2}`);
}

type RunResult = { status: number; out: string };

function runProd(url: string, dbName: string, extraEnv: Record<string, string> = {}): RunResult {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: url,
    EXPECTED_DATABASE_NAME: dbName,
    MIGRATION_PROFILE: 'FULL',
    ...extraEnv,
  };
  const r = spawnSync('npx', ['tsx', 'src/core/db/migrate.ts'], {
    cwd: process.cwd(), env, shell: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  return { status: r.status ?? 99, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

function runPrep(url: string, expectedName: string, before: string | null, extraEnv: Record<string, string> = {}): RunResult {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: url,
    EXPECTED_DATABASE_NAME: expectedName,
    MIGRATION_PROFILE: 'FULL',
    ...extraEnv,
  };
  const args = ['tsx', 'src/scripts/test-support/apply-migrations-before-for-test.ts'];
  if (before !== null) args.push(`--before=${before}`);
  const r = spawnSync('npx', args, {
    cwd: process.cwd(), env, shell: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  return { status: r.status ?? 99, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

async function main(): Promise<void> {
  assertEphemeralNames();
  const pool1 = new Pool({ connectionString: URL_1, max: 4 });
  const pool2 = new Pool({ connectionString: URL_2, max: 4 });
  const count = async (p: Pool, sql: string, params: unknown[] = []): Promise<number> =>
    Number((await p.query<{ n: string }>(sql, params)).rows[0].n);
  const migCount = (p: Pool): Promise<number> => count(p, `SELECT count(*)::text n FROM schema_migrations`);

  // Denominador do disco (mesma enumeração do runner — fonte única).
  const allFiles = await getMigrationFiles(MIGRATIONS_DIR);
  const fullFiltered = allFiles.filter((m) => shouldExecuteMigration(m.filename, 'FULL'));

  try {
    // ════ DB1 — tooling test-only + runner produtivo imune à variável ════════
    console.log('\n— P3: test helper com target VÁLIDO (before 374) —');
    const p3 = runPrep(URL_1, NAME_1, MIG_374);
    const after374Pending = await count(pool1, `SELECT count(*)::text n FROM schema_migrations WHERE filename = ANY($1)`, [[MIG_374, '20260612110000_availability_owner_type_check.sql', MIG_376]]);
    record('P3 aplica SOMENTE anteriores; target e posteriores PENDENTES; mensagem test-only; exit 0',
      p3.status === 0 && p3.out.includes(`TEST DATABASE PREPARED BEFORE ${MIG_374}`) &&
      p3.out.includes('intencionalmente AINDA pendentes') && !p3.out.includes(PROD_SUCCESS) &&
      after374Pending === 0 && (await migCount(pool1)) > 0,
      `exit=${p3.status}`);

    console.log('\n— P8: EXPECTED_DATABASE_NAME divergente —');
    const before8 = await migCount(pool1);
    const p8 = runPrep(URL_1, `${NAME_1}_wrong`, MIG_376);
    record('P8 recusa fail-closed (DB_NAME_MISMATCH); nada aplicado',
      p8.status !== 0 && p8.out.includes('DB_NAME_MISMATCH') && (await migCount(pool1)) === before8,
      `exit=${p8.status}`);

    console.log('\n— preparação pre-376 para a P1 —');
    const prep376 = runPrep(URL_1, NAME_1, MIG_376);
    record('preparação test-only before 376 → exit 0 (374/375 aplicadas; 376 pendente)',
      prep376.status === 0 &&
      (await count(pool1, `SELECT count(*)::text n FROM schema_migrations WHERE filename=$1`, [MIG_376])) === 0);

    console.log('\n— P1: runner PRODUTIVO sob NODE_ENV=production COM a variável antiga —');
    const p1 = runProd(URL_1, NAME_1, { NODE_ENV: 'production', MIGRATION_STOP_BEFORE: MIG_376 });
    const pending1 = fullFiltered.length - (await count(pool1, `SELECT count(*)::text n FROM schema_migrations WHERE filename = ANY($1)`, [fullFiltered.map((m) => m.filename)]));
    record('P1 variável antiga NÃO altera comportamento: 376 APLICADA; pending final = 0; exit 0 só com schema completo',
      p1.status === 0 && p1.out.includes(PROD_SUCCESS) &&
      (await count(pool1, `SELECT count(*)::text n FROM schema_migrations WHERE filename=$1`, [MIG_376])) === 1 &&
      pending1 === 0,
      `exit=${p1.status} pending=${pending1}`);

    // ════ DB2 — runner produtivo normal + recusas + P10 ══════════════════════
    console.log('\n— P2: runner PRODUTIVO sem variável (DB vazia → tudo) —');
    const p2 = runProd(URL_2, NAME_2);
    const pending2 = fullFiltered.length - (await count(pool2, `SELECT count(*)::text n FROM schema_migrations WHERE filename = ANY($1)`, [fullFiltered.map((m) => m.filename)]));
    record('P2 aplica todas normalmente; pending final = 0; exit 0',
      p2.status === 0 && p2.out.includes(PROD_SUCCESS) && pending2 === 0, `exit=${p2.status} pending=${pending2}`);

    console.log('\n— P9: target JÁ APLICADO —');
    const before9 = await migCount(pool2);
    const p9 = runPrep(URL_2, NAME_2, MIG_374);
    record('P9 erro observável (TARGET_ALREADY_APPLIED); não finge preparação histórica',
      p9.status !== 0 && p9.out.includes('TARGET_ALREADY_APPLIED') && !p9.out.includes('TEST DATABASE PREPARED') &&
      (await migCount(pool2)) === before9, `exit=${p9.status}`);

    console.log('\n— P4: target INEXISTENTE —');
    const before4 = await migCount(pool2);
    const p4 = runPrep(URL_2, NAME_2, '20990101000000_does_not_exist.sql');
    record('P4 exit ≠ 0 (TARGET_NOT_FOUND); zero mensagem de sucesso; banco inalterado',
      p4.status !== 0 && p4.out.includes('TARGET_NOT_FOUND') && !p4.out.includes('TEST DATABASE PREPARED') &&
      !p4.out.includes(PROD_SUCCESS) && (await migCount(pool2)) === before4, `exit=${p4.status}`);

    console.log('\n— P5: target VAZIO / MALFORMADO / AUSENTE —');
    const p5a = runPrep(URL_2, NAME_2, '');
    const p5b = runPrep(URL_2, NAME_2, 'not-a-migration');
    const p5c = runPrep(URL_2, NAME_2, null);
    record('P5 vazio/malformado/ausente → exit ≠ 0; nada aplicado',
      p5a.status !== 0 && p5a.out.includes('TARGET_MALFORMED') &&
      p5b.status !== 0 && p5b.out.includes('TARGET_MALFORMED') &&
      p5c.status !== 0 && p5c.out.includes('TARGET_REQUIRED') &&
      (await migCount(pool2)) === before4,
      `a=${p5a.status} b=${p5b.status} c=${p5c.status}`);

    console.log('\n— P6: test helper sob NODE_ENV=production —');
    const p6 = runPrep(URL_2, NAME_2, MIG_374, { NODE_ENV: 'production' });
    record('P6 recusado ANTES de aplicar qualquer migration (TEST_ENV_REQUIRED)',
      p6.status !== 0 && p6.out.includes('TEST_ENV_REQUIRED') && (await migCount(pool2)) === before4, `exit=${p6.status}`);

    console.log('\n— P7: test helper apontado para unificard_dev —');
    const p7 = runPrep(URL_2, 'unificard_dev', MIG_374);
    record('P7 unificard_dev RECUSADO antes de qualquer conexão (DEV_DB_REFUSED); nada aplicado',
      p7.status !== 0 && p7.out.includes('DEV_DB_REFUSED') && (await migCount(pool2)) === before4, `exit=${p7.status}`);

    console.log('\n— P10: runner produtivo com pending restante (migration quebrada transiente) —');
    let p10: RunResult;
    const before10 = await migCount(pool2);
    try {
      writeFileSync(BROKEN_MIG, 'THIS IS NOT VALID SQL — e2e P10 transient proof;\n', 'utf8');
      p10 = runProd(URL_2, NAME_2);
    } finally {
      try { unlinkSync(BROKEN_MIG); } catch { /* noop */ }
    }
    record('P10 schema parcial JAMAIS é sucesso: exit ≠ 0; SEM mensagem de conclusão total; migration quebrada revertida',
      p10.status !== 0 && !p10.out.includes(PROD_SUCCESS) && /Erro ao executar migra/.test(p10.out) &&
      (await migCount(pool2)) === before10 && !existsSync(BROKEN_MIG),
      `exit=${p10.status}`);
    record('P10 cleanup: arquivo transiente removido do diretório de migrations', !existsSync(BROKEN_MIG));

    record('zero Bank nas DBs do e2e',
      (await count(pool1, `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)) === 0 &&
      (await count(pool2, `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)) === 0);
  } finally {
    await pool1.end().catch(() => undefined);
    await pool2.end().catch(() => undefined);
    try { unlinkSync(BROKEN_MIG); } catch { /* noop */ }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    process.exit(1);
  }
  console.log('✨ Runner produtivo purificado + tooling test-only isolado — verde.');
  process.exit(0);
}

main().catch((e) => {
  console.error('💥 Erro não tratado:', e);
  try { unlinkSync(BROKEN_MIG); } catch { /* noop */ }
  process.exit(1);
});
