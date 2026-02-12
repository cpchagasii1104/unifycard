// Script para validar schema da FASE 10

import { pool } from '../src/core/database/pool';

const REQUIRED_TABLES = [
  'event_escrow',
  'event_escrow_transactions',
  'actor_scores',
  'actor_score_history',
  'actor_penalties',
  'actor_debts',
  'event_participants',
  'event_check_ins',
];

const REQUIRED_COLUMNS = {
  events: ['split_processed', 'split_processed_at'],
};

async function main() {
  console.log('🔍 Validando schema da FASE 10...\n');
  
  try {
    const client = await pool.connect();
    try {
      let allValid = true;
      
      // Verificar tabelas
      console.log('📋 Verificando tabelas...');
      for (const table of REQUIRED_TABLES) {
        const result = await client.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = $1
          ) as exists;
        `, [table]);
        
        if (result.rows[0]?.exists) {
          console.log(`   ✅ ${table}`);
        } else {
          console.log(`   ❌ ${table} - NÃO EXISTE`);
          allValid = false;
        }
      }
      
      // Verificar colunas
      console.log('\n📋 Verificando colunas...');
      for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
        for (const column of columns) {
          const result = await client.query(`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = $1 AND column_name = $2
            ) as exists;
          `, [table, column]);
          
          if (result.rows[0]?.exists) {
            console.log(`   ✅ ${table}.${column}`);
          } else {
            console.log(`   ❌ ${table}.${column} - NÃO EXISTE`);
            allValid = false;
          }
        }
      }
      
      // Verificar constraints do escrow
      console.log('\n📋 Verificando constraints do escrow...');
      const escrowStatus = await client.query(`
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%escrow%status%';
      `);
      
      if (escrowStatus.rows.length > 0) {
        console.log(`   ✅ Constraints de status do escrow encontradas`);
      } else {
        console.log(`   ⚠️  Constraints de status do escrow não encontradas`);
      }
      
      console.log('\n' + '='.repeat(50));
      if (allValid) {
        console.log('✅ SCHEMA VALIDADO - Todas as tabelas e colunas necessárias existem');
      } else {
        console.log('❌ SCHEMA INCOMPLETO - Algumas tabelas/colunas estão faltando');
      }
      console.log('='.repeat(50));
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Erro ao validar schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();














