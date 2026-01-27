// Script para adicionar colunas básicas necessárias para migration 090
// Adiciona colunas que a migration 090 espera que existam

import { pool } from '../src/core/database/pool';

async function main() {
  console.log('🔧 Adicionando colunas básicas à tabela events...');
  
  try {
    const client = await pool.connect();
    try {
      // Adicionar colunas que a migration 090 precisa
      const columns = [
        { name: 'event_type', type: 'VARCHAR(50)', default: null },
        { name: 'status', type: 'VARCHAR(20)', default: "'draft'" },
        { name: 'visibility', type: 'VARCHAR(20)', default: "'public'" },
        { name: 'datetime_start', type: 'TIMESTAMPTZ', default: null },
        { name: 'datetime_end', type: 'TIMESTAMPTZ', default: null },
      ];
      
      for (const col of columns) {
        const exists = await client.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = $1
          ) as exists;
        `, [col.name]);
        
        if (!exists.rows[0]?.exists) {
          console.log(`   Adicionando coluna ${col.name}...`);
          let sql = `ALTER TABLE events ADD COLUMN ${col.name} ${col.type}`;
          if (col.default) {
            sql += ` DEFAULT ${col.default}`;
          }
          await client.query(sql);
        } else {
          console.log(`   Coluna ${col.name} já existe`);
        }
      }
      
      // Copiar valores de start_time/end_time para datetime_start/datetime_end se necessário
      const datetimeStartExists = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'events' AND column_name = 'datetime_start'
        ) as exists;
      `);
      
      if (datetimeStartExists.rows[0]?.exists) {
        await client.query(`
          UPDATE events 
          SET datetime_start = start_time 
          WHERE datetime_start IS NULL AND start_time IS NOT NULL;
        `);
        
        await client.query(`
          UPDATE events 
          SET datetime_end = end_time 
          WHERE datetime_end IS NULL AND end_time IS NOT NULL;
        `);
      }
      
      console.log('✅ Colunas básicas adicionadas com sucesso');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Erro ao adicionar colunas:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();














