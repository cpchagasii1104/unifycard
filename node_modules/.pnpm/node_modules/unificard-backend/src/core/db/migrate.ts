// src/core/db/migrate.ts
//
// Script de migração automático que aplica todos os arquivos SQL
// do diretório migrations/ em ordem alfabética.
// Agora com controle de migrations executadas via tabela schema_migrations

import dotenv from 'dotenv';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Pool } from 'pg';
import { createHash } from 'crypto';

// Carrega variáveis de ambiente ANTES de criar o pool
dotenv.config({ path: join(process.cwd(), '.env') });

// Cria pool diretamente aqui para garantir que dotenv foi carregado
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: Number(process.env.DATABASE_POOL_MIN || 2),
  max: Number(process.env.DATABASE_POOL_MAX || 10),
});

// Valida se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
  console.error('   Por favor, defina DATABASE_URL no arquivo .env na raiz do projeto');
  process.exit(1);
}

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

interface MigrationFile {
  filename: string;
  path: string;
}

interface ExecutedMigration {
  filename: string;
  executed_at: Date;
}

/**
 * Garante que a tabela schema_migrations existe
 * 
 * NOTA: Se a tabela não existir, ela será criada aqui.
 * A migration 000 também pode criar, mas usar IF NOT EXISTS garante idempotência.
 */
async function ensureMigrationsTable(): Promise<void> {
  const client = await pool.connect();
  try {
    // Verificar se tabela existe
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);

    if (!checkResult.rows[0].exists) {
      console.log('📋 Criando tabela de controle de migrations (schema_migrations)...');
      
      // Criar tabela schema_migrations (mesma estrutura da migration 000)
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
 * Retorna lista de migrations já executadas
 */
async function getExecutedMigrations(): Promise<Set<string>> {
  const client = await pool.connect();
  try {
    const result = await client.query<ExecutedMigration>(
      'SELECT filename FROM schema_migrations ORDER BY executed_at'
    );
    return new Set(result.rows.map((row) => row.filename));
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
 * Marca uma migration como executada
 */
async function markMigrationAsExecuted(
  filename: string,
  sql: string,
  executionTimeMs: number
): Promise<void> {
  const client = await pool.connect();
  try {
    // Calcular checksum (opcional, para validação futura)
    const checksum = createHash('sha256').update(sql).digest('hex').substring(0, 64);
    
    await client.query(
      `INSERT INTO schema_migrations (filename, checksum, execution_time_ms)
       VALUES ($1, $2, $3)
       ON CONFLICT (filename) DO NOTHING`,
      [filename, checksum, executionTimeMs]
    );
  } finally {
    client.release();
  }
}

/**
 * Lê o diretório de migrações e retorna arquivos .sql ordenados
 */
async function getMigrationFiles(): Promise<MigrationFile[]> {
  const files = await readdir(MIGRATIONS_DIR);
  
  const sqlFiles = files
    .filter((file) => file.endsWith('.sql'))
    .map((file) => ({
      filename: file,
      path: join(MIGRATIONS_DIR, file),
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));

  return sqlFiles;
}

/**
 * Executa um arquivo SQL de migração
 * 
 * NOTA: Esta função EXECUTA o SQL da migration e marca como executada.
 * Diferente do baseline, que apenas marca sem executar.
 */
async function executeMigration(migration: MigrationFile): Promise<void> {
  const startTime = Date.now();
  const is000 = migration.filename.startsWith('000_');
  const prefix = is000 ? '🔧 [BOOTSTRAP]' : '📦 [EXECUTANDO]';
  console.log(`${prefix} ${migration.filename}`);
  
  const sql = await readFile(migration.path, 'utf-8');
  
  if (!sql.trim()) {
    console.log(`⚠️  Arquivo vazio, pulando: ${migration.filename}`);
    return;
  }

  const client = await pool.connect();
  
  try {
    // Executa o SQL completo
    await client.query(sql);
    const executionTime = Date.now() - startTime;
    
    // Marca como executada (com checksum e tempo de execução)
    await markMigrationAsExecuted(migration.filename, sql, executionTime);
    
    const successPrefix = is000 ? '🔧 [BOOTSTRAP OK]' : '✅ [EXECUTADA]';
    console.log(`${successPrefix} ${migration.filename} (${executionTime}ms) - SQL executado com sucesso`);
  } catch (error) {
    console.error(`❌ Erro ao executar migração ${migration.filename}:`);
    console.error(error);
    throw new Error(
      `Falha na migração ${migration.filename}: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    client.release();
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

  try {
    // Verifica conexão com o banco
    const testClient = await pool.connect();
    try {
      await testClient.query('SELECT 1');
      console.log('✔ Conexão com banco de dados estabelecida\n');
    } finally {
      testClient.release();
    }

    // Garante que tabela de controle existe (cria se não existir)
    // NOTA: A migration 000 também cria, mas ensureMigrationsTable garante idempotência
    await ensureMigrationsTable();

    // Obtém lista de migrações disponíveis (ANTES de verificar executadas)
    const allMigrations = await getMigrationFiles();
    
    if (allMigrations.length === 0) {
      console.log('⚠️  Nenhum arquivo de migração encontrado em migrations/');
      process.exit(0);
    }

    // BASELINE AUTOMÁTICO: Se banco já tem tabelas mas schema_migrations está vazio,
    // marca migrations antigas (001-088) como executadas automaticamente
    // NOTA: Migration 000 NÃO é incluída no baseline (será executada normalmente se pendente)
    await performAutoBaseline(allMigrations);

    // Obtém migrations já executadas (após baseline)
    const executedMigrations = await getExecutedMigrations();
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

    // Filtra apenas migrations pendentes (incluindo as forçadas)
    const pendingMigrations = allMigrations.filter(
      (m) => !executedMigrations.has(m.filename) || migrationsToForceExecute.includes(m.filename)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ Todas as migrations já foram registradas e validadas. Nada a fazer.\n');
      process.exit(0);
    }

    console.log(`📋 MIGRATIONS PENDENTES: ${pendingMigrations.length} de ${allMigrations.length} total`);
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
      await executeMigration(migration);
      console.log('');
    }

    console.log('✨ Todas as migrações pendentes foram EXECUTADAS com sucesso!');
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
