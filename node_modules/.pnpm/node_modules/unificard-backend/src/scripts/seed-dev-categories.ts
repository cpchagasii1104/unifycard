// src/scripts/seed-dev-categories.ts
//
// SEED DEV — CATEGORIAS BÁSICAS
//
// ⚠️ IMPORTANTE (LEIA ANTES DE EDITAR)
//
// - ESTE SCRIPT É EXCLUSIVO PARA DESENVOLVIMENTO LOCAL (DEV)
// - NÃO EXECUTAR EM PRODUÇÃO
//
// PRINCÍPIOS CANÔNICOS:
// - NÃO definir `level`
// - NÃO definir `path`
// - NÃO calcular hierarquia
// - O seed declara APENAS `parent_id`
//
// O cálculo de:
// - level
// - path
// - integridade estrutural
// é responsabilidade EXCLUSIVA do trigger + core (SSOT)
//
// ------------------------------------------------------------
//
// IDs DE RAIZ (APENAS DEV)
//
// As categorias raiz abaixo possuem IDs ESTÁVEIS apenas para:
// - previsibilidade de seed
// - testes locais
// - inspeção manual em banco DEV
//
// ❌ ESTES IDs NÃO SÃO:
// - API pública
// - contrato de domínio
// - enum persistido
// - base para lógica de negócio
//
// Se algum código começar a depender semanticamente desses IDs,
// ISSO É BUG.
//
// ------------------------------------------------------------
//
// Se você precisa de categorias em:
// - PROD
// - STAGING
// - MIGRAÇÕES
//
// NÃO use este script.
// Crie uma migração canônica ou seed institucional separado.
//
// ------------------------------------------------------------

import dotenv from 'dotenv';
import { join } from 'path';
import { pool, runQueryWithTenant } from '../core/database/pool';
import { v4 as uuidv4 } from 'uuid';
import 'tsconfig-paths/register';

// ─────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────

dotenv.config({ path: join(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada no .env');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('❌ ESTE SEED NÃO PODE SER EXECUTADO EM PRODUÇÃO');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DEV
// ─────────────────────────────────────────────────────────────

const DEV_TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';

// IDs ESTÁVEIS APENAS PARA RAÍZES (INFRA DEV)
// ⚠️ NÃO UTILIZAR ESSES IDs EM LÓGICA DE DOMÍNIO
const ROOT_PROFISSIONAL_ID = '11111111-1111-1111-1111-111111111111';
const ROOT_PESSOAL_ID      = '22222222-2222-2222-2222-222222222222';
const ROOT_FISICO_ID       = '33333333-3333-3333-3333-333333333333';
const ROOT_APRENDIZADO_ID  = '44444444-4444-4444-4444-444444444444';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Cria categoria se não existir (idempotente).
 *
 * ⚠️ NÃO define `level`
 * ⚠️ NÃO define `path`
 * ⚠️ NÃO calcula hierarquia
 *
 * Apenas declara relação mínima (`parent_id`).
 * Trigger + core derivam o restante (SSOT).
 */
async function createCategoryIfNotExists(
  tenantId: string,
  categoryId: string,
  parentId: string | null,
  name: string,
  slug: string,
  description: string | null
): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `
      INSERT INTO categories (
        category_id,
        parent_id,
        name,
        slug,
        description,
        keywords,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, ARRAY[]::text[], now(), now())
      ON CONFLICT (category_id) DO NOTHING
    `,
    [categoryId, parentId, name, slug, description]
  );
}

// ─────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────

async function seedCategories(): Promise<void> {
  console.log('📦 Seed DEV: Categorias básicas\n');

  // PROFISSIONAL (RAIZ)
  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    ROOT_PROFISSIONAL_ID,
    null,
    'Profissional',
    'profissional',
    'Categorias relacionadas à vida profissional'
  );

  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    uuidv4(),
    ROOT_PROFISSIONAL_ID,
    'Advocacia',
    'advocacia',
    'Direito e advocacia'
  );

  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    uuidv4(),
    ROOT_PROFISSIONAL_ID,
    'Tecnologia da Informação',
    'tecnologia-informacao',
    'TI e desenvolvimento'
  );

  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    uuidv4(),
    ROOT_PROFISSIONAL_ID,
    'Medicina',
    'medicina',
    'Área médica'
  );

  // PESSOAL (RAIZ)
  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    ROOT_PESSOAL_ID,
    null,
    'Pessoal',
    'pessoal',
    'Categorias relacionadas à vida pessoal'
  );

  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    uuidv4(),
    ROOT_PESSOAL_ID,
    'Família',
    'familia',
    'Vida familiar'
  );

  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    uuidv4(),
    ROOT_PESSOAL_ID,
    'Hobbies',
    'hobbies',
    'Passatempos e hobbies'
  );

  // FÍSICO (RAIZ)
  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    ROOT_FISICO_ID,
    null,
    'Físico',
    'fisico',
    'Categorias relacionadas ao bem-estar físico'
  );

  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    uuidv4(),
    ROOT_FISICO_ID,
    'Esportes',
    'esportes',
    'Atividades esportivas'
  );

  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    uuidv4(),
    ROOT_FISICO_ID,
    'Saúde',
    'saude',
    'Saúde e bem-estar'
  );

  // APRENDIZADO (RAIZ)
  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    ROOT_APRENDIZADO_ID,
    null,
    'Aprendizado',
    'aprendizado',
    'Categorias relacionadas ao aprendizado e educação'
  );

  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    uuidv4(),
    ROOT_APRENDIZADO_ID,
    'Educação Formal',
    'educacao-formal',
    'Cursos e educação formal'
  );

  await createCategoryIfNotExists(
    DEV_TENANT_ID,
    uuidv4(),
    ROOT_APRENDIZADO_ID,
    'Habilidades',
    'habilidades',
    'Desenvolvimento de habilidades'
  );

  console.log('✨ Seed DEV concluído com sucesso');
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

async function main() {
  try {
    await seedCategories();
  } catch (err) {
    console.error('💥 Erro fatal no seed DEV:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
