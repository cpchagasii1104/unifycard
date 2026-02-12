// Script para aplicar seed de group_categories de forma idempotente
// Cria a tabela se não existir e insere as categorias

import { pool } from '../src/core/database/pool';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyGroupCategoriesSeed() {
  console.log('🔧 Aplicando seed idempotente de group_categories...\n');

  try {
    // 1. Criar tabela se não existir (extraído da migration 113)
    console.log('1️⃣ Criando tabela group_categories (se não existir)...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_categories (
        category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        icon VARCHAR(50),
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('   ✅ Tabela criada/verificada');

    // 2. Criar índice se não existir
    console.log('\n2️⃣ Criando índice (se não existir)...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_group_categories_slug ON group_categories(slug)
    `);
    console.log('   ✅ Índice criado/verificado');

    // 3. Contar categorias existentes
    console.log('\n3️⃣ Verificando categorias existentes...');
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM group_categories`
    );
    const totalCategorias = parseInt(countResult.rows[0]?.count || '0', 10);
    console.log(`   Total atual: ${totalCategorias}`);

    // 4. Aplicar seed se necessário
    if (totalCategorias === 0) {
      console.log('\n4️⃣ Aplicando seed de categorias...');
      const insertResult = await pool.query<{ name: string; slug: string }>(
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
      console.log(`   ✅ ${insertResult.rows.length} categorias inseridas`);
    } else {
      console.log('\n4️⃣ Seed não necessário - categorias já existem');
    }

    // 5. Verificar resultado final
    console.log('\n5️⃣ Verificando resultado final...');
    const finalCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM group_categories`
    );
    const finalTotal = parseInt(finalCount.rows[0]?.count || '0', 10);
    console.log(`   ✅ Total final: ${finalTotal} categorias`);

    // 6. Listar todas as categorias
    const allCategories = await pool.query<{ name: string; slug: string; icon: string | null }>(
      `SELECT name, slug, icon FROM group_categories ORDER BY name`
    );
    console.log(`\n📋 Categorias disponíveis (${allCategories.rows.length}):`);
    allCategories.rows.forEach((cat, idx) => {
      console.log(`   ${idx + 1}. ${cat.icon || ''} ${cat.name} (${cat.slug})`);
    });

    console.log('\n✅ Seed aplicado com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Erro ao aplicar seed:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
applyGroupCategoriesSeed();







