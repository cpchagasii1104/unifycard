"use strict";
// src/scripts/fix-pizzaiolo-hierarchy.ts
// Script para corrigir hierarquia da categoria "Pizzaiolo"
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const pool_1 = require("../core/database/pool");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
async function fixPizzaioloHierarchy() {
    console.log('🔧 Corrigindo hierarquia da categoria "Pizzaiolo"\n');
    console.log('='.repeat(70));
    try {
        // 1. Buscar IDs das categorias necessárias
        console.log('\n📋 Buscando categorias...\n');
        // Buscar Gastronomia (raiz)
        const gastronomiaResult = await pool_1.pool.query(`
      SELECT category_id, name, slug, level, parent_id, path
      FROM categories
      WHERE slug = 'gastronomia' AND parent_id IS NULL
      LIMIT 1
      `);
        if (gastronomiaResult.rows.length === 0) {
            throw new Error('❌ Categoria "Gastronomia" não encontrada');
        }
        const gastronomia = gastronomiaResult.rows[0];
        console.log(`✅ Gastronomia encontrada:`);
        console.log(`   ID: ${gastronomia.category_id}`);
        console.log(`   Nome: ${gastronomia.name}`);
        console.log(`   Level: ${gastronomia.level}`);
        // Buscar Cozinhar (subcategoria de Gastronomia)
        const cozinharResult = await pool_1.pool.query(`
      SELECT category_id, name, slug, level, parent_id, path
      FROM categories
      WHERE slug = 'cozinhar' AND parent_id = $1
      LIMIT 1
      `, [gastronomia.category_id]);
        if (cozinharResult.rows.length === 0) {
            throw new Error('❌ Categoria "Cozinhar" não encontrada como filha de Gastronomia');
        }
        const cozinhar = cozinharResult.rows[0];
        console.log(`\n✅ Cozinhar encontrada:`);
        console.log(`   ID: ${cozinhar.category_id}`);
        console.log(`   Nome: ${cozinhar.name}`);
        console.log(`   Level: ${cozinhar.level}`);
        console.log(`   Parent: ${cozinhar.parent_id} (Gastronomia)`);
        // Buscar Pizzaiolo
        const pizzaioloResult = await pool_1.pool.query(`
      SELECT category_id, name, slug, level, parent_id, path
      FROM categories
      WHERE slug = 'pizzaiolo'
      LIMIT 1
      `);
        if (pizzaioloResult.rows.length === 0) {
            throw new Error('❌ Categoria "Pizzaiolo" não encontrada');
        }
        const pizzaiolo = pizzaioloResult.rows[0];
        console.log(`\n📌 Pizzaiolo atual:`);
        console.log(`   ID: ${pizzaiolo.category_id}`);
        console.log(`   Nome: ${pizzaiolo.name}`);
        console.log(`   Level: ${pizzaiolo.level} (INCORRETO - deveria ser 2)`);
        console.log(`   Parent ID: ${pizzaiolo.parent_id || 'NULL (INCORRETO)'}`);
        console.log(`   Path: [${pizzaiolo.path?.join(', ') || 'vazio'}]`);
        // Verificar se já está correto
        if (pizzaiolo.parent_id === cozinhar.category_id && pizzaiolo.level === 2) {
            console.log('\n✅ Pizzaiolo já está com hierarquia correta!');
            process.exit(0);
            return;
        }
        // 2. Calcular path correto
        const correctPath = [gastronomia.slug, cozinhar.slug, pizzaiolo.slug];
        console.log(`\n📊 Path correto: [${correctPath.join(', ')}]`);
        // 3. Recalcular path recursivamente
        console.log('\n🔧 Recalculando path...\n');
        // Função auxiliar para calcular path recursivo
        async function calculatePathRecursive(categoryId) {
            const catResult = await pool_1.pool.query(`SELECT category_id, parent_id, slug FROM categories WHERE category_id = $1`, [categoryId]);
            if (catResult.rows.length === 0) {
                return [];
            }
            const cat = catResult.rows[0];
            if (!cat.parent_id) {
                return [cat.slug];
            }
            const parentPath = await calculatePathRecursive(cat.parent_id);
            return [...parentPath, cat.slug];
        }
        // 4. Atualizar categoria usando pool diretamente
        console.log('   Atualizando parent_id e level...');
        await pool_1.pool.query(`
      UPDATE categories
      SET parent_id = $1, level = $2
      WHERE category_id = $3
      `, [cozinhar.category_id, 2, pizzaiolo.category_id]);
        // 5. Recalcular path após atualizar parent
        console.log('   Recalculando path recursivo...');
        const recalculatedPath = await calculatePathRecursive(pizzaiolo.category_id);
        // Atualizar path
        await pool_1.pool.query(`
      UPDATE categories
      SET path = $1
      WHERE category_id = $2
      `, [recalculatedPath, pizzaiolo.category_id]);
        console.log(`   ✅ Path recalculado: [${recalculatedPath.join(', ')}]`);
        // 4. Verificar resultado
        const verifyResult = await pool_1.pool.query(`
      SELECT category_id, name, slug, level, parent_id, path
      FROM categories
      WHERE category_id = $1
      `, [pizzaiolo.category_id]);
        const fixed = verifyResult.rows[0];
        console.log('✅ Categoria atualizada com sucesso!\n');
        console.log(`   ID: ${fixed.category_id}`);
        console.log(`   Nome: ${fixed.name}`);
        console.log(`   Level: ${fixed.level} ✅`);
        console.log(`   Parent ID: ${fixed.parent_id} ✅`);
        console.log(`   Path: [${fixed.path?.join(', ')}] ✅`);
        // 6. Nota sobre cache
        console.log('\n💡 Nota: Cache será invalidado na próxima requisição');
        console.log('\n' + '='.repeat(70));
        console.log('\n📋 Resumo da Correção:\n');
        console.log(JSON.stringify({
            antes: {
                level: pizzaiolo.level,
                parent_id: pizzaiolo.parent_id,
                path: pizzaiolo.path,
            },
            depois: {
                level: fixed.level,
                parent_id: fixed.parent_id,
                path: fixed.path,
            },
            hierarquia_correta: `${gastronomia.name} > ${cozinhar.name} > ${fixed.name}`,
        }, null, 2));
    }
    catch (error) {
        console.error('\n❌ Erro ao corrigir categoria:', error);
        if (error instanceof Error) {
            console.error('   Mensagem:', error.message);
            console.error('   Stack:', error.stack);
        }
        process.exit(1);
    }
    finally {
        await pool_1.pool.end();
    }
}
// Executar correção
fixPizzaioloHierarchy()
    .then(() => {
    console.log('\n✅ Correção concluída com sucesso!\n');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
