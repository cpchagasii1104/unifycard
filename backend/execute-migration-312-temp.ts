// Script temporário para executar migration 312
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function executeMigration312() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Conectando ao banco...');
    
    // Ler o arquivo SQL
    const sqlPath = join(__dirname, 'migrations', '312_tenant_default_context_permissions.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    console.log('📝 Executando migration 312...');
    
    // Executar o SQL completo
    await pool.query(sql);
    
    console.log('✅ Migration 312 executada com sucesso!');
    
    // Validar: verificar se tabela existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tenant_contexts'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Tabela tenant_contexts criada com sucesso');
    } else {
      console.error('❌ Tabela tenant_contexts NÃO foi criada');
    }
    
    // Validar: verificar se migration está registrada
    const migrationCheck = await pool.query(`
      SELECT filename FROM schema_migrations 
      WHERE filename = '312_tenant_default_context_permissions.sql';
    `);
    
    if (migrationCheck.rows.length > 0) {
      console.log('✅ Migration registrada em schema_migrations');
    } else {
      console.error('❌ Migration NÃO está registrada em schema_migrations');
    }
    
    // Validar: verificar dados na tabela
    const dataCheck = await pool.query(`
      SELECT COUNT(*) as count FROM tenant_contexts;
    `);
    
    console.log(`📊 Total de registros em tenant_contexts: ${dataCheck.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

executeMigration312()
  .then(() => {
    console.log('✅ Processo concluído');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Falha no processo:', error);
    process.exit(1);
  });

