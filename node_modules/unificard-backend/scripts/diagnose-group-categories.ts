// Script de diagnóstico: group_categories
// Verifica estado da tabela e aplica seed se necessário

import { pool } from '../src/core/database/pool';
import 'dotenv/config';

async function diagnoseGroupCategories() {
  console.log('🔍 Iniciando diagnóstico de group_categories...\n');

  try {
    // 1. Verificar se migration 113 foi executada
    console.log('1️⃣ Verificando migration 113...');
    const migrationCheck = await pool.query<{ check: string; resultado: number | string }>(
      `SELECT 'migration_113' AS check, COUNT(*)::text AS resultado
       FROM schema_migrations
       WHERE filename LIKE '%113%'`
    );
    const migration113Executed = migrationCheck.rows[0]?.resultado !== '0';
    console.log(`   Migration 113 executada: ${migration113Executed ? '✅ SIM' : '❌ NÃO'}`);

    // 2. Contar categorias existentes
    console.log('\n2️⃣ Contando categorias em group_categories...');
    const countResult = await pool.query<{ check: string; resultado: number | string }>(
      `SELECT 'total_categorias' AS check, COUNT(*)::text AS resultado
       FROM group_categories`
    );
    const totalCategorias = parseInt(countResult.rows[0]?.resultado || '0', 10);
    console.log(`   Total de categorias: ${totalCategorias}`);

    // 3. Verificar primeira categoria (se houver)
    console.log('\n3️⃣ Verificando primeira categoria...');
    const firstCategory = await pool.query<{ check: string; resultado: number | string }>(
      `SELECT 'primeira_categoria' AS check, COALESCE(name, 'NENHUMA') AS resultado
       FROM group_categories
       LIMIT 1`
    );
    const primeiraCategoria = firstCategory.rows[0]?.resultado || 'NENHUMA';
    console.log(`   Primeira categoria: ${primeiraCategoria}`);

    // 4. Decisão: aplicar seed ou não
    console.log('\n4️⃣ Decisão:');
    if (totalCategorias > 0) {
      console.log('   ✅ Tabela já possui categorias. Nenhuma ação necessária.');
      
      // Listar todas as categorias
      const allCategories = await pool.query<{ name: string; slug: string; icon: string | null }>(
        `SELECT name, slug, icon FROM group_categories ORDER BY name`
      );
      console.log(`\n   Categorias existentes (${allCategories.rows.length}):`);
      allCategories.rows.forEach((cat, idx) => {
        console.log(`   ${idx + 1}. ${cat.icon || ''} ${cat.name} (${cat.slug})`);
      });
    } else {
      console.log('   ⚠️  Tabela vazia. Aplicando seed idempotente...\n');
      
      const insertResult = await pool.query(
        `INSERT INTO group_categories (name, slug, icon, description) VALUES
          ('Bandas & Música', 'bandas-musica', '🎵', 'Grupos de música, bandas e artistas'),
          ('Motoclubes', 'motoclubes', '🏍️', 'Clubes de motociclistas e apaixonados por motos'),
          ('Igrejas & Fé', 'igrejas-fe', '⛪', 'Comunidades religiosas e grupos de fé'),
          ('Esporte & Lazer', 'esporte-lazer', '⚽', 'Esportes, atividades físicas e lazer'),
          ('Games', 'games', '🎮', 'Jogos, e-sports e comunidades gamer'),
          ('Estudos & Educação', 'estudos-educacao', '📚', 'Grupos de estudo, educação e aprendizado'),
          ('Negócios & Empreendedorismo', 'negocios-empreendedorismo', '💼', 'Networking, negócios e empreendedorismo'),
          ('Impacto Social', 'impacto-social', '🤝', 'Causas sociais, voluntariado e impacto'),
          ('Cultura & Arte', 'cultura-arte', '🎨', 'Arte, cultura e expressão artística')
        ON CONFLICT (slug) DO NOTHING
        RETURNING name, slug`
      );
      
      console.log(`   ✅ Seed aplicado: ${insertResult.rows.length} categorias inseridas`);
      
      // Verificar total final
      const finalCount = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM group_categories`
      );
      console.log(`   ✅ Total final de categorias: ${finalCount.rows[0].count}`);
    }

    console.log('\n✅ Diagnóstico concluído com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Erro durante diagnóstico:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
diagnoseGroupCategories();







