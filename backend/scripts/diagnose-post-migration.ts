#!/usr/bin/env ts-node
/**
 * Script de Diagnóstico Pós-Migration
 * 
 * Verifica estado do banco após migrations:
 * - Tabelas existem?
 * - Dados básicos existem?
 * - Seeds foram aplicados?
 * - Schemas estão corretos?
 */

import { pool } from '../src/core/database/pool';
import { runQueryWithTenant } from '../src/core/database/pool';

const DEV_TENANT_ID = process.env.DEV_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

interface DiagnosticResult {
  check: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  message: string;
  details?: any;
}

const results: DiagnosticResult[] = [];

async function checkTableExists(tableName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    ) as exists`,
    [tableName]
  );
  return result.rows[0]?.exists || false;
}

async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    ) as exists`,
    [tableName, columnName]
  );
  return result.rows[0]?.exists || false;
}

async function countRows(tableName: string, tenantId?: string): Promise<number> {
  try {
    if (tenantId) {
      const result = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `SELECT COUNT(*)::text as count FROM ${tableName}`,
        []
      );
      return parseInt(result?.count || '0', 10);
    } else {
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM ${tableName}`
      );
      return parseInt(result.rows[0]?.count || '0', 10);
    }
  } catch (error) {
    return -1;
  }
}

async function diagnoseCategories(tenantId: string): Promise<void> {
  console.log('\n📦 DIAGNÓSTICO: Categories');
  console.log('='.repeat(50));

  // 1. Tabela existe?
  const tableExists = await checkTableExists('categories');
  if (!tableExists) {
    results.push({
      check: 'categories_table_exists',
      status: 'ERROR',
      message: 'Tabela categories não existe',
    });
    console.log('❌ Tabela categories não existe');
    return;
  }
  console.log('✅ Tabela categories existe');

  // 2. Colunas essenciais existem?
  const essentialColumns = ['category_id', 'name', 'slug', 'parent_id', 'level', 'path'];
  for (const col of essentialColumns) {
    const exists = await checkColumnExists('categories', col);
    if (!exists) {
      results.push({
        check: `categories_column_${col}`,
        status: 'ERROR',
        message: `Coluna ${col} não existe em categories`,
      });
      console.log(`❌ Coluna ${col} não existe`);
    } else {
      console.log(`✅ Coluna ${col} existe`);
    }
  }

  // 3. Contar categorias
  const categoryCount = await countRows('categories', tenantId);
  if (categoryCount === 0) {
    results.push({
      check: 'categories_count',
      status: 'WARNING',
      message: 'Tabela categories está vazia - seeds não foram aplicados',
      details: { count: 0 },
    });
    console.log('⚠️  Tabela categories está VAZIA (seeds não aplicados)');
  } else {
    results.push({
      check: 'categories_count',
      status: 'OK',
      message: `Tabela categories tem ${categoryCount} registros`,
      details: { count: categoryCount },
    });
    console.log(`✅ Tabela categories tem ${categoryCount} registros`);
  }

  // 4. Verificar categorias raiz
  const rootCategories = await runQueryWithTenant<{ count: string }>(
    tenantId,
    `SELECT COUNT(*)::text as count FROM categories WHERE parent_id IS NULL`,
    []
  );
  const rootCount = parseInt(rootCategories?.count || '0', 10);
  if (rootCount === 0) {
    results.push({
      check: 'categories_root_count',
      status: 'WARNING',
      message: 'Nenhuma categoria raiz encontrada',
      details: { count: 0 },
    });
    console.log('⚠️  Nenhuma categoria raiz encontrada');
  } else {
    console.log(`✅ ${rootCount} categorias raiz encontradas`);
  }

  // 5. Verificar categorias com status active
  const hasStatusColumn = await checkColumnExists('categories', 'status');
  if (hasStatusColumn) {
    const activeCount = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `SELECT COUNT(*)::text as count FROM categories WHERE status = 'active' OR status IS NULL`,
      []
    );
    const active = parseInt(activeCount?.count || '0', 10);
    console.log(`✅ ${active} categorias ativas`);
  }
}

async function diagnoseAccounts(tenantId: string): Promise<void> {
  console.log('\n💰 DIAGNÓSTICO: Accounts');
  console.log('='.repeat(50));

  const tableExists = await checkTableExists('accounts');
  if (!tableExists) {
    results.push({
      check: 'accounts_table_exists',
      status: 'ERROR',
      message: 'Tabela accounts não existe',
    });
    console.log('❌ Tabela accounts não existe');
    return;
  }
  console.log('✅ Tabela accounts existe');

  // Verificar coluna owner_id
  const hasOwnerId = await checkColumnExists('accounts', 'owner_id');
  if (!hasOwnerId) {
    results.push({
      check: 'accounts_owner_id_column',
      status: 'ERROR',
      message: 'Coluna owner_id não existe em accounts',
    });
    console.log('❌ Coluna owner_id não existe');
  } else {
    console.log('✅ Coluna owner_id existe');
  }

  // Contar contas
  const accountCount = await countRows('accounts', tenantId);
  console.log(`ℹ️  Tabela accounts tem ${accountCount} registros`);
}

async function diagnoseBank(tenantId: string): Promise<void> {
  console.log('\n🏦 DIAGNÓSTICO: Bank/Transparency');
  console.log('='.repeat(50));

  // Verificar se há contas bancárias
  const accountsExist = await checkTableExists('accounts');
  if (!accountsExist) {
    console.log('⚠️  Tabela accounts não existe - módulo bank pode não funcionar');
    return;
  }

  // Verificar ledger
  const ledgerExists = await checkTableExists('ledger');
  if (!ledgerExists) {
    console.log('⚠️  Tabela ledger não existe');
  } else {
    console.log('✅ Tabela ledger existe');
    const ledgerCount = await countRows('ledger', tenantId);
    console.log(`ℹ️  Ledger tem ${ledgerCount} entradas`);
  }

  // Verificar transactions
  const transactionsExist = await checkTableExists('transactions');
  if (!transactionsExist) {
    console.log('⚠️  Tabela transactions não existe');
  } else {
    console.log('✅ Tabela transactions existe');
    const txCount = await countRows('transactions', tenantId);
    console.log(`ℹ️  Transactions tem ${txCount} registros`);
  }
}

async function diagnoseCulturalEvents(tenantId: string): Promise<void> {
  console.log('\n🎭 DIAGNÓSTICO: Cultural Events');
  console.log('='.repeat(50));

  const tableExists = await checkTableExists('cultural_events');
  if (!tableExists) {
    results.push({
      check: 'cultural_events_table_exists',
      status: 'WARNING',
      message: 'Tabela cultural_events não existe - feature pode não estar disponível',
    });
    console.log('⚠️  Tabela cultural_events não existe');
    return;
  }
  console.log('✅ Tabela cultural_events existe');

  const eventCount = await countRows('cultural_events', tenantId);
  console.log(`ℹ️  Tabela cultural_events tem ${eventCount} registros`);
}

async function main() {
  console.log('🔍 DIAGNÓSTICO PÓS-MIGRATION');
  console.log('='.repeat(50));
  console.log(`Tenant ID: ${DEV_TENANT_ID}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    await diagnoseCategories(DEV_TENANT_ID);
    await diagnoseAccounts(DEV_TENANT_ID);
    await diagnoseBank(DEV_TENANT_ID);
    await diagnoseCulturalEvents(DEV_TENANT_ID);

    console.log('\n📊 RESUMO');
    console.log('='.repeat(50));
    const errors = results.filter(r => r.status === 'ERROR');
    const warnings = results.filter(r => r.status === 'WARNING');
    const ok = results.filter(r => r.status === 'OK');

    console.log(`✅ OK: ${ok.length}`);
    console.log(`⚠️  WARNINGS: ${warnings.length}`);
    console.log(`❌ ERROS: ${errors.length}`);

    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach(w => {
        console.log(`  - ${w.check}: ${w.message}`);
      });
    }

    if (errors.length > 0) {
      console.log('\n❌ ERROS:');
      errors.forEach(e => {
        console.log(`  - ${e.check}: ${e.message}`);
      });
    }

    // Ações recomendadas
    console.log('\n💡 AÇÕES RECOMENDADAS:');
    const categoriesEmpty = results.find(r => r.check === 'categories_count' && r.status === 'WARNING');
    if (categoriesEmpty) {
      console.log('  1. Executar seed de categorias:');
      console.log('     npm run seed:categories');
      console.log('     ou');
      console.log('     npm run seed:professional-categories');
      console.log('     npm run seed:learning-categories');
    }

    const accountsEmpty = results.find(r => r.check === 'accounts_count' && r.status === 'WARNING');
    if (accountsEmpty) {
      console.log('  2. Verificar criação automática de accounts no código');
    }

  } catch (error) {
    console.error('❌ Erro durante diagnóstico:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();














