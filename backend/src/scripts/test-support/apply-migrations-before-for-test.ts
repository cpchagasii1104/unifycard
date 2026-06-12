// apply-migrations-before-for-test.ts
// ⚠️ FERRAMENTA EXCLUSIVAMENTE DE TESTE — NUNCA é caminho produtivo.
// F-MIGRATION-RUNNER-TEST-HOOK-ISOLATION-CLOSURE: o runner produtivo
// (core/db/migrate.ts) aplica SEMPRE todas as migrations pendentes; a
// preparação de DB efêmera "no estado anterior à migration X" (e2e de
// backfill) vive AQUI, atrás de guardas fail-closed simultâneas:
//
//   · NODE_ENV === 'test' OBRIGATÓRIO (produção/dev recusados antes de conectar);
//   · EXPECTED_DATABASE_NAME OBRIGATÓRIO, ≠ 'unificard_dev', com nome
//     materialmente efêmero (test|e2e|ephemeral|backfill);
//   · current_database() EXATAMENTE igual a EXPECTED_DATABASE_NAME;
//   · target validado por FILENAME EXATO (igualdade estrita, ocorrência única,
//     pendente, sem migration posterior aplicada) — nunca prefixo/substring/
//     ordenação contra filename inexistente;
//   · target inexistente/vazio/malformado/já aplicado ⇒ exit ≠ 0, nada aplicado.
//
// Aplica SOMENTE os índices ANTERIORES ao target (mesmas primitivas de
// execução do runner produtivo — migration-runner-core), confirma que o
// target segue pendente e imprime mensagem test-only inequívoca.
// NUNCA imprime mensagem de sucesso total do runner produtivo.
//
// Uso (e2e/wrapper):
//   NODE_ENV=test EXPECTED_DATABASE_NAME=<db efêmera> npx tsx \
//     src/scripts/test-support/apply-migrations-before-for-test.ts \
//     --before=<filename exato da migration>

import { join } from 'path';
import { Pool } from 'pg';
import { BACKEND_ROOT, loadBackendEnv } from '../../core/db/load-backend-env';
import {
  getMigrationProfile,
  shouldExecuteMigration,
  getMigrationFiles,
  ensureMigrationsTable,
  getExecutedMigrations,
  executeMigration,
} from '../../core/db/migration-runner-core';

loadBackendEnv();

const MIGRATIONS_DIR = join(BACKEND_ROOT, 'migrations');

function refuse(code: string, msg: string): never {
  console.error(`❌ TEST-ONLY REFUSED [${code}]: ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  // ── 1. Guardas de AMBIENTE — antes de qualquer conexão/efeito ──────────────
  if (process.env.NODE_ENV !== 'test') {
    refuse('TEST_ENV_REQUIRED', `NODE_ENV='${process.env.NODE_ENV ?? ''}' — esta ferramenta exige NODE_ENV=test (nenhuma migration aplicada).`);
  }
  const expected = (process.env.EXPECTED_DATABASE_NAME ?? '').trim();
  if (!expected) {
    refuse('EXPECTED_DB_REQUIRED', 'EXPECTED_DATABASE_NAME é obrigatório (nenhuma migration aplicada).');
  }
  if (expected === 'unificard_dev') {
    refuse('DEV_DB_REFUSED', "EXPECTED_DATABASE_NAME='unificard_dev' — banco de desenvolvimento RECUSADO (nenhuma conexão aberta).");
  }
  if (!/(test|e2e|ephemeral|backfill)/i.test(expected)) {
    refuse('EPHEMERAL_NAME_REQUIRED', `banco '${expected}' não identificado materialmente como efêmero/teste (nenhuma migration aplicada).`);
  }
  if (!process.env.DATABASE_URL) {
    refuse('DATABASE_URL_REQUIRED', 'DATABASE_URL ausente.');
  }

  // ── 2. Target EXATO — validação de filesystem antes de conectar ────────────
  const arg = process.argv.find((a) => a.startsWith('--before='));
  if (!arg) {
    refuse('TARGET_REQUIRED', 'uso: --before=<filename exato da migration> (nenhuma migration aplicada).');
  }
  const target = arg.slice('--before='.length).trim();
  if (!target || !/^[0-9A-Za-z][0-9A-Za-z_.-]*\.sql$/.test(target)) {
    refuse('TARGET_MALFORMED', `target vazio/malformado: '${target}' (nenhuma migration aplicada).`);
  }
  const allMigrations = await getMigrationFiles(MIGRATIONS_DIR);
  // Igualdade EXATA de filename — proibido prefixo/substring/ordenação solta.
  const occurrences = allMigrations.filter((m) => m.filename === target);
  if (occurrences.length === 0) {
    refuse('TARGET_NOT_FOUND', `target '${target}' INEXISTENTE no diretório de migrations (nenhuma migration aplicada).`);
  }
  if (occurrences.length > 1) {
    refuse('TARGET_AMBIGUOUS', `target '${target}' com mais de uma ocorrência (nenhuma migration aplicada).`);
  }
  const profile = getMigrationProfile();
  const filtered = allMigrations.filter((m) => shouldExecuteMigration(m.filename, profile));
  const targetIndex = filtered.findIndex((m) => m.filename === target);
  if (targetIndex === -1) {
    refuse('TARGET_NOT_IN_PROFILE', `target '${target}' fora do profile '${profile}' (nenhuma migration aplicada).`);
  }

  // ── 3. Guardas de BANCO ─────────────────────────────────────────────────────
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  try {
    const dbRow = await pool.query<{ db: string }>('SELECT current_database() AS db');
    const currentDb = dbRow.rows[0].db;
    if (currentDb === 'unificard_dev') {
      refuse('DEV_DB_REFUSED', "current_database()='unificard_dev' — RECUSADO (nenhuma migration aplicada).");
    }
    if (currentDb !== expected) {
      refuse('DB_NAME_MISMATCH', `current_database()='${currentDb}' ≠ EXPECTED_DATABASE_NAME='${expected}' (nenhuma migration aplicada).`);
    }

    await ensureMigrationsTable(pool);
    const executed = await getExecutedMigrations(pool);
    if (executed.has(target)) {
      refuse('TARGET_ALREADY_APPLIED', `target '${target}' JÁ APLICADO — preparação histórica impossível (nada alterado).`);
    }
    const laterApplied = filtered.slice(targetIndex + 1).filter((m) => executed.has(m.filename));
    if (laterApplied.length > 0) {
      refuse('POSTERIOR_ALREADY_APPLIED', `${laterApplied.length} migration(s) POSTERIORES ao target já aplicadas (ex.: ${laterApplied[0].filename}) — estado não é histórico (nada alterado).`);
    }

    // ── 4. Aplica SOMENTE os índices ANTERIORES ao target ────────────────────
    const toApply = filtered.slice(0, targetIndex).filter((m) => !executed.has(m.filename));
    console.log(`🧪 TEST-ONLY: preparando '${currentDb}' ANTES de '${target}' — ${toApply.length} migration(s) a aplicar (profile ${profile}).\n`);
    for (let i = 0; i < toApply.length; i++) {
      console.log(`[${i + 1}/${toApply.length}]`);
      await executeMigration(pool, toApply[i]);
    }

    // ── 5. Pós-verificação fail-closed ────────────────────────────────────────
    const after = await getExecutedMigrations(pool);
    if (after.has(target)) {
      refuse('TARGET_APPLIED_BY_BUG', `pós-verificação: target '${target}' consta como aplicado — preparação inválida.`);
    }
    const beforeStillPending = filtered.slice(0, targetIndex).filter((m) => !after.has(m.filename));
    if (beforeStillPending.length > 0) {
      refuse('PREPARATION_INCOMPLETE', `${beforeStillPending.length} migration(s) anteriores ao target seguem pendentes (ex.: ${beforeStillPending[0].filename}).`);
    }
    const intentionallyPending = filtered.slice(targetIndex).filter((m) => !after.has(m.filename));

    console.log(`\nTEST DATABASE PREPARED BEFORE ${target}`);
    console.log(`   banco alvo: ${currentDb}`);
    console.log(`   migrations aplicadas nesta preparação: ${toApply.length}`);
    console.log(`   parou ANTES de: ${target} (segue pendente)`);
    console.log(`   migrations intencionalmente AINDA pendentes: ${intentionallyPending.length}`);
    console.log(`   (estado PARCIAL por design de teste — NÃO é sucesso de migração produtiva)`);
    process.exit(0);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('💥 TEST-ONLY: erro não tratado:', error);
  process.exit(1);
});
