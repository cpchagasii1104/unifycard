// src/scripts/validate-professional-level2.ts
// Validação completa do nível 2 de categorias profissionais

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { categoriesService } from '../core/categories/categories.service';
import { SYSTEM_TENANT, ensureSystemTenant } from '../core/tenants/system-tenant';

dotenv.config({ path: join(process.cwd(), '.env') });

async function validate() {
  // SSOT: Garantir que system-tenant existe
  await ensureSystemTenant();

  console.log('🔍 VALIDAÇÃO COMPLETA DO NÍVEL 2\n');
  console.log('='.repeat(60));

  // 1. Validação SQL: Contagem por level
  console.log('\n📊 1. VALIDAÇÃO SQL: Contagem por level');
  const sqlCount = await pool.query(`
    SELECT level, COUNT(*) as total
    FROM categories
    WHERE scope = 'professional'
    GROUP BY level
    ORDER BY level
  `);
  
  let hasLevel2 = false;
  sqlCount.rows.forEach(r => {
    console.log(`   Level ${r.level}: ${r.total} categorias`);
    if (r.level === 2 && parseInt(r.total) > 0) {
      hasLevel2 = true;
    }
  });
  
  if (!hasLevel2) {
    console.log('\n❌ ERRO: Nenhuma categoria nível 2 encontrada!');
    await pool.end();
    process.exit(1);
  }
  console.log('   ✅ Nível 2 encontrado!');

  // 2. Validação: Estrutura hierárquica
  console.log('\n📊 2. VALIDAÇÃO: Estrutura hierárquica');
  const structure = await pool.query(`
    SELECT 
      c1.name as setor,
      c2.name as subsetor,
      COUNT(c3.category_id) as profissoes
    FROM categories c1
    INNER JOIN categories c2 ON c2.parent_id = c1.category_id
    LEFT JOIN categories c3 ON c3.parent_id = c2.category_id
    WHERE c1.scope = 'professional' 
      AND c1.level = 0
      AND c2.scope = 'professional'
      AND c2.level = 1
      AND c3.scope = 'professional'
      AND c3.level = 2
    GROUP BY c1.name, c2.name
    ORDER BY c1.name, c2.name
    LIMIT 10
  `);
  
  console.log(`   ✅ ${structure.rows.length} subsetores com profissões encontrados`);
  structure.rows.slice(0, 5).forEach(r => {
    console.log(`      ${r.setor} > ${r.subsetor} (${r.profissoes} profissões)`);
  });

  // 3. Validação API: getCategoriesForTenant (SSOT)
  console.log('\n📊 3. VALIDAÇÃO API: getCategoriesForTenant()');
  try {
    const tree = await categoriesService.getCategoriesForTenant(SYSTEM_TENANT.tenantId, 'professional');
    const professionalRoots = tree.filter(c => c.scope === 'professional');
    console.log(`   ✅ Total de raízes: ${tree.length}`);
    console.log(`   ✅ Raízes profissionais: ${professionalRoots.length}`);
    
    if (professionalRoots.length > 0) {
      const exemplo = professionalRoots[0];
      console.log(`   📋 Exemplo: ${exemplo.name}`);
      console.log(`      - Filhos (nível 1): ${exemplo.children?.length || 0}`);
      
      if (exemplo.children && exemplo.children.length > 0) {
        const subsetor = exemplo.children[0];
        console.log(`      - Subsetor: ${subsetor.name} (scope: ${subsetor.scope})`);
        console.log(`      - Filhos do subsetor (nível 2): ${subsetor.children?.length || 0}`);
        
        if (subsetor.children && subsetor.children.length > 0) {
          console.log(`      ✅ Profissões encontradas na API:`);
          subsetor.children.slice(0, 3).forEach(p => {
            console.log(`         • ${p.name} (level ${p.level}, scope ${p.scope})`);
          });
        } else {
          console.log(`      ❌ ERRO: Nenhuma profissão encontrada na API!`);
          await pool.end();
          process.exit(1);
        }
      }
    }
  } catch (error) {
    console.log(`   ❌ ERRO na API: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    await pool.end();
    process.exit(1);
  }

  // 4. Validação API: getChildren
  console.log('\n📊 4. VALIDAÇÃO API: getChildren() de um subsetor');
  try {
    const subsetor = await pool.query(`
      SELECT category_id, name, level
      FROM categories
      WHERE scope = 'professional' AND level = 1
      LIMIT 1
    `);
    
    if (subsetor.rows.length > 0) {
      const subsetorId = subsetor.rows[0].category_id;
      const subsetorName = subsetor.rows[0].name;
      console.log(`   📋 Testando subsetor: ${subsetorName}`);
      
      const children = await categoriesService.getChildren(subsetorId);
      console.log(`   ✅ Filhos encontrados: ${children.length}`);
      
      if (children.length > 0) {
        console.log(`   ✅ Profissões retornadas pela API:`);
        children.slice(0, 3).forEach(c => {
          console.log(`      • ${c.name} (level ${c.level}, scope ${c.scope || 'NULL'})`);
        });
        
        // Verificar se todas têm scope='professional'
        const allProfessional = children.every(c => c.scope === 'professional');
        if (!allProfessional) {
          console.log(`   ⚠️  AVISO: Algumas profissões não têm scope='professional'`);
        } else {
          console.log(`   ✅ Todas as profissões têm scope='professional'`);
        }
      } else {
        console.log(`   ❌ ERRO: Nenhuma profissão retornada pela API!`);
        await pool.end();
        process.exit(1);
      }
    }
  } catch (error) {
    console.log(`   ❌ ERRO: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    await pool.end();
    process.exit(1);
  }

  // 5. Validação: Status e is_active
  console.log('\n📊 5. VALIDAÇÃO: Status e is_active');
  const statusCheck = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE status IN ('active', 'auto_active') OR status IS NULL) as ativas,
      COUNT(*) FILTER (WHERE status = 'pending') as pendentes,
      COUNT(*) as total
    FROM categories
    WHERE scope = 'professional' AND level = 2
  `);
  
  const stats = statusCheck.rows[0];
  console.log(`   Total de profissões: ${stats.total}`);
  console.log(`   Ativas: ${stats.ativas}`);
  console.log(`   Pendentes: ${stats.pendentes}`);
  
  if (parseInt(stats.ativas) === 0) {
    console.log(`   ⚠️  AVISO: Nenhuma profissão está ativa!`);
  } else {
    console.log(`   ✅ Profissões ativas encontradas`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ VALIDAÇÃO COMPLETA: Nível 2 está funcionando!');
  console.log('='.repeat(60));
  
  await pool.end();
}

validate().catch((error) => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});

