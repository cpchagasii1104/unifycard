// backend/scripts/analyze-query-plans.ts
// Script para analisar planos de execução de queries críticas
// Verifica uso de índices tenant-aware e identifica Seq Scans indevidos

import { pool } from '../src/core/database/pool';

interface QueryPlan {
  query: string;
  table: string;
  operation: string;
  indexName: string | null;
  cost: number;
  rows: number;
  actualTime?: number;
  hasSeqScan: boolean;
  hasIndexScan: boolean;
  hasIndexOnlyScan: boolean;
}

interface QueryAnalysis {
  queryName: string;
  sql: string;
  params: any[];
  plan: QueryPlan[];
  hasSeqScan: boolean;
  hasIndexScan: boolean;
  recommendation: string;
}

// Queries críticas para análise
const CRITICAL_QUERIES: Array<{
  name: string;
  sql: string;
  params: any[];
  description: string;
}> = [
  // ACTORS
  {
    name: 'actors.findById',
    sql: `
      SELECT * FROM actors 
      WHERE tenant_id = $1 AND actor_id = $2 
      LIMIT 1
    `,
    params: ['test-tenant-id', 'test-actor-id'],
    description: 'Busca actor por tenant_id + actor_id',
  },
  {
    name: 'actors.findByUserId',
    sql: `
      SELECT * FROM actors 
      WHERE tenant_id = $1 AND user_id = $2 
      LIMIT 1
    `,
    params: ['test-tenant-id', 'test-user-id'],
    description: 'Busca actor por tenant_id + user_id',
  },
  
  // COMPANIES
  {
    name: 'companies.getCompanyById',
    sql: `
      SELECT * FROM companies 
      WHERE tenant_id = $1 AND company_id = $2::uuid 
      LIMIT 1
    `,
    params: ['test-tenant-id', '00000000-0000-0000-0000-000000000000'],
    description: 'Busca empresa por tenant_id + company_id',
  },
  {
    name: 'companies.listByGlobalUserId',
    sql: `
      SELECT * FROM companies 
      WHERE tenant_id = $1 AND global_user_id = $2::uuid
      ORDER BY created_at DESC
    `,
    params: ['test-tenant-id', '00000000-0000-0000-0000-000000000000'],
    description: 'Lista empresas por tenant_id + global_user_id',
  },
  {
    name: 'companies.findByCNPJ',
    sql: `
      SELECT company_id FROM companies 
      WHERE tenant_id = $1 AND global_user_id = $2::uuid AND cnpj = $3
      LIMIT 1
    `,
    params: ['test-tenant-id', '00000000-0000-0000-0000-000000000000', '12345678000190'],
    description: 'Busca empresa por tenant_id + global_user_id + cnpj',
  },
  
  // BANK_ACCOUNTS
  {
    name: 'bank_accounts.getAccountById',
    sql: `
      SELECT * FROM bank_accounts 
      WHERE tenant_id = $1 AND account_id = $2::uuid 
      LIMIT 1
    `,
    params: ['test-tenant-id', '00000000-0000-0000-0000-000000000000'],
    description: 'Busca conta bancária por tenant_id + account_id',
  },
  {
    name: 'bank_accounts.getByOwner',
    sql: `
      SELECT * FROM bank_accounts 
      WHERE tenant_id = $1 AND owner_id = $2::uuid
      ORDER BY created_at DESC
    `,
    params: ['test-tenant-id', '00000000-0000-0000-0000-000000000000'],
    description: 'Lista contas por tenant_id + owner_id',
  },
  
  // BANK_LEDGER
  {
    name: 'bank_ledger.getEntriesByAccount',
    sql: `
      SELECT * FROM bank_ledger 
      WHERE tenant_id = $1 AND account_id = $2::uuid
      ORDER BY timestamp DESC
    `,
    params: ['test-tenant-id', '00000000-0000-0000-0000-000000000000'],
    description: 'Lista entradas do ledger por tenant_id + account_id',
  },
  {
    name: 'bank_ledger.getEntriesByTransaction',
    sql: `
      SELECT * FROM bank_ledger 
      WHERE tenant_id = $1 AND transaction_id = $2::uuid
      ORDER BY timestamp DESC
    `,
    params: ['test-tenant-id', '00000000-0000-0000-0000-000000000000'],
    description: 'Lista entradas do ledger por tenant_id + transaction_id',
  },
  {
    name: 'bank_ledger.calculateBalance',
    sql: `
      SELECT COALESCE(SUM(amount), 0) as balance 
      FROM bank_ledger 
      WHERE tenant_id = $1 AND account_id = $2::uuid
    `,
    params: ['test-tenant-id', '00000000-0000-0000-0000-000000000000'],
    description: 'Calcula saldo por tenant_id + account_id',
  },
];

/**
 * Analisa plano de execução de uma query
 */
async function analyzeQueryPlan(
  queryName: string,
  sql: string,
  params: any[]
): Promise<QueryAnalysis> {
  console.log(`\n📊 Analisando: ${queryName}`);
  
  // Executar EXPLAIN ANALYZE
  const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
  
  try {
    const result = await pool.query(explainSql, params);
    const planJson = result.rows[0]?.explain || result.rows[0]?.'QUERY PLAN';
    
    if (!planJson) {
      throw new Error('Plano de execução não encontrado');
    }
    
    // Parse do JSON do plano
    const plan = Array.isArray(planJson) ? planJson[0] : JSON.parse(planJson);
    
    // Extrair informações do plano
    const queryPlan: QueryPlan[] = [];
    let hasSeqScan = false;
    let hasIndexScan = false;
    let hasIndexOnlyScan = false;
    
    function traversePlan(node: any, depth: number = 0): void {
      if (!node) return;
      
      const operation = node['Node Type'] || node.node_type || '';
      const indexName = node['Index Name'] || node.index_name || null;
      const tableName = node['Relation Name'] || node.relation_name || '';
      const cost = node['Total Cost'] || node.total_cost || 0;
      const rows = node['Actual Rows'] || node.actual_rows || node['Plan Rows'] || node.plan_rows || 0;
      const actualTime = node['Actual Total Time'] || node.actual_total_time;
      
      if (operation.includes('Seq Scan')) {
        hasSeqScan = true;
      }
      if (operation.includes('Index Scan')) {
        hasIndexScan = true;
      }
      if (operation.includes('Index Only Scan')) {
        hasIndexOnlyScan = true;
      }
      
      queryPlan.push({
        query: queryName,
        table: tableName,
        operation,
        indexName,
        cost,
        rows,
        actualTime,
        hasSeqScan: operation.includes('Seq Scan'),
        hasIndexScan: operation.includes('Index Scan'),
        hasIndexOnlyScan: operation.includes('Index Only Scan'),
      });
      
      // Recursivamente processar planos filhos
      if (node.Plans && Array.isArray(node.Plans)) {
        node.Plans.forEach((child: any) => traversePlan(child, depth + 1));
      }
    }
    
    traversePlan(plan.Plan || plan);
    
    // Gerar recomendação
    let recommendation = '';
    if (hasSeqScan && !hasIndexScan && !hasIndexOnlyScan) {
      recommendation = '❌ CRÍTICO: Query usa Seq Scan. Criar índice tenant-aware.';
    } else if (hasSeqScan && (hasIndexScan || hasIndexOnlyScan)) {
      recommendation = '⚠️ ATENÇÃO: Query usa Seq Scan em algum ponto. Verificar se pode ser otimizado.';
    } else if (hasIndexScan || hasIndexOnlyScan) {
      recommendation = '✅ OK: Query usa Index Scan. Performance adequada.';
    } else {
      recommendation = '⚠️ ATENÇÃO: Tipo de scan não identificado. Verificar manualmente.';
    }
    
    return {
      queryName,
      sql,
      params,
      plan: queryPlan,
      hasSeqScan,
      hasIndexScan: hasIndexScan || hasIndexOnlyScan,
      recommendation,
    };
  } catch (error: any) {
    console.error(`❌ Erro ao analisar query ${queryName}:`, error.message);
    return {
      queryName,
      sql,
      params,
      plan: [],
      hasSeqScan: false,
      hasIndexScan: false,
      recommendation: `❌ ERRO: ${error.message}`,
    };
  }
}

/**
 * Gera relatório de análise
 */
function generateReport(analyses: QueryAnalysis[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RELATÓRIO DE ANÁLISE DE QUERY PLANS');
  console.log('='.repeat(80));
  
  const criticalIssues = analyses.filter(a => a.hasSeqScan && !a.hasIndexScan);
  const warnings = analyses.filter(a => a.hasSeqScan && a.hasIndexScan);
  const ok = analyses.filter(a => !a.hasSeqScan && a.hasIndexScan);
  
  console.log(`\n📊 Resumo:`);
  console.log(`  ✅ Queries OK: ${ok.length}`);
  console.log(`  ⚠️  Queries com warnings: ${warnings.length}`);
  console.log(`  ❌ Queries críticas: ${criticalIssues.length}`);
  
  if (criticalIssues.length > 0) {
    console.log(`\n❌ QUERIES CRÍTICAS (Seq Scan sem Index Scan):`);
    criticalIssues.forEach(analysis => {
      console.log(`\n  ${analysis.queryName}`);
      console.log(`  SQL: ${analysis.sql.trim()}`);
      console.log(`  ${analysis.recommendation}`);
      if (analysis.plan.length > 0) {
        console.log(`  Plano:`);
        analysis.plan.forEach(p => {
          console.log(`    - ${p.operation} on ${p.table}${p.indexName ? ` using ${p.indexName}` : ''} (cost: ${p.cost}, rows: ${p.rows})`);
        });
      }
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  QUERIES COM WARNINGS:`);
    warnings.forEach(analysis => {
      console.log(`\n  ${analysis.queryName}`);
      console.log(`  ${analysis.recommendation}`);
    });
  }
  
  console.log(`\n✅ QUERIES OK:`);
  ok.forEach(analysis => {
    console.log(`  ✓ ${analysis.queryName}`);
  });
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Verifica índices existentes
 */
async function checkIndexes(): Promise<void> {
  console.log('\n🔍 Verificando índices tenant-aware existentes...\n');
  
  const tables = ['actors', 'companies', 'bank_accounts', 'bank_ledger'];
  
  for (const table of tables) {
    const result = await pool.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = $1
        AND indexdef LIKE '%tenant_id%'
      ORDER BY indexname
    `, [table]);
    
    if (result.rows.length > 0) {
      console.log(`📑 ${table}:`);
      result.rows.forEach(row => {
        console.log(`  - ${row.indexname}`);
        console.log(`    ${row.indexdef}`);
      });
    } else {
      console.log(`⚠️  ${table}: Nenhum índice tenant-aware encontrado`);
    }
  }
}

/**
 * Função principal
 */
async function main(): Promise<void> {
  console.log('🚀 Iniciando análise de query plans...\n');
  
  try {
    // Verificar índices existentes
    await checkIndexes();
    
    // Analisar queries críticas
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALISANDO QUERIES CRÍTICAS');
    console.log('='.repeat(80));
    
    const analyses: QueryAnalysis[] = [];
    
    for (const query of CRITICAL_QUERIES) {
      const analysis = await analyzeQueryPlan(query.name, query.sql, query.params);
      analyses.push(analysis);
    }
    
    // Gerar relatório
    generateReport(analyses);
    
    // Salvar relatório em arquivo
    const fs = await import('fs');
    const path = await import('path');
    const reportPath = path.join(__dirname, '..', 'audit-reports', 'query-plans-analysis.json');
    
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(
      reportPath,
      JSON.stringify(analyses, null, 2),
      'utf-8'
    );
    
    console.log(`\n💾 Relatório salvo em: ${reportPath}`);
    
  } catch (error: any) {
    console.error('❌ Erro durante análise:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
main().catch(console.error);

