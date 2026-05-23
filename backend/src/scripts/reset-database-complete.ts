// src/scripts/reset-database-complete.ts
//
// Script de RESET COMPLETO do banco de dados UnifyCard
// 
// OBJETIVO:
// - Deletar completamente o banco de dados atual (ambiente de desenvolvimento)
// - Recriar o banco do zero
// - Aplicar TODAS as migrations revisadas automaticamente
// - Garantir que o estado final esteja alinhado com o README de migrations revisado
//
// REGRAS DE OURO:
// 1. NÃO adicionar IF NOT EXISTS em migrations fundacionais
// 2. NÃO pular migrations
// 3. NÃO recriar lógica de domínio no banco
// 4. NÃO executar migrations fora de ordem
// 5. NÃO assumir que o banco antigo está correto
// 6. NÃO pedir confirmação adicional — a ação é deliberada

import dotenv from 'dotenv';
import { join } from 'path';
import { Pool, Client } from 'pg';
import { execSync } from 'child_process';

// Carrega variáveis de ambiente
dotenv.config({ path: join(process.cwd(), '.env') });

interface DatabaseVersionRow {
  version: string;
}

interface DatabaseVersion {
  version: string;
}

// boundary: DB -> domain mapping
function mapDatabaseVersionRowToDomain(row: DatabaseVersionRow): DatabaseVersion {
  return {
    version: row.version,
  };
}

// TODO: migrate to domain mapping (controlled rollout)
// mapper exists but is not applied in critical reset flow to avoid semantic drift.

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Parseia DATABASE_URL e extrai componentes
 */
function parseDatabaseUrl(url: string): DatabaseConfig {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port || '5432', 10),
      user: urlObj.username,
      password: urlObj.password || '',
      database: urlObj.pathname.substring(1), // Remove leading /
    };
  } catch (error) {
    throw new Error(`Erro ao parsear DATABASE_URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Cria conexão administrativa ao postgres (não ao banco unificard)
 */
function createAdminConnection(config: DatabaseConfig): Client {
  return new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres', // Conecta ao banco administrativo
  });
}

/**
 * Cria conexão ao banco unificard
 */
function createUnificardConnection(config: DatabaseConfig): Client {
  return new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });
}

/**
 * PASSO 1: Conectar ao postgres como superuser
 */
async function connectAsSuperuser(config: DatabaseConfig): Promise<Client> {
  console.log('🔌 PASSO 1: Conectando ao PostgreSQL como superuser...');
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   User: ${config.user}`);
  console.log(`   Database: postgres (administrativo)\n`);

  const client = createAdminConnection(config);
  await client.connect();
  
  // Testar conexão
  const result = await client.query<{ version: string }>('SELECT version()');
  console.log(`✅ Conectado ao PostgreSQL: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}\n`);
  
  return client;
}

/**
 * PASSO 2: Drop total do banco antigo
 */
async function dropDatabase(client: Client, databaseName: string): Promise<void> {
  console.log('🗑️  PASSO 2: Drop total do banco antigo...');
  console.log(`   Database: ${databaseName}\n`);

  try {
    // Verificar se banco existe
    const checkResult = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [databaseName]
    );

    if (checkResult.rows.length === 0) {
      console.log(`⚠️  Banco ${databaseName} não existe. Pulando drop.\n`);
      return;
    }

    console.log(`   📋 Banco ${databaseName} encontrado. Encerrando conexões ativas...`);

    // Encerrar todas as conexões ativas ao banco
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid()
    `, [databaseName]);

    console.log(`   ✅ Conexões encerradas`);

    // Dropar o banco
    // NOTA: Não podemos usar parâmetros em DROP DATABASE, então precisamos construir a query
    // Mas validamos que databaseName contém apenas caracteres seguros
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) {
      throw new Error(`Nome de banco inválido: ${databaseName}. Use apenas letras, números e underscore.`);
    }
    
    console.log(`   🗑️  Droppando banco ${databaseName}...`);
    await client.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    console.log(`   ✅ Banco ${databaseName} droppado com sucesso\n`);
  } catch (error) {
    console.error(`   ❌ Erro ao dropar banco: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * PASSO 3: Criar banco novo
 */
async function createDatabase(client: Client, databaseName: string, owner: string): Promise<void> {
  console.log('🆕 PASSO 3: Criando banco novo...');
  console.log(`   Database: ${databaseName}`);
  console.log(`   Owner: ${owner}`);
  console.log(`   Encoding: UTF8\n`);

  try {
    // Validar nomes (não podemos usar parâmetros em CREATE DATABASE)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) {
      throw new Error(`Nome de banco inválido: ${databaseName}. Use apenas letras, números e underscore.`);
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(owner)) {
      throw new Error(`Nome de owner inválido: ${owner}. Use apenas letras, números e underscore.`);
    }

    // Usar template0 para evitar problemas de collation
    await client.query(`
      CREATE DATABASE ${databaseName}
        WITH OWNER = ${owner}
        ENCODING = 'UTF8'
        TEMPLATE = template0
    `);
    console.log(`✅ Banco ${databaseName} criado com sucesso\n`);
  } catch (error) {
    console.error(`❌ Erro ao criar banco: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * PASSO 4: Conectar ao banco novo e validar que está vazio
 */
async function connectToNewDatabase(config: DatabaseConfig): Promise<Client> {
  console.log('🔌 PASSO 4: Conectando ao banco novo...');
  console.log(`   Database: ${config.database}\n`);

  const client = createUnificardConnection(config);
  await client.connect();

  // Validar que está vazio (sem tabelas do projeto)
  const tablesResult = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
  `);

  const userTables = tablesResult.rows.filter(row => !row.table_name.startsWith('pg_'));
  
  if (userTables.length > 0) {
    console.log(`⚠️  AVISO: Banco contém ${userTables.length} tabela(s) não-padrão:`);
    userTables.forEach(t => console.log(`   - ${t.table_name}`));
    console.log('');
  } else {
    console.log(`✅ Banco está vazio (sem tabelas do projeto)\n`);
  }

  return client;
}

/**
 * PASSO 5: Criar tabela de controle de migrations
 */
async function createMigrationsTable(client: Client): Promise<void> {
  console.log('📋 PASSO 5: Criando tabela de controle de migrations...\n');

  await client.query(`
    CREATE TABLE schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum VARCHAR(64),
      execution_time_ms INTEGER
    );

    CREATE INDEX idx_schema_migrations_filename ON schema_migrations (filename);
    CREATE INDEX idx_schema_migrations_executed_at ON schema_migrations (executed_at);

    COMMENT ON TABLE schema_migrations IS 'Controle de migrations executadas - usado pelo sistema de migração automático';
    COMMENT ON COLUMN schema_migrations.filename IS 'Nome do arquivo de migration (ex: 001_initial_schema.sql)';
    COMMENT ON COLUMN schema_migrations.executed_at IS 'Data/hora de execução da migration';
    COMMENT ON COLUMN schema_migrations.checksum IS 'Hash SHA-256 do conteúdo SQL (opcional, para validação)';
    COMMENT ON COLUMN schema_migrations.execution_time_ms IS 'Tempo de execução em milissegundos (opcional)';
  `);

  console.log('✅ Tabela schema_migrations criada\n');
}

/**
 * PASSO 6: Executar todas as migrations automaticamente
 */
async function executeAllMigrations(config: DatabaseConfig): Promise<void> {
  console.log('🚀 PASSO 6: Executando todas as migrations automaticamente...\n');
  console.log('   Usando runner oficial: npm run migrate\n');

  try {
    // Executar npm run migrate no diretório backend
    const backendDir = process.cwd();
    const output = execSync('npm run migrate', {
      cwd: backendDir,
      encoding: 'utf-8',
      stdio: 'inherit',
    });

    console.log('\n✅ Todas as migrations executadas com sucesso\n');
  } catch (error) {
    console.error('\n❌ Erro ao executar migrations:');
    console.error(error);
    throw new Error('Falha na execução das migrations');
  }
}

/**
 * PASSO 7: Validações finais
 */
async function validateFinalState(client: Client): Promise<{
  migrationsCount: number;
  lastMigration: string | null;
  keyTables: { name: string; exists: boolean }[];
}> {
  console.log('✅ PASSO 7: Validações finais...\n');

  // Verificar schema_migrations
  const migrationsResult = await client.query(`
    SELECT filename, executed_at 
    FROM schema_migrations 
    ORDER BY executed_at DESC
  `);

  const migrationsCount = migrationsResult.rows.length;
  const lastMigration = migrationsResult.rows[0]?.filename || null;

  console.log(`   📊 Migrations aplicadas: ${migrationsCount}`);
  if (lastMigration) {
    console.log(`   📌 Última migration: ${lastMigration}\n`);
  }

  // Verificar tabelas-chave
  const keyTables = [
    'tenants',
    'users',
    'global_users',
    'actors',
    'events',
    'event_attendees',
    'event_participants',
    'actor_debts',
    'event_escrow',
    'groups',
    'split_configuration',
  ];

  console.log('   🔍 Verificando tabelas-chave:');
  const tableChecks: { name: string; exists: boolean }[] = [];

  for (const tableName of keyTables) {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = $1
      ) as exists
    `, [tableName]);

    const exists = result.rows[0]?.exists || false;
    tableChecks.push({ name: tableName, exists });
    console.log(`      ${exists ? '✅' : '❌'} ${tableName}`);
  }

  console.log('');

  // Verificar se houve erro
  const missingTables = tableChecks.filter(t => !t.exists);
  if (missingTables.length > 0) {
    console.log(`⚠️  AVISO: ${missingTables.length} tabela(s)-chave não encontrada(s):`);
    missingTables.forEach(t => console.log(`   - ${t.name}`));
    console.log('');
  }

  return {
    migrationsCount,
    lastMigration,
    keyTables: tableChecks,
  };
}

/**
 * Função principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RESET COMPLETO DO BANCO DE DADOS UNIFYCARD');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  ATENÇÃO: Esta operação é DESTRUTIVA');
  console.log('   - O banco de dados atual será DELETADO completamente');
  console.log('   - Um novo banco será criado do zero');
  console.log('   - Todas as migrations serão aplicadas automaticamente');
  console.log('');
  console.log('Ambiente: DESENVOLVIMENTO LOCAL');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Validar DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
    console.error('   Por favor, defina DATABASE_URL no arquivo .env');
    process.exit(1);
  }

  // Parsear configuração
  const config = parseDatabaseUrl(databaseUrl);
  const databaseName = config.database;
  const owner = config.user;

  let adminClient: Client | null = null;
  let unificardClient: Client | null = null;

  try {
    // PASSO 1: Conectar como superuser
    adminClient = await connectAsSuperuser(config);

    // PASSO 2: Drop total do banco antigo
    await dropDatabase(adminClient, databaseName);

    // PASSO 3: Criar banco novo
    await createDatabase(adminClient, databaseName, owner);

    // Fechar conexão administrativa
    await adminClient.end();
    adminClient = null;

    // PASSO 4: Conectar ao banco novo
    unificardClient = await connectToNewDatabase(config);

    // PASSO 5: Criar tabela de controle de migrations
    await createMigrationsTable(unificardClient);

    // Fechar conexão para permitir que migrate.ts use o pool
    await unificardClient.end();
    unificardClient = null;

    // PASSO 6: Executar todas as migrations
    await executeAllMigrations(config);

    // PASSO 7: Validações finais
    unificardClient = await connectToNewDatabase(config);
    const validation = await validateFinalState(unificardClient);

    // RELATÓRIO FINAL
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  RELATÓRIO FINAL');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ Banco recriado com sucesso');
    console.log(`   📊 Total de migrations aplicadas: ${validation.migrationsCount}`);
    if (validation.lastMigration) {
      console.log(`   📌 Última migration executada: ${validation.lastMigration}`);
    }
    console.log('');
    console.log('✅ Observação explícita: Banco recriado do zero conforme auditoria final');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n💥 ERRO FATAL durante o reset:');
    console.error(error);
    process.exit(1);
  } finally {
    // Garantir que conexões são fechadas
    if (adminClient) {
      await adminClient.end();
    }
    if (unificardClient) {
      await unificardClient.end();
    }
  }
}

// Executar o script
main().catch((error) => {
  console.error('Erro não tratado:', error);
  process.exit(1);
});

