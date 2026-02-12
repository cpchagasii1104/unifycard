// Script para inserir categorias de grupo (da migration 113)
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../src/core/database/pool';

dotenv.config({ path: join(process.cwd(), '..', '.env') });

async function seedCategories() {
  try {
    console.log('📦 Inserindo categorias de grupo...\n');

    const categories = [
      { name: 'Bandas & Música', slug: 'bandas-musica', icon: '🎵', description: 'Grupos de música, bandas e artistas' },
      { name: 'Motoclubes', slug: 'motoclubes', icon: '🏍️', description: 'Clubes de motociclistas e apaixonados por motos' },
      { name: 'Igrejas & Fé', slug: 'igrejas-fe', icon: '⛪', description: 'Comunidades religiosas e grupos de fé' },
      { name: 'Esporte & Lazer', slug: 'esporte-lazer', icon: '⚽', description: 'Esportes, atividades físicas e lazer' },
      { name: 'Games', slug: 'games', icon: '🎮', description: 'Jogos, e-sports e comunidades gamer' },
      { name: 'Estudos & Educação', slug: 'estudos-educacao', icon: '📚', description: 'Grupos de estudo, educação e aprendizado' },
      { name: 'Negócios & Empreendedorismo', slug: 'negocios-empreendedorismo', icon: '💼', description: 'Networking, negócios e empreendedorismo' },
      { name: 'Impacto Social', slug: 'impacto-social', icon: '🤝', description: 'Causas sociais, voluntariado e impacto' },
      { name: 'Cultura & Arte', slug: 'cultura-arte', icon: '🎨', description: 'Arte, cultura e expressão artística' }
    ];

    for (const cat of categories) {
      try {
        await pool.query(`
          INSERT INTO group_categories (name, slug, icon, description)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (slug) DO NOTHING
        `, [cat.name, cat.slug, cat.icon, cat.description]);
        console.log(`✅ ${cat.name}`);
      } catch (err: any) {
        console.log(`⚠️  ${cat.name} (já existe ou erro: ${err.message})`);
      }
    }

    // Listar categorias inseridas
    const result = await pool.query(`
      SELECT category_id, name, slug FROM group_categories ORDER BY created_at
    `);

    console.log(`\n📋 Total de categorias: ${result.rows.length}\n`);
    result.rows.forEach((cat: any) => {
      console.log(`   - ${cat.name} (${cat.slug}) - ID: ${cat.category_id}`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

seedCategories();
