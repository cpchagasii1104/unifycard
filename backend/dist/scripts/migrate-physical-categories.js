"use strict";
// src/scripts/migrate-physical-categories.ts
// Script para arquivar categorias antigas do Físico que não se encaixam no novo modelo
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const pool_1 = require("../core/database/pool");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
/**
 * Categorias antigas que devem ser arquivadas (não se encaixam no novo modelo de prazer)
 *
 * REGRA: Se a categoria fizer o usuário se perguntar "isso vira trabalho?" → arquivar
 */
const CATEGORIES_TO_ARCHIVE = [
    // Categorias que soam profissionais demais
    'Cinema e Audiovisual', // Substituída por "Assistir e Consumir Conteúdo"
    'Entretenimento e Jogos', // Substituída por "Jogar e Brincar"
    'Leitura e Literatura', // Substituída por "Ler e Aprender por Prazer"
    'Música', // Substituída por "Ouvir e Fazer Música"
    'Arte e Criatividade', // Substituída por "Criar e Expressar"
    'Gastronomia', // Substituída por "Cozinhar e Comer Bem"
    'Esportes e Atividades Físicas', // Substituída por "Se Movimentar"
];
/**
 * Subcategorias antigas que devem ser arquivadas
 */
const SUBCATEGORIES_TO_ARCHIVE = [
    // Subcategorias que soam profissionais
    'Gêneros de Filme', // Substituída por "Filmes"
    'Séries', // Mantida mas dentro de nova estrutura
    'Gêneros Literários', // Substituída por "Leitura Recreativa"
    'Mangás e Quadrinhos', // Substituída por "HQs e Mangás"
    'Gêneros Musicais', // Substituída por "Ouvir Música"
    'Instrumentos', // Substituída por "Tocar Instrumentos"
    'Artes Visuais', // Substituída por "Artes Visuais" (mantida mas com novo contexto)
    'Artesanato', // Mantida mas com novo contexto
    'Cozinhar', // Substituída por "Cozinhar em Casa"
    'Restaurantes e Bares', // Substituída por "Gastronomia" (hobby)
    'Esportes Coletivos', // Substituída por "Esportes Recreativos"
    'Esportes Individuais', // Substituída por "Atividades Físicas"
];
async function migratePhysicalCategories() {
    console.log('🔄 Iniciando migração de categorias FÍSICAS...\n');
    console.log('📋 PRINCÍPIO: Arquivar categorias que não se encaixam no modelo de prazer\n');
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
        throw new Error('❌ ERRO CRÍTICO: Scripts de migração NÃO podem ser executados em produção!');
    }
    try {
        // Verificar se coluna status existe
        const statusCheck = await pool_1.pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'status'
      ) as exists
      `);
        const hasStatusColumn = statusCheck.rows[0]?.exists || false;
        if (!hasStatusColumn) {
            console.log('⚠️  Coluna "status" não existe. Pulando arquivamento.');
            console.log('💡 Execute as migrations primeiro para adicionar a coluna status.');
            return;
        }
        let archivedCount = 0;
        // Arquivar categorias principais antigas
        console.log('📁 Arquivando categorias principais antigas...');
        for (const categoryName of CATEGORIES_TO_ARCHIVE) {
            const result = await pool_1.pool.query(`
        SELECT category_id, name, status
        FROM categories
        WHERE name = $1 AND parent_id IS NULL
        LIMIT 1
        `, [categoryName]);
            if (result.rows.length > 0) {
                const category = result.rows[0];
                // Só arquivar se ainda não estiver arquivada
                if (category.status !== 'archived') {
                    await pool_1.pool.query(`
            UPDATE categories
            SET status = 'archived', updated_at = now()
            WHERE category_id = $1
            `, [category.category_id]);
                    console.log(`   ✅ Arquivada: ${category.name}`);
                    archivedCount++;
                    // Arquivar também todas as subcategorias e filhos
                    await pool_1.pool.query(`
            UPDATE categories
            SET status = 'archived', updated_at = now()
            WHERE path @> ARRAY[$1::text]
              AND category_id != $1
              AND status != 'archived'
            `, [category.category_id]);
                }
                else {
                    console.log(`   ⏭️  Já arquivada: ${category.name}`);
                }
            }
            else {
                console.log(`   ⚠️  Não encontrada: ${categoryName}`);
            }
        }
        // Arquivar subcategorias específicas que não se encaixam
        console.log('\n📂 Arquivando subcategorias antigas...');
        for (const subcategoryName of SUBCATEGORIES_TO_ARCHIVE) {
            const result = await pool_1.pool.query(`
        SELECT category_id, name, status, parent_id
        FROM categories
        WHERE name = $1 AND parent_id IS NOT NULL
        LIMIT 1
        `, [subcategoryName]);
            if (result.rows.length > 0) {
                const subcategory = result.rows[0];
                // Verificar se a categoria pai está arquivada
                const parentCheck = await pool_1.pool.query(`SELECT status FROM categories WHERE category_id = $1`, [subcategory.parent_id]);
                // Se a categoria pai não está arquivada, arquivar apenas a subcategoria
                if (parentCheck.rows[0]?.status !== 'archived' && subcategory.status !== 'archived') {
                    await pool_1.pool.query(`
            UPDATE categories
            SET status = 'archived', updated_at = now()
            WHERE category_id = $1
            `, [subcategory.category_id]);
                    console.log(`   ✅ Arquivada: ${subcategory.name}`);
                    archivedCount++;
                    // Arquivar também todos os filhos
                    await pool_1.pool.query(`
            UPDATE categories
            SET status = 'archived', updated_at = now()
            WHERE path @> ARRAY[$1::text]
              AND category_id != $1
              AND status != 'archived'
            `, [subcategory.category_id]);
                }
                else {
                    console.log(`   ⏭️  Já arquivada ou pai arquivado: ${subcategory.name}`);
                }
            }
        }
        console.log(`\n✨ Migração concluída!`);
        console.log(`   📊 Total de categorias arquivadas: ${archivedCount}`);
        console.log('\n💡 Próximo passo: Execute o seed-physical-categories.ts para criar as novas categorias');
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
migratePhysicalCategories()
    .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
