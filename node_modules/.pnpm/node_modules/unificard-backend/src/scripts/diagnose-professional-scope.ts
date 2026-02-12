// src/scripts/diagnose-professional-scope.ts
// Script para diagnosticar problema de scope em categorias profissionais

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

async function diagnose() {
  console.log('🔍 Diagnóstico de categorias profissionais...\n');

  try {
    // 1. Total de categorias
    const totalResult = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM categories'
    );
    const total = parseInt(totalResult.rows[0].count, 10);
    console.log(`📊 Total de categorias: ${total}`);

    if (total === 0) {
      console.log('\n❌ PROBLEMA: Nenhuma categoria encontrada!');
      console.log('💡 SOLUÇÃO: Execute o seed de categorias profissionais:');
      console.log('   cd backend && npx ts-node src/scripts/seed-professional-categories.ts');
      await pool.end();
      return;
    }

    // 2. Categorias por scope
    const byScope = await pool.query<{ scope: string | null; count: string }>(
      `SELECT scope, COUNT(*) as count FROM categories GROUP BY scope ORDER BY scope`
    );

    console.log('\n📈 Categorias por SCOPE:');
    byScope.rows.forEach((row) => {
      console.log(`   scope="${row.scope || 'NULL'}": ${row.count} categorias`);
    });

    // 3. Verificar se existem categorias com scope='professional'
    const professionalCount = byScope.rows.find(r => r.scope === 'professional');
    if (!professionalCount || parseInt(professionalCount.count, 10) === 0) {
      console.log('\n❌ PROBLEMA: Nenhuma categoria com scope="professional"!');
      console.log('💡 SOLUÇÃO: Execute o script de correção abaixo ou re-execute o seed:');
      console.log('   cd backend && npx ts-node src/scripts/seed-professional-categories.ts');

      // Mostrar categorias existentes para contexto
      const existingCategories = await pool.query<{ name: string; level: number; scope: string | null }>(
        `SELECT name, level, scope FROM categories WHERE level = 0 LIMIT 10`
      );

      if (existingCategories.rows.length > 0) {
        console.log('\n📋 Categorias raiz existentes (sem scope correto):');
        existingCategories.rows.forEach(row => {
          console.log(`   - ${row.name} (level ${row.level}, scope="${row.scope || 'NULL'}")`);
        });

        console.log('\n🔧 Corrigindo scope para "professional"...');
        await pool.query(`
          UPDATE categories
          SET scope = 'professional'
          WHERE level <= 2 AND (scope IS NULL OR scope = '')
        `);
        console.log('✅ Scope corrigido! Recarregue a página do frontend.');
      }
    } else {
      console.log(`\n✅ Categorias profissionais encontradas: ${professionalCount.count}`);
    }

    // 4. Categorias por status
    const byStatus = await pool.query<{ status: string | null; count: string }>(
      `SELECT status, COUNT(*) as count FROM categories GROUP BY status ORDER BY status`
    );

    console.log('\n📈 Categorias por STATUS:');
    byStatus.rows.forEach((row) => {
      console.log(`   status="${row.status || 'NULL'}": ${row.count} categorias`);
    });

    // 5. Verificar se existem categorias ACTIVE
    const activeCount = byStatus.rows.find(r => r.status === 'active' || r.status === 'auto_active');
    if (!activeCount || parseInt(activeCount.count || '0', 10) === 0) {
      console.log('\n⚠️  AVISO: Nenhuma categoria com status="active"!');
      console.log('🔧 Corrigindo status...');
      await pool.query(`
        UPDATE categories
        SET status = 'active', is_active = true
        WHERE status IS NULL OR status = '' OR status = 'pending'
      `);
      console.log('✅ Status corrigido!');
    }

    // 6. Mostrar árvore simplificada
    const tree = await pool.query<{
      level0_name: string;
      level0_scope: string;
      level1_count: string;
      level2_count: string;
    }>(`
      SELECT
        l0.name as level0_name,
        l0.scope as level0_scope,
        COUNT(DISTINCT l1.category_id) as level1_count,
        COUNT(DISTINCT l2.category_id) as level2_count
      FROM categories l0
      LEFT JOIN categories l1 ON l1.parent_id = l0.category_id
      LEFT JOIN categories l2 ON l2.parent_id = l1.category_id
      WHERE l0.level = 0
      GROUP BY l0.category_id, l0.name, l0.scope
      ORDER BY l0.name
      LIMIT 10
    `);

    console.log('\n🌳 Estrutura da árvore (primeiros 10 setores):');
    tree.rows.forEach(row => {
      console.log(`   📁 ${row.level0_name} (scope="${row.level0_scope}")`);
      console.log(`      └─ ${row.level1_count} subsetores, ${row.level2_count} profissões`);
    });

    console.log('\n✨ Diagnóstico concluído!');
    await pool.end();
  } catch (error) {
    console.error('\n❌ Erro ao diagnosticar:', error);
    await pool.end();
    process.exit(1);
  }
}

diagnose();
