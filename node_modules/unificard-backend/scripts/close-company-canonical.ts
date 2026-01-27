/**
 * UNIFICARD — LIMPEZA CANÔNICA DE EMPRESA (TypeScript)
 * 
 * Script para tornar uma empresa TOTALMENTE INOPERANTE e invisível,
 * sem violar o Database Canonical Truth Contract.
 * 
 * REGRAS ABSOLUTAS:
 * - NÃO apaga eventos, audit logs ou decisões históricas
 * - NÃO truncar tabelas append-only
 * - NÃO reescrever passado
 * - NÃO criar atalhos fora do core
 * 
 * USO:
 *   npm run ts-node backend/scripts/close-company-canonical.ts <company_id|CNPJ>
 * 
 * Exemplo:
 *   npm run ts-node backend/scripts/close-company-canonical.ts 32.121.543/0001-53
 */

import { pool } from '../src/core/database/pool';

interface CloseCompanyResult {
  company_id: string;
  company_name: string;
  status_before: string;
  status_after: string;
  actions_taken: any[];
}

async function closeCompanyCanonical(identifier: string): Promise<CloseCompanyResult> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Executar função SQL
    const result = await client.query<CloseCompanyResult>(
      `SELECT * FROM close_company_canonical($1)`,
      [identifier]
    );
    
    await client.query('COMMIT');
    
    if (result.rows.length === 0) {
      throw new Error(`Empresa não encontrada: ${identifier}`);
    }
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// EXECUÇÃO
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Erro: Forneça company_id ou CNPJ como argumento');
    console.error('');
    console.error('Uso:');
    console.error('  npm run ts-node backend/scripts/close-company-canonical.ts <company_id|CNPJ>');
    console.error('');
    console.error('Exemplos:');
    console.error('  npm run ts-node backend/scripts/close-company-canonical.ts 32.121.543/0001-53');
    console.error('  npm run ts-node backend/scripts/close-company-canonical.ts 550e8400-e29b-41d4-a716-446655440000');
    process.exit(1);
  }
  
  const identifier = args[0];
  
  console.log('🔒 Iniciando fechamento canônico de empresa...');
  console.log(`   Identificador: ${identifier}`);
  console.log('');
  
  try {
    const result = await closeCompanyCanonical(identifier);
    
    console.log('✅ Empresa fechada canonicamente:');
    console.log(`   ID: ${result.company_id}`);
    console.log(`   Nome: ${result.company_name}`);
    console.log(`   Status anterior: ${result.status_before}`);
    console.log(`   Status atual: ${result.status_after}`);
    console.log('');
    console.log('📋 Ações executadas:');
    
    if (Array.isArray(result.actions_taken)) {
      result.actions_taken.forEach((action: any) => {
        console.log(`   - ${action.action}: ${action.count} registro(s)`);
      });
    } else {
      console.log('   (nenhuma ação adicional necessária)');
    }
    
    console.log('');
    console.log('✅ Limpeza canônica concluída com sucesso!');
    console.log('');
    console.log('⚠️  IMPORTANTE:');
    console.log('   - A empresa está TOTALMENTE INOPERANTE');
    console.log('   - Não pode ser usada para absolutamente nada');
    console.log('   - Nenhuma ação pode ser executada por ela');
    console.log('   - O histórico permanece auditável');
    console.log('   - O sistema continua consistente com o core');
    
  } catch (error: any) {
    console.error('❌ Erro ao fechar empresa:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main();
}

export { closeCompanyCanonical };

