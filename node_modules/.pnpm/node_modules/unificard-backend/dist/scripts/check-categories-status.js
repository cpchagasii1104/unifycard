"use strict";
// src/scripts/check-categories-status.ts
// Script para verificar o status das categorias problemáticas
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const pool_1 = require("../core/database/pool");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
const CATEGORIES_TO_CHECK = [
    'Cinema e Audiovisual',
    'Entretenimento e Jogos',
    'Leitura e Literatura',
];
const SUBCATEGORIES_TO_CHECK = [
    'Produção Audiovisual',
    'Captação de Imagem e Som',
    'Pós-produção',
    'Criação de Conteúdo',
    'Criação Literária',
    'Produção de Conteúdo',
    'Revisão e Preparação de Texto',
];
const PROFESSIONS_TO_CHECK = [
    'Produtor Audiovisual',
    'Operador de Câmera',
    'Editor de Vídeo',
    'Criador de Conteúdo Gamer',
    'Streamer',
    'Escritor',
    'Redator',
    'Revisor de Texto',
];
async function checkCategories() {
    console.log('🔍 Verificando status das categorias...\n');
    try {
        // Verificar se coluna status existe
        const statusCheck = await pool_1.pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'status'
      ) as exists
      `);
        const hasStatusColumn = statusCheck.rows[0]?.exists || false;
        console.log(`📊 Coluna 'status' existe: ${hasStatusColumn}\n`);
        // Verificar categorias principais
        console.log('📁 CATEGORIAS PRINCIPAIS:');
        for (const categoryName of CATEGORIES_TO_CHECK) {
            const result = await pool_1.pool.query(`
        SELECT category_id, name, parent_id, status, level
        FROM categories
        WHERE name = $1 AND parent_id IS NULL
        `, [categoryName]);
            if (result.rows.length === 0) {
                console.log(`   ❌ ${categoryName}: NÃO ENCONTRADA`);
            }
            else {
                const cat = result.rows[0];
                console.log(`   ${cat.status === 'active' ? '✅' : '⚠️'} ${categoryName}:`);
                console.log(`      ID: ${cat.category_id}`);
                console.log(`      Status: ${cat.status || 'NULL'}`);
                console.log(`      Level: ${cat.level}`);
                // Verificar subcategorias
                const subcats = await pool_1.pool.query(`
          SELECT category_id, name, parent_id, status, level
          FROM categories
          WHERE parent_id = $1
          ORDER BY name
          `, [cat.category_id]);
                if (subcats.rows.length === 0) {
                    console.log(`      ⚠️  Nenhuma subcategoria encontrada`);
                }
                else {
                    console.log(`      📂 Subcategorias (${subcats.rows.length}):`);
                    for (const subcat of subcats.rows) {
                        console.log(`         ${subcat.status === 'active' ? '✅' : '⚠️'} ${subcat.name} (${subcat.status || 'NULL'})`);
                        // Verificar profissões
                        const professions = await pool_1.pool.query(`
              SELECT category_id, name, parent_id, status, level
              FROM categories
              WHERE parent_id = $1
              ORDER BY name
              `, [subcat.category_id]);
                        if (professions.rows.length > 0) {
                            console.log(`            💼 Profissões (${professions.rows.length}):`);
                            for (const prof of professions.rows) {
                                console.log(`               ${prof.status === 'active' ? '✅' : '⚠️'} ${prof.name} (${prof.status || 'NULL'})`);
                            }
                        }
                    }
                }
            }
            console.log('');
        }
        // Verificar profissões diretamente ligadas às categorias principais (problema)
        console.log('🔍 VERIFICANDO PROFISSÕES DIRETAMENTE LIGADAS (PROBLEMA):');
        for (const categoryName of CATEGORIES_TO_CHECK) {
            const mainCat = await pool_1.pool.query(`SELECT category_id FROM categories WHERE name = $1 AND parent_id IS NULL LIMIT 1`, [categoryName]);
            if (mainCat.rows.length > 0) {
                const mainCatId = mainCat.rows[0].category_id;
                const directProfessions = await pool_1.pool.query(`
          SELECT category_id, name, status
          FROM categories
          WHERE parent_id = $1
            AND level = 2
          ORDER BY name
          `, [mainCatId]);
                if (directProfessions.rows.length > 0) {
                    console.log(`   ⚠️  ${categoryName} tem ${directProfessions.rows.length} profissões diretamente ligadas:`);
                    for (const prof of directProfessions.rows) {
                        console.log(`      - ${prof.name} (${prof.status || 'NULL'})`);
                    }
                }
            }
        }
        console.log('\n✨ Verificação concluída!');
    }
    catch (error) {
        console.error('❌ Erro:', error);
        throw error;
    }
    finally {
        await pool_1.pool.end();
    }
}
checkCategories()
    .then(() => {
    console.log('\n✅ Processo finalizado!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=check-categories-status.js.map