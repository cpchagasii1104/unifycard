// src/scripts/ensure-token-version-column.ts
//
// Script para garantir que a coluna users.token_version existe no banco
// Verifica schema real via information_schema e cria a coluna se necessário
// NÃO depende de schema_migrations - valida apenas o schema real

import dotenv from 'dotenv';
import { join } from 'path';
import { Pool } from 'pg';
import { columnExists } from '../core/database/schema-validator';

dotenv.config({ path: join(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function ensureTokenVersionColumn(): Promise<void> {
  console.log('🔍 Verificando schema real do banco de dados...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    // Verificar conexão
    await client.query('SELECT 1');
    console.log('✔ Conexão com banco de dados estabelecida\n');

    // Verificar se coluna existe usando information_schema (schema real)
    console.log('📋 Verificando se coluna users.token_version existe...');
    const exists = await columnExists('users', 'token_version');

    if (exists) {
      console.log('✅ Coluna users.token_version já existe no banco de dados\n');
      
      // Verificar detalhes da coluna
      const columnInfo = await client.query<{
        column_name: string;
        data_type: string;
        column_default: string | null;
        is_nullable: string;
      }>(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'token_version'
      `);

      if (columnInfo.rows.length > 0) {
        const col = columnInfo.rows[0];
        console.log('📊 Detalhes da coluna:');
        console.log(`   Nome: ${col.column_name}`);
        console.log(`   Tipo: ${col.data_type}`);
        console.log(`   Default: ${col.column_default || 'NULL'}`);
        console.log(`   Nullable: ${col.is_nullable}\n`);
      }

      process.exit(0);
    }

    // Coluna não existe - criar
    console.log('⚠️  Coluna users.token_version NÃO existe no banco de dados');
    console.log('📦 Criando coluna users.token_version...\n');

    await client.query(`
      ALTER TABLE users
      ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0
    `);

    console.log('✅ Coluna users.token_version criada com sucesso!\n');

    // Limpar cache do schema-validator ANTES de verificar novamente
    const { clearColumnCache } = await import('../core/database/schema-validator');
    clearColumnCache();

    // Verificar novamente diretamente no banco (sem cache)
    const verifyResult = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'token_version'
      ) as exists
    `);

    const existsAfter = verifyResult.rows[0]?.exists || false;
    if (existsAfter) {
      console.log('✅ Confirmação: Coluna users.token_version existe no banco de dados\n');
    } else {
      console.error('❌ Erro: Coluna não foi criada corretamente\n');
      process.exit(1);
    }

    console.log('✨ Schema atualizado com sucesso!');
    console.log('   O sistema agora pode usar token_version para invalidação de tokens.\n');

  } catch (error) {
    console.error('\n💥 Erro ao verificar/criar coluna:');
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar
ensureTokenVersionColumn().catch((error) => {
  console.error('Erro não tratado:', error);
  process.exit(1);
});

