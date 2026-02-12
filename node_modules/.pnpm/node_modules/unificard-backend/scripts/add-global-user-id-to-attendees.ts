// Script para adicionar coluna global_user_id à tabela event_attendees

import { pool } from '../src/core/database/pool';

async function main() {
  console.log('🔧 Adicionando coluna global_user_id à tabela event_attendees...');
  
  try {
    const client = await pool.connect();
    try {
      // Verificar se coluna já existe
      const checkResult = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'event_attendees' AND column_name = 'global_user_id'
        ) as exists;
      `);
      
      if (checkResult.rows[0]?.exists) {
        console.log('✅ Coluna global_user_id já existe');
        return;
      }
      
      // Adicionar coluna
      console.log('   Adicionando coluna global_user_id...');
      await client.query(`
        ALTER TABLE event_attendees 
        ADD COLUMN global_user_id UUID;
      `);
      
      console.log('✅ Coluna global_user_id adicionada com sucesso');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Erro ao adicionar coluna:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();














