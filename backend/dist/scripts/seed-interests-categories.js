"use strict";
// src/scripts/seed-interests-categories.ts
// Seed de categorias de interesses/hobbies em 3 níveis hierárquicos
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const categories_service_1 = require("../core/categories/categories.service");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
/**
 * Estrutura de categorias de interesses em 3 níveis:
 * Nível 1: Grande área (Entretenimento, Esportes, Cultura, etc.)
 * Nível 2: Subcategoria (Jogos, Leitura, Cinema, etc.)
 * Nível 3: Interesse específico (RPG, Ficção Científica, Ação, etc.)
 */
const INTEREST_CATEGORIES = [
    // ============================================
    // ENTERTENIMENTO E JOGOS
    // ============================================
    {
        level1: { name: 'Entretenimento e Jogos', slug: 'entretenimento-jogos', description: 'Jogos, hobbies e entretenimento' },
        level2: [
            {
                name: 'Videogames',
                slug: 'videogames',
                description: 'Jogos eletrônicos',
                level3: [
                    { name: 'RPG', slug: 'rpg' },
                    { name: 'Ação', slug: 'acao' },
                    { name: 'Estratégia', slug: 'estrategia' },
                    { name: 'Esportes', slug: 'esportes' },
                    { name: 'Corrida', slug: 'corrida' },
                    { name: 'Luta', slug: 'luta' },
                    { name: 'Aventura', slug: 'aventura' },
                    { name: 'Puzzle', slug: 'puzzle' },
                    { name: 'Simulação', slug: 'simulacao' },
                ],
            },
            {
                name: 'Jogos de Mesa',
                slug: 'jogos-mesa',
                description: 'Jogos de tabuleiro e cartas',
                level3: [
                    { name: 'Xadrez', slug: 'xadrez' },
                    { name: 'Poker', slug: 'poker' },
                    { name: 'Jogos de Tabuleiro', slug: 'tabuleiro' },
                    { name: 'Magic: The Gathering', slug: 'magic' },
                    { name: 'Dungeons & Dragons', slug: 'dnd' },
                ],
            },
        ],
    },
    // ============================================
    // LEITURA E LITERATURA
    // ============================================
    {
        level1: { name: 'Leitura e Literatura', slug: 'leitura-literatura', description: 'Livros e leitura' },
        level2: [
            {
                name: 'Gêneros Literários',
                slug: 'generos-literarios',
                description: 'Tipos de leitura',
                level3: [
                    { name: 'Ficção Científica', slug: 'ficcao-cientifica' },
                    { name: 'Fantasia', slug: 'fantasia' },
                    { name: 'Romance', slug: 'romance' },
                    { name: 'Suspense', slug: 'suspense' },
                    { name: 'Terror', slug: 'terror' },
                    { name: 'Biografia', slug: 'biografia' },
                    { name: 'História', slug: 'historia' },
                    { name: 'Filosofia', slug: 'filosofia' },
                    { name: 'Autoajuda', slug: 'autoajuda' },
                    { name: 'Negócios', slug: 'negocios' },
                ],
            },
            {
                name: 'Mangás e Quadrinhos',
                slug: 'mangas-quadrinhos',
                description: 'Histórias em quadrinhos',
                level3: [
                    { name: 'Mangá', slug: 'manga' },
                    { name: 'Comics', slug: 'comics' },
                    { name: 'Graphic Novels', slug: 'graphic-novels' },
                ],
            },
        ],
    },
    // ============================================
    // CINEMA E AUDIOVISUAL
    // ============================================
    {
        level1: { name: 'Cinema e Audiovisual', slug: 'cinema-audiovisual', description: 'Filmes, séries e vídeos' },
        level2: [
            {
                name: 'Gêneros de Filme',
                slug: 'generos-filme',
                description: 'Tipos de filmes',
                level3: [
                    { name: 'Ação', slug: 'acao-filme' },
                    { name: 'Comédia', slug: 'comedia' },
                    { name: 'Drama', slug: 'drama' },
                    { name: 'Terror', slug: 'terror-filme' },
                    { name: 'Ficção Científica', slug: 'ficcao-cientifica-filme' },
                    { name: 'Romance', slug: 'romance-filme' },
                    { name: 'Documentário', slug: 'documentario' },
                    { name: 'Animação', slug: 'animacao' },
                ],
            },
            {
                name: 'Séries',
                slug: 'series',
                description: 'Séries de TV e streaming',
                level3: [
                    { name: 'Drama', slug: 'drama-serie' },
                    { name: 'Comédia', slug: 'comedia-serie' },
                    { name: 'Suspense', slug: 'suspense-serie' },
                    { name: 'Ficção Científica', slug: 'ficcao-cientifica-serie' },
                    { name: 'Fantasia', slug: 'fantasia-serie' },
                ],
            },
        ],
    },
    // ============================================
    // MÚSICA
    // ============================================
    {
        level1: { name: 'Música', slug: 'musica', description: 'Música e sons' },
        level2: [
            {
                name: 'Gêneros Musicais',
                slug: 'generos-musicais',
                description: 'Estilos musicais',
                level3: [
                    { name: 'Rock', slug: 'rock' },
                    { name: 'Pop', slug: 'pop' },
                    { name: 'Sertanejo', slug: 'sertanejo' },
                    { name: 'Funk', slug: 'funk' },
                    { name: 'Hip Hop', slug: 'hip-hop' },
                    { name: 'Eletrônica', slug: 'eletronica' },
                    { name: 'Jazz', slug: 'jazz' },
                    { name: 'Clássica', slug: 'classica' },
                    { name: 'MPB', slug: 'mpb' },
                    { name: 'Reggae', slug: 'reggae' },
                ],
            },
            {
                name: 'Instrumentos',
                slug: 'instrumentos',
                description: 'Tocar instrumentos',
                level3: [
                    { name: 'Violão', slug: 'violao' },
                    { name: 'Guitarra', slug: 'guitarra' },
                    { name: 'Piano', slug: 'piano' },
                    { name: 'Bateria', slug: 'bateria' },
                    { name: 'Baixo', slug: 'baixo' },
                ],
            },
        ],
    },
    // ============================================
    // ARTE E CRIATIVIDADE
    // ============================================
    {
        level1: { name: 'Arte e Criatividade', slug: 'arte-criatividade', description: 'Artes e expressão criativa' },
        level2: [
            {
                name: 'Artes Visuais',
                slug: 'artes-visuais',
                description: 'Pintura, desenho, etc.',
                level3: [
                    { name: 'Pintura', slug: 'pintura' },
                    { name: 'Desenho', slug: 'desenho' },
                    { name: 'Fotografia', slug: 'fotografia' },
                    { name: 'Escultura', slug: 'escultura' },
                    { name: 'Arte Digital', slug: 'arte-digital' },
                ],
            },
            {
                name: 'Artesanato',
                slug: 'artesanato',
                description: 'Trabalhos manuais',
                level3: [
                    { name: 'Tricô', slug: 'trico' },
                    { name: 'Crochê', slug: 'croche' },
                    { name: 'Costura', slug: 'costura' },
                    { name: 'Marcenaria', slug: 'marcenaria' },
                ],
            },
        ],
    },
    // ============================================
    // ESPORTES E ATIVIDADES FÍSICAS
    // ============================================
    {
        level1: { name: 'Esportes e Atividades Físicas', slug: 'esportes-atividades', description: 'Esportes e exercícios' },
        level2: [
            {
                name: 'Esportes Coletivos',
                slug: 'esportes-coletivos',
                description: 'Esportes em equipe',
                level3: [
                    { name: 'Futebol', slug: 'futebol' },
                    { name: 'Basquete', slug: 'basquete' },
                    { name: 'Vôlei', slug: 'volei' },
                    { name: 'Handebol', slug: 'handebol' },
                ],
            },
            {
                name: 'Esportes Individuais',
                slug: 'esportes-individuais',
                description: 'Esportes solo',
                level3: [
                    { name: 'Corrida', slug: 'corrida-esporte' },
                    { name: 'Ciclismo', slug: 'ciclismo' },
                    { name: 'Natação', slug: 'natacao' },
                    { name: 'Tênis', slug: 'tenis' },
                    { name: 'Musculação', slug: 'musculacao' },
                    { name: 'Yoga', slug: 'yoga' },
                    { name: 'Pilates', slug: 'pilates' },
                    { name: 'Artes Marciais', slug: 'artes-marciais' },
                ],
            },
        ],
    },
    // ============================================
    // GASTRONOMIA
    // ============================================
    {
        level1: { name: 'Gastronomia', slug: 'gastronomia', description: 'Culinária e comida' },
        level2: [
            {
                name: 'Cozinhar',
                slug: 'cozinhar',
                description: 'Preparar comida',
                level3: [
                    { name: 'Culinária Brasileira', slug: 'culinaria-brasileira' },
                    { name: 'Culinária Italiana', slug: 'culinaria-italiana' },
                    { name: 'Culinária Japonesa', slug: 'culinaria-japonesa' },
                    { name: 'Sobremesas', slug: 'sobremesas' },
                    { name: 'Churrasco', slug: 'churrasco' },
                ],
            },
            {
                name: 'Restaurantes e Bares',
                slug: 'restaurantes-bares',
                description: 'Frequentar estabelecimentos',
                level3: [
                    { name: 'Restaurantes', slug: 'restaurantes' },
                    { name: 'Bares', slug: 'bares' },
                    { name: 'Cafeterias', slug: 'cafeterias' },
                    { name: 'Food Trucks', slug: 'food-trucks' },
                ],
            },
        ],
    },
    // ============================================
    // NATUREZA E AR LIVRE
    // ============================================
    {
        level1: { name: 'Natureza e Ar Livre', slug: 'natureza-ar-livre', description: 'Atividades ao ar livre' },
        level2: [
            {
                name: 'Atividades na Natureza',
                slug: 'atividades-natureza',
                description: 'Contato com natureza',
                level3: [
                    { name: 'Caminhada', slug: 'caminhada' },
                    { name: 'Trilha', slug: 'trilha' },
                    { name: 'Acampamento', slug: 'acampamento' },
                    { name: 'Pesca', slug: 'pesca' },
                    { name: 'Surf', slug: 'surf' },
                    { name: 'Praia', slug: 'praia' },
                ],
            },
        ],
    },
];
/**
 * ⚠️ UNSAFE SCRIPT - APENAS PARA DESENVOLVIMENTO
 * GOVERNANÇA: Este script cria categorias como 'active' diretamente
 * NUNCA executar em produção sem revisão manual
 */
async function seedInterests() {
    // GOVERNANÇA: Validar ambiente
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
        throw new Error('❌ ERRO CRÍTICO: Scripts de seed NÃO podem ser executados em produção!');
    }
    console.log('🌱 Iniciando seed de categorias de interesses...\n');
    console.log('⚠️  AVISO: Este script cria categorias como ACTIVE (unsafe)\n');
    let totalCreated = 0;
    for (const categoryGroup of INTEREST_CATEGORIES) {
        try {
            // Criar nível 1 (Grande área)
            console.log(`📁 Criando categoria: ${categoryGroup.level1.name}`);
            const level1Category = await categories_service_1.categoriesService.createCategory({
                name: categoryGroup.level1.name,
                slug: categoryGroup.level1.slug,
                description: categoryGroup.level1.description,
                parentId: null,
                allowActive: true, // GOVERNANÇA: Flag explícita para script
                createdBy: {
                    source: 'script',
                },
            }, {
                validateAdmin: false, // Scripts não validam admin
            });
            totalCreated++;
            console.log(`   ✅ Criada: ${level1Category.name} (${level1Category.categoryId})`);
            // Criar nível 2 (Subcategorias)
            for (const level2Item of categoryGroup.level2) {
                console.log(`  📂 Criando subcategoria: ${level2Item.name}`);
                const level2Category = await categories_service_1.categoriesService.createCategory({
                    name: level2Item.name,
                    slug: level2Item.slug,
                    description: level2Item.description,
                    parentId: level1Category.categoryId,
                    allowActive: true,
                    createdBy: {
                        source: 'script',
                    },
                }, {
                    validateAdmin: false,
                });
                totalCreated++;
                console.log(`     ✅ Criada: ${level2Category.name} (${level2Category.categoryId})`);
                // Criar nível 3 (Interesses específicos)
                for (const level3Item of level2Item.level3) {
                    try {
                        const level3Category = await categories_service_1.categoriesService.createCategory({
                            name: level3Item.name,
                            slug: level3Item.slug,
                            description: null,
                            parentId: level2Category.categoryId,
                            allowActive: true,
                            createdBy: {
                                source: 'script',
                            },
                        }, {
                            validateAdmin: false,
                        });
                        totalCreated++;
                        console.log(`       ✅ Criada: ${level3Category.name} (${level3Category.categoryId})`);
                    }
                    catch (error) {
                        console.log(`       ⚠️  Já existe ou erro: ${level3Item.name} - ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                    }
                }
            }
            console.log('');
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('já existe')) {
                console.log(`   ⚠️  Categoria "${categoryGroup.level1.name}" já existe, pulando...\n`);
            }
            else {
                console.error(`   ❌ Erro ao criar categoria "${categoryGroup.level1.name}":`, error);
                console.log('');
            }
        }
    }
    console.log(`\n✨ Seed concluído! Total de categorias criadas: ${totalCreated}`);
    console.log('\n💡 Nota: Categorias que já existiam foram ignoradas (idempotente)');
}
// Executar seed
seedInterests()
    .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=seed-interests-categories.js.map