// Script para remover/arquivar categorias que NÃO são profissões
// Exemplos: Gêneros de Filme, Gêneros Musicais, Gêneros Literários, etc.
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function removeNonProfessions() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Identificando categorias que NÃO são profissões...\n');
    
    // 1. Lista de padrões que NÃO são profissões
    const nonProfessionPatterns = [
      // Gêneros
      '%gênero%',
      '%genero%',
      '%gêneros%',
      '%generos%',
      
      // Filmes/Cinema
      'ação',
      'animação',
      'comédia',
      'documentário',
      'drama',
      'ficção científica',
      'romance',
      'terror',
      'suspense',
      'aventura',
      'fantasia',
      
      // Música
      'rock',
      'pop',
      'sertanejo',
      'funk',
      'hip hop',
      'jazz',
      'clássica',
      'eletrônica',
      
      // Literatura
      'ficção',
      'não-ficção',
      'biografia',
      'autobiografia',
      'poesia',
      'teatro',
      
      // Jogos
      'rpg',
      'estratégia',
      'ação',
      'aventura',
      'simulação',
      
      // Outros não-profissionais
      'hobby',
      'passatempo',
      'interesse',
    ];
    
    // 2. Buscar categorias que correspondem a esses padrões
    const nonProfessions = await client.query(`
      SELECT 
        category_id,
        name,
        slug,
        level,
        parent_id,
        status,
        (SELECT COUNT(*) FROM categories WHERE parent_id = c.category_id) as num_filhos,
        (SELECT name FROM categories WHERE category_id = c.parent_id) as parent_name
      FROM categories c
      WHERE (
        -- Buscar por nome que contém padrões não-profissionais
        ${nonProfessionPatterns.map((pattern, idx) => 
          `LOWER(name) LIKE $${idx + 1}`
        ).join(' OR ')}
        
        -- OU buscar subgrupos específicos conhecidos
        OR slug IN (
          'generos-filme',
          'generos-musicais',
          'generos-literarios',
          'generos-filme',
          'generos-musicais',
          'generos-literarios',
          'jogos-mesa',
          'videogames',
          'series',
          'mangas-quadrinhos'
        )
        
        -- OU categorias que são claramente não-profissionais
        OR name IN (
          'Gêneros de Filme',
          'Gêneros Musicais',
          'Gêneros Literários',
          'Jogos de Mesa',
          'Videogames',
          'Séries',
          'Mangás e Quadrinhos'
        )
      )
      ORDER BY level, name
    `, nonProfessionPatterns);
    
    console.log(`📊 Categorias não-profissionais encontradas: ${nonProfessions.rows.length}\n`);
    
    if (nonProfessions.rows.length === 0) {
      console.log('✅ Nenhuma categoria não-profissional encontrada!');
      return;
    }
    
    // 3. Exibir categorias encontradas
    console.log('=== CATEGORIAS NÃO-PROFISSIONAIS ===\n');
    nonProfessions.rows.forEach(cat => {
      const filhos = parseInt(cat.num_filhos) || 0;
      console.log(`❌ ${cat.name} (${cat.slug})`);
      console.log(`   Level: ${cat.level} | Filhos: ${filhos} | Status: ${cat.status || 'N/A'}`);
      if (cat.parent_name) {
        console.log(`   Parent: ${cat.parent_name}`);
      }
      console.log('');
    });
    
    // 4. Separar por tipo
    const grupos = nonProfessions.rows.filter(c => c.level === 0);
    const subgrupos = nonProfessions.rows.filter(c => c.level === 1);
    const profissoes = nonProfessions.rows.filter(c => c.level === 2);
    
    console.log(`\n📁 Grupos não-profissionais: ${grupos.length}`);
    console.log(`📂 Subgrupos não-profissionais: ${subgrupos.length}`);
    console.log(`❌ "Profissões" não-profissionais: ${profissoes.length}`);
    
    // 5. Verificar se há filhos antes de arquivar
    const comFilhos = nonProfessions.rows.filter(c => {
      const filhos = parseInt(c.num_filhos) || 0;
      return filhos > 0;
    });
    
    if (comFilhos.length > 0) {
      console.log(`\n⚠️ ATENÇÃO: ${comFilhos.length} categorias têm filhos:`);
      comFilhos.forEach(cat => {
        console.log(`   - ${cat.name} tem ${cat.num_filhos} filhos`);
      });
      console.log('\n💡 Essas categorias serão arquivadas junto com seus filhos.');
    }
    
    // 6. Gerar script SQL para arquivar
    console.log('\n=== GERANDO SCRIPT SQL ===\n');
    
    const sqlContent = `-- ================================================
-- Remover categorias que NÃO são profissões
-- Data: ${new Date().toISOString()}
-- Total: ${nonProfessions.rows.length} categorias
-- ================================================

BEGIN;

-- Arquivar categorias não-profissionais
${nonProfessions.rows.map(cat => 
  `-- ${cat.name} (${cat.slug}) - Level ${cat.level}\nUPDATE categories SET status = 'archived' WHERE category_id = '${cat.category_id}';`
).join('\n\n')}

COMMIT;

-- Verificar resultado
SELECT 
  level,
  status,
  COUNT(*) as total
FROM categories
WHERE status = 'archived'
GROUP BY level, status
ORDER BY level, status;

-- Profissões ativas restantes
SELECT COUNT(*) as profissoes_ativas
FROM categories
WHERE level = 2 
  AND (SELECT COUNT(*) FROM categories WHERE parent_id = categories.category_id) = 0
  AND (status = 'active' OR status = 'auto_active');
`;
    
    const fs = require('fs');
    const path = require('path');
    const sqlDir = path.join(__dirname, '../../docs/dev/sql');
    if (!fs.existsSync(sqlDir)) {
      fs.mkdirSync(sqlDir, { recursive: true });
    }
    const sqlPath = path.join(sqlDir, 'remove-non-professions.sql');
    fs.writeFileSync(sqlPath, sqlContent, 'utf8');
    
    console.log(`✅ Script SQL salvo em: ${sqlPath}`);
    console.log(`\n📝 Total de categorias para arquivar: ${nonProfessions.rows.length}`);
    console.log('\n💡 Para aplicar, execute:');
    console.log('   node backend/scripts/apply-remove-non-professions.js');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

removeNonProfessions().catch(console.error);















