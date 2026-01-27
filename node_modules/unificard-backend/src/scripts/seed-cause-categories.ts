// src/scripts/seed-cause-categories.ts
// Seed de categorias de CAUSAS SOCIAIS - Engajamento e propósito

import dotenv from 'dotenv';
import { join } from 'path';
import { categoriesService } from '../core/categories/categories.service';

dotenv.config({ path: join(process.cwd(), '.env') });

/**
 * ESTRUTURA DAS CAUSAS SOCIAIS - Baseada em grandes temas de impacto social
 *
 * PRINCÍPIO:
 * Causas são grandes temas onde a pessoa quer gerar impacto positivo.
 * Não é profissão. Não é hobby. É propósito e engajamento.
 *
 * ESCOPO: scope='cause'
 */
const CAUSE_CATEGORIES = [
  // ============================================
  // 1️⃣ MEIO AMBIENTE
  // ============================================
  {
    level1: {
      name: 'Meio Ambiente',
      slug: 'meio-ambiente',
      description: 'Sustentabilidade, preservação ambiental e ecologia',
      icon: '🌍'
    },
    level2: [
      {
        name: 'Preservação Ambiental',
        slug: 'preservacao-ambiental',
        description: 'Proteção de ecossistemas e biodiversidade'
      },
      {
        name: 'Mudanças Climáticas',
        slug: 'mudancas-climaticas',
        description: 'Combate ao aquecimento global e emissões'
      },
      {
        name: 'Energia Limpa',
        slug: 'energia-limpa',
        description: 'Energias renováveis e sustentáveis'
      },
      {
        name: 'Gestão de Resíduos',
        slug: 'gestao-residuos',
        description: 'Reciclagem, compostagem e redução de lixo'
      },
      {
        name: 'Água e Saneamento',
        slug: 'agua-saneamento',
        description: 'Preservação de recursos hídricos'
      },
      {
        name: 'Agricultura Sustentável',
        slug: 'agricultura-sustentavel',
        description: 'Práticas agrícolas ecológicas'
      },
    ],
  },

  // ============================================
  // 2️⃣ EDUCAÇÃO
  // ============================================
  {
    level1: {
      name: 'Educação',
      slug: 'educacao-causa',
      description: 'Acesso à educação de qualidade e inclusão educacional',
      icon: '📚'
    },
    level2: [
      {
        name: 'Alfabetização',
        slug: 'alfabetizacao',
        description: 'Combate ao analfabetismo'
      },
      {
        name: 'Educação Infantil',
        slug: 'educacao-infantil',
        description: 'Primeira infância e pré-escola'
      },
      {
        name: 'Ensino Fundamental',
        slug: 'ensino-fundamental',
        description: 'Acesso e qualidade no ensino básico'
      },
      {
        name: 'Ensino Médio',
        slug: 'ensino-medio',
        description: 'Formação de adolescentes e jovens'
      },
      {
        name: 'Ensino Superior',
        slug: 'ensino-superior',
        description: 'Acesso à universidade e formação técnica'
      },
      {
        name: 'Educação de Jovens e Adultos',
        slug: 'eja',
        description: 'EJA e educação continuada'
      },
      {
        name: 'Educação Tecnológica',
        slug: 'educacao-tecnologica',
        description: 'Inclusão digital e capacitação em TI'
      },
      {
        name: 'Educação Especial',
        slug: 'educacao-especial',
        description: 'Inclusão de pessoas com deficiência'
      },
    ],
  },

  // ============================================
  // 3️⃣ SAÚDE
  // ============================================
  {
    level1: {
      name: 'Saúde',
      slug: 'saude-causa',
      description: 'Acesso à saúde, bem-estar e qualidade de vida',
      icon: '❤️'
    },
    level2: [
      {
        name: 'Saúde Pública',
        slug: 'saude-publica',
        description: 'Acesso universal à saúde'
      },
      {
        name: 'Saúde Mental',
        slug: 'saude-mental',
        description: 'Prevenção e tratamento psicológico'
      },
      {
        name: 'Combate a Doenças',
        slug: 'combate-doencas',
        description: 'Prevenção e tratamento de doenças'
      },
      {
        name: 'Nutrição e Segurança Alimentar',
        slug: 'nutricao-causa',
        description: 'Alimentação saudável e combate à fome'
      },
      {
        name: 'Saúde Materno-Infantil',
        slug: 'saude-materno-infantil',
        description: 'Saúde de gestantes, mães e bebês'
      },
      {
        name: 'Prevenção de Drogas e Álcool',
        slug: 'prevencao-drogas',
        description: 'Combate à dependência química'
      },
      {
        name: 'Doação de Sangue e Órgãos',
        slug: 'doacao-sangue-orgaos',
        description: 'Incentivo à doação'
      },
    ],
  },

  // ============================================
  // 4️⃣ DIREITOS HUMANOS
  // ============================================
  {
    level1: {
      name: 'Direitos Humanos',
      slug: 'direitos-humanos',
      description: 'Igualdade, justiça social e direitos civis',
      icon: '✊'
    },
    level2: [
      {
        name: 'Igualdade de Gênero',
        slug: 'igualdade-genero',
        description: 'Combate ao machismo e promoção da igualdade'
      },
      {
        name: 'Direitos LGBTQIA+',
        slug: 'direitos-lgbtqia',
        description: 'Respeito à diversidade sexual e de gênero'
      },
      {
        name: 'Combate ao Racismo',
        slug: 'combate-racismo',
        description: 'Antirracismo e igualdade racial'
      },
      {
        name: 'Direitos da Criança',
        slug: 'direitos-crianca',
        description: 'Proteção e bem-estar infantil'
      },
      {
        name: 'Direitos do Adolescente',
        slug: 'direitos-adolescente',
        description: 'ECA e proteção de jovens'
      },
      {
        name: 'Direitos do Idoso',
        slug: 'direitos-idoso',
        description: 'Estatuto do Idoso e envelhecimento digno'
      },
      {
        name: 'Pessoas com Deficiência',
        slug: 'pcd',
        description: 'Inclusão e acessibilidade'
      },
      {
        name: 'Refugiados e Migrantes',
        slug: 'refugiados-migrantes',
        description: 'Acolhimento e integração'
      },
      {
        name: 'Liberdade de Expressão',
        slug: 'liberdade-expressao',
        description: 'Direitos civis e liberdades democráticas'
      },
    ],
  },

  // ============================================
  // 5️⃣ PROTEÇÃO ANIMAL
  // ============================================
  {
    level1: {
      name: 'Proteção Animal',
      slug: 'protecao-animal',
      description: 'Bem-estar animal e direitos dos animais',
      icon: '🐾'
    },
    level2: [
      {
        name: 'Animais de Rua',
        slug: 'animais-rua',
        description: 'Resgate e cuidado de animais abandonados'
      },
      {
        name: 'Animais Silvestres',
        slug: 'animais-silvestres',
        description: 'Proteção da fauna nativa'
      },
      {
        name: 'Adoção Responsável',
        slug: 'adocao-responsavel',
        description: 'Incentivo à adoção e guarda responsável'
      },
      {
        name: 'Combate aos Maus-Tratos',
        slug: 'combate-maus-tratos',
        description: 'Denúncia e prevenção de crueldade'
      },
      {
        name: 'Castração e Controle Populacional',
        slug: 'castracao',
        description: 'Controle ético de natalidade'
      },
      {
        name: 'Veganismo e Direitos Animais',
        slug: 'veganismo-direitos-animais',
        description: 'Ética animal e alimentação consciente'
      },
    ],
  },

  // ============================================
  // 6️⃣ COMBATE À POBREZA
  // ============================================
  {
    level1: {
      name: 'Combate à Pobreza',
      slug: 'combate-pobreza',
      description: 'Redução da desigualdade social e inclusão econômica',
      icon: '🤝'
    },
    level2: [
      {
        name: 'Segurança Alimentar',
        slug: 'seguranca-alimentar',
        description: 'Combate à fome e distribuição de alimentos'
      },
      {
        name: 'Moradia Digna',
        slug: 'moradia-causa',
        description: 'Direito à moradia e sem-teto'
      },
      {
        name: 'Geração de Renda',
        slug: 'geracao-renda',
        description: 'Capacitação profissional e empreendedorismo'
      },
      {
        name: 'Economia Solidária',
        slug: 'economia-solidaria',
        description: 'Cooperativas e negócios sociais'
      },
      {
        name: 'Acesso a Serviços Básicos',
        slug: 'acesso-servicos-basicos',
        description: 'Água, luz, saneamento e transporte'
      },
      {
        name: 'Microcrédito e Finanças Solidárias',
        slug: 'microcredito',
        description: 'Inclusão financeira'
      },
    ],
  },

  // ============================================
  // 7️⃣ ARTE E CULTURA
  // ============================================
  {
    level1: {
      name: 'Arte e Cultura',
      slug: 'arte-cultura-causa',
      description: 'Preservação cultural, acesso à cultura e expressão artística',
      icon: '🎨'
    },
    level2: [
      {
        name: 'Cultura Popular',
        slug: 'cultura-popular',
        description: 'Festas tradicionais e manifestações populares'
      },
      {
        name: 'Patrimônio Cultural',
        slug: 'patrimonio-cultural',
        description: 'Preservação de monumentos e memória'
      },
      {
        name: 'Arte Urbana',
        slug: 'arte-urbana',
        description: 'Grafite, muralismo e arte de rua'
      },
      {
        name: 'Música e Tradições',
        slug: 'musica-tradicoes',
        description: 'Música tradicional e folclore'
      },
      {
        name: 'Teatro e Artes Cênicas',
        slug: 'teatro-artes-cenicas',
        description: 'Acesso ao teatro e formação artística'
      },
      {
        name: 'Cinema e Audiovisual',
        slug: 'cinema-audiovisual-causa',
        description: 'Produção cultural e acesso ao cinema'
      },
      {
        name: 'Bibliotecas e Leitura',
        slug: 'bibliotecas-leitura',
        description: 'Incentivo à leitura e acesso a livros'
      },
    ],
  },

  // ============================================
  // 8️⃣ ESPORTE E LAZER
  // ============================================
  {
    level1: {
      name: 'Esporte e Lazer',
      slug: 'esporte-lazer-causa',
      description: 'Acesso ao esporte, lazer e atividades físicas para todos',
      icon: '⚽'
    },
    level2: [
      {
        name: 'Esporte Comunitário',
        slug: 'esporte-comunitario',
        description: 'Esporte de base e escolinhas'
      },
      {
        name: 'Inclusão pelo Esporte',
        slug: 'inclusao-esporte',
        description: 'Esporte adaptado e inclusivo'
      },
      {
        name: 'Lazer e Recreação',
        slug: 'lazer-recreacao',
        description: 'Espaços públicos e atividades recreativas'
      },
      {
        name: 'Esporte para Crianças e Jovens',
        slug: 'esporte-criancas-jovens',
        description: 'Formação esportiva infantojuvenil'
      },
      {
        name: 'Atividade Física e Saúde',
        slug: 'atividade-fisica-saude',
        description: 'Incentivo à prática de exercícios'
      },
    ],
  },

  // ============================================
  // 9️⃣ SEGURANÇA E JUSTIÇA
  // ============================================
  {
    level1: {
      name: 'Segurança e Justiça',
      slug: 'seguranca-justica',
      description: 'Segurança pública, acesso à justiça e direitos civis',
      icon: '⚖️'
    },
    level2: [
      {
        name: 'Violência Doméstica',
        slug: 'violencia-domestica',
        description: 'Combate à violência contra mulheres e crianças'
      },
      {
        name: 'Segurança Comunitária',
        slug: 'seguranca-comunitaria',
        description: 'Prevenção da violência e mediação de conflitos'
      },
      {
        name: 'Acesso à Justiça',
        slug: 'acesso-justica',
        description: 'Assistência jurídica gratuita'
      },
      {
        name: 'Sistema Prisional',
        slug: 'sistema-prisional',
        description: 'Ressocialização e direitos dos presos'
      },
      {
        name: 'Combate ao Tráfico',
        slug: 'combate-trafico',
        description: 'Prevenção ao tráfico de drogas'
      },
    ],
  },

  // ============================================
  // 🔟 TECNOLOGIA E INOVAÇÃO SOCIAL
  // ============================================
  {
    level1: {
      name: 'Tecnologia e Inovação Social',
      slug: 'tecnologia-inovacao-social',
      description: 'Tecnologia para impacto social e inclusão digital',
      icon: '💡'
    },
    level2: [
      {
        name: 'Inclusão Digital',
        slug: 'inclusao-digital',
        description: 'Acesso à internet e alfabetização digital'
      },
      {
        name: 'Tecnologia para o Bem',
        slug: 'tecnologia-bem',
        description: 'Tech4Good e inovação com propósito'
      },
      {
        name: 'Dados Abertos e Transparência',
        slug: 'dados-abertos',
        description: 'Governo aberto e accountability'
      },
      {
        name: 'Inovação Social',
        slug: 'inovacao-social',
        description: 'Soluções criativas para problemas sociais'
      },
    ],
  },
];

/**
 * Cria categorias de causas sociais de forma hierárquica
 */
async function seedCauseCategories() {
  console.log('🌱 Iniciando seed de categorias de CAUSAS SOCIAIS...\n');

  let totalCreated = 0;
  let totalExisting = 0;

  for (const area of CAUSE_CATEGORIES) {
    console.log(`\n📁 ${area.level1.icon} ${area.level1.name}`);

    // Criar categoria de nível 1 (raiz)
    let level1Category: any;
    try {
      level1Category = await categoriesService.createCategory({
        name: area.level1.name,
        slug: area.level1.slug,
        description: area.level1.description || null,
        parentId: null,
        allowActive: true, // Criar como ativa
        createdBy: {
          source: 'script',
        },
      });
      console.log(`  ✅ Criada: ${area.level1.name}`);
      totalCreated++;
    } catch (error: any) {
      // Se já existe, buscar pelo slug (via repository ou query direta)
      const { pool } = await import('../core/database/pool');
      const existingResult = await pool.query(
        `SELECT * FROM categories WHERE slug = $1 LIMIT 1`,
        [area.level1.slug]
      );
      if (existingResult.rows.length > 0) {
        level1Category = { categoryId: existingResult.rows[0].category_id };
        console.log(`  ⏭️  Já existe: ${area.level1.name}`);
        totalExisting++;
      } else {
        console.error(`  ❌ Erro ao criar categoria: ${area.level1.name}`, error);
        continue;
      }
    }

    const level1CategoryId = level1Category?.categoryId;

    if (!level1CategoryId) {
      console.error(`  ❌ Erro ao criar/buscar categoria: ${area.level1.name}`);
      continue;
    }

    // Atualizar scope e ícone via metadata
    try {
      const { pool } = await import('../core/database/pool');
      await pool.query(
        `UPDATE categories
         SET scope = 'cause',
             icon = $1,
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{icon}',
               to_jsonb($1::text)
             )
         WHERE category_id = $2`,
        [area.level1.icon, level1CategoryId]
      );
    } catch (error) {
      console.error(`  ⚠️  Erro ao atualizar scope/icon: ${error}`);
    }

    // Criar categorias de nível 2
    if (area.level2 && area.level2.length > 0) {
      for (const subcat of area.level2) {
        let level2Category: any;
        try {
          level2Category = await categoriesService.createCategory({
            name: subcat.name,
            slug: subcat.slug,
            description: subcat.description || null,
            parentId: level1CategoryId,
            allowActive: true,
            createdBy: {
              source: 'script',
            },
          });
          console.log(`    ✅ ${subcat.name}`);
          totalCreated++;
        } catch (error: any) {
          // Se já existe, buscar pelo slug (via query direta)
          const { pool } = await import('../core/database/pool');
          const existingResult = await pool.query(
            `SELECT * FROM categories WHERE slug = $1 LIMIT 1`,
            [subcat.slug]
          );
          if (existingResult.rows.length > 0) {
            level2Category = { categoryId: existingResult.rows[0].category_id };
            console.log(`    ⏭️  ${subcat.name}`);
            totalExisting++;
          } else {
            console.error(`    ❌ Erro ao criar categoria: ${subcat.name}`, error);
            continue;
          }
        }

        // Atualizar scope da subcategoria
        if (level2Category?.categoryId) {
          try {
            const { pool } = await import('../core/database/pool');
            await pool.query(
              `UPDATE categories SET scope = 'cause' WHERE category_id = $1`,
              [level2Category.categoryId]
            );
          } catch (error) {
            console.error(`    ⚠️  Erro ao atualizar scope: ${error}`);
          }
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Seed de categorias de CAUSAS SOCIAIS concluído!`);
  console.log(`📊 Total criado: ${totalCreated}`);
  console.log(`⏭️  Total já existente: ${totalExisting}`);
  console.log('='.repeat(60) + '\n');
}

// Executar seed
seedCauseCategories()
  .then(() => {
    console.log('✅ Script finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar seed:', error);
    process.exit(1);
  });
