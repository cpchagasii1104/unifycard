// src/scripts/diagnose-categories-complete.ts
// Diagnóstico completo das categorias profissionais

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

async function diagnose() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DE CATEGORIAS\n');
  console.log('='.repeat(60));

  // 1. Contagem por scope
  console.log('\n📊 1. CONTAGEM POR SCOPE:');
  const byScope = await pool.query(`
    SELECT scope, COUNT(*) as total
    FROM categories
    GROUP BY scope
    ORDER BY scope
  `);
  byScope.rows.forEach(r => {
    console.log(`   ${r.scope || 'NULL'}: ${r.total} categorias`);
  });

  // 2. Contagem por level dentro de scope='professional'
  console.log('\n📊 2. CATEGORIAS PROFISSIONAIS POR LEVEL:');
  const byLevel = await pool.query(`
    SELECT level, COUNT(*) as total
    FROM categories
    WHERE scope = 'professional'
    GROUP BY level
    ORDER BY level
  `);
  byLevel.rows.forEach(r => {
    console.log(`   Level ${r.level}: ${r.total} categorias`);
  });

  // 3. Verificar estrutura hierárquica
  console.log('\n📊 3. ESTRUTURA HIERÁRQUICA PROFISSIONAL:');
  const structure = await pool.query(`
    SELECT 
      c1.name as setor,
      c1.level as l0,
      c2.name as subsetor,
      c2.level as l1,
      COUNT(c3.category_id) as profissoes
    FROM categories c1
    LEFT JOIN categories c2 ON c2.parent_id = c1.category_id AND c2.scope = 'professional'
    LEFT JOIN categories c3 ON c3.parent_id = c2.category_id AND c3.scope = 'professional'
    WHERE c1.scope = 'professional' AND c1.level = 0
    GROUP BY c1.category_id, c1.name, c1.level, c2.category_id, c2.name, c2.level
    ORDER BY c1.name, c2.name
    LIMIT 20
  `);
  
  structure.rows.forEach(r => {
    if (r.subsetor) {
      console.log(`   ${r.setor} > ${r.subsetor} (${r.profissoes} profissões)`);
    } else {
      console.log(`   ${r.setor} (sem subsetores)`);
    }
  });

  // 4. Verificar um subsetor específico
  console.log('\n📊 4. EXEMPLO: Subsetor "Desenvolvimento de Software" e seus filhos:');
  const exemplo = await pool.query(`
    SELECT 
      c2.name as subsetor,
      c2.level,
      c2.scope,
      c2.status,
      c2.is_active,
      c3.name as profissao,
      c3.level as prof_level,
      c3.scope as prof_scope,
      c3.status as prof_status
    FROM categories c2
    LEFT JOIN categories c3 ON c3.parent_id = c2.category_id
    WHERE c2.slug = 'desenvolvimento-software'
    ORDER BY c3.name
  `);
  
  if (exemplo.rows.length > 0) {
    const subsetor = exemplo.rows[0];
    console.log(`   Subsetor: ${subsetor.subsetor}`);
    console.log(`   - Level: ${subsetor.level}`);
    console.log(`   - Scope: ${subsetor.scope}`);
    console.log(`   - Status: ${subsetor.status}`);
    console.log(`   - Is Active: ${subsetor.is_active}`);
    console.log(`   - Profissões encontradas: ${exemplo.rows.filter(r => r.profissao).length}`);
    exemplo.rows.filter(r => r.profissao).forEach(r => {
      console.log(`     • ${r.profissao} (level ${r.prof_level}, scope ${r.prof_scope}, status ${r.prof_status})`);
    });
  } else {
    console.log('   ⚠️  Subsetor não encontrado');
  }

  // 5. Verificar campos da tabela
  console.log('\n📊 5. ESTRUTURA DA TABELA (amostra):');
  const sample = await pool.query(`
    SELECT 
      category_id,
      name,
      slug,
      level,
      parent_id,
      scope,
      status,
      is_active
    FROM categories
    WHERE scope = 'professional'
    ORDER BY level, name
    LIMIT 5
  `);
  
  if (sample.rows.length > 0) {
    console.log('   Campos encontrados:');
    Object.keys(sample.rows[0]).forEach(key => {
      console.log(`     - ${key}`);
    });
  }

  await pool.end();
}

diagnose().catch(console.error);

