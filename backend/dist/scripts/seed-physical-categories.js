"use strict";
// src/scripts/seed-physical-categories.ts
// Seed de categorias FÍSICAS (hobbies/prazer) - REORGANIZADO
// PRINCÍPIO: Foco em prazer, não em profissão ou aprendizado
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const categories_service_1 = require("../core/categories/categories.service");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
/**
 * NOVA ESTRUTURA DO FÍSICO - Baseada em verbos de prazer
 *
 * REGRA INVARIÁVEL:
 * Se a categoria fizer o usuário se perguntar "isso vira trabalho?" → NÃO É FÍSICO
 *
 * FÍSICO = coisas que a pessoa faria mesmo se ninguém visse e ninguém pagasse
 */
const PHYSICAL_CATEGORIES = [
    // ============================================
    // 1️⃣ ASSISTIR & CONSUMIR CONTEÚDO
    // ============================================
    {
        level1: {
            name: 'Assistir e Consumir Conteúdo',
            slug: 'assistir-consumir-conteudo',
            description: 'Tempo de sofá, desligar a cabeça'
        },
        level2: [
            {
                name: 'Filmes',
                slug: 'filmes',
                description: 'Assistir filmes',
                level3: [
                    { name: 'Ação', slug: 'acao-filmes' },
                    { name: 'Comédia', slug: 'comedia-filmes' },
                    { name: 'Drama', slug: 'drama-filmes' },
                    { name: 'Terror', slug: 'terror-filmes' },
                    { name: 'Ficção Científica', slug: 'ficcao-cientifica-filmes' },
                    { name: 'Romance', slug: 'romance-filmes' },
                    { name: 'Documentários', slug: 'documentarios-filmes' },
                    { name: 'Animação', slug: 'animacao-filmes' },
                ],
            },
            {
                name: 'Séries',
                slug: 'series',
                description: 'Séries de TV e streaming',
                level3: [
                    { name: 'Drama', slug: 'drama-series' },
                    { name: 'Comédia', slug: 'comedia-series' },
                    { name: 'Suspense', slug: 'suspense-series' },
                    { name: 'Ficção Científica', slug: 'ficcao-cientifica-series' },
                    { name: 'Fantasia', slug: 'fantasia-series' },
                    { name: 'Reality Shows', slug: 'reality-shows' },
                ],
            },
            {
                name: 'Vídeos Online',
                slug: 'videos-online',
                description: 'YouTube, creators, conteúdo digital',
                level3: [
                    { name: 'Vlogs', slug: 'vlogs' },
                    { name: 'Tutoriais', slug: 'tutoriais-videos' },
                    { name: 'Entretenimento', slug: 'entretenimento-videos' },
                    { name: 'Gaming', slug: 'gaming-videos' },
                    { name: 'Música', slug: 'musica-videos' },
                ],
            },
            {
                name: 'Cinema',
                slug: 'cinema',
                description: 'Ir ao cinema',
                level3: [
                    { name: 'Cinema de Rua', slug: 'cinema-rua' },
                    { name: 'Cinema Shopping', slug: 'cinema-shopping' },
                    { name: 'Festivais de Cinema', slug: 'festivais-cinema' },
                ],
            },
        ],
    },
    // ============================================
    // 2️⃣ JOGAR & BRINCAR
    // ============================================
    {
        level1: {
            name: 'Jogar e Brincar',
            slug: 'jogar-brincar',
            description: 'Diversão pura'
        },
        level2: [
            {
                name: 'Jogos Digitais',
                slug: 'jogos-digitais',
                description: 'Videogames e jogos eletrônicos',
                level3: [
                    { name: 'RPG', slug: 'rpg-games' },
                    { name: 'Ação', slug: 'acao-games' },
                    { name: 'Estratégia', slug: 'estrategia-games' },
                    { name: 'Esportes', slug: 'esportes-games' },
                    { name: 'Corrida', slug: 'corrida-games' },
                    { name: 'Luta', slug: 'luta-games' },
                    { name: 'Aventura', slug: 'aventura-games' },
                    { name: 'Puzzle', slug: 'puzzle-games' },
                    { name: 'Simulação', slug: 'simulacao-games' },
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
                    { name: 'Cartas', slug: 'cartas' },
                ],
            },
            {
                name: 'Jogos Online',
                slug: 'jogos-online',
                description: 'Jogos multiplayer online',
                level3: [
                    { name: 'MMORPG', slug: 'mmorpg' },
                    { name: 'Battle Royale', slug: 'battle-royale' },
                    { name: 'MOBA', slug: 'moba' },
                    { name: 'Jogos Casuais', slug: 'jogos-casuais' },
                ],
            },
            {
                name: 'E-sports',
                slug: 'esports',
                description: 'E-sports como espectador ou player',
                level3: [
                    { name: 'Assistir E-sports', slug: 'assistir-esports' },
                    { name: 'Competir em E-sports', slug: 'competir-esports' },
                ],
            },
        ],
    },
    // ============================================
    // 3️⃣ LER & EXPLORAR
    // ============================================
    {
        level1: {
            name: 'Ler e Explorar',
            slug: 'ler-explorar',
            description: 'Leitura recreativa e descoberta'
        },
        level2: [
            {
                name: 'Leitura Recreativa',
                slug: 'leitura-recreativa',
                description: 'Livros por prazer',
                level3: [
                    { name: 'Ficção Científica', slug: 'ficcao-cientifica-livros' },
                    { name: 'Fantasia', slug: 'fantasia-livros' },
                    { name: 'Romance', slug: 'romance-livros' },
                    { name: 'Suspense', slug: 'suspense-livros' },
                    { name: 'Terror', slug: 'terror-livros' },
                    { name: 'Biografia', slug: 'biografia-livros' },
                    { name: 'História', slug: 'historia-livros' },
                    { name: 'Filosofia', slug: 'filosofia-livros' },
                    { name: 'Autoajuda', slug: 'autoajuda-livros' },
                    { name: 'Negócios', slug: 'negocios-livros' },
                ],
            },
            {
                name: 'HQs e Mangás',
                slug: 'hqs-mangas',
                description: 'Histórias em quadrinhos',
                level3: [
                    { name: 'Mangá', slug: 'manga' },
                    { name: 'Comics', slug: 'comics' },
                    { name: 'Graphic Novels', slug: 'graphic-novels' },
                ],
            },
            {
                name: 'Escrita Pessoal',
                slug: 'escrita-pessoal',
                description: 'Escrever por prazer',
                level3: [
                    { name: 'Diário', slug: 'diario' },
                    { name: 'Poesia', slug: 'poesia' },
                    { name: 'Contos', slug: 'contos' },
                    { name: 'Blog Pessoal', slug: 'blog-pessoal' },
                ],
            },
        ],
    },
    // ============================================
    // 4️⃣ OUVIR & FAZER MÚSICA
    // ============================================
    {
        level1: {
            name: 'Ouvir e Fazer Música',
            slug: 'ouvir-fazer-musica',
            description: 'Expressão e consumo musical'
        },
        level2: [
            {
                name: 'Ouvir Música',
                slug: 'ouvir-musica',
                description: 'Consumir música',
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
                name: 'Tocar Instrumentos',
                slug: 'tocar-instrumentos',
                description: 'Brincar com instrumentos por prazer',
                level3: [
                    { name: 'Violão', slug: 'violao' },
                    { name: 'Guitarra', slug: 'guitarra' },
                    { name: 'Piano', slug: 'piano' },
                    { name: 'Bateria', slug: 'bateria' },
                    { name: 'Baixo', slug: 'baixo' },
                    { name: 'Violino', slug: 'violino' },
                    { name: 'Flauta', slug: 'flauta' },
                ],
            },
            {
                name: 'Cantar',
                slug: 'cantar',
                description: 'Cantar por prazer',
                level3: [
                    { name: 'Karaokê', slug: 'karaoke' },
                    { name: 'Coral', slug: 'coral' },
                    { name: 'Cantar em Casa', slug: 'cantar-casa' },
                ],
            },
            {
                name: 'Produção Musical',
                slug: 'producao-musical-hobby',
                description: 'Brincar com produção musical',
                level3: [
                    { name: 'Composição', slug: 'composicao-musical' },
                    { name: 'Produção Digital', slug: 'producao-digital' },
                    { name: 'DJ', slug: 'dj-hobby' },
                ],
            },
        ],
    },
    // ============================================
    // 5️⃣ CRIAR & EXPRESSAR
    // ============================================
    {
        level1: {
            name: 'Criar e Expressar',
            slug: 'criar-expressar',
            description: 'Flow criativo'
        },
        level2: [
            {
                name: 'Artes Visuais',
                slug: 'artes-visuais',
                description: 'Desenhar, pintar, criar visualmente',
                level3: [
                    { name: 'Desenho', slug: 'desenho' },
                    { name: 'Pintura', slug: 'pintura' },
                    { name: 'Fotografia', slug: 'fotografia-hobby' },
                    { name: 'Escultura', slug: 'escultura' },
                    { name: 'Arte Digital', slug: 'arte-digital' },
                ],
            },
            {
                name: 'Vídeo Criativo',
                slug: 'video-criativo',
                description: 'Criar vídeos por prazer',
                level3: [
                    { name: 'Vídeos Pessoais', slug: 'videos-pessoais' },
                    { name: 'Edição de Vídeo', slug: 'edicao-video-hobby' },
                    { name: 'Vlogs', slug: 'vlogs-criacao' },
                ],
            },
            {
                name: 'Artesanato',
                slug: 'artesanato',
                description: 'Trabalhos manuais criativos',
                level3: [
                    { name: 'Tricô', slug: 'trico' },
                    { name: 'Crochê', slug: 'croche' },
                    { name: 'Costura', slug: 'costura-hobby' },
                    { name: 'Marcenaria', slug: 'marcenaria-hobby' },
                    { name: 'DIY', slug: 'diy' },
                ],
            },
        ],
    },
    // ============================================
    // 6️⃣ COZINHAR & COMER BEM
    // ============================================
    {
        level1: {
            name: 'Cozinhar e Comer Bem',
            slug: 'cozinhar-comer-bem',
            description: 'Prazer sensorial'
        },
        level2: [
            {
                name: 'Cozinhar em Casa',
                slug: 'cozinhar-casa',
                description: 'Cozinhar por prazer',
                level3: [
                    { name: 'Culinária Brasileira', slug: 'culinaria-brasileira' },
                    { name: 'Culinária Italiana', slug: 'culinaria-italiana' },
                    { name: 'Culinária Japonesa', slug: 'culinaria-japonesa' },
                    { name: 'Testar Receitas', slug: 'testar-receitas' },
                ],
            },
            {
                name: 'Confeitaria',
                slug: 'confeitaria',
                description: 'Fazer doces e sobremesas',
                level3: [
                    { name: 'Bolos', slug: 'bolos' },
                    { name: 'Doces', slug: 'doces' },
                    { name: 'Sobremesas', slug: 'sobremesas' },
                ],
            },
            {
                name: 'Churrasco',
                slug: 'churrasco',
                description: 'Churrasco e grelhados',
                level3: [
                    { name: 'Churrasco', slug: 'churrasco-hobby' },
                ],
            },
            {
                name: 'Gastronomia',
                slug: 'gastronomia-hobby',
                description: 'Explorar gastronomia',
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
    // 7️⃣ SE MOVIMENTAR
    // ============================================
    {
        level1: {
            name: 'Se Movimentar',
            slug: 'se-movimentar',
            description: 'Corpo em ação, não performance'
        },
        level2: [
            {
                name: 'Atividades Físicas',
                slug: 'atividades-fisicas',
                description: 'Movimento e exercício',
                level3: [
                    { name: 'Caminhada', slug: 'caminhada' },
                    { name: 'Corrida', slug: 'corrida-recreativa' },
                    { name: 'Academia', slug: 'academia' },
                    { name: 'Musculação', slug: 'musculacao' },
                    { name: 'Yoga', slug: 'yoga' },
                    { name: 'Pilates', slug: 'pilates' },
                    { name: 'Dança', slug: 'danca' },
                ],
            },
            {
                name: 'Esportes Recreativos',
                slug: 'esportes-recreativos',
                description: 'Esportes por diversão',
                level3: [
                    { name: 'Futebol', slug: 'futebol-recreativo' },
                    { name: 'Basquete', slug: 'basquete-recreativo' },
                    { name: 'Vôlei', slug: 'volei-recreativo' },
                    { name: 'Tênis', slug: 'tenis-recreativo' },
                    { name: 'Natação', slug: 'natacao-recreativa' },
                    { name: 'Ciclismo', slug: 'ciclismo-recreativo' },
                    { name: 'Artes Marciais', slug: 'artes-marciais-recreativo' },
                ],
            },
        ],
    },
    // ============================================
    // 8️⃣ CUIDAR DE SI
    // ============================================
    {
        level1: {
            name: 'Cuidar de Si',
            slug: 'cuidar-de-si',
            description: 'Prazer silencioso'
        },
        level2: [
            {
                name: 'Bem-Estar',
                slug: 'bem-estar',
                description: 'Bem-estar e autocuidado',
                level3: [
                    { name: 'Meditação', slug: 'meditacao' },
                    { name: 'Autocuidado', slug: 'autocuidado' },
                    { name: 'Saúde Mental', slug: 'saude-mental' },
                    { name: 'Sono', slug: 'sono' },
                    { name: 'Rotina Saudável', slug: 'rotina-saudavel' },
                ],
            },
        ],
    },
    // ============================================
    // 9️⃣ NATUREZA & AR LIVRE
    // ============================================
    {
        level1: {
            name: 'Natureza e Ar Livre',
            slug: 'natureza-ar-livre',
            description: 'Desconexão'
        },
        level2: [
            {
                name: 'Atividades na Natureza',
                slug: 'atividades-natureza',
                description: 'Contato com natureza',
                level3: [
                    { name: 'Trilhas', slug: 'trilhas' },
                    { name: 'Praia', slug: 'praia' },
                    { name: 'Acampamento', slug: 'acampamento' },
                    { name: 'Pesca', slug: 'pesca' },
                    { name: 'Surf', slug: 'surf' },
                    { name: 'Jardinagem', slug: 'jardinagem' },
                ],
            },
        ],
    },
    // ============================================
    // 🔟 DESACELERAR & RELAXAR
    // ============================================
    {
        level1: {
            name: 'Desacelerar e Relaxar',
            slug: 'desacelerar-relaxar',
            description: 'Tempo offline, descanso mental'
        },
        level2: [
            {
                name: 'Tempo para Si',
                slug: 'tempo-para-si',
                description: 'Momentos de pausa e silêncio',
                level3: [
                    { name: 'Relaxar', slug: 'relaxar' },
                    { name: 'Não Fazer Nada', slug: 'nao-fazer-nada' },
                    { name: 'Silêncio', slug: 'silencio' },
                    { name: 'Rotina Leve', slug: 'rotina-leve' },
                    { name: 'Pausa Digital', slug: 'pausa-digital' },
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
async function seedPhysicalCategories() {
    // GOVERNANÇA: Validar ambiente
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
        throw new Error('❌ ERRO CRÍTICO: Scripts de seed NÃO podem ser executados em produção!');
    }
    console.log('🌱 Iniciando seed de categorias FÍSICAS (prazer/hobbies)...\n');
    console.log('⚠️  AVISO: Este script cria categorias como ACTIVE (unsafe)\n');
    console.log('📋 PRINCÍPIO: Foco em prazer, não em profissão ou aprendizado\n');
    let totalCreated = 0;
    for (const categoryGroup of PHYSICAL_CATEGORIES) {
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
                context: 'interest', // IMPORTANTE: Contexto de interesse/hobby
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
                    context: 'interest',
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
                            context: 'interest',
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
    console.log('\n🎯 PRINCÍPIO APLICADO: Foco em prazer, não em profissão ou aprendizado');
}
// Executar seed
seedPhysicalCategories()
    .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=seed-physical-categories.js.map