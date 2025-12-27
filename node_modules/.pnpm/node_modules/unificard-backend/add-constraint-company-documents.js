// add-constraint-company-documents.js
// Script para adicionar a constraint que faltou

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    console.log('🔍 Verificando se constraint existe...');
    
    // Verificar se constraint já existe
    const check = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'company_documents' 
        AND constraint_name = 'company_documents_type_unique'
    `);
    
    if (check.rows.length > 0) {
      console.log('✅ Constraint já existe!');
      process.exit(0);
    }
    
    console.log('📦 Criando índice único parcial (equivalente à constraint)...');
    
    // PostgreSQL não permite constraint UNIQUE parcial diretamente
    // Usar índice único parcial que funciona como constraint
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS company_documents_type_unique
      ON company_documents (company_id, document_type, status)
      WHERE status = 'pending'
    `);
    
    console.log('✅ Índice único criado com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();













