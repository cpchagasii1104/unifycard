"use strict";
// src/scripts/check-pizzaiolo-parents.ts
// Verificar se categorias pai esperadas existem
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const pool_1 = require("../core/database/pool");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
async function checkPizzaioloParents() {
    console.log('🔍 Verificando categorias pai esperadas para Pizzaiolo\n');
    console.log('='.repeat(70));
    try {
        // Buscar categorias relacionadas a alimentação/gastronomia
        const alimentacaoResult = await pool_1.pool.query(`
      SELECT category_id, name, slug, level, parent_id, path
      FROM categories
      WHERE LOWER(name) LIKE '%aliment%' 
         OR LOWER(slug) LIKE '%aliment%'
         OR LOWER(name) LIKE '%gastronom%'
         OR LOWER(slug) LIKE '%gastronom%'
      ORDER BY level, name
      `);
        console.log('\n📋 Categorias relacionadas a Alimentação/Gastronomia:\n');
        if (alimentacaoResult.rows.length === 0) {
            console.log('   ❌ Nenhuma categoria encontrada');
        }
        else {
            alimentacaoResult.rows.forEach((cat) => {
                console.log(`   - ${cat.name} (slug: ${cat.slug}, level: ${cat.level}, parent: ${cat.parent_id || 'NULL'})`);
                console.log(`     Path: [${cat.path?.join(', ') || 'vazio'}]`);
            });
        }
        // Buscar todas as raízes (level 0)
        console.log('\n🌳 Todas as categorias raiz (level 0):\n');
        const rootsResult = await pool_1.pool.query(`
      SELECT category_id, name, slug, level, path
      FROM categories
      WHERE parent_id IS NULL
      ORDER BY name
      LIMIT 20
      `);
        if (rootsResult.rows.length === 0) {
            console.log('   ❌ Nenhuma categoria raiz encontrada');
        }
        else {
            rootsResult.rows.forEach((root) => {
                console.log(`   - ${root.name} (slug: ${root.slug}, id: ${root.category_id.substring(0, 8)}...)`);
                console.log(`     Path: [${root.path?.join(', ') || 'vazio'}]`);
            });
        }
        // Buscar subcategorias de nível 1 relacionadas
        console.log('\n📂 Categorias de nível 1 (subcategorias):\n');
        const level1Result = await pool_1.pool.query(`
      SELECT category_id, name, slug, level, parent_id, path
      FROM categories
      WHERE level = 1
      ORDER BY name
      LIMIT 30
      `);
        if (level1Result.rows.length === 0) {
            console.log('   ❌ Nenhuma categoria de nível 1 encontrada');
        }
        else {
            level1Result.rows.forEach((cat) => {
                console.log(`   - ${cat.name} (slug: ${cat.slug}, parent_id: ${cat.parent_id?.substring(0, 8) || 'NULL'}...)`);
            });
        }
        // Buscar profissões de nível 2 relacionadas a alimentação
        console.log('\n👨‍🍳 Profissões de nível 2 relacionadas a alimentação:\n');
        const professionsResult = await pool_1.pool.query(`
      SELECT c2.category_id, c2.name, c2.slug, c2.level, c2.parent_id, c2.path,
             c1.name as parent_name, c1.slug as parent_slug,
             c0.name as root_name, c0.slug as root_slug
      FROM categories c2
      LEFT JOIN categories c1 ON c2.parent_id = c1.category_id
      LEFT JOIN categories c0 ON c1.parent_id = c0.category_id
      WHERE c2.level = 2
        AND (
          LOWER(c2.name) LIKE '%pizza%'
          OR LOWER(c2.name) LIKE '%cozin%'
          OR LOWER(c2.name) LIKE '%chef%'
          OR LOWER(c1.name) LIKE '%aliment%'
          OR LOWER(c1.name) LIKE '%gastronom%'
          OR LOWER(c0.name) LIKE '%aliment%'
        )
      ORDER BY c2.name
      LIMIT 20
      `);
        if (professionsResult.rows.length === 0) {
            console.log('   ❌ Nenhuma profissão relacionada encontrada');
        }
        else {
            professionsResult.rows.forEach((prof) => {
                const path = prof.root_name && prof.parent_name
                    ? `${prof.root_name} > ${prof.parent_name} > ${prof.name}`
                    : prof.name;
                console.log(`   - ${prof.name} (slug: ${prof.slug})`);
                console.log(`     Hierarquia: ${path}`);
                console.log(`     Path: [${prof.path?.join(', ') || 'vazio'}]`);
            });
        }
    }
    catch (error) {
        console.error('\n❌ Erro:', error);
        if (error instanceof Error) {
            console.error('   Mensagem:', error.message);
        }
        process.exit(1);
    }
    finally {
        await pool_1.pool.end();
    }
}
checkPizzaioloParents()
    .then(() => {
    console.log('\n✅ Verificação concluída\n');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=check-pizzaiolo-parents.js.map