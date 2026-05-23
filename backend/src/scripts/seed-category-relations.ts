/**
 * Seed controlado: materializa relações canónicas em category_relations (grafo SSOT no runtime).
 *
 * A inferência lê o grafo via graph.adapter; este arquivo é a fonte de verdade para popular o DB.
 *
 * - physical (slug) → learning: enables
 * - learning[i] → professional[i]: evolves_to (pareamento por índice até min(len))
 *
 * Uso: pnpm seed:category-relations
 * Requer: DATABASE_URL e categorias globais já seedadas.
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { CategoryRepository } from '../core/categories/categories.repository';
import type { CategoryAffinity } from '../core/profile/profile-inference.types';

dotenv.config({ path: join(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Este seed não deve ser executado com NODE_ENV=production');
  process.exit(1);
}

/** Lista canónica usada só para seed do grafo (não duplicar em ProfileInferenceService). */
const CATEGORY_AFFINITIES_SEED: CategoryAffinity[] = [
  {
    physicalCategory: 'criar-expressar',
    learningCategories: [
      'fotografia-aprendizado',
      'desenho-ilustracao',
      'escrita-criativa',
      'video-aprendizado',
      'design-aprendizado',
    ],
    professionalCategories: ['fotografo', 'designer', 'escritor', 'editor-video'],
  },
  {
    physicalCategory: 'fotografia',
    learningCategories: ['fotografia-aprendizado'],
    professionalCategories: ['fotografo'],
  },
  {
    physicalCategory: 'desenho',
    learningCategories: ['desenho-ilustracao'],
    professionalCategories: ['designer', 'ilustrador'],
  },
  {
    physicalCategory: 'video',
    learningCategories: ['video-aprendizado', 'edicao-video-aprendizado'],
    professionalCategories: ['editor-video', 'produtor-audiovisual'],
  },
  {
    physicalCategory: 'escrita',
    learningCategories: ['escrita-criativa', 'escrita-profissional'],
    professionalCategories: ['escritor', 'redator'],
  },
  {
    physicalCategory: 'musica',
    learningCategories: ['musica-aprendizado', 'teoria-musical'],
    professionalCategories: ['musico', 'produtor-musical'],
  },
  {
    physicalCategory: 'tecnologia',
    learningCategories: ['programacao', 'desenvolvimento-web-aprendizado', 'inteligencia-artificial'],
    professionalCategories: ['desenvolvedor-backend', 'desenvolvedor-frontend', 'desenvolvedor-fullstack'],
  },
  {
    physicalCategory: 'jogos',
    learningCategories: ['games-aprendizado', 'desenvolvimento-jogos'],
    professionalCategories: ['desenvolvedor-jogos', 'game-designer'],
  },
  {
    physicalCategory: 'cozinhar-comer-bem',
    learningCategories: ['culinaria-aprendizado', 'confeitaria-aprendizado'],
    professionalCategories: ['chef', 'confeiteiro', 'cozinheiro'],
  },
  {
    physicalCategory: 'se-movimentar',
    learningCategories: ['atividade-fisica-aprendizado', 'treinamento-fisico'],
    professionalCategories: ['personal-trainer', 'educador-fisico'],
  },
  {
    physicalCategory: 'cuidar-de-si',
    learningCategories: ['saude-mental-aprendizado', 'nutricao-aprendizado'],
    professionalCategories: ['nutricionista', 'psicologo'],
  },
];

const STATUS_WHERE = `(status IN ('active', 'auto_active') OR status IS NULL)`;

const categoryRepository = new CategoryRepository();

/**
 * Resolve slug via CategoryRepository.findBySlug e confirma linha ativa em categories.
 */
async function resolveCategoryId(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  slug: string
): Promise<string | null> {
  const row = await categoryRepository.findBySlug(slug, undefined, client);
  if (!row) return null;
  const ok = await client.query(
    `
    SELECT category_id
    FROM categories
    WHERE category_id = $1::uuid
      AND ${STATUS_WHERE}
    LIMIT 1
    `,
    [row.category_id]
  );
  return ok.rows[0] ? row.category_id : null;
}

async function insertRelation(
  client: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  fromId: string,
  toId: string,
  relationType: 'enables' | 'evolves_to'
): Promise<'inserted' | 'duplicate' | 'skip'> {
  if (fromId === toId) return 'skip';
  const res = (await client.query(
    `
    INSERT INTO category_relations (
      from_category_id, to_category_id, relation_type, weight, metadata
    )
    VALUES ($1::uuid, $2::uuid, $3, 1, '{}'::jsonb)
    ON CONFLICT (from_category_id, to_category_id, relation_type) DO NOTHING
    RETURNING relation_id
    `,
    [fromId, toId, relationType],
  )) as { rowCount: number };
  if (res.rowCount === 1) return 'inserted';
  if (res.rowCount === 0) return 'duplicate';
  return 'skip';
}

async function main(): Promise<void> {
  console.log('🌱 seed-category-relations (grafo global)\n');

  let inserted = 0;
  let duplicate = 0;
  let missingSlug = 0;

  const client = await pool.connect();
  try {
    for (const aff of CATEGORY_AFFINITIES_SEED) {
      const physicalId = await resolveCategoryId(client, aff.physicalCategory);
      if (!physicalId) {
        missingSlug += 1;
        console.warn(`⚠️  physical slug não encontrado: ${aff.physicalCategory}`);
        continue;
      }

      const learningIds: (string | null)[] = [];
      for (const slug of aff.learningCategories) {
        const id = await resolveCategoryId(client, slug);
        if (!id) {
          missingSlug += 1;
          console.warn(`⚠️  learning slug não encontrado: ${slug}`);
        }
        learningIds.push(id);
      }

      const professionalIds: (string | null)[] = [];
      for (const slug of aff.professionalCategories) {
        const id = await resolveCategoryId(client, slug);
        if (!id) {
          missingSlug += 1;
          console.warn(`⚠️  professional slug não encontrado: ${slug}`);
        }
        professionalIds.push(id);
      }

      for (let i = 0; i < aff.learningCategories.length; i++) {
        const lId = learningIds[i];
        if (!lId) continue;
        const r = await insertRelation(client, physicalId, lId, 'enables');
        if (r === 'inserted') inserted += 1;
        else if (r === 'duplicate') duplicate += 1;
      }

      const n = Math.min(aff.learningCategories.length, aff.professionalCategories.length);
      for (let i = 0; i < n; i++) {
        const lId = learningIds[i];
        const pId = professionalIds[i];
        if (!lId || !pId) continue;
        const r = await insertRelation(client, lId, pId, 'evolves_to');
        if (r === 'inserted') inserted += 1;
        else if (r === 'duplicate') duplicate += 1;
      }
    }
  } finally {
    client.release();
  }

  console.log('\n📊 Resumo');
  console.log(`   relações inseridas: ${inserted}`);
  console.log(`   duplicadas (já existentes): ${duplicate}`);
  console.log(`   slugs não encontrados (avisos acima): ${missingSlug}`);
  console.log('\n✅ Concluído.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});