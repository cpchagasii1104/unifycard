"use strict";
// src/scripts/seed-learning-categories.ts
// Seed de categorias de APRENDIZADO - Trilha de evolução
// PRINCÍPIO: Foco em processo de aprendizagem, não em identidade profissional
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const categories_service_1 = require("../core/categories/categories.service");
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), '.env') });
/**
 * ESTRUTURA DO APRENDIZADO - Baseada em temas de aprendizagem
 *
 * REGRA INVARIÁVEL:
 * Se a categoria fizer o usuário se perguntar "isso é meu trabalho?" → NÃO É APRENDIZADO
 *
 * APRENDIZADO = coisas que a pessoa está tentando aprender, melhorar ou explorar com intenção
 * Não é obrigação formal. Não é renda. É direção.
 */
const LEARNING_CATEGORIES = [
    // ============================================
    // 1️⃣ CRIATIVIDADE & EXPRESSÃO
    // ============================================
    {
        level1: {
            name: 'Criatividade e Expressão',
            slug: 'criatividade-expressao',
            description: 'Aprender a criar e se expressar'
        },
        level2: [
            {
                name: 'Desenho e Ilustração',
                slug: 'desenho-ilustracao',
                description: 'Aprender a desenhar e ilustrar',
                level3: [
                    { name: 'Desenho à Mão', slug: 'desenho-mao' },
                    { name: 'Ilustração Digital', slug: 'ilustracao-digital' },
                    { name: 'Sketching', slug: 'sketching' },
                    { name: 'Anatomia Artística', slug: 'anatomia-artistica' },
                ],
            },
            {
                name: 'Fotografia',
                slug: 'fotografia-aprendizado',
                description: 'Aprender fotografia',
                level3: [
                    { name: 'Fotografia Básica', slug: 'fotografia-basica' },
                    { name: 'Fotografia de Retrato', slug: 'fotografia-retrato' },
                    { name: 'Fotografia de Paisagem', slug: 'fotografia-paisagem' },
                    { name: 'Edição de Fotos', slug: 'edicao-fotos' },
                ],
            },
            {
                name: 'Vídeo',
                slug: 'video-aprendizado',
                description: 'Aprender produção de vídeo',
                level3: [
                    { name: 'Edição de Vídeo', slug: 'edicao-video-aprendizado' },
                    { name: 'Produção de Vídeo', slug: 'producao-video-aprendizado' },
                    { name: 'Motion Graphics', slug: 'motion-graphics' },
                ],
            },
            {
                name: 'Escrita Criativa',
                slug: 'escrita-criativa',
                description: 'Aprender a escrever criativamente',
                level3: [
                    { name: 'Narrativa', slug: 'narrativa' },
                    { name: 'Poesia', slug: 'poesia-aprendizado' },
                    { name: 'Roteiro', slug: 'roteiro' },
                ],
            },
            {
                name: 'Música',
                slug: 'musica-aprendizado',
                description: 'Aprender música',
                level3: [
                    { name: 'Teoria Musical', slug: 'teoria-musical' },
                    { name: 'Composição', slug: 'composicao-musical' },
                    { name: 'Produção Musical', slug: 'producao-musical-aprendizado' },
                ],
            },
            {
                name: 'Design',
                slug: 'design-aprendizado',
                description: 'Aprender design',
                level3: [
                    { name: 'Design Gráfico', slug: 'design-grafico-aprendizado' },
                    { name: 'Design de UX/UI', slug: 'design-ux-ui-aprendizado' },
                    { name: 'Design de Produto', slug: 'design-produto' },
                ],
            },
        ],
    },
    // ============================================
    // 2️⃣ TECNOLOGIA & DIGITAL
    // ============================================
    {
        level1: {
            name: 'Tecnologia e Digital',
            slug: 'tecnologia-digital',
            description: 'Aprender tecnologia e ferramentas digitais'
        },
        level2: [
            {
                name: 'Programação',
                slug: 'programacao',
                description: 'Aprender a programar',
                level3: [
                    { name: 'Programação Básica', slug: 'programacao-basica' },
                    { name: 'Desenvolvimento Web', slug: 'desenvolvimento-web-aprendizado' },
                    { name: 'Desenvolvimento Mobile', slug: 'desenvolvimento-mobile-aprendizado' },
                    { name: 'Backend', slug: 'backend-aprendizado' },
                    { name: 'Frontend', slug: 'frontend-aprendizado' },
                ],
            },
            {
                name: 'Inteligência Artificial',
                slug: 'inteligencia-artificial',
                description: 'Aprender sobre IA',
                level3: [
                    { name: 'Machine Learning', slug: 'machine-learning' },
                    { name: 'IA Generativa', slug: 'ia-generativa' },
                    { name: 'Análise de Dados', slug: 'analise-dados' },
                ],
            },
            {
                name: 'Ferramentas Digitais',
                slug: 'ferramentas-digitais',
                description: 'Aprender ferramentas digitais',
                level3: [
                    { name: 'Excel e Planilhas', slug: 'excel-planilhas' },
                    { name: 'Ferramentas de Design', slug: 'ferramentas-design' },
                    { name: 'Automação', slug: 'automacao' },
                ],
            },
            {
                name: 'Games',
                slug: 'games-aprendizado',
                description: 'Aprender desenvolvimento de jogos',
                level3: [
                    { name: 'Desenvolvimento de Jogos', slug: 'desenvolvimento-jogos' },
                    { name: 'Game Design', slug: 'game-design' },
                ],
            },
        ],
    },
    // ============================================
    // 3️⃣ COMUNICAÇÃO & CONTEÚDO
    // ============================================
    {
        level1: {
            name: 'Comunicação e Conteúdo',
            slug: 'comunicacao-conteudo',
            description: 'Aprender a comunicar e criar conteúdo'
        },
        level2: [
            {
                name: 'Produção de Conteúdo',
                slug: 'producao-conteudo-aprendizado',
                description: 'Aprender a produzir conteúdo',
                level3: [
                    { name: 'Criação de Conteúdo', slug: 'criacao-conteudo-aprendizado' },
                    { name: 'Storytelling', slug: 'storytelling' },
                    { name: 'Podcast', slug: 'podcast-aprendizado' },
                ],
            },
            {
                name: 'Redes Sociais',
                slug: 'redes-sociais-aprendizado',
                description: 'Aprender sobre redes sociais',
                level3: [
                    { name: 'Gestão de Redes Sociais', slug: 'gestao-redes-sociais' },
                    { name: 'Estratégia de Conteúdo', slug: 'estrategia-conteudo' },
                ],
            },
            {
                name: 'Escrita Profissional',
                slug: 'escrita-profissional',
                description: 'Aprender escrita profissional',
                level3: [
                    { name: 'Redação', slug: 'redacao-aprendizado' },
                    { name: 'Copywriting', slug: 'copywriting' },
                    { name: 'Jornalismo', slug: 'jornalismo-aprendizado' },
                ],
            },
            {
                name: 'Oratória',
                slug: 'oratoria',
                description: 'Aprender a falar em público',
                level3: [
                    { name: 'Apresentações', slug: 'apresentacoes' },
                    { name: 'Comunicação Verbal', slug: 'comunicacao-verbal' },
                ],
            },
            {
                name: 'Marketing Digital',
                slug: 'marketing-digital-aprendizado',
                description: 'Aprender marketing digital',
                level3: [
                    { name: 'Marketing de Conteúdo', slug: 'marketing-conteudo' },
                    { name: 'SEO', slug: 'seo' },
                    { name: 'Publicidade Online', slug: 'publicidade-online' },
                ],
            },
        ],
    },
    // ============================================
    // 4️⃣ BEM-ESTAR & CORPO
    // ============================================
    {
        level1: {
            name: 'Bem-Estar e Corpo',
            slug: 'bem-estar-corpo',
            description: 'Aprender sobre bem-estar e saúde'
        },
        level2: [
            {
                name: 'Nutrição',
                slug: 'nutricao-aprendizado',
                description: 'Aprender sobre nutrição',
                level3: [
                    { name: 'Alimentação Saudável', slug: 'alimentacao-saudavel' },
                    { name: 'Nutrição Esportiva', slug: 'nutricao-esportiva' },
                ],
            },
            {
                name: 'Atividade Física',
                slug: 'atividade-fisica-aprendizado',
                description: 'Aprender sobre atividade física',
                level3: [
                    { name: 'Treinamento Físico', slug: 'treinamento-fisico' },
                    { name: 'Yoga e Meditação', slug: 'yoga-meditacao-aprendizado' },
                    { name: 'Pilates', slug: 'pilates-aprendizado' },
                ],
            },
            {
                name: 'Saúde Mental',
                slug: 'saude-mental-aprendizado',
                description: 'Aprender sobre saúde mental',
                level3: [
                    { name: 'Autoconhecimento', slug: 'autoconhecimento' },
                    { name: 'Mindfulness', slug: 'mindfulness-aprendizado' },
                    { name: 'Terapias', slug: 'terapias-aprendizado' },
                ],
            },
        ],
    },
    // ============================================
    // 5️⃣ GASTRONOMIA & SABORES
    // ============================================
    {
        level1: {
            name: 'Gastronomia e Sabores',
            slug: 'gastronomia-sabores',
            description: 'Aprender sobre culinária e gastronomia'
        },
        level2: [
            {
                name: 'Culinária',
                slug: 'culinaria-aprendizado',
                description: 'Aprender a cozinhar',
                level3: [
                    { name: 'Culinária Básica', slug: 'culinaria-basica' },
                    { name: 'Culinária Internacional', slug: 'culinaria-internacional-aprendizado' },
                    { name: 'Técnicas de Cozinha', slug: 'tecnicas-cozinha' },
                ],
            },
            {
                name: 'Confeitaria',
                slug: 'confeitaria-aprendizado',
                description: 'Aprender confeitaria',
                level3: [
                    { name: 'Doces e Sobremesas', slug: 'doces-sobremesas-aprendizado' },
                    { name: 'Bolos', slug: 'bolos-aprendizado' },
                ],
            },
            {
                name: 'Panificação',
                slug: 'panificacao',
                description: 'Aprender panificação',
                level3: [
                    { name: 'Pães', slug: 'paes' },
                    { name: 'Massas', slug: 'massas-aprendizado' },
                ],
            },
        ],
    },
    // ============================================
    // 6️⃣ NEGÓCIOS & EMPREENDEDORISMO
    // ============================================
    {
        level1: {
            name: 'Negócios e Empreendedorismo',
            slug: 'negocios-empreendedorismo',
            description: 'Aprender sobre negócios e empreender'
        },
        level2: [
            {
                name: 'Empreender',
                slug: 'empreender',
                description: 'Aprender a empreender',
                level3: [
                    { name: 'Criação de Negócios', slug: 'criacao-negocios' },
                    { name: 'Modelos de Negócio', slug: 'modelos-negocio' },
                    { name: 'Startups', slug: 'startups' },
                ],
            },
            {
                name: 'Vendas',
                slug: 'vendas-aprendizado',
                description: 'Aprender sobre vendas',
                level3: [
                    { name: 'Técnicas de Vendas', slug: 'tecnicas-vendas' },
                    { name: 'Atendimento ao Cliente', slug: 'atendimento-cliente-aprendizado' },
                ],
            },
            {
                name: 'Gestão',
                slug: 'gestao-aprendizado',
                description: 'Aprender gestão',
                level3: [
                    { name: 'Gestão de Projetos', slug: 'gestao-projetos' },
                    { name: 'Gestão de Pessoas', slug: 'gestao-pessoas' },
                    { name: 'Liderança', slug: 'lideranca' },
                ],
            },
            {
                name: 'Finanças Pessoais',
                slug: 'financas-pessoais',
                description: 'Aprender sobre finanças',
                level3: [
                    { name: 'Investimentos', slug: 'investimentos' },
                    { name: 'Orçamento Pessoal', slug: 'orcamento-pessoal' },
                ],
            },
            {
                name: 'Organização e Produtividade',
                slug: 'organizacao-produtividade',
                description: 'Aprender organização',
                level3: [
                    { name: 'Produtividade', slug: 'produtividade' },
                    { name: 'Gestão de Tempo', slug: 'gestao-tempo' },
                ],
            },
        ],
    },
    // ============================================
    // 7️⃣ CASA, MANUAL & PRÁTICO
    // ============================================
    {
        level1: {
            name: 'Casa, Manual e Prático',
            slug: 'casa-manual-pratico',
            description: 'Aprender habilidades manuais e práticas'
        },
        level2: [
            {
                name: 'Marcenaria',
                slug: 'marcenaria-aprendizado',
                description: 'Aprender marcenaria',
                level3: [
                    { name: 'Carpintaria', slug: 'carpintaria' },
                    { name: 'Móveis', slug: 'moveis-aprendizado' },
                ],
            },
            {
                name: 'Jardinagem',
                slug: 'jardinagem-aprendizado',
                description: 'Aprender jardinagem',
                level3: [
                    { name: 'Plantio', slug: 'plantio' },
                    { name: 'Paisagismo', slug: 'paisagismo-aprendizado' },
                ],
            },
            {
                name: 'DIY',
                slug: 'diy-aprendizado',
                description: 'Aprender faça você mesmo',
                level3: [
                    { name: 'Reparos Domésticos', slug: 'reparos-domesticos' },
                    { name: 'Projetos DIY', slug: 'projetos-diy' },
                ],
            },
            {
                name: 'Manutenção Básica',
                slug: 'manutencao-basica',
                description: 'Aprender manutenção',
                level3: [
                    { name: 'Elétrica Básica', slug: 'eletrica-basica' },
                    { name: 'Hidráulica Básica', slug: 'hidraulica-basica' },
                ],
            },
            {
                name: 'Decoração',
                slug: 'decoracao',
                description: 'Aprender decoração',
                level3: [
                    { name: 'Interiores', slug: 'interiores' },
                    { name: 'Arquitetura Básica', slug: 'arquitetura-basica' },
                ],
            },
        ],
    },
    // ============================================
    // 8️⃣ EDUCAÇÃO & CONHECIMENTO GERAL
    // ============================================
    {
        level1: {
            name: 'Educação e Conhecimento Geral',
            slug: 'educacao-conhecimento',
            description: 'Aprender sobre diversos temas'
        },
        level2: [
            {
                name: 'Idiomas',
                slug: 'idiomas',
                description: 'Aprender idiomas',
                level3: [
                    { name: 'Inglês', slug: 'ingles' },
                    { name: 'Espanhol', slug: 'espanhol' },
                    { name: 'Francês', slug: 'frances' },
                    { name: 'Outros Idiomas', slug: 'outros-idiomas' },
                ],
            },
            {
                name: 'História',
                slug: 'historia-aprendizado',
                description: 'Aprender história',
                level3: [
                    { name: 'História do Brasil', slug: 'historia-brasil' },
                    { name: 'História Mundial', slug: 'historia-mundial' },
                ],
            },
            {
                name: 'Filosofia',
                slug: 'filosofia-aprendizado',
                description: 'Aprender filosofia',
                level3: [
                    { name: 'Filosofia Geral', slug: 'filosofia-geral' },
                    { name: 'Ética', slug: 'etica' },
                ],
            },
            {
                name: 'Ciências',
                slug: 'ciencias',
                description: 'Aprender ciências',
                level3: [
                    { name: 'Física', slug: 'fisica' },
                    { name: 'Química', slug: 'quimica' },
                    { name: 'Biologia', slug: 'biologia' },
                ],
            },
            {
                name: 'Estudos Gerais',
                slug: 'estudos-gerais',
                description: 'Estudos diversos',
                level3: [
                    { name: 'Cultura Geral', slug: 'cultura-geral' },
                    { name: 'Atualidades', slug: 'atualidades' },
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
async function seedLearningCategories() {
    // GOVERNANÇA: Validar ambiente
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
        throw new Error('❌ ERRO CRÍTICO: Scripts de seed NÃO podem ser executados em produção!');
    }
    console.log('🌱 Iniciando seed de categorias de APRENDIZADO...\n');
    console.log('⚠️  AVISO: Este script cria categorias como ACTIVE (unsafe)\n');
    console.log('📋 PRINCÍPIO: Foco em processo de aprendizagem, não em identidade profissional\n');
    let totalCreated = 0;
    for (const categoryGroup of LEARNING_CATEGORIES) {
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
                context: 'learning', // IMPORTANTE: Contexto de aprendizado
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
                    context: 'learning',
                });
                totalCreated++;
                console.log(`     ✅ Criada: ${level2Category.name} (${level2Category.categoryId})`);
                // Criar nível 3 (Temas específicos)
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
                            context: 'learning',
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
    console.log('\n🎯 PRINCÍPIO APLICADO: Foco em processo de aprendizagem, não em identidade profissional');
}
// Executar seed
seedLearningCategories()
    .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=seed-learning-categories.js.map