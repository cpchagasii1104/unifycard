// backend/scripts/run-remove-company.ts
// Script temporário para remover empresa de teste
// Executar com: npx ts-node scripts/run-remove-company.ts

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function removeTestCompany() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unificard',
  });

  const cnpj = '32121543000153';
  const cnpjFormatted = '32.121.543/0001-53';

  console.log('');
  console.log('================================================');
  console.log('🗑️  REMOÇÃO DE EMPRESA DE TESTE');
  console.log(`   CNPJ: ${cnpjFormatted}`);
  console.log('================================================');
  console.log('');

  try {
    // FASE 1: Diagnóstico
    console.log('📋 FASE 1: Diagnóstico');
    console.log('');

    // Buscar empresa
    const companyResult = await pool.query(`
      SELECT company_id, company_name, company_status, created_at
      FROM companies
      WHERE cnpj = $1 OR cnpj = $2
    `, [cnpj, cnpjFormatted]);

    if (companyResult.rows.length === 0) {
      console.log('⚠️  Empresa não encontrada com este CNPJ');
      console.log('   Nada a fazer.');
      await pool.end();
      return;
    }

    const company = companyResult.rows[0];
    console.log(`   Empresa encontrada: ${company.company_name}`);
    console.log(`   ID: ${company.company_id}`);
    console.log(`   Status: ${company.company_status}`);
    console.log('');

    // Buscar actor
    const actorResult = await pool.query(`
      SELECT actor_id, display_name
      FROM actors
      WHERE company_id = $1 AND actor_type = 'page'
    `, [company.company_id]);

    const actor = actorResult.rows[0];
    if (actor) {
      console.log(`   Actor encontrado: ${actor.display_name} (${actor.actor_id})`);
    } else {
      console.log('   Nenhum actor vinculado');
    }
    console.log('');

    // Verificar dependências
    const depsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM company_users WHERE company_id = $1) as company_users,
        (SELECT COUNT(*) FROM accounts WHERE owner_id = $1::text AND owner_type = 'company') as accounts,
        (SELECT COUNT(*) FROM events WHERE actor_id = $2 AND actor_type = 'page') as events,
        (SELECT COUNT(*) FROM posts WHERE actor_id = $2) as posts
    `, [company.company_id, actor?.actor_id || '00000000-0000-0000-0000-000000000000']);

    const deps = depsResult.rows[0];
    console.log('   Dependências:');
    console.log(`   - company_users: ${deps.company_users}`);
    console.log(`   - accounts: ${deps.accounts}`);
    console.log(`   - events: ${deps.events}`);
    console.log(`   - posts: ${deps.posts}`);
    console.log('');

    // FASE 2: Remoção
    console.log('🗑️  FASE 2: Remoção');
    console.log('');

    await pool.query('BEGIN');

    // 1. Remover company_users
    await pool.query('DELETE FROM company_users WHERE company_id = $1', [company.company_id]);
    console.log('   ✓ company_users removidos');

    // 2. Remover company_documents (se existir)
    try {
      await pool.query('DELETE FROM company_documents WHERE company_id = $1', [company.company_id]);
      console.log('   ✓ company_documents removidos');
    } catch (e: any) {
      if (e.code === '42P01') { // undefined_table
        console.log('   - company_documents não existe (ignorado)');
      } else {
        throw e;
      }
    }

    // 3. Remover company_validations (se existir)
    try {
      await pool.query('DELETE FROM company_validations WHERE company_id = $1', [company.company_id]);
      console.log('   ✓ company_validations removidos');
    } catch (e: any) {
      if (e.code === '42P01') { // undefined_table
        console.log('   - company_validations não existe (ignorado)');
      } else {
        throw e;
      }
    }

    // 4. Desvincular eventos (preservar eventos)
    if (actor) {
      await pool.query(`
        UPDATE events
        SET actor_id = NULL, actor_type = NULL, updated_at = now()
        WHERE actor_id = $1 AND actor_type = 'page'
      `, [actor.actor_id]);
      console.log('   ✓ Eventos desvinculados (preservados)');
    }

    // 5. Desvincular accounts (preservar histórico)
    await pool.query(`
      UPDATE accounts
      SET owner_id = NULL, owner_type = NULL, updated_at = now()
      WHERE owner_id = $1::text AND owner_type = 'company'
    `, [company.company_id]);
    console.log('   ✓ Accounts desvinculados (histórico preservado)');

    // 6. Remover actor (posts em CASCADE)
    if (actor) {
      await pool.query('DELETE FROM actors WHERE actor_id = $1', [actor.actor_id]);
      console.log('   ✓ Actor removido');
    }

    // 7. Remover empresa
    await pool.query('DELETE FROM companies WHERE company_id = $1', [company.company_id]);
    console.log('   ✓ Empresa removida');

    await pool.query('COMMIT');

    console.log('');
    console.log('================================================');
    console.log(`✅ EMPRESA REMOVIDA COM SUCESSO: ${company.company_name}`);
    console.log('================================================');
    console.log('');

    // FASE 3: Verificação
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as count FROM companies WHERE cnpj = $1 OR cnpj = $2
    `, [cnpj, cnpjFormatted]);

    if (parseInt(verifyResult.rows[0].count) === 0) {
      console.log('✅ Verificação: Empresa não existe mais no banco');
    } else {
      console.log('❌ ERRO: Empresa ainda existe no banco!');
    }

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Erro durante remoção:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar
removeTestCompany()
  .then(() => {
    console.log('');
    console.log('Script finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Falha na execução:', error);
    process.exit(1);
  });

