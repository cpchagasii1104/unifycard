// Script para executar uma única migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MIGRATION_FILE = '018_fix_user_has_permission_rls.sql';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  console.log('🚀 Executando migration:', MIGRATION_FILE);
  
  const migrationPath = path.join(__dirname, 'migrations', MIGRATION_FILE);
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  if (!sql.trim()) {
    console.error('❌ Arquivo de migration vazio');
    process.exit(1);
  }

  const client = await pool.connect();
  
  try {
    await client.query(sql);
    console.log(`✅ Migration ${MIGRATION_FILE} executada com sucesso!`);
  } catch (error) {
    console.error(`❌ Erro ao executar migration ${MIGRATION_FILE}:`);
    console.error(error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('✨ Processo concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });

