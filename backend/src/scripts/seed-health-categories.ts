// src/scripts/seed-health-categories.ts
// Seed de categorias de SAÚDE - Autodeclaração de condições e características
// PRINCÍPIO FUNDAMENTAL: Saúde é AUTODECLARAÇÃO, NUNCA diagnóstico.

import dotenv from 'dotenv';
import { join } from 'path';
import { categoriesService } from '../core/categories/categories.service';

dotenv.config({ path: join(process.cwd(), '.env') });

/**
 * ESTRUTURA DE SAÚDE - Baseada em autodeclaração
 *
 * REGRAS CANÔNICAS:
 * 1. scope='health' é 100% AUTODECLARADO
 * 2. scope='health' NUNCA gera diagnóstico ou inferência médica
 * 3. scope='health' NUNCA bloqueia acesso a funcionalidades
 * 4. scope='health' NUNCA altera preços ou permissões
 * 5. scope='health' PODE cruzar com:
 *    - Planos de saúde parceiros (elegibilidade a benefícios)
 *    - Descontos em farmácias/óticas
 *    - Eventos de bem-estar
 *    - Grupos de apoio (ex: diabéticos, celíacos)
 * 6. Dados de saúde são SENSÍVEIS (LGPD Art. 11)
 *
 * ESTRUTURA:
 * - Level 0: Domínio de Saúde (ex: Visão, Audição, Sono)
 * - Level 1: Área (ex: Correção Visual, Condições)
 * - Level 2: Condição/Característica autodeclarável (ex: Miopia, Uso óculos)
 */
const HEALTH_CATEGORIES = [
  // ============================================
  // 1. VISÃO
  // ============================================
  {
    level0: {
      name: 'Visão',
      slug: 'visao',
      description: 'Autodeclaração sobre saúde visual',
    },
    level1: [
      {
        name: 'Correção Visual',
        slug: 'correcao-visual',
        description: 'Uso de correção visual',
        level2: [
          { name: 'Uso óculos', slug: 'uso-oculos' },
          { name: 'Uso lentes de contato', slug: 'uso-lentes-contato' },
          { name: 'Uso óculos e lentes', slug: 'uso-oculos-lentes' },
          { name: 'Não uso correção visual', slug: 'nao-uso-correcao-visual' },
        ],
      },
      {
        name: 'Condições Visuais',
        slug: 'condicoes-visuais',
        description: 'Condições visuais autodeclaradas',
        level2: [
          { name: 'Miopia', slug: 'miopia' },
          { name: 'Hipermetropia', slug: 'hipermetropia' },
          { name: 'Astigmatismo', slug: 'astigmatismo' },
          { name: 'Presbiopia (vista cansada)', slug: 'presbiopia' },
          { name: 'Daltonismo', slug: 'daltonismo' },
          { name: 'Nenhuma condição visual', slug: 'nenhuma-condicao-visual' },
        ],
      },
      {
        name: 'Cirurgias Oculares',
        slug: 'cirurgias-oculares',
        description: 'Histórico de cirurgias oculares',
        level2: [
          { name: 'Fiz cirurgia refrativa', slug: 'cirurgia-refrativa' },
          { name: 'Fiz cirurgia de catarata', slug: 'cirurgia-catarata' },
          { name: 'Nunca fiz cirurgia ocular', slug: 'nunca-cirurgia-ocular' },
        ],
      },
    ],
  },

  // ============================================
  // 2. AUDIÇÃO
  // ============================================
  {
    level0: {
      name: 'Audição',
      slug: 'audicao',
      description: 'Autodeclaração sobre saúde auditiva',
    },
    level1: [
      {
        name: 'Correção Auditiva',
        slug: 'correcao-auditiva',
        description: 'Uso de aparelhos auditivos',
        level2: [
          { name: 'Uso aparelho auditivo', slug: 'uso-aparelho-auditivo' },
          { name: 'Uso implante coclear', slug: 'uso-implante-coclear' },
          { name: 'Não uso correção auditiva', slug: 'nao-uso-correcao-auditiva' },
        ],
      },
      {
        name: 'Condições Auditivas',
        slug: 'condicoes-auditivas',
        description: 'Condições auditivas autodeclaradas',
        level2: [
          { name: 'Perda auditiva leve', slug: 'perda-auditiva-leve' },
          { name: 'Perda auditiva moderada', slug: 'perda-auditiva-moderada' },
          { name: 'Perda auditiva severa', slug: 'perda-auditiva-severa' },
          { name: 'Zumbido (tinnitus)', slug: 'zumbido-tinnitus' },
          { name: 'Audição normal', slug: 'audicao-normal' },
        ],
      },
    ],
  },

  // ============================================
  // 3. SONO
  // ============================================
  {
    level0: {
      name: 'Sono',
      slug: 'sono',
      description: 'Autodeclaração sobre qualidade do sono',
    },
    level1: [
      {
        name: 'Qualidade do Sono',
        slug: 'qualidade-sono',
        description: 'Como você avalia seu sono',
        level2: [
          { name: 'Durmo bem', slug: 'durmo-bem' },
          { name: 'Tenho dificuldade para dormir', slug: 'dificuldade-dormir' },
          { name: 'Acordo durante a noite', slug: 'acordo-durante-noite' },
          { name: 'Acordo cansado', slug: 'acordo-cansado' },
        ],
      },
      {
        name: 'Condições de Sono',
        slug: 'condicoes-sono',
        description: 'Condições relacionadas ao sono',
        level2: [
          { name: 'Insônia', slug: 'insonia' },
          { name: 'Apneia do sono', slug: 'apneia-sono' },
          { name: 'Ronco', slug: 'ronco' },
          { name: 'Bruxismo', slug: 'bruxismo' },
          { name: 'Nenhuma condição de sono', slug: 'nenhuma-condicao-sono' },
        ],
      },
      {
        name: 'Horas de Sono',
        slug: 'horas-sono',
        description: 'Média de horas de sono por noite',
        level2: [
          { name: 'Durmo menos de 5 horas', slug: 'sono-menos-5h' },
          { name: 'Durmo 5 a 6 horas', slug: 'sono-5-6h' },
          { name: 'Durmo 6 a 8 horas', slug: 'sono-6-8h' },
          { name: 'Durmo mais de 8 horas', slug: 'sono-mais-8h' },
        ],
      },
    ],
  },

  // ============================================
  // 4. ALIMENTAÇÃO E RESTRIÇÕES
  // ============================================
  {
    level0: {
      name: 'Alimentação e Restrições',
      slug: 'alimentacao-restricoes',
      description: 'Autodeclaração sobre dieta e restrições alimentares',
    },
    level1: [
      {
        name: 'Dieta',
        slug: 'dieta',
        description: 'Tipo de dieta seguida',
        level2: [
          { name: 'Sem restrição alimentar', slug: 'sem-restricao-alimentar' },
          { name: 'Vegetariano', slug: 'vegetariano' },
          { name: 'Vegano', slug: 'vegano' },
          { name: 'Pescetariano', slug: 'pescetariano' },
          { name: 'Low carb', slug: 'low-carb' },
          { name: 'Cetogênica', slug: 'cetogenica' },
          { name: 'Kosher', slug: 'kosher' },
          { name: 'Halal', slug: 'halal' },
        ],
      },
      {
        name: 'Intolerâncias',
        slug: 'intolerancias',
        description: 'Intolerâncias alimentares',
        level2: [
          { name: 'Intolerância à lactose', slug: 'intolerancia-lactose' },
          { name: 'Intolerância ao glúten', slug: 'intolerancia-gluten' },
          { name: 'Intolerância à frutose', slug: 'intolerancia-frutose' },
          { name: 'Nenhuma intolerância', slug: 'nenhuma-intolerancia' },
        ],
      },
      {
        name: 'Alergias Alimentares',
        slug: 'alergias-alimentares',
        description: 'Alergias alimentares declaradas',
        level2: [
          { name: 'Alergia a amendoim', slug: 'alergia-amendoim' },
          { name: 'Alergia a frutos do mar', slug: 'alergia-frutos-mar' },
          { name: 'Alergia a ovo', slug: 'alergia-ovo' },
          { name: 'Alergia a leite', slug: 'alergia-leite' },
          { name: 'Alergia a soja', slug: 'alergia-soja' },
          { name: 'Alergia a trigo', slug: 'alergia-trigo' },
          { name: 'Outras alergias alimentares', slug: 'outras-alergias-alimentares' },
          { name: 'Nenhuma alergia alimentar', slug: 'nenhuma-alergia-alimentar' },
        ],
      },
    ],
  },

  // ============================================
  // 5. CONDIÇÕES CRÔNICAS
  // ============================================
  {
    level0: {
      name: 'Condições Crônicas',
      slug: 'condicoes-cronicas',
      description: 'Autodeclaração de condições crônicas',
    },
    level1: [
      {
        name: 'Condições Metabólicas',
        slug: 'condicoes-metabolicas',
        description: 'Condições metabólicas autodeclaradas',
        level2: [
          { name: 'Diabetes tipo 1', slug: 'diabetes-tipo-1' },
          { name: 'Diabetes tipo 2', slug: 'diabetes-tipo-2' },
          { name: 'Pré-diabetes', slug: 'pre-diabetes' },
          { name: 'Colesterol alto', slug: 'colesterol-alto' },
          { name: 'Hipotireoidismo', slug: 'hipotireoidismo' },
          { name: 'Hipertireoidismo', slug: 'hipertireoidismo' },
          { name: 'Nenhuma condição metabólica', slug: 'nenhuma-condicao-metabolica' },
        ],
      },
      {
        name: 'Condições Cardiovasculares',
        slug: 'condicoes-cardiovasculares',
        description: 'Condições cardiovasculares autodeclaradas',
        level2: [
          { name: 'Hipertensão (pressão alta)', slug: 'hipertensao' },
          { name: 'Hipotensão (pressão baixa)', slug: 'hipotensao' },
          { name: 'Arritmia cardíaca', slug: 'arritmia-cardiaca' },
          { name: 'Nenhuma condição cardiovascular', slug: 'nenhuma-condicao-cardiovascular' },
        ],
      },
      {
        name: 'Condições Respiratórias',
        slug: 'condicoes-respiratorias',
        description: 'Condições respiratórias autodeclaradas',
        level2: [
          { name: 'Asma', slug: 'asma' },
          { name: 'Bronquite crônica', slug: 'bronquite-cronica' },
          { name: 'Rinite alérgica', slug: 'rinite-alergica' },
          { name: 'Sinusite crônica', slug: 'sinusite-cronica' },
          { name: 'Nenhuma condição respiratória', slug: 'nenhuma-condicao-respiratoria' },
        ],
      },
      {
        name: 'Condições Autoimunes',
        slug: 'condicoes-autoimunes',
        description: 'Condições autoimunes autodeclaradas',
        level2: [
          { name: 'Lúpus', slug: 'lupus' },
          { name: 'Artrite reumatoide', slug: 'artrite-reumatoide' },
          { name: 'Psoríase', slug: 'psoriase' },
          { name: 'Doença celíaca', slug: 'doenca-celiaca' },
          { name: 'Vitiligo', slug: 'vitiligo' },
          { name: 'Nenhuma condição autoimune', slug: 'nenhuma-condicao-autoimune' },
        ],
      },
    ],
  },

  // ============================================
  // 6. SAÚDE MENTAL
  // ============================================
  {
    level0: {
      name: 'Saúde Mental',
      slug: 'saude-mental',
      description: 'Autodeclaração sobre saúde mental e bem-estar emocional',
    },
    level1: [
      {
        name: 'Acompanhamento',
        slug: 'acompanhamento-mental',
        description: 'Tipo de acompanhamento em saúde mental',
        level2: [
          { name: 'Faço terapia', slug: 'faco-terapia' },
          { name: 'Faço acompanhamento psiquiátrico', slug: 'acompanhamento-psiquiatrico' },
          { name: 'Faço terapia e psiquiatria', slug: 'terapia-e-psiquiatria' },
          { name: 'Não faço acompanhamento', slug: 'nao-faco-acompanhamento-mental' },
        ],
      },
      {
        name: 'Condições Declaradas',
        slug: 'condicoes-mentais-declaradas',
        description: 'Condições de saúde mental autodeclaradas',
        level2: [
          { name: 'Ansiedade', slug: 'ansiedade' },
          { name: 'Depressão', slug: 'depressao' },
          { name: 'TDAH', slug: 'tdah' },
          { name: 'TOC', slug: 'toc' },
          { name: 'Burnout', slug: 'burnout' },
          { name: 'Síndrome do pânico', slug: 'sindrome-panico' },
          { name: 'Nenhuma condição declarada', slug: 'nenhuma-condicao-mental' },
        ],
      },
      {
        name: 'Bem-estar Atual',
        slug: 'bem-estar-atual',
        description: 'Como você se sente atualmente',
        level2: [
          { name: 'Me sinto bem', slug: 'me-sinto-bem' },
          { name: 'Passando por momento difícil', slug: 'momento-dificil' },
          { name: 'Buscando ajuda profissional', slug: 'buscando-ajuda' },
          { name: 'Prefiro não declarar', slug: 'prefiro-nao-declarar-mental' },
        ],
      },
    ],
  },

  // ============================================
  // 7. MOBILIDADE
  // ============================================
  {
    level0: {
      name: 'Mobilidade',
      slug: 'mobilidade',
      description: 'Autodeclaração sobre mobilidade e locomoção',
    },
    level1: [
      {
        name: 'Locomoção',
        slug: 'locomocao',
        description: 'Como você se locomove',
        level2: [
          { name: 'Sem restrições de mobilidade', slug: 'sem-restricao-mobilidade' },
          { name: 'Uso muletas', slug: 'uso-muletas' },
          { name: 'Uso cadeira de rodas', slug: 'uso-cadeira-rodas' },
          { name: 'Uso andador', slug: 'uso-andador' },
          { name: 'Uso prótese', slug: 'uso-protese' },
        ],
      },
      {
        name: 'Dores Crônicas',
        slug: 'dores-cronicas',
        description: 'Dores crônicas declaradas',
        level2: [
          { name: 'Dor crônica nas costas', slug: 'dor-cronica-costas' },
          { name: 'Dor crônica nos joelhos', slug: 'dor-cronica-joelhos' },
          { name: 'Dor crônica no pescoço', slug: 'dor-cronica-pescoco' },
          { name: 'Fibromialgia', slug: 'fibromialgia' },
          { name: 'Nenhuma dor crônica', slug: 'nenhuma-dor-cronica' },
        ],
      },
    ],
  },

  // ============================================
  // 8. INFORMAÇÕES GERAIS
  // ============================================
  {
    level0: {
      name: 'Informações Gerais de Saúde',
      slug: 'informacoes-gerais-saude',
      description: 'Informações gerais sobre saúde',
    },
    level1: [
      {
        name: 'Tipo Sanguíneo',
        slug: 'tipo-sanguineo',
        description: 'Seu tipo sanguíneo',
        level2: [
          { name: 'Tipo A positivo (A+)', slug: 'tipo-a-positivo' },
          { name: 'Tipo A negativo (A-)', slug: 'tipo-a-negativo' },
          { name: 'Tipo B positivo (B+)', slug: 'tipo-b-positivo' },
          { name: 'Tipo B negativo (B-)', slug: 'tipo-b-negativo' },
          { name: 'Tipo AB positivo (AB+)', slug: 'tipo-ab-positivo' },
          { name: 'Tipo AB negativo (AB-)', slug: 'tipo-ab-negativo' },
          { name: 'Tipo O positivo (O+)', slug: 'tipo-o-positivo' },
          { name: 'Tipo O negativo (O-)', slug: 'tipo-o-negativo' },
          { name: 'Não sei meu tipo sanguíneo', slug: 'nao-sei-tipo-sanguineo' },
        ],
      },
      {
        name: 'Doação',
        slug: 'doacao',
        description: 'Informações sobre doação',
        level2: [
          { name: 'Sou doador de sangue', slug: 'doador-sangue' },
          { name: 'Sou doador de órgãos', slug: 'doador-orgaos' },
          { name: 'Sou doador de sangue e órgãos', slug: 'doador-sangue-orgaos' },
          { name: 'Quero me tornar doador', slug: 'quero-ser-doador' },
          { name: 'Não sou doador', slug: 'nao-sou-doador' },
        ],
      },
      {
        name: 'Alergias Gerais',
        slug: 'alergias-gerais',
        description: 'Outras alergias não alimentares',
        level2: [
          { name: 'Alergia a medicamentos', slug: 'alergia-medicamentos' },
          { name: 'Alergia a látex', slug: 'alergia-latex' },
          { name: 'Alergia a picada de inseto', slug: 'alergia-picada-inseto' },
          { name: 'Alergia a pólen', slug: 'alergia-polen' },
          { name: 'Alergia a ácaros', slug: 'alergia-acaros' },
          { name: 'Alergia a pelos de animais', slug: 'alergia-pelos-animais' },
          { name: 'Nenhuma alergia conhecida', slug: 'nenhuma-alergia' },
        ],
      },
    ],
  },
];

/**
 * ⚠️ UNSAFE SCRIPT - APENAS PARA DESENVOLVIMENTO
 * GOVERNANÇA: Este script cria categorias como 'active' diretamente
 * NUNCA executar em produção sem revisão manual
 *
 * PRINCÍPIO: Saúde é AUTODECLARAÇÃO, NUNCA diagnóstico.
 */
async function seedHealthCategories() {
  // GOVERNANÇA: Validar ambiente
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    throw new Error('❌ ERRO CRÍTICO: Scripts de seed NÃO podem ser executados em produção!');
  }

  console.log('🏥 Iniciando seed de categorias de SAÚDE...\n');
  console.log('⚠️  AVISO: Este script cria categorias como ACTIVE (unsafe)\n');
  console.log('🔒 PRINCÍPIO: Saúde é AUTODECLARAÇÃO, NUNCA diagnóstico.\n');
  console.log('📋 REGRAS CANÔNICAS:');
  console.log('   - scope="health" é 100% AUTODECLARADO');
  console.log('   - NUNCA gera diagnóstico ou inferência médica');
  console.log('   - NUNCA bloqueia acesso ou altera preços');
  console.log('   - Dados são SENSÍVEIS (LGPD Art. 11)\n');

  let totalCreated = 0;
  const { pool } = await import('@core/database/pool');

  for (const categoryGroup of HEALTH_CATEGORIES) {
    try {
      // Criar LEVEL 0 (Domínio de Saúde) - parent_id = null
      console.log(`📁 Criando domínio (level 0): ${categoryGroup.level0.name}`);
      const level0Category = await categoriesService.createCategory(
        {
          name: categoryGroup.level0.name,
          slug: categoryGroup.level0.slug,
          description: categoryGroup.level0.description,
          parentId: null,
          allowActive: true,
          createdBy: {
            source: 'script',
          },
        },
        {
          validateAdmin: false,
          context: 'health', // IMPORTANTE: Contexto de saúde
          skipGate: true,
        }
      );

      // Garantir scope='health' e status='active'
      await pool.query(
        `UPDATE categories SET scope = 'health', status = 'active', is_active = true WHERE category_id = $1`,
        [level0Category.categoryId]
      );
      totalCreated++;
      console.log(`   ✅ Criado: ${level0Category.name} (level 0, ${level0Category.categoryId})`);

      // Criar LEVEL 1 (Área)
      for (const level1Item of categoryGroup.level1) {
        console.log(`  📂 Criando área (level 1): ${level1Item.name}`);
        const level1Category = await categoriesService.createCategory(
          {
            name: level1Item.name,
            slug: level1Item.slug,
            description: level1Item.description,
            parentId: level0Category.categoryId,
            allowActive: true,
            createdBy: {
              source: 'script',
            },
          },
          {
            validateAdmin: false,
            context: 'health',
            skipGate: true,
          }
        );

        // Garantir scope='health' e status='active'
        await pool.query(
          `UPDATE categories SET scope = 'health', status = 'active', is_active = true WHERE category_id = $1`,
          [level1Category.categoryId]
        );
        totalCreated++;
        console.log(`     ✅ Criado: ${level1Category.name} (level 1, ${level1Category.categoryId})`);

        // Criar LEVEL 2 (Condição/Característica autodeclarável)
        for (const level2Item of level1Item.level2) {
          try {
            const level2Category = await categoriesService.createCategory(
              {
                name: level2Item.name,
                slug: level2Item.slug,
                description: null,
                parentId: level1Category.categoryId,
                allowActive: true,
                createdBy: {
                  source: 'script',
                },
              },
              {
                validateAdmin: false,
                context: 'health',
                skipGate: true,
              }
            );

            // Garantir scope='health', status='active' e is_active=true
            await pool.query(
              `UPDATE categories
               SET scope = 'health',
                   status = 'active',
                   is_active = true
               WHERE category_id = $1`,
              [level2Category.categoryId]
            );

            totalCreated++;
            console.log(`       ✅ Criado: ${level2Category.name} (level 2, ${level2Category.categoryId})`);
          } catch (error) {
            console.log(`       ⚠️  Já existe ou erro: ${level2Item.name} - ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          }
        }
      }

      console.log('');
    } catch (error) {
      if (error instanceof Error && error.message.includes('já existe')) {
        console.log(`   ⚠️  Categoria "${categoryGroup.level0.name}" já existe, pulando...\n`);
      } else {
        console.error(`   ❌ Erro ao criar categoria "${categoryGroup.level0.name}":`, error);
        console.log('');
      }
    }
  }

  console.log(`\n✨ Seed concluído! Total de categorias criadas: ${totalCreated}`);
  console.log('\n💡 Nota: Categorias que já existiam foram ignoradas (idempotente)');
  console.log('\n🔒 PRINCÍPIO APLICADO: Saúde é AUTODECLARAÇÃO, NUNCA diagnóstico.');
  console.log('\n⚠️  LEMBRETE: Dados de saúde são SENSÍVEIS (LGPD Art. 11)');
}

// Executar seed
seedHealthCategories()
  .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
