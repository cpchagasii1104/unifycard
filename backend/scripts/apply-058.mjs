import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = readFileSync(
  join(__dirname, '../migrations/058_fix_categories_slug_unique_constraint.sql'),
  'utf8'
);

const client = await pool.connect();

try {
  console.log('📋 Aplicando migration 058...');
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('✅ Migration 058 aplicada com sucesso!');
  
  const result = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'categories' 
    AND indexname LIKE '%slug%parent%'
    ORDER BY indexname
  `);
  
  console.log('\n=== ÍNDICES CRIADOS ===');
  result.rows.forEach(row => {
    console.log(`${row.indexname}:`);
    console.log(`  ${row.indexdef.substring(0, 100)}...\n`);
  });
} catch (error) {
  await client.query('ROLLBACK');
  console.error('❌ Erro:', error.message);
  throw error;
} finally {
  client.release();
  await pool.end();
}















