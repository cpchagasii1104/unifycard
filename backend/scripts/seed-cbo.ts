// backend/scripts/seed-cbo.ts
// Script para popular occupations_reference com dados do CBO
// FASE 3.8: Category Input Gate - Seed do CBO

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

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
    'técnico': ['técnica'],
    'tecnico': ['tecnica'],
    'técnica': ['técnico'],
    'tecnica': ['tecnico'],
    'analista': ['analista'], // Neutro
    'gerente': ['gerente'], // Neutro
    'vendedor': ['vendedora'],
    'vendedora': ['vendedor'],
    'atendente': ['atendente'], // Neutro
    'cozinheiro': ['cozinheira'],
    'cozinheira': ['cozinheiro'],
    'barbeiro': ['barbeira'],
    'barbeira': ['barbeiro'],
    'cabeleireiro': ['cabeleireira'],
    'cabeleireira': ['cabeleireiro'],
    'advogado': ['advogada'],
    'advogada': ['advogado'],
    'contador': ['contadora'],
    'contadora': ['contador'],
    'jornalista': ['jornalista'], // Neutro
    'fotógrafo': ['fotógrafa'],
    'fotografo': ['fotografa'],
    'fotógrafa': ['fotógrafo'],
    'fotografa': ['fotografo'],
  };
  
  if (genderMappings[normalized]) {
    variations.push(...genderMappings[normalized]);
  }
  
  return [...new Set(variations)];
}

async function seedCBO() {
  console.log('🌱 Iniciando seed do CBO...\n');
  
  try {
    // Verificar se arquivo existe
    const jsonPath = path.join(__dirname, '../docs/seed/cbo-occupations.json');
    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ Arquivo não encontrado: ${jsonPath}`);
      console.error('   Execute primeiro: npm run cbo:fetch');
      process.exit(1);
    }

    const fileContent = fs.readFileSync(jsonPath, 'utf8');
    const occupations: CBOOccupation[] = JSON.parse(fileContent);

    if (!Array.isArray(occupations) || occupations.length === 0) {
      console.error('❌ Arquivo CBO vazio ou inválido');
      process.exit(1);
    }

    console.log(`📊 Processando ${occupations.length} ocupações...\n`);

    await pool.query('BEGIN');

    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const occ of occupations) {
      if (!occ.code || !occ.title) {
        console.warn(`⚠️  Ocupação inválida (sem code ou title): ${JSON.stringify(occ)}`);
        errors++;
        continue;
      }

      // Gerar variações de gênero
      const allSynonyms = [
        ...(occ.synonyms || []),
        ...generateGenderVariations(occ.title),
      ];
      const uniqueSynonyms = [...new Set(allSynonyms)];

      const normalizedTitle = normalizeTitle(occ.title);
      const slug = generateSlug(occ.title);

      try {
        const result = await pool.query(
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
             updated_at = NOW()
           RETURNING (xmax = 0) AS is_new`,
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

        if (result.rows[0]?.is_new) {
          imported++;
          console.log(`✅ ${occ.title} (${occ.code})`);
        } else {
          updated++;
          console.log(`🔄 ${occ.title} (${occ.code}) - atualizado`);
        }
      } catch (error: any) {
        console.error(`❌ Erro ao importar ${occ.title}:`, error.message);
        errors++;
      }
    }

    await pool.query('COMMIT');

    console.log(`\n✅ Seed concluído!`);
    console.log(`   Importados: ${imported}`);
    console.log(`   Atualizados: ${updated}`);
    console.log(`   Erros: ${errors}\n`);

    // Verificar total no banco
    const countResult = await pool.query('SELECT COUNT(*) as total FROM occupations_reference');
    console.log(`📊 Total de ocupações no banco: ${countResult.rows[0].total}\n`);

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Erro durante seed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar seed
seedCBO()
  .then(() => {
    console.log('✅ Script concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });















