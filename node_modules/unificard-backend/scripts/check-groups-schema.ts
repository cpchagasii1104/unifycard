// Script para verificar schema da tabela groups
import { pool } from '../src/core/database/pool';
import 'dotenv/config';

async function checkGroupsSchema() {
  try {
    // Verificar colunas relacionadas a categoria
    const categoryCols = await pool.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'groups' AND column_name LIKE '%categor%' 
       ORDER BY column_name`
    );
    
    console.log('📋 Colunas relacionadas a categoria:');
    if (categoryCols.rows.length === 0) {
      console.log('   ⚠️  Nenhuma coluna encontrada com "categor" no nome');
    } else {
      categoryCols.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
      });
    }

    // Listar todas as colunas
    const allCols = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'groups' 
       ORDER BY column_name`
    );
    
    console.log('\n📋 Todas as colunas da tabela groups:');
    allCols.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    // Verificar se a migration 113 foi executada
    const migrationCheck = await pool.query(
      `SELECT filename FROM schema_migrations WHERE filename LIKE '%113%' OR filename LIKE '%groups%' ORDER BY filename`
    );
    
    console.log('\n📋 Migrations relacionadas a groups:');
    migrationCheck.rows.forEach(row => {
      console.log(`   - ${row.filename}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

checkGroupsSchema();






