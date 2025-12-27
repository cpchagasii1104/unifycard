#!/usr/bin/env ts-node
/**
 * Script de validação de banco de dados
 * Verifica se UPDATE e GET usam o mesmo banco
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { parse } from 'url';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não está definida no .env');
  process.exit(1);
}

// Parse DATABASE_URL
const urlObj = parse(DATABASE_URL);
const maskedUrl = `${urlObj.protocol}//${urlObj.auth?.split(':')[0]}:****@${urlObj.hostname}:${urlObj.port || '5432'}${urlObj.pathname}`;

console.log('🔍 VALIDAÇÃO DE BANCO DE DADOS');
console.log('='.repeat(60));
console.log(`DATABASE_URL (mascarada): ${maskedUrl}`);
console.log(`Host: ${urlObj.hostname}`);
console.log(`Porta: ${urlObj.port || '5432'}`);
console.log(`Database: ${urlObj.pathname?.substring(1) || 'N/A'}`);
console.log(`User: ${urlObj.auth?.split(':')[0] || 'N/A'}`);
console.log('='.repeat(60));
console.log('');

// Criar pool e testar conexão
const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function validateConnection() {
  try {
    const client = await pool.connect();
    try {
      // Obter informações do banco conectado
      const result = await client.query<{
        current_database: string;
        current_user: string;
        current_schema: string;
        inet_server_addr: string | null;
        inet_server_port: number | null;
      }>(`
        SELECT 
          current_database() as current_database,
          current_user as current_user,
          current_schema() as current_schema,
          inet_server_addr() as inet_server_addr,
          inet_server_port() as inet_server_port
      `);
      
      const dbInfo = result.rows[0];
      
      console.log('✅ CONEXÃO ESTABELECIDA');
      console.log(`   Host conectado: ${dbInfo.inet_server_addr || 'localhost'}`);
      console.log(`   Porta conectada: ${dbInfo.inet_server_port || 5432}`);
      console.log(`   Database conectado: ${dbInfo.current_database}`);
      console.log(`   Schema atual: ${dbInfo.current_schema}`);
      console.log(`   User atual: ${dbInfo.current_user}`);
      console.log('');
      
      // Verificar se corresponde ao .env
      const expectedHost = urlObj.hostname;
      const expectedPort = parseInt(urlObj.port || '5432', 10);
      const expectedDatabase = urlObj.pathname?.substring(1);
      const actualHost = dbInfo.inet_server_addr || 'localhost';
      const actualPort = dbInfo.inet_server_port || 5432;
      const actualDatabase = dbInfo.current_database;
      
      console.log('🔍 VERIFICAÇÃO DE CONSISTÊNCIA:');
      console.log(`   Host: ${actualHost === expectedHost ? '✅' : '❌'} (esperado: ${expectedHost}, atual: ${actualHost})`);
      console.log(`   Porta: ${actualPort === expectedPort ? '✅' : '❌'} (esperado: ${expectedPort}, atual: ${actualPort})`);
      console.log(`   Database: ${actualDatabase === expectedDatabase ? '✅' : '❌'} (esperado: ${expectedDatabase}, atual: ${actualDatabase})`);
      console.log('');
      
      if (actualHost !== expectedHost || actualPort !== expectedPort || actualDatabase !== expectedDatabase) {
        console.warn('⚠️  ATENÇÃO: Diferença detectada entre .env e conexão real!');
        console.warn('   Isso pode causar problemas de persistência de dados.');
      }
      
      // Verificar se há múltiplas instâncias do Postgres
      console.log('🔍 VERIFICANDO PROCESSOS POSTGRES:');
      console.log('   (Execute manualmente: Get-Process | Where-Object { $_.ProcessName -like "*postgres*" })');
      console.log('');
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ ERRO ao conectar ao banco:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

validateConnection().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});












