// diagnose-categories.ts - Script temporário de diagnóstico
import dotenv from 'dotenv';
dotenv.config(); // Carrega .env do diretório atual

import { pool } from '../src/core/database/pool';

async function main() {
  try {
    console.log('=== DIAGNÓSTICO DE CATEGORIAS ===\n');

    // 1. Verificar contagem por scope e status
    const scopeCount = await pool.query(`
      SELECT scope, status, COUNT(*) as count
      FROM categories
      GROUP BY scope, status
      ORDER BY scope, status
    `);
    console.log('CONTAGEM POR SCOPE E STATUS:');
    console.table(scopeCount.rows);

    // 2. Verificar categorias profissionais leaf (sem filhos)
    const professionalLeaf = await pool.query(`
      SELECT c.category_id, c.name, c.level, c.scope, c.status
      FROM categories c
      WHERE (c.scope = 'professional' OR c.scope = 'global' OR c.scope IS NULL)
        AND c.status IN ('active', 'auto_active')
        AND NOT EXISTS (
          SELECT 1 FROM categories c2 WHERE c2.parent_id = c.category_id
        )
      ORDER BY c.level, c.name
      LIMIT 30
    `);
    console.log('\nCATEGORIAS PROFISSIONAIS LEAF (active/auto_active):');
    console.table(professionalLeaf.rows);

    // 3. Verificar categorias raiz (level 0)
    const roots = await pool.query(`
      SELECT category_id, name, level, scope, status, parent_id
      FROM categories
      WHERE parent_id IS NULL
      ORDER BY name
      LIMIT 30
    `);
    console.log('\nCATEGORIAS RAIZ (LEVEL 0):');
    console.table(roots.rows);

    // 4. Verificar categorias com scope específico
    const byScope = await pool.query(`
      SELECT scope, COUNT(*) as total,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
             SUM(CASE WHEN status = 'auto_active' THEN 1 ELSE 0 END) as auto_active,
             SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status IS NULL THEN 1 ELSE 0 END) as null_status
      FROM categories
      GROUP BY scope
      ORDER BY total DESC
    `);
    console.log('\nRESUMO POR SCOPE:');
    console.table(byScope.rows);

    // 5. Verificar se coluna status existe
    const statusCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'categories' AND column_name = 'status'
      ) as has_status
    `);
    console.log('\nCOLUNA STATUS EXISTE:', statusCheck.rows[0]?.has_status);

    // 6. Testar query do autocomplete para 'professional'
    const autocompleteTest = await pool.query(`
      SELECT c.category_id, c.name, c.level, c.scope, c.status
      FROM categories c
      WHERE (c.status IN ('active', 'auto_active') OR c.status IS NULL)
        AND (c.scope = 'professional' OR c.scope = 'global' OR c.scope IS NULL)
        AND c.level <= 2
        AND NOT EXISTS (
          SELECT 1 FROM categories c2 WHERE c2.parent_id = c.category_id
        )
      ORDER BY c.name
      LIMIT 20
    `);
    console.log('\nTESTE AUTOCOMPLETE PROFESSIONAL (query simulada):');
    console.table(autocompleteTest.rows);

    await pool.end();
    console.log('\n=== DIAGNÓSTICO CONCLUÍDO ===');
  } catch (error: any) {
    console.error('Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

main();
