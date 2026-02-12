// src/scripts/seed-health-taxonomies.ts
// Seed inicial de taxonomias de saúde
// Baseado nas seções do ProfileHealth.tsx

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

interface TaxonomySeed {
  name: string;
  slug: string;
  category: 'general' | 'vision' | 'dental' | 'medications' | 'mobility' | 'mental' | 'other';
  factType: 'condition' | 'medication' | 'device' | 'service_need' | 'allergy' | 'other';
  description: string | null;
  parentId?: string | null;
}

const TAXONOMIES: TaxonomySeed[] = [
  // ============================================
  // GENERAL
  // ============================================
  // Dados físicos básicos (podem aparecer no perfil de relacionamento)
  {
    name: 'Altura',
    slug: 'altura',
    category: 'general',
    factType: 'condition',
    description: 'Altura em centímetros (ex: 175)',
  },
  {
    name: 'Peso',
    slug: 'peso',
    category: 'general',
    factType: 'condition',
    description: 'Peso em quilogramas (ex: 70)',
  },
  {
    name: 'Tipo Sanguíneo',
    slug: 'tipo-sanguineo',
    category: 'general',
    factType: 'condition',
    description: 'Tipo sanguíneo (ex: A+, O-, AB+)',
  },
  {
    name: 'Compartilhar no Perfil de Relacionamento',
    slug: 'compartilhar-perfil-relacionamento',
    category: 'general',
    factType: 'service_need',
    description: 'Consentimento para compartilhar altura/peso no perfil de relacionamento',
  },
  // Condições gerais comuns na sociedade
  {
    name: 'Hipertensão',
    slug: 'hipertensao',
    category: 'general',
    factType: 'condition',
    description: 'Hipertensão arterial',
  },
  {
    name: 'Diabetes Tipo 1',
    slug: 'diabetes-tipo-1',
    category: 'general',
    factType: 'condition',
    description: 'Diabetes tipo 1',
  },
  {
    name: 'Diabetes Tipo 2',
    slug: 'diabetes-tipo-2',
    category: 'general',
    factType: 'condition',
    description: 'Diabetes tipo 2',
  },
  {
    name: 'Asma',
    slug: 'asma',
    category: 'general',
    factType: 'condition',
    description: 'Asma',
  },
  {
    name: 'Alergias',
    slug: 'alergias',
    category: 'general',
    factType: 'allergy',
    description: 'Alergias (alimentares, medicamentosas, etc.)',
  },
  {
    name: 'Acompanhamento Médico',
    slug: 'acompanhamento-medico',
    category: 'general',
    factType: 'service_need',
    description: 'Especialistas que acompanham o usuário',
  },
  {
    name: 'Último Check-up',
    slug: 'ultimo-checkup',
    category: 'general',
    factType: 'service_need',
    description: 'Data do último check-up médico',
  },

  // ============================================
  // VISION
  // ============================================
  {
    name: 'Uso de Óculos',
    slug: 'uso-oculos',
    category: 'vision',
    factType: 'device',
    description: 'Usuário utiliza óculos para correção visual',
  },
  {
    name: 'Uso de Lentes de Contato',
    slug: 'uso-lentes-contato',
    category: 'vision',
    factType: 'device',
    description: 'Usuário utiliza lentes de contato',
  },
  // Condições visuais específicas (comuns na sociedade)
  {
    name: 'Miopia',
    slug: 'miopia',
    category: 'vision',
    factType: 'condition',
    description: 'Miopia (dificuldade para enxergar de longe)',
  },
  {
    name: 'Astigmatismo',
    slug: 'astigmatismo',
    category: 'vision',
    factType: 'condition',
    description: 'Astigmatismo (visão distorcida)',
  },
  {
    name: 'Hipermetropia',
    slug: 'hipermetropia',
    category: 'vision',
    factType: 'condition',
    description: 'Hipermetropia (dificuldade para enxergar de perto)',
  },
  {
    name: 'Presbiopia',
    slug: 'presbiopia',
    category: 'vision',
    factType: 'condition',
    description: 'Presbiopia (vista cansada, comum após 40 anos)',
  },
  {
    name: 'Daltonismo',
    slug: 'daltonismo',
    category: 'vision',
    factType: 'condition',
    description: 'Daltonismo (dificuldade em distinguir cores)',
  },
  {
    name: 'Grau do Óculos (Miopia)',
    slug: 'grau-oculos-miopia',
    category: 'vision',
    factType: 'condition',
    description: 'Grau de miopia (ex: -2.5)',
  },
  {
    name: 'Grau do Óculos (Astigmatismo)',
    slug: 'grau-oculos-astigmatismo',
    category: 'vision',
    factType: 'condition',
    description: 'Grau de astigmatismo',
  },
  {
    name: 'Último Exame de Visão',
    slug: 'ultimo-exame-visao',
    category: 'vision',
    factType: 'service_need',
    description: 'Data do último exame oftalmológico',
  },

  // ============================================
  // DENTAL
  // ============================================
  {
    name: 'Uso de Aparelho Ortodôntico',
    slug: 'uso-aparelho-ortodontico',
    category: 'dental',
    factType: 'device',
    description: 'Usuário utiliza aparelho ortodôntico',
  },
  {
    name: 'Última Consulta Odontológica',
    slug: 'ultima-consulta-odontologica',
    category: 'dental',
    factType: 'service_need',
    description: 'Data da última consulta odontológica',
  },
  // Condições bucais específicas (comuns na sociedade)
  {
    name: 'Facetas',
    slug: 'facetas',
    category: 'dental',
    factType: 'condition',
    description: 'Possui facetas dentárias',
  },
  {
    name: 'Implantes Dentários',
    slug: 'implantes-dentarios',
    category: 'dental',
    factType: 'condition',
    description: 'Possui implantes dentários',
  },
  {
    name: 'Próteses Dentárias',
    slug: 'proteses-dentarias',
    category: 'dental',
    factType: 'condition',
    description: 'Utiliza próteses dentárias',
  },
  {
    name: 'Gengivite',
    slug: 'gengivite',
    category: 'dental',
    factType: 'condition',
    description: 'Gengivite (inflamação da gengiva)',
  },
  {
    name: 'Sensibilidade Dentária',
    slug: 'sensibilidade-dentaria',
    category: 'dental',
    factType: 'condition',
    description: 'Sensibilidade dentária',
  },
  {
    name: 'Bruxismo',
    slug: 'bruxismo',
    category: 'dental',
    factType: 'condition',
    description: 'Bruxismo (ranger de dentes)',
  },
  {
    name: 'Necessidades Urgentes Odontologia',
    slug: 'necessidades-urgentes-odontologia',
    category: 'dental',
    factType: 'service_need',
    description: 'Necessidades urgentes de tratamento odontológico',
  },

  // ============================================
  // MEDICATIONS
  // ============================================
  {
    name: 'Toma Medicamentos Contínuos',
    slug: 'toma-medicamentos-continuos',
    category: 'medications',
    factType: 'medication',
    description: 'Usuário toma medicamentos de uso contínuo',
  },
  {
    name: 'Nome do Medicamento',
    slug: 'nome-medicamento',
    category: 'medications',
    factType: 'medication',
    description: 'Nome do medicamento (ex: Metformina, Losartana)',
  },
  {
    name: 'Dosagem do Medicamento',
    slug: 'dosagem-medicamento',
    category: 'medications',
    factType: 'medication',
    description: 'Dosagem do medicamento (ex: 500mg, 50mg)',
  },
  {
    name: 'Frequência do Medicamento',
    slug: 'frequencia-medicamento',
    category: 'medications',
    factType: 'medication',
    description: 'Frequência de uso (ex: 1x ao dia, 2x ao dia)',
  },
  {
    name: 'Prescrito Por',
    slug: 'prescrito-por',
    category: 'medications',
    factType: 'service_need',
    description: 'Profissional que prescreveu o medicamento',
  },

  // ============================================
  // MOBILITY
  // ============================================
  {
    name: 'Usa Cadeira de Rodas',
    slug: 'usa-cadeira-rodas',
    category: 'mobility',
    factType: 'device',
    description: 'Usuário utiliza cadeira de rodas',
  },
  {
    name: 'Usa Muletas',
    slug: 'usa-muletas',
    category: 'mobility',
    factType: 'device',
    description: 'Usuário utiliza muletas',
  },
  {
    name: 'Usa Bengala',
    slug: 'usa-bengala',
    category: 'mobility',
    factType: 'device',
    description: 'Usuário utiliza bengala',
  },
  {
    name: 'Usa Andador',
    slug: 'usa-andador',
    category: 'mobility',
    factType: 'device',
    description: 'Usuário utiliza andador',
  },
  {
    name: 'Necessita Rampa',
    slug: 'necessita-rampa',
    category: 'mobility',
    factType: 'service_need',
    description: 'Necessita de rampa para acessibilidade',
  },
  {
    name: 'Necessita Elevador',
    slug: 'necessita-elevador',
    category: 'mobility',
    factType: 'service_need',
    description: 'Necessita de elevador para acessibilidade',
  },
  {
    name: 'Necessita Banheiro Adaptado',
    slug: 'necessita-banheiro-adaptado',
    category: 'mobility',
    factType: 'service_need',
    description: 'Necessita de banheiro adaptado',
  },
  {
    name: 'Limitação de Movimento',
    slug: 'limitacao-movimento',
    category: 'mobility',
    factType: 'condition',
    description: 'Possui limitação de movimento',
  },

  // ============================================
  // MENTAL
  // ============================================
  {
    name: 'Em Acompanhamento Psicológico',
    slug: 'acompanhamento-psicologico',
    category: 'mental',
    factType: 'service_need',
    description: 'Usuário está em acompanhamento psicológico/terapêutico',
  },
  // Condições de saúde mental comuns
  {
    name: 'Ansiedade',
    slug: 'ansiedade',
    category: 'mental',
    factType: 'condition',
    description: 'Ansiedade',
  },
  {
    name: 'Depressão',
    slug: 'depressao',
    category: 'mental',
    factType: 'condition',
    description: 'Depressão',
  },
  {
    name: 'TDAH',
    slug: 'tdah',
    category: 'mental',
    factType: 'condition',
    description: 'Transtorno de Déficit de Atenção e Hiperatividade (TDAH)',
  },
  {
    name: 'Transtorno Bipolar',
    slug: 'transtorno-bipolar',
    category: 'mental',
    factType: 'condition',
    description: 'Transtorno Bipolar',
  },
  {
    name: 'TOC',
    slug: 'toc',
    category: 'mental',
    factType: 'condition',
    description: 'Transtorno Obsessivo-Compulsivo (TOC)',
  },
  {
    name: 'Medicamentos Psiquiátricos',
    slug: 'medicamentos-psiquiatricos',
    category: 'mental',
    factType: 'medication',
    description: 'Medicamentos psiquiátricos em uso',
  },
];

async function seedHealthTaxonomies() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Buscar tenant_id padrão (assumindo que existe um tenant padrão)
    // Se não existir, criar ou usar o primeiro disponível
    const tenantResult = await client.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM tenants ORDER BY created_at ASC LIMIT 1`
    );

    if (tenantResult.rows.length === 0) {
      throw new Error('Nenhum tenant encontrado. Crie um tenant antes de executar o seed.');
    }

    const tenantId = tenantResult.rows[0].tenant_id;
    console.log(`📦 Seedando taxonomias de saúde para tenant: ${tenantId}`);

    let created = 0;
    let skipped = 0;

    for (const taxonomy of TAXONOMIES) {
      // Verificar se já existe
      const existing = await client.query<{ taxonomy_id: string }>(
        `SELECT taxonomy_id FROM health_taxonomies WHERE tenant_id = $1 AND slug = $2`,
        [tenantId, taxonomy.slug]
      );

      if (existing.rows.length > 0) {
        console.log(`⏭️  Taxonomia já existe: ${taxonomy.slug}`);
        skipped++;
        continue;
      }

      // Inserir taxonomia
      await client.query(
        `
        INSERT INTO health_taxonomies 
          (tenant_id, name, slug, category, fact_type, description, parent_id, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        `,
        [
          tenantId,
          taxonomy.name,
          taxonomy.slug,
          taxonomy.category,
          taxonomy.factType,
          taxonomy.description,
          taxonomy.parentId || null,
        ]
      );

      console.log(`✅ Criada: ${taxonomy.name} (${taxonomy.slug})`);
      created++;
    }

    await client.query('COMMIT');

    console.log(`\n✨ Seed concluído!`);
    console.log(`   ✅ Criadas: ${created}`);
    console.log(`   ⏭️  Ignoradas: ${skipped}`);
    console.log(`   📊 Total: ${TAXONOMIES.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao executar seed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Executar seed
seedHealthTaxonomies()
  .then(() => {
    console.log('🎉 Seed executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });

