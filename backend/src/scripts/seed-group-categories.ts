// src/scripts/seed-group-categories.ts
// Seed de categorias de grupos em 3 níveis hierárquicos
// 🔴 BLINDAGEM: Categorias de grupo NÃO decidem nada
// - NÃO criam score
// - NÃO bloqueiam funcionalidades
// - São contexto, não hierarquia
// - Devem usar o mesmo sistema de categorias (levels 0, 1, 2)
// - Devem respeitar scope = 'group'

import dotenv from 'dotenv';
import { join } from 'path';
import { categoriesService } from '../core/categories/categories.service';

dotenv.config({ path: join(process.cwd(), '.env') });

/**
 * Estrutura de categorias de grupos em 3 níveis:
 * Level 0: Tipo de Grupo (Cultura, Esporte, Negócios, etc.)
 * Level 1: Subtipo (Música, Artes, Futebol, etc.)
 * Level 2: Foco Específico (Banda, Orquestra, Futebol de Rua, etc.)
 * 
 * IMPORTANTE: O sistema suporta APENAS levels 0, 1 e 2.
 * O level é calculado automaticamente pelo banco baseado no parent_id.
 * 
 * 🔴 BLINDAGEM: Categorias de grupo NÃO decidem nada
 * - NÃO criam score
 * - NÃO bloqueiam funcionalidades
 * - São contexto, não hierarquia
 */
const GROUP_CATEGORIES = [
  // ============================================
  // CULTURA E ARTE
  // ============================================
  {
    level0: {
      name: 'Cultura e Arte',
      slug: 'cultura-arte',
      description: 'Grupos culturais, artísticos e de expressão criativa',
    },
    level1: [
      {
        name: 'Música',
        slug: 'musica',
        description: 'Grupos musicais, bandas e coletivos sonoros',
        level2: [
          { name: 'Banda', slug: 'banda' },
          { name: 'Orquestra', slug: 'orquestra' },
          { name: 'Coral', slug: 'coral' },
          { name: 'DJs e Produtores', slug: 'djs-produtores' },
          { name: 'Coletivo Musical', slug: 'coletivo-musical' },
        ],
      },
      {
        name: 'Artes Visuais',
        slug: 'artes-visuais',
        description: 'Grupos de artes visuais e plásticas',
        level2: [
          { name: 'Coletivo de Artistas', slug: 'coletivo-artistas' },
          { name: 'Grafiteiros', slug: 'grafiteiros' },
          { name: 'Fotógrafos', slug: 'fotografos' },
          { name: 'Ilustradores', slug: 'ilustradores' },
        ],
      },
      {
        name: 'Teatro e Performance',
        slug: 'teatro-performance',
        description: 'Grupos de teatro, dança e performance',
        level2: [
          { name: 'Grupo de Teatro', slug: 'grupo-teatro' },
          { name: 'Companhia de Dança', slug: 'companhia-danca' },
          { name: 'Coletivo de Performance', slug: 'coletivo-performance' },
        ],
      },
      {
        name: 'Literatura e Poesia',
        slug: 'literatura-poesia',
        description: 'Grupos literários e de poesia',
        level2: [
          { name: 'Sarau', slug: 'sarau' },
          { name: 'Clube do Livro', slug: 'clube-livro' },
          { name: 'Coletivo Literário', slug: 'coletivo-literario' },
        ],
      },
    ],
  },

  // ============================================
  // ESPORTE E LAZER
  // ============================================
  {
    level0: {
      name: 'Esporte e Lazer',
      slug: 'esporte-lazer',
      description: 'Grupos esportivos e de atividades físicas',
    },
    level1: [
      {
        name: 'Futebol',
        slug: 'futebol',
        description: 'Grupos de futebol e futebol de rua',
        level2: [
          { name: 'Time de Futebol', slug: 'time-futebol' },
          { name: 'Futebol de Rua', slug: 'futebol-rua' },
          { name: 'Pelada', slug: 'pelada' },
        ],
      },
      {
        name: 'Lutas e Artes Marciais',
        slug: 'lutas-artes-marciais',
        description: 'Grupos de lutas e artes marciais',
        level2: [
          { name: 'Academia de Lutas', slug: 'academia-lutas' },
          { name: 'Grupo de Capoeira', slug: 'grupo-capoeira' },
          { name: 'Coletivo de Artes Marciais', slug: 'coletivo-artes-marciais' },
        ],
      },
      {
        name: 'Ciclismo',
        slug: 'ciclismo',
        description: 'Grupos de ciclismo e bike',
        level2: [
          { name: 'Grupo de Ciclismo', slug: 'grupo-ciclismo' },
          { name: 'Bike Anjo', slug: 'bike-anjo' },
          { name: 'Pedal Coletivo', slug: 'pedal-coletivo' },
        ],
      },
      {
        name: 'Corrida e Caminhada',
        slug: 'corrida-caminhada',
        description: 'Grupos de corrida e caminhada',
        level2: [
          { name: 'Grupo de Corrida', slug: 'grupo-corrida' },
          { name: 'Caminhada Coletiva', slug: 'caminhada-coletiva' },
        ],
      },
    ],
  },

  // ============================================
  // NEGÓCIOS E EMPREENDEDORISMO
  // ============================================
  {
    level0: {
      name: 'Negócios e Empreendedorismo',
      slug: 'negocios-empreendedorismo',
      description: 'Grupos de negócios, networking e empreendedorismo',
    },
    level1: [
      {
        name: 'Networking',
        slug: 'networking',
        description: 'Grupos de networking profissional',
        level2: [
          { name: 'Rede de Negócios', slug: 'rede-negocios' },
          { name: 'Grupo de Networking', slug: 'grupo-networking' },
          { name: 'Associação Comercial', slug: 'associacao-comercial' },
        ],
      },
      {
        name: 'Empreendedorismo',
        slug: 'empreendedorismo',
        description: 'Grupos de empreendedores',
        level2: [
          { name: 'Coletivo de Empreendedores', slug: 'coletivo-empreendedores' },
          { name: 'Startup Community', slug: 'startup-community' },
          { name: 'Grupo de Mentoria', slug: 'grupo-mentoria' },
        ],
      },
      {
        name: 'Cooperativas',
        slug: 'cooperativas',
        description: 'Grupos cooperativos',
        level2: [
          { name: 'Cooperativa', slug: 'cooperativa' },
          { name: 'Associação de Trabalhadores', slug: 'associacao-trabalhadores' },
        ],
      },
    ],
  },

  // ============================================
  // IMPACTO SOCIAL
  // ============================================
  {
    level0: {
      name: 'Impacto Social',
      slug: 'impacto-social',
      description: 'Grupos de impacto social, causas e voluntariado',
    },
    level1: [
      {
        name: 'Voluntariado',
        slug: 'voluntariado',
        description: 'Grupos de voluntariado',
        level2: [
          { name: 'Grupo de Voluntários', slug: 'grupo-voluntarios' },
          { name: 'Ação Social', slug: 'acao-social' },
          { name: 'Mutirão', slug: 'mutirao' },
        ],
      },
      {
        name: 'Causas Específicas',
        slug: 'causas-especificas',
        description: 'Grupos focados em causas específicas',
        level2: [
          { name: 'Meio Ambiente', slug: 'meio-ambiente' },
          { name: 'Direitos Humanos', slug: 'direitos-humanos' },
          { name: 'Inclusão Social', slug: 'inclusao-social' },
          { name: 'Segurança Alimentar', slug: 'seguranca-alimentar' },
        ],
      },
      {
        name: 'Assistência',
        slug: 'assistencia',
        description: 'Grupos de assistência social',
        level2: [
          { name: 'Grupo de Apoio', slug: 'grupo-apoio' },
          { name: 'Assistência Comunitária', slug: 'assistencia-comunitaria' },
        ],
      },
    ],
  },

  // ============================================
  // EDUCAÇÃO E APRENDIZADO
  // ============================================
  {
    level0: {
      name: 'Educação e Aprendizado',
      slug: 'educacao-aprendizado',
      description: 'Grupos educacionais e de aprendizado',
    },
    level1: [
      {
        name: 'Estudos',
        slug: 'estudos',
        description: 'Grupos de estudo',
        level2: [
          { name: 'Grupo de Estudos', slug: 'grupo-estudos' },
          { name: 'Cursinho Popular', slug: 'cursinho-popular' },
          { name: 'Preparatório', slug: 'preparatorio' },
        ],
      },
      {
        name: 'Oficinas e Workshops',
        slug: 'oficinas-workshops',
        description: 'Grupos de oficinas e workshops',
        level2: [
          { name: 'Oficina Comunitária', slug: 'oficina-comunitaria' },
          { name: 'Workshop Coletivo', slug: 'workshop-coletivo' },
        ],
      },
      {
        name: 'Troca de Conhecimento',
        slug: 'troca-conhecimento',
        description: 'Grupos de troca de conhecimento',
        level2: [
          { name: 'Círculo de Aprendizado', slug: 'circulo-aprendizado' },
          { name: 'Troca de Saberes', slug: 'troca-saberes' },
        ],
      },
    ],
  },

  // ============================================
  // FÉ E ESPIRITUALIDADE
  // ============================================
  {
    level0: {
      name: 'Fé e Espiritualidade',
      slug: 'fe-espiritualidade',
      description: 'Grupos religiosos e espirituais',
    },
    level1: [
      {
        name: 'Igrejas',
        slug: 'igrejas',
        description: 'Comunidades religiosas',
        level2: [
          { name: 'Igreja', slug: 'igreja' },
          { name: 'Templo', slug: 'templo' },
          { name: 'Centro Espiritual', slug: 'centro-espiritual' },
        ],
      },
      {
        name: 'Grupos de Fé',
        slug: 'grupos-fe',
        description: 'Grupos de fé e espiritualidade',
        level2: [
          { name: 'Grupo de Oração', slug: 'grupo-oracao' },
          { name: 'Círculo de Fé', slug: 'circulo-fe' },
          { name: 'Estudo Bíblico', slug: 'estudo-biblico' },
        ],
      },
    ],
  },

  // ============================================
  // HOBBIES E INTERESSES
  // ============================================
  {
    level0: {
      name: 'Hobbies e Interesses',
      slug: 'hobbies-interesses',
      description: 'Grupos de hobbies e interesses',
    },
    level1: [
      {
        name: 'Games',
        slug: 'games',
        description: 'Grupos de jogos e e-sports',
        level2: [
          { name: 'Clan de Games', slug: 'clan-games' },
          { name: 'E-sports', slug: 'e-sports' },
          { name: 'RPG', slug: 'rpg' },
        ],
      },
      {
        name: 'Motoclubes',
        slug: 'motoclubes',
        description: 'Clubes de motociclistas',
        level2: [
          { name: 'Motoclube', slug: 'motoclube' },
          { name: 'Grupo de Motociclistas', slug: 'grupo-motociclistas' },
        ],
      },
      {
        name: 'Colecionismo',
        slug: 'colecionismo',
        description: 'Grupos de colecionadores',
        level2: [
          { name: 'Colecionadores', slug: 'colecionadores' },
          { name: 'Troca e Venda', slug: 'troca-venda' },
        ],
      },
    ],
  },
];

/**
 * Função auxiliar para criar categoria
 */
async function createCategory(
  name: string,
  slug: string,
  description: string | undefined,
  parentId: string | null,
  scope: string = 'group'
): Promise<string> {
  try {
    // Verificar se categoria já existe pelo slug
    const { CategoryRepository } = await import('../core/categories/categories.repository');
    const categoryRepository = new CategoryRepository();
    const existing = await categoryRepository.findBySlug(slug, null);
    if (existing) {
      return existing.category_id;
    }

    // Criar categoria usando repository diretamente (para seeds, bypass service)
    const { runQueryWithTenant } = await import('../core/database/pool');
    const { v4: uuidv4 } = await import('uuid');
    
    // Calcular level e path
    let level = 0;
    let path: string[] = [slug];
    
    if (parentId) {
      const parent = await categoryRepository.findById(parentId);
      if (parent) {
        level = parent.level + 1;
        path = [...(parent.path || []), slug];
      }
    }

    // Criar categoria usando repository.create (método canônico)
    // Verificar se já existe antes de criar
    const existingBySlug = await categoryRepository.findBySlugAndParent(slug, parentId);
    if (existingBySlug) {
      return existingBySlug.category_id;
    }

    // Usar runQueryWithTenant para inserir com scope
    const tenantId = '00000000-0000-0000-0000-000000000000'; // Tenant global para seeds
    const categoryId = uuidv4();
    
    await runQueryWithTenant(
      tenantId,
      `
      INSERT INTO categories (
        category_id, name, slug, description, parent_id, level, path, 
        scope, keywords, country_code, status, is_active, requires_review, created_by_ai
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $12, $13, $14)
      ON CONFLICT (category_id) DO NOTHING
      RETURNING category_id
      `,
      [
        categoryId,
        name,
        slug,
        description || null,
        parentId,
        level,
        path,
        scope,
        [], // keywords como array vazio
        null,
        'active',
        true,
        false,
        false,
      ]
    );

    // Verificar se foi criada ou já existia
    const created = await categoryRepository.findBySlugAndParent(slug, parentId);
    if (created) {
      return created.category_id;
    }

    return categoryId;
  } catch (error: any) {
    // Se categoria já existe, buscar pelo slug novamente
    const { CategoryRepository } = await import('../core/categories/categories.repository');
    const categoryRepository = new CategoryRepository();
    const existing = await categoryRepository.findBySlug(slug, null);
    if (existing) {
      return existing.category_id;
    }
    throw error;
  }
}

/**
 * Executa o seed
 */
async function seedGroupCategories() {
  console.log('🌱 Iniciando seed de categorias de grupos...');

  for (const categoryTree of GROUP_CATEGORIES) {
    // Criar Level 0
    const level0Id = await createCategory(
      categoryTree.level0.name,
      categoryTree.level0.slug,
      categoryTree.level0.description,
      null,
      'group'
    );
    console.log(`✅ Level 0 criado: ${categoryTree.level0.name} (${level0Id})`);

    // Criar Level 1
    for (const level1 of categoryTree.level1) {
      const level1Id = await createCategory(
        level1.name,
        level1.slug,
        level1.description,
        level0Id,
        'group'
      );
      console.log(`  ✅ Level 1 criado: ${level1.name} (${level1Id})`);

      // Criar Level 2
      if (level1.level2) {
        for (const level2 of level1.level2) {
          const level2Id = await createCategory(
            level2.name,
            level2.slug,
            undefined,
            level1Id,
            'group'
          );
          console.log(`    ✅ Level 2 criado: ${level2.name} (${level2Id})`);
        }
      }
    }
  }

  console.log('✅ Seed de categorias de grupos concluído!');
}

// Executar se chamado diretamente
if (require.main === module) {
  seedGroupCategories()
    .then(() => {
      console.log('✅ Seed concluído com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro ao executar seed:', error);
      process.exit(1);
    });
}

export { seedGroupCategories, GROUP_CATEGORIES };

