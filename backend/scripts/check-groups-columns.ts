// Script para verificar colunas específicas da tabela groups
import { pool } from '../src/core/database/pool';
import 'dotenv/config';

async function checkGroupsColumns() {
  try {
    const columns = [
      'scope',
      'country_id',
      'state_id',
      'city_id',
      'neighborhood',
      'rules_text',
      'visibility',
      'category_id',
      'slug'
    ];

    const result = await pool.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'groups' 
       AND column_name = ANY($1::text[])
       ORDER BY column_name`,
      [columns]
    );

    console.log('📋 Colunas verificadas:');
    if (result.rows.length === 0) {
      console.log('   ⚠️  Nenhuma das colunas verificadas foi encontrada');
    } else {
      result.rows.forEach(row => {
        console.log(`   ✅ ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
      });
    }

    // Verificar quais estão faltando
    const found = result.rows.map(r => r.column_name);
    const missing = columns.filter(c => !found.includes(c));
    if (missing.length > 0) {
      console.log('\n⚠️  Colunas faltando:');
      missing.forEach(col => console.log(`   - ${col}`));
    }

    // Verificar se migration 114 foi executada
    const migrationCheck = await pool.query(
      `SELECT filename FROM schema_migrations WHERE filename LIKE '%114%' OR filename LIKE '%groups_community%'`
    );
    
    console.log('\n📋 Migration 114:');
    if (migrationCheck.rows.length === 0) {
      console.log('   ⚠️  Migration 114 não foi executada');
    } else {
      console.log('   ✅ Migration 114 executada:', migrationCheck.rows[0].filename);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

checkGroupsColumns();






