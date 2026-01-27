// Script para verificar se migration 124 foi executada
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../src/core/database/pool';

dotenv.config({ path: join(process.cwd(), '..', '.env') });

async function checkMigration() {
  try {
    // Verificar se tabela schema_migrations existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'schema_migrations'
      ) as exists
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Tabela schema_migrations não existe');
      return;
    }

    // Verificar se migration 124 foi executada
    const migrationCheck = await pool.query(`
      SELECT * FROM schema_migrations
      WHERE filename LIKE '%124%'
      ORDER BY executed_at DESC
      LIMIT 1
    `);

    if (migrationCheck.rows.length > 0) {
      console.log('✅ Migration 124 foi executada em:', migrationCheck.rows[0].executed_at);
      console.log('   Arquivo:', migrationCheck.rows[0].filename);
    } else {
      console.log('❌ Migration 124 NÃO foi executada');
    }

    // Verificar se coluna audience_description existe
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'groups' AND column_name = 'audience_description'
      ) as exists
    `);

    if (columnCheck.rows[0].exists) {
      console.log('✅ Coluna audience_description existe na tabela groups');
    } else {
      console.log('❌ Coluna audience_description NÃO existe na tabela groups');
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

checkMigration();
