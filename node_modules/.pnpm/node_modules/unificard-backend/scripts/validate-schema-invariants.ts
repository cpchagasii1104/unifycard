/**
 * Script de Validação de Invariantes de Schema
 * 
 * Este script valida que o banco de dados reforça os invariantes canônicos
 * documentados em docs/audit/SYSTEM-CANONICAL-INVARIANTS.md
 * 
 * Execução:
 *   ts-node -r tsconfig-paths/register scripts/validate-schema-invariants.ts
 */

import { pool } from '@core/database/pool';

interface ValidationResult {
  table: string;
  column: string;
  constraint: string;
  status: 'PASS' | 'FAIL';
  message: string;
}

async function validateSchemaInvariants(): Promise<void> {
  const results: ValidationResult[] = [];
  const criticalTables = [
    'actors',
    'companies',
    'bank_accounts',
    'bank_ledger',
    'event_log',
    'users',
    'profiles',
    'accounts',
    'transactions',
    'ledger',
  ];

  console.log('🔍 Validando invariantes de schema...\n');

  // 1. Validar tenant_id NOT NULL
  console.log('1. Validando tenant_id NOT NULL...');
  for (const table of criticalTables) {
    const result = await pool.query<{ is_nullable: string }>(
      `
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = $1 AND column_name = 'tenant_id'
      `,
      [table]
    );

    if (result.rows.length === 0) {
      // Tabela não tem tenant_id (pode ser OK para algumas tabelas)
      continue;
    }

    const isNullable = result.rows[0].is_nullable === 'YES';
    if (isNullable) {
      results.push({
        table,
        column: 'tenant_id',
        constraint: 'NOT NULL',
        status: 'FAIL',
        message: `${table}.tenant_id permite NULL - deve ser NOT NULL`,
      });
    } else {
      results.push({
        table,
        column: 'tenant_id',
        constraint: 'NOT NULL',
        status: 'PASS',
        message: `${table}.tenant_id é NOT NULL ✅`,
      });
    }
  }

  // 2. Validar índices compostos (tenant_id + id)
  console.log('2. Validando índices compostos...');
  for (const table of criticalTables) {
    const idColumn = table === 'users' ? 'user_id' :
                     table === 'profiles' ? 'profile_id' :
                     table === 'accounts' ? 'account_id' :
                     table === 'transactions' ? 'transaction_id' :
                     table === 'ledger' ? 'entry_id' :
                     table === 'event_log' ? 'event_id' :
                     table === 'actors' ? 'actor_id' :
                     table === 'companies' ? 'company_id' :
                     table === 'bank_accounts' ? 'account_id' :
                     table === 'bank_ledger' ? 'entry_id' : null;

    if (!idColumn) continue;

    const result = await pool.query<{ indexname: string }>(
      `
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = $1
        AND indexdef LIKE '%tenant_id%'
        AND indexdef LIKE '%${idColumn}%'
      `,
      [table]
    );

    if (result.rows.length === 0) {
      results.push({
        table,
        column: idColumn,
        constraint: 'INDEX (tenant_id, id)',
        status: 'FAIL',
        message: `${table} não tem índice composto (tenant_id, ${idColumn})`,
      });
    } else {
      results.push({
        table,
        column: idColumn,
        constraint: 'INDEX (tenant_id, id)',
        status: 'PASS',
        message: `${table} tem índice composto (tenant_id, ${idColumn}) ✅`,
      });
    }
  }

  // 3. Validar CHECK constraints
  console.log('3. Validando CHECK constraints...');
  
  // users.token_version >= 0
  const tokenVersionCheck = await pool.query<{ conname: string }>(
    `
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'users')
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%token_version%'
    `
  );
  
  if (tokenVersionCheck.rows.length === 0) {
    results.push({
      table: 'users',
      column: 'token_version',
      constraint: 'CHECK (token_version >= 0)',
      status: 'FAIL',
      message: 'users.token_version não tem CHECK constraint',
    });
  } else {
    results.push({
      table: 'users',
      column: 'token_version',
      constraint: 'CHECK (token_version >= 0)',
      status: 'PASS',
      message: 'users.token_version tem CHECK constraint ✅',
    });
  }

  // 4. Validar RLS
  console.log('4. Validando Row Level Security...');
  for (const table of criticalTables) {
    const result = await pool.query<{ rowsecurity: boolean }>(
      `
      SELECT rowsecurity
      FROM pg_tables
      WHERE tablename = $1
      `,
      [table]
    );

    if (result.rows.length === 0) {
      // Tabela não existe
      continue;
    }

    const hasRLS = result.rows[0].rowsecurity;
    if (!hasRLS) {
      results.push({
        table,
        column: 'N/A',
        constraint: 'RLS',
        status: 'FAIL',
        message: `${table} não tem RLS habilitado`,
      });
    } else {
      results.push({
        table,
        column: 'N/A',
        constraint: 'RLS',
        status: 'PASS',
        message: `${table} tem RLS habilitado ✅`,
      });
    }
  }

  // 5. Validar Foreign Keys
  console.log('5. Validando Foreign Keys...');
  for (const table of criticalTables) {
    const result = await pool.query<{ conname: string; pg_get_constraintdef: string }>(
      `
      SELECT conname, pg_get_constraintdef(oid) as pg_get_constraintdef
      FROM pg_constraint
      WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = $1)
        AND contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%tenant_id%'
      `,
      [table]
    );

    if (result.rows.length === 0 && table !== 'tenants') {
      // Verificar se tabela tem tenant_id
      const hasTenantId = await pool.query<{ count: string }>(
        `
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'tenant_id'
        `,
        [table]
      );

      if (hasTenantId.rows[0].count === '1') {
        results.push({
          table,
          column: 'tenant_id',
          constraint: 'FOREIGN KEY',
          status: 'FAIL',
          message: `${table}.tenant_id não tem FOREIGN KEY para tenants`,
        });
      }
    } else if (result.rows.length > 0) {
      results.push({
        table,
        column: 'tenant_id',
        constraint: 'FOREIGN KEY',
        status: 'PASS',
        message: `${table}.tenant_id tem FOREIGN KEY para tenants ✅`,
      });
    }
  }

  // Resumo
  console.log('\n📊 Resumo da Validação:\n');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`✅ Passou: ${passed}`);
  console.log(`❌ Falhou: ${failed}\n`);

  // Detalhes
  console.log('📋 Detalhes:\n');
  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.message}`);
  }

  // Falhar se houver erros
  if (failed > 0) {
    console.log('\n❌ Validação falhou! Corrija os problemas acima.');
    process.exit(1);
  } else {
    console.log('\n✅ Todas as validações passaram!');
    process.exit(0);
  }
}

// Executar validação
validateSchemaInvariants().catch((error) => {
  console.error('❌ Erro ao validar invariantes de schema:', error);
  process.exit(1);
});

