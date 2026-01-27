// Script para verificar se tabela events existe e criar se necessário

import { pool } from '../src/core/database/pool';

async function main() {
  console.log('🔍 Verificando se tabela events existe...');
  
  try {
    const client = await pool.connect();
    try {
      // Verificar se existe
      const checkResult = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'events'
        ) as exists;
      `);
      
      const exists = checkResult.rows[0]?.exists;
      
      if (exists) {
        console.log('✅ Tabela events já existe');
        
        // Mostrar estrutura
        const columns = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'events'
          ORDER BY ordinal_position;
        `);
        
        console.log('\n📋 Colunas da tabela events:');
        columns.rows.forEach((col: any) => {
          console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        });
      } else {
        console.log('❌ Tabela events NÃO existe');
        console.log('   Execute: npx ts-node scripts/create-events-table-fix.ts');
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Erro ao verificar tabela events:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();














