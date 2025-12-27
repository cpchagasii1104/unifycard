// src/scripts/run-single-migration.ts
// Script para executar uma migration específica diretamente

import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Pool } from 'pg';

dotenv.config({ path: join(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration(filename: string) {
  const migrationPath = join(process.cwd(), 'migrations', filename);
  
  console.log(`📦 Executando migração: ${filename}`);
  
  const sql = await readFile(migrationPath, 'utf-8');
  
  const client = await pool.connect();
  
  try {
    await client.query(sql);
    console.log(`✅ Migração concluída: ${filename}`);
  } catch (error) {
    console.error(`❌ Erro ao executar migração ${filename}:`);
    console.error(error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error('❌ Uso: ts-node run-single-migration.ts <nome-do-arquivo.sql>');
    console.error('   Exemplo: ts-node run-single-migration.ts 073_company_status_and_documents.sql');
    process.exit(1);
  }
  
  try {
    await runMigration(migrationFile);
    console.log('✨ Migração aplicada com sucesso!');
  } catch (error) {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();













