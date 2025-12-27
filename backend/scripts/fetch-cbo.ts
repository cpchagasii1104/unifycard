// backend/scripts/fetch-cbo.ts
// Script para importar CBO oficial do governo brasileiro
// FASE 3.8: Category Input Gate - ETAPA 3.1

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface CBOOccupation {
  code: string;
  title: string;
  synonyms?: string[];
  family?: string;
  major_group?: string;
  description?: string;
}

/**
 * Gera slug a partir do nome
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normaliza título para busca
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Gera variações de gênero (ex: enfermeiro ↔ enfermeira)
 */
function generateGenderVariations(title: string): string[] {
  const variations: string[] = [title];
  const normalized = normalizeTitle(title);
  
  // Mapeamentos comuns de gênero
  const genderMappings: Record<string, string[]> = {
    'enfermeiro': ['enfermeira'],
    'enfermeira': ['enfermeiro'],
    'psicólogo': ['psicóloga'],
    'psicóloga': ['psicólogo'],
    'psicologo': ['psicologa'],
    'psicologa': ['psicologo'],
    'dentista': ['dentista'], // Neutro
    'médico': ['médica'],
    'medico': ['medica'],
    'médica': ['médico'],
    'medica': ['medico'],
    'professor': ['professora'],
    'professora': ['professor'],
    'diretor': ['diretora'],
    'diretora': ['diretor'],
    'coordenador': ['coordenadora'],
    'coordenadora': ['coordenador'],
  };
  
  if (genderMappings[normalized]) {
    variations.push(...genderMappings[normalized]);
  }
  
  return [...new Set(variations)];
}

/**
 * Importa ocupações do CBO
 * NOTA: Este é um exemplo. Em produção, você precisaria:
 * 1. Baixar o arquivo oficial do CBO do site do governo
 * 2. Converter para JSON estruturado
 * 3. Processar e importar
 */
async function importCBO() {
  console.log('📥 Iniciando importação do CBO...\n');
  
  try {
    // Exemplo de estrutura CBO (você precisaria baixar o arquivo real)
    // Por enquanto, vamos criar um dataset mínimo para demonstração
    const sampleOccupations: CBOOccupation[] = [
      {
        code: '2251-05',
        title: 'Médico',
        synonyms: ['Médica', 'Doutor', 'Doutora'],
        family: 'Saúde',
        major_group: 'Profissionais das ciências e das artes',
      },
      {
        code: '2251-10',
        title: 'Dentista',
        synonyms: ['Odontólogo', 'Odontóloga'],
        family: 'Saúde',
        major_group: 'Profissionais das ciências e das artes',
      },
      {
        code: '2235-05',
        title: 'Enfermeiro',
        synonyms: ['Enfermeira'],
        family: 'Saúde',
        major_group: 'Técnicos de nível médio',
      },
      {
        code: '2515-05',
        title: 'Psicólogo',
        synonyms: ['Psicóloga'],
        family: 'Saúde',
        major_group: 'Profissionais das ciências e das artes',
      },
      {
        code: '2341-05',
        title: 'Professor de Educação Infantil',
        synonyms: ['Professora de Educação Infantil'],
        family: 'Educação',
        major_group: 'Profissionais das ciências e das artes',
      },
      {
        code: '3171-10',
        title: 'Programador',
        synonyms: ['Desenvolvedor', 'Desenvolvedora'],
        family: 'Tecnologia',
        major_group: 'Técnicos de nível médio',
      },
      {
        code: '7170-10',
        title: 'Pedreiro',
        synonyms: ['Pedreira'],
        family: 'Construção',
        major_group: 'Trabalhadores da produção de bens e serviços',
      },
      {
        code: '7241-05',
        title: 'Eletricista',
        synonyms: ['Eletricista'],
        family: 'Construção',
        major_group: 'Trabalhadores da produção de bens e serviços',
      },
    ];

    console.log(`📊 Processando ${sampleOccupations.length} ocupações...\n`);

    await pool.query('BEGIN');

    let imported = 0;
    for (const occ of sampleOccupations) {
      // Gerar variações de gênero
      const allSynonyms = [
        ...(occ.synonyms || []),
        ...generateGenderVariations(occ.title),
      ];
      const uniqueSynonyms = [...new Set(allSynonyms)];

      const normalizedTitle = normalizeTitle(occ.title);
      const slug = generateSlug(occ.title);

      try {
        await pool.query(
          `INSERT INTO occupations_reference 
           (cbo_code, title, normalized_title, slug, synonyms, family, major_group, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (cbo_code) DO UPDATE SET
             title = EXCLUDED.title,
             normalized_title = EXCLUDED.normalized_title,
             slug = EXCLUDED.slug,
             synonyms = EXCLUDED.synonyms,
             family = EXCLUDED.family,
             major_group = EXCLUDED.major_group,
             description = EXCLUDED.description,
             updated_at = NOW()`,
          [
            occ.code,
            occ.title,
            normalizedTitle,
            slug,
            uniqueSynonyms,
            occ.family || null,
            occ.major_group || null,
            occ.description || null,
          ]
        );
        imported++;
        console.log(`✅ ${occ.title} (${occ.code})`);
      } catch (error: any) {
        console.error(`❌ Erro ao importar ${occ.title}:`, error.message);
      }
    }

    await pool.query('COMMIT');

    console.log(`\n✅ Importação concluída! ${imported} ocupações importadas.`);
    
    // Salvar JSON para referência
    const jsonPath = path.join(__dirname, '../docs/seed/cbo-occupations.json');
    const jsonDir = path.dirname(jsonPath);
    if (!fs.existsSync(jsonDir)) {
      fs.mkdirSync(jsonDir, { recursive: true });
    }
    fs.writeFileSync(jsonPath, JSON.stringify(sampleOccupations, null, 2), 'utf8');
    console.log(`💾 JSON salvo em: ${jsonPath}\n`);

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Erro durante importação:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar importação
importCBO()
  .then(() => {
    console.log('✅ Script concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });















