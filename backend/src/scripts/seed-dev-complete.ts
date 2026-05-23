// src/scripts/seed-dev-complete.ts
//
// Script de seed DEV COMPLETO - cria tudo necessário para desenvolvimento
// APENAS para ambiente de desenvolvimento local
// NÃO executar em produção
//
// Este script executa em ordem:
// 1. Tenant DEV
// 2. RBAC (roles e permissões)
// 3. Usuário DEV
// 4. Identidade global e actor
// 5. Feature flags (PRO/GRATUITO e microfone)
// 6. Profile básico

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { identityService } from '../core/identity/identity.service';
import { actorRepository } from '../modules/social/actor.repository';
import { configService } from '../core/config/config.service';
import { profileService } from '../core/profile/profile.service';
import { runQueryWithTenant } from '../core/database/pool';
import 'tsconfig-paths/register';

// Carrega variáveis de ambiente
dotenv.config({ path: join(process.cwd(), '.env') });

// Valida se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
  process.exit(1);
}

// BLOQUEAR EM PRODUÇÃO
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERRO: Este script NÃO pode ser executado em produção');
  console.error('   NODE_ENV está definido como "production"');
  console.error('   Este seed é APENAS para ambiente de desenvolvimento local');
  process.exit(1);
}

// Configuração DEV
const DEV_EMAIL = 'dev@unificard.local';
const DEV_PASSWORD = '123456'; // Senha padrão
const DEV_TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_TENANT_NAME = 'UnifyCard DEV';
const DEV_TENANT_SLUG = 'unificard-dev';

type ExistingUserRow = {
  user_id: string;
};

type ExistingUser = {
  userId: string;
};

type RoleRow = {
  role_id: string;
};

type RoleRecord = {
  roleId: string;
};

function mapExistingUserRow(row: ExistingUserRow): ExistingUser {
  return {
    userId: row.user_id,
  };
}

function mapRoleRow(row: RoleRow): RoleRecord {
  return {
    roleId: row.role_id,
  };
}

/**
 * 1. Criar tenant DEV
 */
async function seedTenant(): Promise<void> {
  console.log('📦 [1/6] Verificando tenant DEV...');
  
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT id FROM tenants WHERE id = $1 LIMIT 1
      `,
      [DEV_TENANT_ID]
    );

    if (result.rows.length > 0) {
      console.log('✅ Tenant DEV já existe');
      return;
    }
  } finally {
    client.release();
  }

  await tenantService.createTenant({
    id: DEV_TENANT_ID,
    name: DEV_TENANT_NAME,
    slug: DEV_TENANT_SLUG,
  });

  console.log('✅ Tenant DEV criado');
}

/**
 * 2. Seed RBAC
 */
async function seedRBAC(): Promise<void> {
  console.log('📦 [2/6] Verificando RBAC...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${DEV_TENANT_ID}'`);

    const existing = await client.query(
      `SELECT role_id FROM roles WHERE tenant_id = $1 AND name = 'admin' LIMIT 1`,
      [DEV_TENANT_ID]
    );

    if (existing.rows.length > 0) {
      console.log('✅ RBAC já existe');
      await client.query('COMMIT');
      return;
    }

    // Verificar se função existe antes de chamar
    const functionExists = await client.query(
      `SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'seed_default_rbac') as exists`
    );
    
    if (functionExists.rows[0]?.exists) {
      await client.query(`SELECT seed_default_rbac($1)`, [DEV_TENANT_ID]);
    } else {
      console.log('⚠️  Função seed_default_rbac não encontrada - criando roles manualmente');
      // Criar role admin básica
      const adminRoleId = await client.query(
        `INSERT INTO roles (tenant_id, name, description) VALUES ($1, 'admin', 'Administrador') RETURNING role_id`,
        [DEV_TENANT_ID]
      );
      console.log('✅ Role admin criada manualmente');
    }
    
    await client.query('COMMIT');
    console.log('✅ RBAC criado');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 3. Criar usuário DEV
 */
async function seedUser(): Promise<string> {
  console.log('📦 [3/6] Verificando usuário DEV...');
  
  const bcrypt = await import('bcrypt');
  
  // Verificar se usuário já existe
  const existingRow = await runQueryWithTenant<ExistingUserRow>(
    DEV_TENANT_ID,
    `SELECT user_id FROM users WHERE email = $1 LIMIT 1`,
    [DEV_EMAIL.toLowerCase()]
  );
  const existing = existingRow ? mapExistingUserRow(existingRow) : null;

  if (existing) {
    // Atualizar senha e marcar como teste
    const passwordHash = await bcrypt.default.hash(DEV_PASSWORD, 10);
    await runQueryWithTenant(
      DEV_TENANT_ID,
      `UPDATE users SET password_hash = $1, is_test = true, plan = 'pro', updated_at = now() WHERE user_id = $2`,
      [passwordHash, existing.userId]
    );
    console.log('✅ Usuário DEV atualizado');
    return existing.userId;
  }

  // Criar novo usuário
  const { v4: uuidv4 } = await import('uuid');
  const userId = uuidv4();
  const passwordHash = await bcrypt.default.hash(DEV_PASSWORD, 10);
  
  await runQueryWithTenant(
    DEV_TENANT_ID,
    `
      INSERT INTO users (user_id, tenant_id, email, password_hash, is_test, plan, token_version, created_at)
      VALUES ($1, $2, $3, $4, true, 'pro', 0, now())
    `,
    [userId, DEV_TENANT_ID, DEV_EMAIL.toLowerCase(), passwordHash]
  );

  // Atribuir role admin
  const adminRoleRow = await runQueryWithTenant<RoleRow>(
    DEV_TENANT_ID,
    `SELECT role_id FROM roles WHERE name = 'admin' LIMIT 1`,
    []
  );
  const adminRole = adminRoleRow ? mapRoleRow(adminRoleRow) : null;
  
  if (adminRole) {
    await runQueryWithTenant(
      DEV_TENANT_ID,
      `
        INSERT INTO user_roles (tenant_id, user_id, role_id, assigned_by)
        VALUES ($1, $2, $3, $2)
        ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING
      `,
      [DEV_TENANT_ID, userId, adminRole.roleId]
    );
  }

  console.log('✅ Usuário DEV criado');
  return userId;
}

/**
 * 4. Criar identidade global e actor
 */
async function seedIdentityAndActor(userId: string): Promise<void> {
  console.log('📦 [4/6] Verificando identidade global e actor...');

  await identityService.ensureGlobalUserLinked(userId, DEV_TENANT_ID);
  const profile = await identityService.getIdentityProfile(userId, DEV_TENANT_ID);
  if (!profile) {
    throw new Error('getIdentityProfile falhou após ensureGlobalUserLinked');
  }
  console.log('✅ Identidade global criada/verificada');

  try {
    await actorRepository.findOrCreateUserActor(DEV_TENANT_ID, userId);
    console.log('✅ Actor criado/verificado');
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
    // CORE_ONLY: `actors` legado (0002) não tem user_id/actor_id social — não falhar o seed.
    if (code === '42703') {
      console.warn(
        '⚠️  Actor social não criado: schema atual de `actors` não expõe user_id (perfil CORE_ONLY). Identidade global já está vinculada.'
      );
    } else {
      throw err;
    }
  }
}

/**
 * 5. Criar categorias básicas
 */
async function seedCategories(): Promise<void> {
  console.log('📦 [5/7] Verificando categorias...');
  
  try {
    const { v4: uuidv4 } = await import('uuid');
    
    // Verificar se já existem categorias
    const existing = await runQueryWithTenant<{ count: string }>(
      DEV_TENANT_ID,
      `SELECT COUNT(*)::text as count FROM categories WHERE parent_id IS NULL`,
      []
    );
    
    if (existing && parseInt(existing.count) > 0) {
      console.log('✅ Categorias já existem');
      return;
    }
    
    // Criar raízes básicas
    const roots = [
      { name: 'Profissional', slug: 'profissional', description: 'Categorias relacionadas à vida profissional' },
      { name: 'Pessoal', slug: 'pessoal', description: 'Categorias relacionadas à vida pessoal' },
      { name: 'Físico', slug: 'fisico', description: 'Categorias relacionadas ao bem-estar físico' },
      { name: 'Aprendizado', slug: 'aprendizado', description: 'Categorias relacionadas ao aprendizado e educação' },
    ];
    
    const rootIds: string[] = [];
    
    for (const root of roots) {
      const rootId = uuidv4();
      rootIds.push(rootId);
      await runQueryWithTenant(
        DEV_TENANT_ID,
        `
          INSERT INTO categories (category_id, parent_id, name, slug, description, level, path, keywords, created_at, updated_at)
          VALUES ($1, NULL, $2, $3, $4, 0, ARRAY[$5::text]::text[], '[]'::jsonb, now(), now())
          ON CONFLICT (category_id) DO NOTHING
        `,
        [rootId, root.name, root.slug, root.description, root.name]
      );
    }
    
    // Criar alguns filhos
    // Profissional -> Advocacia, TI, Medicina
    if (rootIds[0]) {
      await runQueryWithTenant(
        DEV_TENANT_ID,
        `
          INSERT INTO categories (category_id, parent_id, name, slug, description, level, path, keywords, created_at, updated_at)
          VALUES 
            ($1, $2, 'Advocacia', 'advocacia', 'Direito e advocacia', 1, ARRAY['Profissional', 'Advocacia']::text[], '[]'::jsonb, now(), now()),
            ($3, $2, 'Tecnologia da Informação', 'tecnologia-informacao', 'TI e desenvolvimento', 1, ARRAY['Profissional', 'Tecnologia da Informação']::text[], '[]'::jsonb, now(), now()),
            ($4, $2, 'Medicina', 'medicina', 'Área médica', 1, ARRAY['Profissional', 'Medicina']::text[], '[]'::jsonb, now(), now())
          ON CONFLICT (category_id) DO NOTHING
        `,
        [uuidv4(), rootIds[0], uuidv4(), uuidv4()]
      );
    }
    
    // Pessoal -> Família, Hobbies
    if (rootIds[1]) {
      await runQueryWithTenant(
        DEV_TENANT_ID,
        `
          INSERT INTO categories (category_id, parent_id, name, slug, description, level, path, keywords, created_at, updated_at)
          VALUES 
            ($1, $2, 'Família', 'familia', 'Vida familiar', 1, ARRAY['Pessoal', 'Família']::text[], '[]'::jsonb, now(), now()),
            ($3, $2, 'Hobbies', 'hobbies', 'Passatempos e hobbies', 1, ARRAY['Pessoal', 'Hobbies']::text[], '[]'::jsonb, now(), now())
          ON CONFLICT (category_id) DO NOTHING
        `,
        [uuidv4(), rootIds[1], uuidv4()]
      );
    }
    
    // Físico -> Esportes, Saúde
    if (rootIds[2]) {
      await runQueryWithTenant(
        DEV_TENANT_ID,
        `
          INSERT INTO categories (category_id, parent_id, name, slug, description, level, path, keywords, created_at, updated_at)
          VALUES 
            ($1, $2, 'Esportes', 'esportes', 'Atividades esportivas', 1, ARRAY['Físico', 'Esportes']::text[], '[]'::jsonb, now(), now()),
            ($3, $2, 'Saúde', 'saude', 'Saúde e bem-estar', 1, ARRAY['Físico', 'Saúde']::text[], '[]'::jsonb, now(), now())
          ON CONFLICT (category_id) DO NOTHING
        `,
        [uuidv4(), rootIds[2], uuidv4()]
      );
    }
    
    // Aprendizado -> Educação Formal, Habilidades
    if (rootIds[3]) {
      await runQueryWithTenant(
        DEV_TENANT_ID,
        `
          INSERT INTO categories (category_id, parent_id, name, slug, description, level, path, keywords, created_at, updated_at)
          VALUES 
            ($1, $2, 'Educação Formal', 'educacao-formal', 'Cursos e educação formal', 1, ARRAY['Aprendizado', 'Educação Formal']::text[], '[]'::jsonb, now(), now()),
            ($3, $2, 'Habilidades', 'habilidades', 'Desenvolvimento de habilidades', 1, ARRAY['Aprendizado', 'Habilidades']::text[], '[]'::jsonb, now(), now())
          ON CONFLICT (category_id) DO NOTHING
        `,
        [uuidv4(), rootIds[3], uuidv4()]
      );
    }
    
    console.log('✅ Categorias básicas criadas');
  } catch (error) {
    console.error('⚠️  Erro ao criar categorias (continuando):', error);
  }
}

/**
 * 6. Criar feature flags
 */
async function seedFeatureFlags(): Promise<void> {
  console.log('📦 [6/7] Verificando feature flags...');
  
  try {
    // Feature flag para PRO (habilitado por padrão em DEV)
    await configService.upsertFeatureFlag(DEV_TENANT_ID, 'plan_pro_enabled', {
      description: 'Habilita plano PRO para usuários de teste',
        isEnabled: true,
      rolloutPercentage: 100,
    });

    // Feature flag para microfone (habilitado por padrão em DEV)
    await configService.upsertFeatureFlag(DEV_TENANT_ID, 'microphone_enabled', {
      description: 'Habilita reconhecimento de voz/microfone',
        isEnabled: true,
      rolloutPercentage: 100,
    });

    console.log('✅ Feature flags criadas');
  } catch (error) {
    console.error('⚠️  Erro ao criar feature flags (continuando):', error);
  }
}

/**
 * 7. Criar profile básico
 */
async function seedProfile(userId: string): Promise<void> {
  console.log('📦 [7/7] Verificando profile...');
  
  try {
    const profile = await profileService.getProfile(DEV_TENANT_ID, userId);
    
    if (!profile) {
      await profileService.createProfileIfNotExists(DEV_TENANT_ID, userId);
      console.log('✅ Profile criado');
    } else {
      console.log('✅ Profile já existe');
    }
  } catch (error) {
    console.error('⚠️  Erro ao criar profile (continuando):', error);
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED DEV COMPLETO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  ATENÇÃO: Este script é APENAS para desenvolvimento local');
  console.log('');

  try {
    await seedTenant();
    await seedRBAC();
    const userId = await seedUser();
    await seedIdentityAndActor(userId);
    await seedCategories();
    await seedFeatureFlags();
    await seedProfile(userId);

    console.log('');
    console.log('✨ Seed DEV COMPLETO concluído com sucesso!');
    console.log('');
    console.log('📋 Resumo:');
    console.log(`   Tenant: ${DEV_TENANT_NAME} (${DEV_TENANT_ID})`);
    console.log(`   Email: ${DEV_EMAIL}`);
    console.log(`   Senha: ${DEV_PASSWORD}`);
    console.log(`   Plano: PRO (teste)`);
    console.log(`   Feature Flags: PRO e Microfone habilitados`);
  } catch (error) {
    console.error('\n💥 Erro fatal durante o seed DEV:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executa o script
main().catch((error) => {
  console.error('Erro não tratado:', error);
  process.exit(1);
});

