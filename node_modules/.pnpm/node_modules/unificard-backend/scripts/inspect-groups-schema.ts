// Script para inspecionar o schema REAL da tabela groups
import { pool } from '../src/core/database/pool';
import 'dotenv/config';

async function inspectGroupsSchema() {
  try {
    console.log('🔍 Inspecionando schema REAL da tabela groups...\n');

    // 1. Todas as colunas com detalhes
    const columns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        udt_name
      FROM information_schema.columns
      WHERE table_name = 'groups'
      ORDER BY ordinal_position
    `);

    console.log('📋 COLUNAS DA TABELA groups:');
    console.log('─'.repeat(80));
    columns.rows.forEach((col, idx) => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const type = col.udt_name === 'uuid' ? 'UUID' : 
                   col.udt_name === 'varchar' ? `VARCHAR${maxLength}` :
                   col.udt_name === 'text' ? 'TEXT' :
                   col.udt_name === 'bool' ? 'BOOLEAN' :
                   col.udt_name === 'numeric' ? 'NUMERIC' :
                   col.udt_name === 'timestamptz' ? 'TIMESTAMPTZ' :
                   col.udt_name === 'jsonb' ? 'JSONB' :
                   col.data_type.toUpperCase();
      
      console.log(`${(idx + 1).toString().padStart(2, ' ')}. ${col.column_name.padEnd(25)} ${type.padEnd(20)} ${nullable}${defaultVal}`);
    });

    // 2. Constraints (PK, FK, UNIQUE, CHECK)
    console.log('\n📋 CONSTRAINTS:');
    console.log('─'.repeat(80));
    
    const constraints = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_name = 'groups'
      ORDER BY tc.constraint_type, tc.constraint_name
    `);

    const constraintsByType: Record<string, any[]> = {};
    constraints.rows.forEach(row => {
      if (!constraintsByType[row.constraint_type]) {
        constraintsByType[row.constraint_type] = [];
      }
      constraintsByType[row.constraint_type].push(row);
    });

    Object.entries(constraintsByType).forEach(([type, rows]) => {
      console.log(`\n${type}:`);
      rows.forEach(row => {
        if (row.foreign_table_name) {
          console.log(`  - ${row.constraint_name}: ${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
        } else {
          console.log(`  - ${row.constraint_name}: ${row.column_name}`);
        }
      });
    });

    // 3. Índices
    console.log('\n📋 ÍNDICES:');
    console.log('─'.repeat(80));
    const indexes = await pool.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'groups'
      ORDER BY indexname
    `);

    indexes.rows.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
      console.log(`    ${idx.indexdef}`);
    });

    // 4. Resumo para contrato
    console.log('\n📋 RESUMO PARA CONTRATO DE CRIAÇÃO:');
    console.log('─'.repeat(80));
    console.log('\nColunas OBRIGATÓRIAS (NOT NULL sem DEFAULT):');
    columns.rows
      .filter(col => col.is_nullable === 'NO' && !col.column_default)
      .forEach(col => {
        console.log(`  - ${col.column_name} (${col.udt_name || col.data_type})`);
      });

    console.log('\nColunas OPCIONAIS (NULL ou com DEFAULT):');
    columns.rows
      .filter(col => col.is_nullable === 'YES' || col.column_default)
      .forEach(col => {
        const defaultInfo = col.column_default ? ` [default: ${col.column_default}]` : '';
        console.log(`  - ${col.column_name} (${col.udt_name || col.data_type})${defaultInfo}`);
      });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

inspectGroupsSchema();






