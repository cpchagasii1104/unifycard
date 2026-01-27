// src/scripts/test-api-professional-categories.ts
// Testa se a API retorna corretamente as categorias profissionais

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { categoriesService } from '../core/categories/categories.service';
import { SYSTEM_TENANT, ensureSystemTenant } from '../core/tenants/system-tenant';

dotenv.config({ path: join(process.cwd(), '.env') });

async function testAPI() {
  // SSOT: Garantir que system-tenant existe
  await ensureSystemTenant();

  console.log('🧪 TESTANDO API DE CATEGORIAS PROFISSIONAIS\n');
  console.log('='.repeat(60));

  // 1. Testar getCategoriesForTenant (SSOT)
  console.log('\n📊 1. TESTE: getCategoriesForTenant()');
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
        console.log(`      - Subsetor: ${subsetor.name}`);
        console.log(`      - Filhos do subsetor (nível 2): ${subsetor.children?.length || 0}`);
        
        if (subsetor.children && subsetor.children.length > 0) {
          console.log(`      - Profissões encontradas:`);
          subsetor.children.slice(0, 3).forEach(p => {
            console.log(`        • ${p.name} (level ${p.level}, scope ${p.scope})`);
          });
        } else {
          console.log(`      ⚠️  Nenhuma profissão encontrada para este subsetor`);
        }
      }
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }

  // 2. Testar getChildren de um subsetor
  console.log('\n📊 2. TESTE: getChildren() de um subsetor');
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
      console.log(`   📋 Testando subsetor: ${subsetorName} (${subsetorId})`);
      
      const children = await categoriesService.getChildren(subsetorId);
      console.log(`   ✅ Filhos encontrados: ${children.length}`);
      
      if (children.length > 0) {
        console.log(`   📋 Profissões:`);
        children.slice(0, 5).forEach(c => {
          console.log(`      • ${c.name} (level ${c.level}, scope ${c.scope || 'NULL'}, status ${(c as any).status || 'NULL'})`);
        });
      } else {
        console.log(`   ⚠️  Nenhuma profissão encontrada`);
      }
    } else {
      console.log(`   ⚠️  Nenhum subsetor encontrado para testar`);
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }

  // 3. Verificar SQL direto
  console.log('\n📊 3. VERIFICAÇÃO SQL DIRETA:');
  const sqlCheck = await pool.query(`
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
      AND (c3.scope = 'professional' OR c3.scope IS NULL)
      AND (c3.level = 2 OR c3.level IS NULL)
    GROUP BY c1.name, c2.name
    ORDER BY c1.name, c2.name
    LIMIT 5
  `);
  
  console.log(`   ✅ Estrutura encontrada no banco:`);
  sqlCheck.rows.forEach(r => {
    console.log(`      ${r.setor} > ${r.subsetor} (${r.profissoes} profissões)`);
  });

  await pool.end();
}

testAPI().catch(console.error);

