// src/scripts/seed-professional-categories.ts
// Seed de categorias profissionais em 3 níveis hierárquicos

import dotenv from 'dotenv';
import { join } from 'path';
import { categoriesService } from '../core/categories/categories.service';

dotenv.config({ path: join(process.cwd(), '.env') });

/**
 * Estrutura de categorias profissionais em 3 níveis:
 * Nível 1: Grande área (Construção, Tecnologia, Comércio, etc.)
 * Nível 2: Subcategoria (Obras, Reformas, Desenvolvimento, etc.)
 * Nível 3: Profissão específica (Pedreiro, Eletricista, Programador, etc.)
 */
const PROFESSIONAL_CATEGORIES = [
  // ============================================
  // CONSTRUÇÃO E REFORMAS
  // ============================================
  {
    level1: { name: 'Construção e Reformas', slug: 'construcao-reformas', description: 'Serviços de construção civil e reformas' },
    level2: [
      {
        name: 'Obras e Construção',
        slug: 'obras-construcao',
        description: 'Construção de obras novas',
        level3: [
          { name: 'Pedreiro', slug: 'pedreiro' },
          { name: 'Mestre de Obras', slug: 'mestre-obras' },
          { name: 'Encarregado de Obra', slug: 'encarregado-obra' },
          { name: 'Ajudante de Pedreiro', slug: 'ajudante-pedreiro' },
        ],
      },
      {
        name: 'Reformas e Acabamentos',
        slug: 'reformas-acabamentos',
        description: 'Reformas e serviços de acabamento',
        level3: [
          { name: 'Pintor', slug: 'pintor' },
          { name: 'Gesseiro', slug: 'gesseiro' },
          { name: 'Azulejista', slug: 'azulejista' },
          { name: 'Marceneiro', slug: 'marceneiro' },
          { name: 'Serralheiro', slug: 'serralheiro' },
        ],
      },
      {
        name: 'Instalações Elétricas e Hidráulicas',
        slug: 'instalacoes-eletricas-hidraulicas',
        description: 'Instalações elétricas e hidráulicas',
        level3: [
          { name: 'Eletricista', slug: 'eletricista' },
          { name: 'Eletricista Industrial', slug: 'eletricista-industrial' },
          { name: 'Encanador', slug: 'encanador' },
          { name: 'Instalador Hidráulico', slug: 'instalador-hidraulico' },
        ],
      },
      {
        name: 'Coberturas e Telhados',
        slug: 'coberturas-telhados',
        description: 'Serviços de cobertura e telhados',
        level3: [
          { name: 'Telhador', slug: 'telhador' },
          { name: 'Carpinteiro', slug: 'carpinteiro' },
          { name: 'Instalador de Coberturas', slug: 'instalador-coberturas' },
        ],
      },
    ],
  },

  // ============================================
  // TECNOLOGIA E INFORMÁTICA
  // ============================================
  {
    level1: { name: 'Tecnologia e Informática', slug: 'tecnologia-informatica', description: 'Serviços de tecnologia e informática' },
    level2: [
      {
        name: 'Desenvolvimento de Software',
        slug: 'desenvolvimento-software',
        description: 'Desenvolvimento de aplicações e sistemas',
        level3: [
          { name: 'Programador', slug: 'programador' },
          { name: 'Desenvolvedor Web', slug: 'desenvolvedor-web' },
          { name: 'Desenvolvedor Mobile', slug: 'desenvolvedor-mobile' },
          { name: 'Desenvolvedor Full Stack', slug: 'desenvolvedor-fullstack' },
          { name: 'Analista de Sistemas', slug: 'analista-sistemas' },
        ],
      },
      {
        name: 'Suporte Técnico',
        slug: 'suporte-tecnico',
        description: 'Suporte e manutenção de equipamentos',
        level3: [
          { name: 'Técnico em Informática', slug: 'tecnico-informatica' },
          { name: 'Técnico em Manutenção de Computadores', slug: 'tecnico-manutencao-computadores' },
          { name: 'Suporte Técnico Remoto', slug: 'suporte-tecnico-remoto' },
          { name: 'Instalador de Redes', slug: 'instalador-redes' },
        ],
      },
      {
        name: 'Design e Multimídia',
        slug: 'design-multimidia',
        description: 'Design gráfico e produção multimídia',
        level3: [
          { name: 'Designer Gráfico', slug: 'designer-grafico' },
          { name: 'Web Designer', slug: 'web-designer' },
          { name: 'Designer de UX/UI', slug: 'designer-ux-ui' },
        ],
      },
    ],
  },

  // ============================================
  // SERVIÇOS DOMÉSTICOS
  // ============================================
  {
    level1: { name: 'Serviços Domésticos', slug: 'servicos-domesticos', description: 'Serviços para residências' },
    level2: [
      {
        name: 'Limpeza',
        slug: 'limpeza',
        description: 'Serviços de limpeza e organização',
        level3: [
          { name: 'Faxineira', slug: 'faxineira' },
          { name: 'Diarista', slug: 'diarista' },
          { name: 'Limpeza Pós-Obra', slug: 'limpeza-pos-obra' },
          { name: 'Organizador de Ambientes', slug: 'organizador-ambientes' },
        ],
      },
      {
        name: 'Jardinagem e Paisagismo',
        slug: 'jardinagem-paisagismo',
        description: 'Serviços de jardinagem e paisagismo',
        level3: [
          { name: 'Jardineiro', slug: 'jardineiro' },
          { name: 'Paisagista', slug: 'paisagista' },
          { name: 'Podador', slug: 'podador' },
        ],
      },
      {
        name: 'Manutenção Residencial',
        slug: 'manutencao-residencial',
        description: 'Manutenção e reparos residenciais',
        level3: [
          { name: 'Técnico em Ar Condicionado', slug: 'tecnico-ar-condicionado' },
          { name: 'Técnico em Refrigeração', slug: 'tecnico-refrigeracao' },
          { name: 'Técnico em Eletrodomésticos', slug: 'tecnico-eletrodomesticos' },
          { name: 'Chaveiro', slug: 'chaveiro' },
        ],
      },
    ],
  },

  // ============================================
  // BELEZA E ESTÉTICA
  // ============================================
  {
    level1: { name: 'Beleza e Estética', slug: 'beleza-estetica', description: 'Serviços de beleza e estética' },
    level2: [
      {
        name: 'Cuidados com Cabelo',
        slug: 'cuidados-cabelo',
        description: 'Cortes, tratamentos e penteados',
        level3: [
          { name: 'Cabeleireiro', slug: 'cabeleireiro' },
          { name: 'Barbeiro', slug: 'barbeiro' },
          { name: 'Colorista', slug: 'colorista' },
          { name: 'Tricologista', slug: 'tricologista' },
        ],
      },
      {
        name: 'Manicure e Pedicure',
        slug: 'manicure-pedicure',
        description: 'Cuidados com unhas',
        level3: [
          { name: 'Manicure', slug: 'manicure' },
          { name: 'Pedicure', slug: 'pedicure' },
          { name: 'Esmaltadora', slug: 'esmaltadora' },
        ],
      },
      {
        name: 'Estética Facial e Corporal',
        slug: 'estetica-facial-corporal',
        description: 'Tratamentos estéticos',
        level3: [
          { name: 'Esteticista', slug: 'esteticista' },
          { name: 'Massagista', slug: 'massagista' },
          { name: 'Depilador', slug: 'depilador' },
        ],
      },
    ],
  },

  // ============================================
  // SAÚDE E BEM-ESTAR
  // ============================================
  {
    level1: { name: 'Saúde e Bem-Estar', slug: 'saude-bemestar', description: 'Serviços de saúde e bem-estar' },
    level2: [
      {
        name: 'Fisioterapia e Reabilitação',
        slug: 'fisioterapia-reabilitacao',
        description: 'Fisioterapia e reabilitação',
        level3: [
          { name: 'Fisioterapeuta', slug: 'fisioterapeuta' },
          { name: 'Massoterapeuta', slug: 'massoterapeuta' },
          { name: 'Quiropraxista', slug: 'quiropraxista' },
        ],
      },
      {
        name: 'Nutrição e Alimentação',
        slug: 'nutricao-alimentacao',
        description: 'Nutrição e alimentação saudável',
        level3: [
          { name: 'Nutricionista', slug: 'nutricionista' },
          { name: 'Personal Chef', slug: 'personal-chef' },
          { name: 'Cozinheiro', slug: 'cozinheiro' },
        ],
      },
    ],
  },

  // ============================================
  // TRANSPORTE E LOGÍSTICA
  // ============================================
  {
    level1: { name: 'Transporte e Logística', slug: 'transporte-logistica', description: 'Serviços de transporte e logística' },
    level2: [
      {
        name: 'Transporte de Cargas',
        slug: 'transporte-cargas',
        description: 'Transporte e mudanças',
        level3: [
          { name: 'Motorista de Caminhão', slug: 'motorista-caminhao' },
          { name: 'Carreteiro', slug: 'carreteiro' },
          { name: 'Mudanças', slug: 'mudancas' },
          { name: 'Entregador', slug: 'entregador' },
        ],
      },
      {
        name: 'Transporte de Pessoas',
        slug: 'transporte-pessoas',
        description: 'Transporte de passageiros',
        level3: [
          { name: 'Motorista de Aplicativo', slug: 'motorista-aplicativo' },
          { name: 'Motorista Particular', slug: 'motorista-particular' },
          { name: 'Taxista', slug: 'taxista' },
        ],
      },
    ],
  },

  // ============================================
  // COMÉRCIO E VENDAS
  // ============================================
  {
    level1: { name: 'Comércio e Vendas', slug: 'comercio-vendas', description: 'Serviços comerciais e vendas' },
    level2: [
      {
        name: 'Vendas e Atendimento',
        slug: 'vendas-atendimento',
        description: 'Vendas e atendimento ao cliente',
        level3: [
          { name: 'Vendedor', slug: 'vendedor' },
          { name: 'Atendente', slug: 'atendente' },
          { name: 'Representante Comercial', slug: 'representante-comercial' },
          { name: 'Promotor de Vendas', slug: 'promotor-vendas' },
        ],
      },
      {
        name: 'Marketing e Publicidade',
        slug: 'marketing-publicidade',
        description: 'Marketing e publicidade',
        level3: [
          { name: 'Social Media', slug: 'social-media' },
          { name: 'Fotógrafo', slug: 'fotografo' },
          { name: 'Videomaker', slug: 'videomaker' },
        ],
      },
    ],
  },

  // ============================================
  // EDUCAÇÃO E ENSINO
  // ============================================
  {
    level1: { name: 'Educação e Ensino', slug: 'educacao-ensino', description: 'Serviços educacionais' },
    level2: [
      {
        name: 'Aulas Particulares',
        slug: 'aulas-particulares',
        description: 'Aulas particulares e reforço',
        level3: [
          { name: 'Professor Particular', slug: 'professor-particular' },
          { name: 'Instrutor de Idiomas', slug: 'instrutor-idiomas' },
          { name: 'Monitor de Estudos', slug: 'monitor-estudos' },
        ],
      },
      {
        name: 'Cursos e Treinamentos',
        slug: 'cursos-treinamentos',
        description: 'Cursos e treinamentos profissionais',
        level3: [
          { name: 'Instrutor de Cursos', slug: 'instrutor-cursos' },
          { name: 'Treinador', slug: 'treinador' },
        ],
      },
    ],
  },

  // ============================================
  // CINEMA E AUDIOVISUAL
  // ============================================
  {
    level1: { name: 'Cinema e Audiovisual', slug: 'cinema-audiovisual', description: 'Produção audiovisual e cinematográfica' },
    level2: [
      {
        name: 'Produção Audiovisual',
        slug: 'producao-audiovisual',
        description: 'Produção e coordenação de projetos audiovisuais',
        level3: [
          { name: 'Produtor Audiovisual', slug: 'produtor-audiovisual' },
        ],
      },
      {
        name: 'Captação de Imagem e Som',
        slug: 'captacao-imagem-som',
        description: 'Captação de imagem e som para produções',
        level3: [
          { name: 'Operador de Câmera', slug: 'operador-camera' },
        ],
      },
      {
        name: 'Pós-produção',
        slug: 'pos-producao',
        description: 'Edição e finalização de conteúdo audiovisual',
        level3: [
          { name: 'Editor de Vídeo', slug: 'editor-video' },
        ],
      },
    ],
  },

  // ============================================
  // ENTERTENIMENTO E JOGOS
  // ============================================
  {
    level1: { name: 'Entretenimento e Jogos', slug: 'entretenimento-jogos', description: 'Criação de conteúdo e entretenimento digital' },
    level2: [
      {
        name: 'Criação de Conteúdo',
        slug: 'criacao-conteudo',
        description: 'Criação de conteúdo para jogos e entretenimento',
        level3: [
          { name: 'Criador de Conteúdo Gamer', slug: 'criador-conteudo-gamer' },
          { name: 'Streamer', slug: 'streamer' },
        ],
      },
    ],
  },

  // ============================================
  // LEITURA E LITERATURA
  // ============================================
  {
    level1: { name: 'Leitura e Literatura', slug: 'leitura-literatura', description: 'Serviços relacionados a escrita e literatura' },
    level2: [
      {
        name: 'Criação Literária',
        slug: 'criacao-literaria',
        description: 'Criação de obras literárias',
        level3: [
          { name: 'Escritor', slug: 'escritor' },
        ],
      },
      {
        name: 'Produção de Conteúdo',
        slug: 'producao-conteudo',
        description: 'Produção de conteúdo textual',
        level3: [
          { name: 'Redator', slug: 'redator' },
        ],
      },
      {
        name: 'Revisão e Preparação de Texto',
        slug: 'revisao-preparacao-texto',
        description: 'Revisão e preparação de textos',
        level3: [
          { name: 'Revisor de Texto', slug: 'revisor-texto' },
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
async function seedCategories() {
  // GOVERNANÇA: Validar ambiente
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    throw new Error('❌ ERRO CRÍTICO: Scripts de seed NÃO podem ser executados em produção!');
  }

  console.log('🌱 Iniciando seed de categorias profissionais...\n');
  console.log('⚠️  AVISO: Este script cria categorias como ACTIVE (unsafe)\n');

  let totalCreated = 0;

  for (const categoryGroup of PROFESSIONAL_CATEGORIES) {
    try {
      // Criar nível 1 (Grande área)
      console.log(`📁 Criando categoria: ${categoryGroup.level1.name}`);
      const level1Category = await categoriesService.createCategory(
        {
          name: categoryGroup.level1.name,
          slug: categoryGroup.level1.slug,
          description: categoryGroup.level1.description,
          parentId: null,
          allowActive: true, // GOVERNANÇA: Flag explícita para script
          createdBy: {
            source: 'script',
          },
        },
        {
          validateAdmin: false, // Scripts não validam admin
        }
      );
      totalCreated++;
      console.log(`   ✅ Criada: ${level1Category.name} (${level1Category.categoryId})`);

      // Criar nível 2 (Subcategorias)
      for (const level2Item of categoryGroup.level2) {
        console.log(`  📂 Criando subcategoria: ${level2Item.name}`);
        const level2Category = await categoriesService.createCategory(
          {
            name: level2Item.name,
            slug: level2Item.slug,
            description: level2Item.description,
            parentId: level1Category.categoryId,
            allowActive: true,
            createdBy: {
              source: 'script',
            },
          },
          {
            validateAdmin: false,
          }
        );
        totalCreated++;
        console.log(`     ✅ Criada: ${level2Category.name} (${level2Category.categoryId})`);

        // Criar nível 3 (Profissões específicas)
        for (const level3Item of level2Item.level3) {
          try {
            const level3Category = await categoriesService.createCategory(
              {
                name: level3Item.name,
                slug: level3Item.slug,
                description: null,
                parentId: level2Category.categoryId,
                allowActive: true,
                createdBy: {
                  source: 'script',
                },
              },
              {
                validateAdmin: false,
              }
            );
            totalCreated++;
            console.log(`       ✅ Criada: ${level3Category.name} (${level3Category.categoryId})`);
          } catch (error) {
            console.log(`       ⚠️  Já existe ou erro: ${level3Item.name} - ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          }
        }
      }

      console.log('');
    } catch (error) {
      if (error instanceof Error && error.message.includes('já existe')) {
        console.log(`   ⚠️  Categoria "${categoryGroup.level1.name}" já existe, pulando...\n`);
      } else {
        console.error(`   ❌ Erro ao criar categoria "${categoryGroup.level1.name}":`, error);
        console.log('');
      }
    }
  }

  console.log(`\n✨ Seed concluído! Total de categorias criadas: ${totalCreated}`);
  console.log('\n💡 Nota: Categorias que já existiam foram ignoradas (idempotente)');
}

// Executar seed
seedCategories()
  .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });



