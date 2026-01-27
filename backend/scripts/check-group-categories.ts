// Script para verificar group_categories
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../src/core/database/pool';

dotenv.config({ path: join(process.cwd(), '..', '.env') });

async function check() {
  try {
    // Verificar se migration 113 foi executada
    const migrationCheck = await pool.query(`
      SELECT * FROM schema_migrations
      WHERE filename LIKE '%113%'
      ORDER BY executed_at DESC
      LIMIT 1
    `);

    if (migrationCheck.rows.length > 0) {
      console.log('✅ Migration 113 foi executada em:', migrationCheck.rows[0].executed_at);
    } else {
      console.log('❌ Migration 113 NÃO foi executada');
    }

    // Verificar se tabela existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'group_categories'
      ) as exists
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ Tabela group_categories existe');

      // Contar categorias
      const countCheck = await pool.query(`
        SELECT COUNT(*) as count FROM group_categories
      `);

      console.log(`   Categorias na tabela: ${countCheck.rows[0].count}`);

      // Listar categorias
      if (parseInt(countCheck.rows[0].count) > 0) {
        const categories = await pool.query(`
          SELECT category_id, name, slug FROM group_categories ORDER BY created_at
        `);

        console.log('\n📋 Categorias:');
        categories.rows.forEach((cat: any) => {
          console.log(`   - ${cat.name} (${cat.slug}) - ID: ${cat.category_id}`);
        });
      }
    } else {
      console.log('❌ Tabela group_categories NÃO existe');
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

check();
