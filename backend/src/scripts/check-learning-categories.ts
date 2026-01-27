// src/scripts/check-learning-categories.ts
// Script para verificar categorias de aprendizado

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

async function check() {
  console.log('🔍 Verificando categorias de aprendizado...\n');

  try {
    // Verificar por scope
    const byScope = await pool.query<{ scope: string | null; count: string }>(
      `SELECT scope, COUNT(*) as count FROM categories GROUP BY scope ORDER BY scope`
    );

    console.log('📈 Categorias por SCOPE:');
    byScope.rows.forEach((r) => {
      console.log(`   scope="${r.scope || 'NULL'}": ${r.count} categorias`);
    });

    // Verificar se existe scope='learning'
    const learning = await pool.query<{
      category_id: string;
      name: string;
      level: number;
      scope: string;
      parent_id: string | null;
    }>(
      `SELECT category_id, name, level, scope, parent_id
       FROM categories
       WHERE scope IN ('learning', 'interest', 'physical', 'education')
       ORDER BY scope, level, name
       LIMIT 30`
    );

    console.log('\n📚 Categorias de aprendizado/interesse/físico/educação:');
    if (learning.rows.length === 0) {
      console.log('   ❌ NENHUMA ENCONTRADA!');
      console.log('\n💡 SOLUÇÃO: Execute os seeds de categorias:');
      console.log('   npx ts-node -r tsconfig-paths/register src/scripts/seed-learning-categories.ts');
      console.log('   npx ts-node -r tsconfig-paths/register src/scripts/seed-physical-categories.ts');
      console.log('   npx ts-node -r tsconfig-paths/register src/scripts/seed-interests-categories.ts');
    } else {
      let currentScope = '';
      learning.rows.forEach((r) => {
        if (r.scope !== currentScope) {
          currentScope = r.scope;
          console.log(`\n   [${r.scope.toUpperCase()}]`);
        }
        const indent = '   '.repeat(r.level + 1);
        console.log(`${indent}- ${r.name} (level ${r.level})`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error);
    await pool.end();
    process.exit(1);
  }
}

check();
