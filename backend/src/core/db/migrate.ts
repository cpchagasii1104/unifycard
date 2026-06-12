// src/core/db/migrate.ts
//
// Runner PRODUTIVO de migrations: aplica TODOS os arquivos SQL pendentes do
// diretório migrations/ em ordem alfabética, com controle via schema_migrations.
// Convenção de nomes (novas migrations = timestamp): ver README.md na raiz do backend — secção "Convenção de nomeação de migrations".
//
// SEMÂNTICA OPERACIONAL ÚNICA (F-MIGRATION-RUNNER-TEST-HOOK-ISOLATION-CLOSURE):
// descobrir todas as pendentes → validar sequência → aplicar TODAS em ordem →
// falhar em qualquer erro → declarar sucesso SOMENTE com pending final = 0.
// PROIBIDO neste entrypoint: stop-before/stop-after/limit/skip por variável de
// ambiente ou filtro arbitrário de filename — variáveis desconhecidas NÃO
// alteram o comportamento. Preparação histórica parcial para e2e de backfill
// vive EXCLUSIVAMENTE em src/scripts/test-support/apply-migrations-before-for-test.ts
// (NODE_ENV=test + banco efêmero obrigatórios), fora do caminho produtivo.

import { join } from 'path';
import { Pool } from 'pg';
import { BACKEND_ROOT, loadBackendEnv } from './load-backend-env';
import {
  type MigrationFile,
  getMigrationProfile,
  shouldExecuteMigration,
  getMigrationFiles,
  ensureMigrationsTable,
  getExecutedMigrations,
  executeMigration,
  LATENT_MODULE_MIGRATIONS,
  IGNORED_MIGRATIONS,
} from './migration-runner-core';

loadBackendEnv();

// Cria pool diretamente aqui para garantir que dotenv foi carregado
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: Number(process.env.DATABASE_POOL_MIN || 2),
  max: Number(process.env.DATABASE_POOL_MAX || 10),
});

// Valida se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
  console.error(`   Defina DATABASE_URL em ${join(BACKEND_ROOT, '.env')}`);
  process.exit(1);
}

const MIGRATIONS_DIR = join(BACKEND_ROOT, 'migrations');
const SEEDS_DIR = join(BACKEND_ROOT, 'seeds');

/**
 * Verifica se tabelas principais do sistema já existem (indicador de banco populado)
 */
async function hasMainTables(): Promise<boolean> {
  const client = await pool.connect();
  try {
    // Verificar se tabelas principais existem (users e tenants são criadas na 001)
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      ) AND EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'tenants'
      ) as has_main_tables;
    `);
    return result.rows[0]?.has_main_tables || false;
  } finally {
    client.release();
  }
}

/**
 * Verifica se uma coluna crítica existe no banco
 * Usado para validar que migrations estruturais foram realmente aplicadas
 */
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) as exists
    `, [tableName, columnName]);
    return result.rows[0]?.exists || false;
  } finally {
    client.release();
  }
}

/**
 * Baseline automático: marca migrations antigas como executadas quando banco já está populado
 *
 * LÓGICA:
 * - Se tabelas principais (users, tenants) existem
 * - E schema_migrations está vazio ou quase vazio
 * - Então assume que migrations 001-088 já foram aplicadas no passado
 * - Marca todas as migrations até 088 como executadas automaticamente
 *
 * REGRA CRÍTICA: Migrations >= 089 NUNCA são marcadas no baseline
 */
async function performAutoBaseline(allMigrations: MigrationFile[]): Promise<void> {
  const client = await pool.connect();
  try {
    // Verificar se tabelas principais existem
    const mainTablesExist = await hasMainTables();

    if (!mainTablesExist) {
      // Banco vazio, não fazer baseline
      return;
    }

    // Verificar quantas migrations já estão marcadas
    const executedCount = await client.query('SELECT COUNT(*) as count FROM schema_migrations');
    const count = parseInt(executedCount.rows[0]?.count || '0', 10);

    // Se já tem muitas migrations marcadas, não fazer baseline
    // Threshold: se já tem mais de 5 migrations, assume que está sincronizado
    if (count > 5) {
      console.log(`📊 ${count} migrations já marcadas, pulando baseline automático\n`);
      return;
    }

    console.log('🔍 BASELINE AUTOMÁTICO: Detectado banco populado com schema_migrations incompleto');
    console.log(`   Tabelas principais: ✅ Existem (users, tenants)`);
    console.log(`   Migrations marcadas: ${count}`);
    console.log('📋 Executando baseline automático (marcando 001-088 como executadas)...\n');

    // Encontrar migrations até 088 (baseline automático)
    // Incluir todas as migrations que começam com número <= 088
    // IMPORTANTE: Não usar break, pois migrations podem ter sufixos (ex: 028a, 028b)
    const migrationsToBaseline: string[] = [];

    for (const migration of allMigrations) {
      // Pular migration 000 (schema_migrations) - ela será executada normalmente se necessário
      if (migration.filename.startsWith('000_')) {
        continue;
      }

      // Extrair número da migration (ex: "001_initial_schema.sql" -> "001", "028a_catalog.sql" -> "028")
      const match = migration.filename.match(/^(\d+)/);
      if (!match) {
        continue; // Pular migrations sem número (ex: README.md, migration-test-output.log)
      }

      const migrationNumber = parseInt(match[1], 10);

      // Baseline até 088 (incluindo 088 e sufixos como 028a, 028b, etc)
      // REGRA CRÍTICA: Migrations 089+ NUNCA são incluídas no baseline
      // Elas devem ser sempre executadas para garantir que colunas críticas existam
      if (migrationNumber <= 88) {
        migrationsToBaseline.push(migration.filename);
      }
      // NÃO usar break aqui - continuar verificando todas as migrations
      // para garantir que todas <= 88 sejam incluídas, mesmo com sufixos
      // Migrations >= 089 são ignoradas no baseline (serão executadas normalmente)
    }

    if (migrationsToBaseline.length === 0) {
      console.log('⚠️  Nenhuma migration para baseline\n');
      return;
    }

    console.log(`📌 BASELINE: Marcando ${migrationsToBaseline.length} migration(s) como executadas (SEM executar SQL):\n`);

    let markedCount = 0;
    let skippedCount = 0;

    for (const filename of migrationsToBaseline) {
      // Verificar se já está marcada
      const existing = await client.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if (existing.rows.length > 0) {
        skippedCount++;
        continue; // Já marcada, pular
      }

      // Marcar como executada (sem checksum, pois não executamos de fato)
      // NOTA: Isso apenas registra no controle, NÃO executa o SQL da migration
      await client.query(
        `INSERT INTO schema_migrations (filename, executed_at, checksum)
         VALUES ($1, now(), NULL)
         ON CONFLICT (filename) DO NOTHING`,
        [filename]
      );

      markedCount++;
      console.log(`  📝 [BASELINE] ${filename} (marcada como executada, SQL não executado)`);
    }

    if (markedCount > 0) {
      console.log(`\n✨ BASELINE AUTOMÁTICO CONCLUÍDO:`);
      console.log(`   ✅ ${markedCount} migration(s) marcadas como executadas`);
      if (skippedCount > 0) {
        console.log(`   ⏭️  ${skippedCount} migration(s) já estavam marcadas (puladas)`);
      }
      console.log(`   ⚠️  IMPORTANTE: Essas migrations foram apenas MARCADAS, não executadas`);
      console.log(`   ⚠️  O SQL dessas migrations NÃO foi executado (banco já estava populado)\n`);
    } else {
      console.log(`\n⚠️  Nenhuma migration nova foi marcada (${skippedCount} já estavam todas marcadas)\n`);
    }
  } finally {
    client.release();
  }
}

/**
 * Lê o diretório de seeds e retorna arquivos .sql ordenados
 * Executa apenas se RUN_SEEDS=true estiver definido
 */
async function getSeedFiles(): Promise<MigrationFile[]> {
  // Verificar se seeds devem ser executados
  const shouldRunSeeds = process.env.RUN_SEEDS === 'true';

  if (!shouldRunSeeds) {
    return []; // Não executar seeds por padrão
  }

  try {
    return await getMigrationFiles(SEEDS_DIR);
  } catch (error) {
    // Se diretório não existe, retornar array vazio (não é erro)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando processo de migração...\n');

  // Verificar modo observação
  if (process.env.OBSERVATION_MODE === 'true') {
    console.error('❌ OBSERVATION MODE ATIVO: Migrações automáticas estão bloqueadas.');
    console.error('   Nenhuma feature estrutural deve ser adicionada.');
    console.error('   Para executar migrações, desative OBSERVATION_MODE no .env');
    process.exit(1);
  }

  // Obter profile de migrations
  const profile = getMigrationProfile();
  console.log(`📋 PROFILE DE MIGRATIONS: ${profile}`);
  if (profile === 'CORE_ONLY') {
    console.log('   ⚠️  Módulos latentes (rides, work-instant) serão IGNORADOS');
    console.log('   💡 Para executar todas as migrations, defina MIGRATION_PROFILE=FULL no .env\n');
  } else {
    console.log('   ✅ Executando TODAS as migrations (incluindo módulos latentes)\n');
  }

  try {
    // Verifica conexão com o banco
    const testClient = await pool.connect();
    try {
      await testClient.query('SELECT 1');
      console.log('✔ Conexão com banco de dados estabelecida\n');
    } finally {
      testClient.release();
    }

    // Guard-rail de alvo: confirmar contra qual banco vamos rodar antes de qualquer
    // migration. Se EXPECTED_DATABASE_NAME estiver definida e divergir do alvo
    // resolvido, ABORTA. Sem a env var, log informativo apenas (não muda fluxo CI).
    const guardClient = await pool.connect();
    let targetDbName = '';
    try {
      const res = await guardClient.query<{ db: string }>('SELECT current_database() AS db');
      targetDbName = res.rows[0]!.db;
    } finally {
      guardClient.release();
    }
    console.log(`🎯 Banco-alvo do migrate: ${targetDbName}`);
    const expected = process.env.EXPECTED_DATABASE_NAME;
    if (expected && expected !== targetDbName) {
      console.error(
        `❌ Alvo divergente: current_database='${targetDbName}' ≠ EXPECTED_DATABASE_NAME='${expected}' — abortado antes de aplicar migrations.`
      );
      process.exit(2);
    }
    if (expected) {
      console.log(`✅ Alvo confere com EXPECTED_DATABASE_NAME='${expected}'\n`);
    }

    // Garante que tabela de controle existe (cria se não existir)
    // NOTA: A migration 000 também cria, mas ensureMigrationsTable garante idempotência
    await ensureMigrationsTable(pool);

    // Obtém lista de migrações disponíveis (ANTES de verificar executadas)
    const allMigrations = await getMigrationFiles(MIGRATIONS_DIR);

    if (allMigrations.length === 0) {
      console.log('⚠️  Nenhum arquivo de migração encontrado em migrations/');
      process.exit(0);
    }

    // Filtrar migrations baseado no profile
    const filteredMigrations = allMigrations.filter((m) => shouldExecuteMigration(m.filename, profile));
    const skippedMigrations = allMigrations.filter((m) => !shouldExecuteMigration(m.filename, profile));

    if (skippedMigrations.length > 0) {
      const latentMigrations = skippedMigrations.filter(m => LATENT_MODULE_MIGRATIONS.includes(m.filename));
      const ignoredMigrations = skippedMigrations.filter(m => IGNORED_MIGRATIONS.includes(m.filename));

      if (latentMigrations.length > 0) {
        console.log(`⏭️  MIGRATIONS IGNORADAS (módulos latentes): ${latentMigrations.length}`);
        latentMigrations.forEach((m) => {
          console.log(`   🚫 ${m.filename}`);
        });
        console.log('');
      }

      if (ignoredMigrations.length > 0) {
        console.log(`⚠️  MIGRATIONS IGNORADAS (inconsistências históricas): ${ignoredMigrations.length}`);
        ignoredMigrations.forEach((m) => {
          console.log(`   ⚠️  ${m.filename} (marcada como executada pelo baseline, mas tabelas dependentes não existem)`);
        });
        console.log('');
      }
    }

    console.log(`📦 MIGRATIONS DISPONÍVEIS: ${filteredMigrations.length} de ${allMigrations.length} total\n`);

    // BASELINE AUTOMÁTICO: Se banco já tem tabelas mas schema_migrations está vazio,
    // marca migrations antigas (001-088) como executadas automaticamente
    // NOTA: Migration 000 NÃO é incluída no baseline (será executada normalmente se pendente)
    // IMPORTANTE: Baseline usa allMigrations (todas), mas apenas filteredMigrations serão executadas
    await performAutoBaseline(allMigrations);

    // Obtém migrations já executadas (após baseline)
    const executedMigrations = await getExecutedMigrations(pool);
    console.log(`📊 RESUMO: ${executedMigrations.size} migration(s) já registrada(s) no controle\n`);

    // VALIDAÇÃO CRÍTICA: Verificar se migrations estruturais críticas foram realmente aplicadas
    // Mesmo que estejam marcadas como executadas, se a coluna não existir, forçar execução
    console.log('🔍 Validando migrations estruturais críticas...\n');

    const criticalMigrations: { filename: string; table: string; column: string }[] = [
      { filename: '089_add_token_version_to_users.sql', table: 'users', column: 'token_version' },
    ];

    const migrationsToForceExecute: string[] = [];

    for (const critical of criticalMigrations) {
      // Verificar se migration está marcada como executada
      const isMarked = executedMigrations.has(critical.filename);

      if (isMarked) {
        // Migration está marcada, mas verificar se coluna realmente existe
        const columnExistsInDb = await columnExists(critical.table, critical.column);

        if (!columnExistsInDb) {
          console.log(`⚠️  CRÍTICO: Migration ${critical.filename} está marcada como executada, mas coluna ${critical.table}.${critical.column} NÃO existe!`);
          console.log(`   Forçando execução da migration para corrigir inconsistência.\n`);

          // Remover da lista de executadas para forçar execução
          migrationsToForceExecute.push(critical.filename);

          // Remover do registro de executadas (será re-executada e re-marcada)
          const client = await pool.connect();
          try {
            await client.query('DELETE FROM schema_migrations WHERE filename = $1', [critical.filename]);
            // Atualizar Set local para refletir a remoção
            executedMigrations.delete(critical.filename);
            console.log(`   ✅ Registro removido de schema_migrations. Migration será executada.\n`);
          } finally {
            client.release();
          }
        } else {
          console.log(`   ✅ ${critical.filename}: Coluna ${critical.table}.${critical.column} existe (validação OK)\n`);
        }
      }
    }

    // Filtra apenas migrations pendentes (incluindo as forçadas).
    // ÚNICA semântica deste runner: aplicar TODAS as pendentes do profile —
    // nenhum stop/limit/skip por variável de ambiente existe neste entrypoint.
    const pendingMigrations = filteredMigrations.filter(
      (m) => !executedMigrations.has(m.filename) || migrationsToForceExecute.includes(m.filename)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ Todas as migrations já foram registradas e validadas. Nada a fazer.\n');
      process.exit(0);
    }

    console.log(`📋 MIGRATIONS PENDENTES: ${pendingMigrations.length} de ${filteredMigrations.length} disponíveis (${allMigrations.length} total no diretório)`);
    console.log(`   Essas migrations serão EXECUTADAS (SQL será rodado):\n`);
    pendingMigrations.forEach((m, index) => {
      const is000 = m.filename.startsWith('000_');
      const isForced = migrationsToForceExecute.includes(m.filename);
      let marker = is000 ? '🔧 [BOOTSTRAP]' : '📦 [EXECUTAR]';
      if (isForced) {
        marker = '⚠️  [FORÇADA]'; // Migration crítica sendo forçada
      }
      console.log(`  ${index + 1}. ${marker} ${m.filename}${isForced ? ' (validação detectou inconsistência)' : ''}`);
    });
    console.log('');

    // Executa cada migração pendente em ordem
    for (let i = 0; i < pendingMigrations.length; i++) {
      const migration = pendingMigrations[i];
      console.log(`[${i + 1}/${pendingMigrations.length}]`);
      await executeMigration(pool, migration);
      console.log('');
    }

    // VERIFICAÇÃO FINAL FAIL-CLOSED: sucesso TOTAL só com pending = 0.
    // Recalcula do DISCO + schema_migrations (não confia na lista da iteração):
    // se restar QUALQUER migration pendente, schema está INCOMPLETO → exit 1.
    const finalFiles = await getMigrationFiles(MIGRATIONS_DIR);
    const finalFiltered = finalFiles.filter((m) => shouldExecuteMigration(m.filename, profile));
    const finalExecuted = await getExecutedMigrations(pool);
    const stillPending = finalFiltered.filter((m) => !finalExecuted.has(m.filename));
    if (stillPending.length > 0) {
      console.error(`❌ ${stillPending.length} migration(s) AINDA PENDENTES após a execução — schema INCOMPLETO; nenhum sucesso declarado:`);
      stillPending.forEach((m) => console.error(`   - ${m.filename}`));
      process.exit(1);
    }

    console.log('✨ Todas as migrações pendentes foram EXECUTADAS com sucesso!');

    // Executar seeds se flag estiver presente
    const shouldRunSeeds = process.env.RUN_SEEDS === 'true';
    if (shouldRunSeeds) {
      console.log('\n🌱 Executando seeds (RUN_SEEDS=true)...\n');

      const seedFiles = await getSeedFiles();

      if (seedFiles.length === 0) {
        console.log('⚠️  Nenhum arquivo de seed encontrado em seeds/\n');
      } else {
        console.log(`📋 SEEDS DISPONÍVEIS: ${seedFiles.length}`);
        seedFiles.forEach((s, index) => {
          console.log(`  ${index + 1}. 🌱 [SEED] ${s.filename}`);
        });
        console.log('');

        // Executar cada seed
        for (let i = 0; i < seedFiles.length; i++) {
          const seed = seedFiles[i];
          console.log(`[${i + 1}/${seedFiles.length}]`);
          await executeMigration(pool, seed);
          console.log('');
        }

        console.log('✨ Todos os seeds foram EXECUTADOS com sucesso!');
      }
    } else {
      console.log('\n⏭️  Seeds ignorados (RUN_SEEDS não está definido como true)');
      console.log('   💡 Para executar seeds, defina RUN_SEEDS=true no .env\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n💥 Erro fatal durante a migração:');
    console.error(error);
    process.exit(1);
  } finally {
    // Fecha o pool de conexões
    await pool.end();
  }
}

// Executa o script
main().catch((error) => {
  console.error('Erro não tratado:', error);
  process.exit(1);
});
