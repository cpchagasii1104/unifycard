// src/scripts/validate-core-only.ts
//
// Script de validação: Subida limpa do banco com profile CORE_ONLY
//
// OBJETIVO:
// - Validar que banco sobe limpo com profile CORE_ONLY
// - Verificar que nenhuma tabela de rides/work foi criada
// - Verificar que nenhum dado demo foi criado
// - Garantir que reexecução não gera erro

import dotenv from 'dotenv';
import { join } from 'path';
import { Pool, Client } from 'pg';
import { execSync } from 'child_process';

// Carrega variáveis de ambiente
dotenv.config({ path: join(process.cwd(), '.env') });

// Valida se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Verifica se tabelas de módulos latentes existem
 */
async function checkLatentModuleTables(): Promise<{
  ridesTables: string[];
  workTables: string[];
}> {
  const client = await pool.connect();
  try {
    // Verificar tabelas de rides
    const ridesResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename LIKE 'rides_%'
      ORDER BY tablename
    `);

    // Verificar tabelas de work
    const workResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename LIKE 'work_%'
        OR tablename LIKE 'workers'
        OR tablename LIKE 'jobs'
        OR tablename LIKE 'applications'
      ORDER BY tablename
    `);

    return {
      ridesTables: ridesResult.rows.map((r) => r.tablename),
      workTables: workResult.rows.map((r) => r.tablename),
    };
  } finally {
    client.release();
  }
}

/**
 * Verifica se dados demo foram criados
 */
async function checkDemoData(): Promise<{
  demoTenants: number;
  demoUsers: number;
}> {
  const client = await pool.connect();
  try {
    // Verificar tenants demo
    const tenantsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM tenants
      WHERE slug LIKE '%demo%' OR slug LIKE '%test%'
    `);

    // Verificar users demo
    const usersResult = await client.query(`
      SELECT COUNT(*) as count
      FROM users
      WHERE email LIKE '%demo%' OR email LIKE '%test%' OR email LIKE '%@cidadenova.demo%'
    `);

    return {
      demoTenants: parseInt(tenantsResult.rows[0]?.count || '0', 10),
      demoUsers: parseInt(usersResult.rows[0]?.count || '0', 10),
    };
  } finally {
    client.release();
  }
}

/**
 * Verifica migrations executadas
 */
async function checkMigrations(): Promise<{
  totalCents: number;
  latentMigrations: string[];
}> {
  const client = await pool.connect();
  try {
    // Verificar total de migrations
    const totalResult = await client.query(`
      SELECT COUNT(*) as count
      FROM schema_migrations
    `);

    // Verificar migrations latentes (não devem estar executadas)
    const latentMigrations = [
      '005_unifywork.sql',
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
    ];

    const executedLatent = await client.query(`
      SELECT filename
      FROM schema_migrations
      WHERE filename = ANY($1)
    `, [latentMigrations]);

    return {
      totalCents: parseInt(totalResult.rows[0]?.count || '0', 10),
      latentMigrations: executedLatent.rows.map((r) => r.filename),
    };
  } finally {
    client.release();
  }
}

/**
 * Executa migrations com profile CORE_ONLY
 */
async function runMigrations(): Promise<void> {
  console.log('📦 Executando migrations com profile CORE_ONLY...\n');
  
  // Garantir que MIGRATION_PROFILE está definido como CORE_ONLY
  process.env.MIGRATION_PROFILE = 'CORE_ONLY';
  
  // Garantir que RUN_SEEDS não está definido (não executar seeds)
  delete process.env.RUN_SEEDS;
  
  try {
    execSync('pnpm migrate', {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        MIGRATION_PROFILE: 'CORE_ONLY',
        RUN_SEEDS: undefined,
      },
    });
    console.log('\n✅ Migrations executadas com sucesso\n');
  } catch (error) {
    console.error('\n❌ Erro ao executar migrations:');
    console.error(error);
    throw error;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  VALIDAÇÃO: Subida Limpa do Banco com CORE_ONLY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Verificar conexão
    const testClient = await pool.connect();
    try {
      await testClient.query('SELECT 1');
      console.log('✔ Conexão com banco de dados estabelecida\n');
    } finally {
      testClient.release();
    }

    // PASSO 1: Executar migrations com CORE_ONLY
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  PASSO 1: Executar Migrations (CORE_ONLY)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    
    await runMigrations();

    // PASSO 2: Verificar tabelas de módulos latentes
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  PASSO 2: Verificar Tabelas de Módulos Latentes');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    const { ridesTables, workTables } = await checkLatentModuleTables();

    if (ridesTables.length > 0) {
      console.error(`❌ FALHA: ${ridesTables.length} tabela(s) de rides encontrada(s):`);
      ridesTables.forEach((t) => console.error(`   - ${t}`));
      process.exit(1);
    }

    if (workTables.length > 0) {
      console.error(`❌ FALHA: ${workTables.length} tabela(s) de work encontrada(s):`);
      workTables.forEach((t) => console.error(`   - ${t}`));
      process.exit(1);
    }

    console.log('✅ Nenhuma tabela de módulos latentes encontrada');
    console.log(`   Rides: ${ridesTables.length} tabelas`);
    console.log(`   Work: ${workTables.length} tabelas\n`);

    // PASSO 3: Verificar dados demo
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  PASSO 3: Verificar Dados Demo');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    const { demoTenants, demoUsers } = await checkDemoData();

    if (demoTenants > 0 || demoUsers > 0) {
      console.error(`❌ FALHA: Dados demo encontrados:`);
      console.error(`   Tenants demo: ${demoTenants}`);
      console.error(`   Users demo: ${demoUsers}`);
      process.exit(1);
    }

    console.log('✅ Nenhum dado demo encontrado');
    console.log(`   Tenants demo: ${demoTenants}`);
    console.log(`   Users demo: ${demoUsers}\n`);

    // PASSO 4: Verificar migrations executadas
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  PASSO 4: Verificar Migrations Executadas');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    const { total, latentMigrations } = await checkMigrations();

    if (latentMigrations.length > 0) {
      console.error(`❌ FALHA: ${latentMigrations.length} migration(s) latente(s) executada(s):`);
      latentMigrations.forEach((m) => console.error(`   - ${m}`));
      process.exit(1);
    }

    console.log(`✅ Total de migrations executadas: ${total}`);
    console.log(`✅ Nenhuma migration latente executada\n`);

    // PASSO 5: Reexecutar migrations (teste de idempotência)
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  PASSO 5: Reexecutar Migrations (Teste de Idempotência)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    await runMigrations();

    console.log('✅ Reexecução concluída sem erros (idempotência validada)\n');

    // RELATÓRIO FINAL
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  RELATÓRIO FINAL');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO');
    console.log('');
    console.log('✅ Banco sobe limpo com profile CORE_ONLY');
    console.log('✅ Nenhuma tabela de módulos latentes criada');
    console.log('✅ Nenhum dado demo criado');
    console.log('✅ Migrations são idempotentes');
    console.log('✅ Reexecução não gera erro');
    console.log('');

  } catch (error) {
    console.error('\n💥 ERRO FATAL durante a validação:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar o script
main().catch((error) => {
  console.error('Erro não tratado:', error);
  process.exit(1);
});















