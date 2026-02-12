import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

async function diagnose() {
  console.log('🔍 Diagnosticando categorias profissionais...\n');

  // Buscar categorias profissionais
  const all = await pool.query(`
    SELECT category_id, name, slug, level, parent_id, scope, status
    FROM categories
    WHERE scope = 'professional'
    ORDER BY level, name
  `);
  
  // Contar profissões (nível 2)
  const profissoes = await pool.query(`
    SELECT COUNT(*) as total
    FROM categories
    WHERE scope = 'professional' AND level = 2
  `);
  
  console.log(`\n✅ Profissões (nível 2) criadas: ${profissoes.rows[0].total}`);
  
  // Mostrar algumas profissões
  const amostra = await pool.query(`
    SELECT c3.name as profissao, c2.name as subsetor, c1.name as setor
    FROM categories c1
    INNER JOIN categories c2 ON c2.parent_id = c1.category_id
    INNER JOIN categories c3 ON c3.parent_id = c2.category_id
    WHERE c1.scope = 'professional' AND c1.level = 0
      AND c2.scope = 'professional' AND c2.level = 1
      AND c3.scope = 'professional' AND c3.level = 2
    ORDER BY c1.name, c2.name, c3.name
    LIMIT 20
  `);
  
  if (amostra.rows.length > 0) {
    console.log(`\n📋 Amostra de profissões criadas:`);
    amostra.rows.forEach(r => {
      console.log(`   ${r.setor} > ${r.subsetor} > ${r.profissao}`);
    });
  }

  console.log(`Total encontrado: ${all.rows.length}\n`);

  const porNivel: Record<number, any[]> = {};
  for (const row of all.rows) {
    if (!porNivel[row.level]) porNivel[row.level] = [];
    porNivel[row.level].push(row);
  }

  for (const nivel of [0, 1, 2]) {
    const categorias = porNivel[nivel] || [];
    console.log(`\n📊 Nível ${nivel}: ${categorias.length} categorias`);
    categorias.forEach(c => {
      console.log(`   - ${c.name} (${c.slug}) [scope: ${c.scope || 'NULL'}, status: ${c.status || 'NULL'}]`);
    });
  }

  // Buscar subsetores que podem ser profissionais
  const subsetores = await pool.query(`
    SELECT c2.category_id, c2.name, c2.slug, c1.name as setor, c1.slug as setor_slug
    FROM categories c1
    INNER JOIN categories c2 ON c2.parent_id = c1.category_id
    WHERE c1.level = 0 AND c2.level = 1
    ORDER BY c1.name, c2.name
  `);
  console.log(`\n📂 Subsetores (nível 1) encontrados: ${subsetores.rows.length}`);
  subsetores.rows.slice(0, 20).forEach(s => {
    console.log(`   - ${s.setor} > ${s.name} (${s.slug})`);
  });

  await pool.end();
}

diagnose().catch(console.error);

