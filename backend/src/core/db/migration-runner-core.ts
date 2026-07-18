// migration-runner-core.ts
// Primitivas PURAS/parametrizadas de enumeração e aplicação de migrations —
// FONTE ÚNICA compartilhada entre:
//   · o runner PRODUTIVO (src/core/db/migrate.ts) — aplica SEMPRE todas as
//     pendentes (nenhum mecanismo de truncamento existe no caminho produtivo);
//   · o tooling EXCLUSIVO DE TESTE
//     (src/scripts/test-support/apply-migrations-before-for-test.ts) — prepara
//     DB efêmera no estado anterior a uma migration para e2e de backfill.
//
// F-MIGRATION-RUNNER-TEST-HOOK-ISOLATION-CLOSURE: o hook MIGRATION_STOP_BEFORE
// foi REMOVIDO do runner produtivo (permitia schema parcial com exit 0 sob
// NODE_ENV=production). Compartilhar as primitivas aqui evita duplicar o
// migrador no helper de teste SEM reintroduzir truncamento no entrypoint
// produtivo. Nenhuma função deste módulo lê variável de ambiente de corte.

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Pool, PoolClient } from 'pg';
import { createHash } from 'crypto';

export interface MigrationFile {
  filename: string;
  path: string;
}

export type MigrationProfile = 'CORE_ONLY' | 'FULL';

/**
 * Migrations de módulos LATENTES ignoradas no profile CORE_ONLY
 * (semântica histórica de seleção de módulo — NÃO é truncamento de sequência).
 */
export const LATENT_MODULE_MIGRATIONS = [
  // Módulo Rides (latente)
  '009_rides_part1_geography.sql',
  '010_rides_part2_drivers_vehicles.sql',
  '011_rides_part3_ride_lifecycle.sql',
  '012_rides_part4_pricing.sql',
  '013_rides_part5_distribution.sql',
  '014_rides_part6_security_analytics.sql',
  '015_rides_patch_enhanced.sql',
  '016_rides_patch_requirements.sql',
  '017_rides_driver_vehicle_compliance.sql',
  '036_rides_patch_requirements.sql',

  // Módulo Work-Instant (latente)
  '005_unifywork.sql',
];

/**
 * Migrations com SKIP GOVERNADO e versionado: `shouldExecuteMigration=false` → NUNCA executadas
 * e NUNCA marcadas em `schema_migrations` (SKIPPED ≠ APPLIED). Duas naturezas distintas:
 *  - `046_company_status_and_documents.sql`: inconsistência histórica do baseline automático.
 *  - `20260713140000_neighborhood_alias_first_governed_flow.sql` (R-7): migration N1 **DORMENTE por
 *    desenho** (AUTO-PROVA self-aborting; só aplicável sob GATE/GO territorial real; ausente de dev por
 *    decisão). Sob FULL, o runner tentava executá-la e ABORTAVA — por isso os E2E FULL antes dependiam de
 *    pré-marcação manual não versionada (o bypass condenado). Com o skip governado, o FULL efêmero é
 *    reprodutível a partir do repo, sem pré-marca. Arquivo da migration INTOCADO; nada inserido em
 *    schema_migrations. Ver DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED.
 */
export const IGNORED_MIGRATIONS = [
  '046_company_status_and_documents.sql',
  '20260713140000_neighborhood_alias_first_governed_flow.sql',
];

/** Profile a partir do ambiente (padrão CORE_ONLY — seleção de módulo, não corte). */
export function getMigrationProfile(): MigrationProfile {
  const profile = (process.env.MIGRATION_PROFILE || 'CORE_ONLY').toUpperCase();
  return profile === 'FULL' ? 'FULL' : 'CORE_ONLY';
}

/** Uma migration deve executar sob o profile? (ignoradas nunca executam.) */
export function shouldExecuteMigration(filename: string, profile: MigrationProfile): boolean {
  if (IGNORED_MIGRATIONS.includes(filename)) {
    return false;
  }
  if (profile === 'FULL') {
    return true;
  }
  if (profile === 'CORE_ONLY') {
    return !LATENT_MODULE_MIGRATIONS.includes(filename);
  }
  return true;
}

/**
 * Número sequencial legado da migration (Lei 2 / forward-only).
 * Timestamps YYYYMMDDHHMMSS/YYYYMMDD ficam fora da sequência numérica → null.
 */
export function extractMigrationNumber(filename: string): number | null {
  if (/^\d{14}_/.test(filename)) {
    return null;
  }
  if (/^\d{8}_/.test(filename)) {
    return null;
  }
  const match = filename.match(/^(\d+)_/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/** Lê o diretório de migrations e devolve os .sql em ordem lexicográfica. */
export async function getMigrationFiles(migrationsDir: string): Promise<MigrationFile[]> {
  const files = await readdir(migrationsDir);
  return files
    .filter((file) => file.endsWith('.sql'))
    .map((file) => ({ filename: file, path: join(migrationsDir, file) }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Versão atual do schema (Lei 2 / forward-only): MAX(schema_version) se a
 * tabela existir; senão derivada de schema_migrations.
 */
export async function getCurrentSchemaVersion(client: PoolClient): Promise<number> {
  const tableExists = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'schema_version'
    ) as exists
  `);
  if (tableExists.rows[0]?.exists) {
    const result = await client.query<{ v: string }>(
      'SELECT COALESCE(MAX(version), 0)::text as v FROM schema_version'
    );
    return parseInt(result.rows[0]?.v ?? '0', 10);
  }
  const result = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations'
  );
  let maxVer = 0;
  for (const row of result.rows) {
    const n = extractMigrationNumber(row.filename);
    if (n !== null && n > maxVer) maxVer = n;
  }
  return maxVer;
}

/** Garante a tabela de controle schema_migrations (idempotente). */
export async function ensureMigrationsTable(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'schema_migrations'
      );
    `);

    if (!checkResult.rows[0].exists) {
      console.log('📋 Criando tabela de controle de migrations (schema_migrations)...');
      await client.query(`
        CREATE TABLE schema_migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          checksum VARCHAR(64),
          execution_time_ms INTEGER,
          CONSTRAINT unique_filename UNIQUE (filename)
        );

        CREATE INDEX idx_schema_migrations_filename ON schema_migrations (filename);
        CREATE INDEX idx_schema_migrations_executed_at ON schema_migrations (executed_at);
      `);
      console.log('✅ Tabela schema_migrations criada\n');
    }
  } finally {
    client.release();
  }
}

/** Migrations já registradas como executadas. */
export async function getExecutedMigrations(pool: Pool): Promise<Set<string>> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY executed_at'
    );
    return new Set(result.rows.map((row) => row.filename));
  } finally {
    client.release();
  }
}

/** Marca a migration como executada (mesma transação do client passado). */
async function markMigrationAsExecuted(
  client: PoolClient,
  filename: string,
  sql: string,
  executionTimeMs: number
): Promise<void> {
  const checksum = createHash('sha256').update(sql).digest('hex').substring(0, 64);
  await client.query(
    `INSERT INTO schema_migrations (filename, checksum, execution_time_ms)
     VALUES ($1, $2, $3)
     ON CONFLICT (filename) DO NOTHING`,
    [filename, checksum, executionTimeMs]
  );
}

/**
 * Executa UM arquivo de migration em transação, respeitando Lei 2
 * (forward-only: valida sequência via schema_version e insere nova versão).
 * Comportamento idêntico para runner produtivo e tooling de teste — a
 * DIFERENÇA entre eles é exclusivamente QUAIS migrations cada um seleciona.
 */
export async function executeMigration(pool: Pool, migration: MigrationFile): Promise<void> {
  const startTime = Date.now();
  const sql = await readFile(migration.path, 'utf-8');

  if (!sql.trim()) {
    console.log(`⚠️  Arquivo vazio, pulando: ${migration.filename}`);
    return;
  }

  const migrationNumber = extractMigrationNumber(migration.filename);
  const client = await pool.connect();

  try {
    if (migrationNumber !== null) {
      const currentVersion = await getCurrentSchemaVersion(client);
      const expected = currentVersion + 1;
      if (migrationNumber !== expected) {
        throw new Error(
          `Forward-only violation: expected migration ${expected} but got ${migrationNumber}`
        );
      }
      console.log(`Running migration ${migration.filename}`);
      console.log(`Current schema version: ${currentVersion}`);
      console.log(`Expected: ${expected}`);
      console.log(`Executing: ${migrationNumber}`);
    } else {
      console.log(`📦 [EXECUTANDO] ${migration.filename}`);
    }

    await client.query('BEGIN');

    await client.query(sql);
    const executionTime = Date.now() - startTime;

    await markMigrationAsExecuted(client, migration.filename, sql, executionTime);

    if (migrationNumber !== null && migrationNumber >= 9) {
      await client.query(
        'INSERT INTO schema_version(version) VALUES ($1)',
        [migrationNumber]
      );
    }

    await client.query('COMMIT');

    const is000 = migration.filename.startsWith('000_');
    const successPrefix = is000 ? '🔧 [BOOTSTRAP OK]' : '✅ [EXECUTADA]';
    console.log(`${successPrefix} ${migration.filename} (${executionTime}ms) - SQL executado com sucesso`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`❌ Erro ao executar migração ${migration.filename}:`);
    console.error(error);
    throw new Error(
      `Falha na migração ${migration.filename}: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    client.release();
  }
}
