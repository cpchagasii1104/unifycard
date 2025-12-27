"use strict";
// src/scripts/migrate-categories-to-subcategories.ts
// Script para reorganizar categorias: mover profissões de categorias principais para subcategorias
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const pool_1 = require("../core/database/pool");
const categories_service_1 = require("../core/categories/categories.service");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
/**
 * Mapeamento de profissões para suas novas subcategorias
 */
const PROFESSION_MIGRATIONS = [
    // Cinema e Audiovisual
    {
        categoryName: 'Cinema e Audiovisual',
        professionName: 'Produtor Audiovisual',
        newSubcategoryName: 'Produção Audiovisual',
        newSubcategorySlug: 'producao-audiovisual',
        newSubcategoryDescription: 'Produção e coordenação de projetos audiovisuais',
    },
    {
        categoryName: 'Cinema e Audiovisual',
        professionName: 'Operador de Câmera',
        newSubcategoryName: 'Captação de Imagem e Som',
        newSubcategorySlug: 'captacao-imagem-som',
        newSubcategoryDescription: 'Captação de imagem e som para produções',
    },
    {
        categoryName: 'Cinema e Audiovisual',
        professionName: 'Editor de Vídeo',
        newSubcategoryName: 'Pós-produção',
        newSubcategorySlug: 'pos-producao',
        newSubcategoryDescription: 'Edição e finalização de conteúdo audiovisual',
    },
    // Entretenimento e Jogos
    {
        categoryName: 'Entretenimento e Jogos',
        professionName: 'Criador de Conteúdo Gamer',
        newSubcategoryName: 'Criação de Conteúdo',
        newSubcategorySlug: 'criacao-conteudo',
        newSubcategoryDescription: 'Criação de conteúdo para jogos e entretenimento',
    },
    {
        categoryName: 'Entretenimento e Jogos',
        professionName: 'Streamer',
        newSubcategoryName: 'Criação de Conteúdo',
        newSubcategorySlug: 'criacao-conteudo',
        newSubcategoryDescription: 'Criação de conteúdo para jogos e entretenimento',
    },
    // Leitura e Literatura
    {
        categoryName: 'Leitura e Literatura',
        professionName: 'Escritor',
        newSubcategoryName: 'Criação Literária',
        newSubcategorySlug: 'criacao-literaria',
        newSubcategoryDescription: 'Criação de obras literárias',
    },
    {
        categoryName: 'Leitura e Literatura',
        professionName: 'Redator',
        newSubcategoryName: 'Produção de Conteúdo',
        newSubcategorySlug: 'producao-conteudo',
        newSubcategoryDescription: 'Produção de conteúdo textual',
    },
    {
        categoryName: 'Leitura e Literatura',
        professionName: 'Revisor de Texto',
        newSubcategoryName: 'Revisão e Preparação de Texto',
        newSubcategorySlug: 'revisao-preparacao-texto',
        newSubcategoryDescription: 'Revisão e preparação de textos',
    },
];
async function migrateCategories() {
    console.log('🔄 Iniciando migração de categorias para subcategorias...\n');
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
        throw new Error('❌ ERRO CRÍTICO: Scripts de migração NÃO podem ser executados em produção!');
    }
    try {
        // Agrupar por categoria principal e subcategoria
        const migrationsByCategory = new Map();
        for (const migration of PROFESSION_MIGRATIONS) {
            if (!migrationsByCategory.has(migration.categoryName)) {
                migrationsByCategory.set(migration.categoryName, new Map());
            }
            const subcategoryMap = migrationsByCategory.get(migration.categoryName);
            if (!subcategoryMap.has(migration.newSubcategoryName)) {
                subcategoryMap.set(migration.newSubcategoryName, []);
            }
            subcategoryMap.get(migration.newSubcategoryName).push(migration);
        }
        // Processar cada categoria principal
        for (const [categoryName, subcategoryMap] of migrationsByCategory) {
            console.log(`\n📁 Processando categoria: ${categoryName}`);
            // Buscar categoria principal
            const categoryResult = await pool_1.pool.query(`
        SELECT category_id, name, parent_id
        FROM categories
        WHERE name = $1 AND parent_id IS NULL
        LIMIT 1
        `, [categoryName]);
            if (categoryResult.rows.length === 0) {
                console.log(`   ⚠️  Categoria "${categoryName}" não encontrada. Pulando...`);
                continue;
            }
            const mainCategory = categoryResult.rows[0];
            console.log(`   ✅ Categoria encontrada: ${mainCategory.category_id}`);
            // Processar cada subcategoria
            for (const [subcategoryName, professions] of subcategoryMap) {
                const firstProfession = professions[0];
                console.log(`\n  📂 Processando subcategoria: ${subcategoryName}`);
                // Verificar se subcategoria já existe
                let subcategoryId;
                const existingSubcategory = await pool_1.pool.query(`
          SELECT category_id
          FROM categories
          WHERE name = $1 AND parent_id = $2
          LIMIT 1
          `, [subcategoryName, mainCategory.category_id]);
                if (existingSubcategory.rows.length > 0) {
                    subcategoryId = existingSubcategory.rows[0].category_id;
                    console.log(`     ✅ Subcategoria já existe: ${subcategoryId}`);
                }
                else {
                    // Criar subcategoria
                    console.log(`     📦 Criando subcategoria: ${subcategoryName}`);
                    const newSubcategory = await categories_service_1.categoriesService.createCategory({
                        name: subcategoryName,
                        slug: firstProfession.newSubcategorySlug,
                        description: firstProfession.newSubcategoryDescription,
                        parentId: mainCategory.category_id,
                        allowActive: true,
                        createdBy: {
                            source: 'script',
                        },
                    }, {
                        validateAdmin: false,
                    });
                    subcategoryId = newSubcategory.categoryId;
                    console.log(`     ✅ Subcategoria criada: ${subcategoryId}`);
                }
                // Mover profissões para a subcategoria
                for (const profession of professions) {
                    console.log(`     🔄 Movendo profissão: ${profession.professionName}`);
                    // Buscar profissão diretamente ligada à categoria principal
                    const professionResult = await pool_1.pool.query(`
            SELECT category_id, name, parent_id
            FROM categories
            WHERE name = $1 AND parent_id = $2
            LIMIT 1
            `, [profession.professionName, mainCategory.category_id]);
                    if (professionResult.rows.length === 0) {
                        console.log(`       ⚠️  Profissão "${profession.professionName}" não encontrada diretamente na categoria principal.`);
                        // Verificar se já está em alguma subcategoria
                        const existingProfession = await pool_1.pool.query(`
              SELECT category_id, parent_id
              FROM categories
              WHERE name = $1
              LIMIT 1
              `, [profession.professionName]);
                        if (existingProfession.rows.length > 0) {
                            const existing = existingProfession.rows[0];
                            if (existing.parent_id === subcategoryId) {
                                console.log(`       ✅ Profissão já está na subcategoria correta.`);
                            }
                            else {
                                console.log(`       ⚠️  Profissão existe mas está em outra subcategoria (${existing.parent_id}).`);
                            }
                        }
                        continue;
                    }
                    const professionCategory = professionResult.rows[0];
                    // Atualizar parent_id da profissão
                    await pool_1.pool.query(`
            UPDATE categories
            SET parent_id = $1, updated_at = now()
            WHERE category_id = $2
            `, [subcategoryId, professionCategory.category_id]);
                    console.log(`       ✅ Profissão movida para subcategoria ${subcategoryName}`);
                }
            }
        }
        console.log('\n✨ Migração concluída com sucesso!');
    }
    catch (error) {
        console.error('\n❌ Erro durante migração:', error);
        throw error;
    }
    finally {
        await pool_1.pool.end();
    }
}
// Executar migração
migrateCategories()
    .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=migrate-categories-to-subcategories.js.map