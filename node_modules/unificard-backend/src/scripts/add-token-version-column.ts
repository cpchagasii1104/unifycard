// Script para adicionar coluna token_version se não existir
// Executa diretamente a migration 089 sem passar pelo sistema de migrations

import dotenv from 'dotenv';
import { join } from 'path';
import { Pool } from 'pg';

dotenv.config({ path: join(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addTokenVersionColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando se coluna token_version existe...');
    
    // Verificar se a coluna já existe
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'token_version'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Coluna token_version já existe na tabela users');
      return;
    }
    
    console.log('📝 Adicionando coluna token_version...');
    
    // Executar migration 089
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0
    `);
    
    await client.query(`
      COMMENT ON COLUMN users.token_version IS
        'Versão do token JWT para invalidação de sessões (logout global)'
    `);
    
    console.log('✅ Coluna token_version adicionada com sucesso');
    
  } catch (error: any) {
    if (error.code === '28P01') {
      console.error('❌ Erro de autenticação PostgreSQL');
      console.error('   Verifique se DATABASE_URL no .env está correto');
      console.error('   Formato esperado: postgresql://usuario:senha@host:porta/database');
      console.error('');
      console.error('   Exemplo válido:');
      console.error('   DATABASE_URL=postgresql://postgres:senha123@localhost:5432/unificard_dev');
    } else {
      console.error('❌ Erro ao adicionar coluna:', error.message);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addTokenVersionColumn()
  .then(() => {
    console.log('✅ Processo concluído');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });





