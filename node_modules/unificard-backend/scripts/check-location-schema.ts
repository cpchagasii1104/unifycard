// Script para verificar schema atual das tabelas de localização
import { pool } from '../src/core/database/pool';
import 'dotenv/config';

async function checkLocationSchema() {
  console.log('🔍 Verificando schema das tabelas de localização...\n');

  try {
    // Verificar colunas de countries
    const countriesCols = await pool.query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'countries' 
       ORDER BY ordinal_position`
    );
    console.log('📋 Colunas da tabela countries:');
    countriesCols.rows.forEach(col => {
      console.log(`   - ${col.column_name}`);
    });

    // Verificar colunas de states
    const statesCols = await pool.query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'states' 
       ORDER BY ordinal_position`
    );
    console.log('\n📋 Colunas da tabela states:');
    statesCols.rows.forEach(col => {
      console.log(`   - ${col.column_name}`);
    });

    // Verificar se migration 116 foi executada
    const migration116 = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count 
       FROM schema_migrations 
       WHERE filename LIKE '%116%'`
    );
    console.log(`\n📋 Migration 116 executada: ${migration116.rows[0]?.count !== '0' ? 'SIM' : 'NÃO'}`);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

checkLocationSchema();







