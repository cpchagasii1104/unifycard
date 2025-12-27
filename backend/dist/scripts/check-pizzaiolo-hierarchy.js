"use strict";
// src/scripts/check-pizzaiolo-hierarchy.ts
// Script para diagnosticar hierarquia da categoria "Pizzaiolo"
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const pool_1 = require("../core/database/pool");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
async function checkPizzaioloHierarchy() {
    console.log('🔍 Diagnosticando hierarquia da categoria "Pizzaiolo"\n');
    console.log('='.repeat(70));
    try {
        // Verificar se coluna status existe
        const statusCheck = await pool_1.pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'status'
      ) as exists
      `);
        const hasStatusColumn = statusCheck.rows[0]?.exists || false;
        // Construir query dinamicamente
        const statusFields = hasStatusColumn
            ? 'status, requires_review, created_by_ai,'
            : '';
        // Buscar categoria pelo slug
        const result = await pool_1.pool.query(`
      SELECT 
        category_id,
        parent_id,
        name,
        slug,
        description,
        level,
        path,
        ${statusFields}
        country_code,
        created_at,
        updated_at
      FROM categories
      WHERE slug = $1
      LIMIT 1
      `, ['pizzaiolo']);
        if (result.rows.length === 0) {
            console.log('❌ Categoria "Pizzaiolo" NÃO encontrada no banco de dados');
            console.log('\n💡 Verificando variações de slug...\n');
            // Buscar variações
            const variations = await pool_1.pool.query(`
        SELECT category_id, name, slug, level, parent_id, path, status
        FROM categories
        WHERE LOWER(name) LIKE '%pizza%' OR LOWER(slug) LIKE '%pizza%'
        ORDER BY name
        `);
            if (variations.rows.length > 0) {
                console.log('📋 Categorias relacionadas encontradas:');
                variations.rows.forEach((cat) => {
                    console.log(`   - ${cat.name} (slug: ${cat.slug}, level: ${cat.level}, status: ${cat.status || 'NULL'})`);
                });
            }
            else {
                console.log('   Nenhuma categoria relacionada encontrada');
            }
            process.exit(0);
            return;
        }
        const category = result.rows[0];
        console.log('\n✅ Categoria encontrada:\n');
        console.log(`   ID: ${category.category_id}`);
        console.log(`   Nome: ${category.name}`);
        console.log(`   Slug: ${category.slug}`);
        console.log(`   Descrição: ${category.description || '(sem descrição)'}`);
        console.log(`   Level: ${category.level}`);
        if (hasStatusColumn) {
            console.log(`   Status: ${category.status || 'NULL'}`);
            console.log(`   Requires Review: ${category.requires_review || false}`);
            console.log(`   Created by AI: ${category.created_by_ai || false}`);
        }
        else {
            console.log(`   Status: (coluna não existe no banco)`);
        }
        console.log(`   Country Code: ${category.country_code || 'NULL (global)'}`);
        console.log(`   Created At: ${category.created_at}`);
        console.log(`   Updated At: ${category.updated_at}`);
        console.log(`\n   Parent ID: ${category.parent_id || 'NULL (é raiz)'}`);
        console.log(`   Path: [${category.path?.join(', ') || 'vazio'}]`);
        // Buscar informações do parent se existir
        if (category.parent_id) {
            console.log('\n📂 Informações do Parent:');
            const parentResult = await pool_1.pool.query(`
        SELECT category_id, name, slug, level, path, status
        FROM categories
        WHERE category_id = $1
        `, [category.parent_id]);
            if (parentResult.rows.length > 0) {
                const parent = parentResult.rows[0];
                console.log(`   ID: ${parent.category_id}`);
                console.log(`   Nome: ${parent.name}`);
                console.log(`   Slug: ${parent.slug}`);
                console.log(`   Level: ${parent.level}`);
                console.log(`   Path: [${parent.path?.join(', ') || 'vazio'}]`);
                if (hasStatusColumn) {
                    console.log(`   Status: ${parent.status || 'NULL'}`);
                }
                // Buscar root se parent não for raiz
                if (parent.parent_id) {
                    const rootResult = await pool_1.pool.query(`
            SELECT category_id, name, slug, level, path, status
            FROM categories
            WHERE category_id = $1
            `, [parent.parent_id]);
                    if (rootResult.rows.length > 0) {
                        const root = rootResult.rows[0];
                        console.log('\n🌳 Informações do Root:');
                        console.log(`   ID: ${root.category_id}`);
                        console.log(`   Nome: ${root.name}`);
                        console.log(`   Slug: ${root.slug}`);
                        console.log(`   Level: ${root.level}`);
                        console.log(`   Path: [${root.path?.join(', ') || 'vazio'}]`);
                        if (hasStatusColumn) {
                            console.log(`   Status: ${root.status || 'NULL'}`);
                        }
                    }
                }
                else {
                    console.log('\n🌳 Parent é a raiz (level 0)');
                }
            }
            else {
                console.log('   ⚠️  Parent não encontrado (parent_id inválido?)');
            }
        }
        // Verificar hierarquia completa esperada
        console.log('\n' + '='.repeat(70));
        console.log('\n📊 Análise da Hierarquia:\n');
        const expectedPath = category.path || [];
        const currentLevel = category.level;
        console.log(`   Level atual: ${currentLevel}`);
        console.log(`   Path atual: ${expectedPath.length > 0 ? expectedPath.join(' > ') : '(vazio)'}`);
        // Verificar se path está correto
        if (expectedPath.length > 0) {
            const pathFromSlug = expectedPath[expectedPath.length - 1];
            if (pathFromSlug !== category.slug) {
                console.log(`   ⚠️  AVISO: Último item do path ("${pathFromSlug}") não corresponde ao slug ("${category.slug}")`);
            }
            else {
                console.log(`   ✅ Path termina com slug correto`);
            }
        }
        // Verificar nível esperado
        if (currentLevel === 0) {
            console.log(`   ⚠️  AVISO: Pizzaiolo está como raiz (level 0), mas deveria ser profissão (level 2)`);
        }
        else if (currentLevel === 1) {
            console.log(`   ⚠️  AVISO: Pizzaiolo está como subcategoria (level 1), mas deveria ser profissão (level 2)`);
        }
        else if (currentLevel === 2) {
            console.log(`   ✅ Level correto: Pizzaiolo é uma profissão (level 2)`);
        }
        else {
            console.log(`   ⚠️  AVISO: Level ${currentLevel} é incomum para uma profissão`);
        }
        // Verificar se path tem 3 níveis (root > parent > leaf)
        if (expectedPath.length === 3) {
            console.log(`   ✅ Path tem 3 níveis (esperado para profissão)`);
        }
        else if (expectedPath.length === 2) {
            console.log(`   ⚠️  AVISO: Path tem apenas 2 níveis, esperado 3 (root > parent > leaf)`);
        }
        else if (expectedPath.length === 1) {
            console.log(`   ⚠️  AVISO: Path tem apenas 1 nível, esperado 3`);
        }
        else {
            console.log(`   ⚠️  AVISO: Path tem ${expectedPath.length} níveis, esperado 3`);
        }
        // Verificar status
        if (hasStatusColumn) {
            if (!category.status || category.status === 'active') {
                console.log(`   ✅ Status: active (categoria ativa)`);
            }
            else if (category.status === 'pending') {
                console.log(`   ⚠️  AVISO: Status é 'pending' (aguardando aprovação)`);
            }
            else {
                console.log(`   ⚠️  AVISO: Status é '${category.status}'`);
            }
        }
        else {
            console.log(`   ℹ️  Coluna status não existe (migration 056 ainda não executada?)`);
        }
        console.log('\n' + '='.repeat(70));
        console.log('\n📋 Resumo do Diagnóstico:\n');
        const summary = {
            id: category.category_id,
            name: category.name,
            slug: category.slug,
            parent_id: category.parent_id,
            level: category.level,
            path: category.path,
        };
        if (hasStatusColumn) {
            summary.status = category.status || 'NULL';
            summary.requires_review = category.requires_review || false;
            summary.created_by_ai = category.created_by_ai || false;
        }
        console.log(JSON.stringify(summary, null, 2));
    }
    catch (error) {
        console.error('\n❌ Erro ao buscar categoria:', error);
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
// Executar diagnóstico
checkPizzaioloHierarchy()
    .then(() => {
    console.log('\n✅ Diagnóstico concluído\n');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=check-pizzaiolo-hierarchy.js.map