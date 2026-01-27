// src/scripts/validate-levels-only-0-1-2.ts
// Valida que existem APENAS levels 0, 1 e 2 no scope professional

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

async function validate() {
  console.log('🔍 VALIDAÇÃO: Apenas Levels 0, 1 e 2\n');
  console.log('='.repeat(60));

  // 1. Contagem por level
  console.log('\n📊 1. CONTAGEM POR LEVEL:');
  const countByLevel = await pool.query(`
    SELECT level, COUNT(*) as total
    FROM categories
    WHERE scope = 'professional'
    GROUP BY level
    ORDER BY level
  `);
  
  const levels = countByLevel.rows.map(r => parseInt(r.level));
  const hasLevel3 = levels.includes(3);
  
  countByLevel.rows.forEach(r => {
    const level = parseInt(r.level);
    const total = parseInt(r.total);
    const status = level <= 2 ? '✅' : '❌';
    console.log(`   ${status} Level ${level}: ${total} categorias`);
  });
  
  if (hasLevel3) {
    console.log('\n❌ ERRO: Existe level 3 no banco! O sistema suporta apenas levels 0, 1 e 2.');
    await pool.end();
    process.exit(1);
  }
  
  if (!levels.includes(0) || !levels.includes(1) || !levels.includes(2)) {
    console.log('\n❌ ERRO: Faltam levels obrigatórios (0, 1 ou 2)');
    await pool.end();
    process.exit(1);
  }
  
  console.log('\n✅ Validação: Apenas levels 0, 1 e 2 encontrados');

  // 2. Verificar estrutura hierárquica
  console.log('\n📊 2. ESTRUTURA HIERÁRQUICA:');
  const structure = await pool.query(`
    SELECT 
      c0.name as setor,
      c1.name as subsetor,
      COUNT(c2.category_id) as profissoes
    FROM categories c0
    INNER JOIN categories c1 ON c1.parent_id = c0.category_id
    LEFT JOIN categories c2 ON c2.parent_id = c1.category_id
    WHERE c0.scope = 'professional' 
      AND c0.level = 0
      AND c1.scope = 'professional'
      AND c1.level = 1
      AND c2.scope = 'professional'
      AND c2.level = 2
    GROUP BY c0.name, c1.name
    ORDER BY c0.name, c1.name
    LIMIT 10
  `);
  
  console.log(`   ✅ ${structure.rows.length} subsetores com profissões encontrados`);
  structure.rows.slice(0, 5).forEach(r => {
    console.log(`      ${r.setor} > ${r.subsetor} (${r.profissoes} profissões)`);
  });

  // 3. Verificar se alguma profissão (level 2) tem parent incorreto
  console.log('\n📊 3. VALIDAÇÃO DE PARENT_ID:');
  const wrongParent = await pool.query(`
    SELECT c2.category_id, c2.name, c2.level, c2.parent_id, c1.level as parent_level
    FROM categories c2
    INNER JOIN categories c1 ON c1.category_id = c2.parent_id
    WHERE c2.scope = 'professional'
      AND c2.level = 2
      AND c1.level != 1
  `);
  
  if (wrongParent.rows.length > 0) {
    console.log(`   ❌ ERRO: ${wrongParent.rows.length} profissões (level 2) com parent incorreto:`);
    wrongParent.rows.forEach(r => {
      console.log(`      - ${r.name} (parent level: ${r.parent_level}, esperado: 1)`);
    });
    await pool.end();
    process.exit(1);
  }
  console.log('   ✅ Todas as profissões (level 2) têm parent correto (level 1)');

  // 4. Verificar se algum subsetor (level 1) tem parent incorreto
  const wrongParent1 = await pool.query(`
    SELECT c1.category_id, c1.name, c1.level, c1.parent_id, c0.level as parent_level
    FROM categories c1
    INNER JOIN categories c0 ON c0.category_id = c1.parent_id
    WHERE c1.scope = 'professional'
      AND c1.level = 1
      AND c0.level != 0
  `);
  
  if (wrongParent1.rows.length > 0) {
    console.log(`   ❌ ERRO: ${wrongParent1.rows.length} subsetores (level 1) com parent incorreto:`);
    wrongParent1.rows.forEach(r => {
      console.log(`      - ${r.name} (parent level: ${r.parent_level}, esperado: 0)`);
    });
    await pool.end();
    process.exit(1);
  }
  console.log('   ✅ Todos os subsetores (level 1) têm parent correto (level 0)');

  // 5. Verificar scope e status
  console.log('\n📊 4. VALIDAÇÃO DE SCOPE E STATUS:');
  const scopeStatus = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE scope = 'professional') as professional_scope,
      COUNT(*) FILTER (WHERE status IN ('active', 'auto_active') OR status IS NULL) as ativas,
      COUNT(*) as total
    FROM categories
    WHERE scope = 'professional'
  `);
  
  const stats = scopeStatus.rows[0];
  console.log(`   Total: ${stats.total}`);
  console.log(`   Scope professional: ${stats.professional_scope}`);
  console.log(`   Status ativo: ${stats.ativas}`);
  
  if (parseInt(stats.professional_scope) !== parseInt(stats.total)) {
    console.log(`   ⚠️  AVISO: Nem todas as categorias têm scope='professional'`);
  } else {
    console.log(`   ✅ Todas as categorias têm scope='professional'`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ VALIDAÇÃO COMPLETA: Estrutura correta (apenas levels 0, 1, 2)');
  console.log('='.repeat(60));
  
  await pool.end();
}

validate().catch((error) => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});

