// src/scripts/seed-dev-groups.ts
//
// Script de seed DEV para grupos - cria dados mínimos para smoke tests
// APENAS para ambiente de desenvolvimento local
// NÃO executar em produção
//
// Este script cria:
// 1. 2 usuários (user_owner, user_member)
// 2. 3 grupos (público, privado, secreto)
// 3. Relacionamentos corretos
// 4. Conteúdo mínimo (posts e eventos)

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { runQueryWithTenant } from '../core/database/pool';
import { identityService } from '../core/identity/identity.service';
import { actorRepository } from '../modules/social/actor.repository';
import { groupsService } from '../modules/groups/groups.service';
import { social2Service } from '../modules/social/social-2.0.service';
import { categoriesService } from '../core/categories/categories.service';
import { worldService } from '../core/world/services/world.service';
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
  process.exit(1);
}

// Configuração DEV
const DEV_TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';
const USER_OWNER_PUBLIC_EMAIL = 'user_owner_public@unificard.local';
const USER_OWNER_PRIVATE_EMAIL = 'user_owner_private@unificard.local';
const USER_OWNER_SECRET_EMAIL = 'user_owner_secret@unificard.local';
const USER_MEMBER_EMAIL = 'user_member@unificard.local';
const DEFAULT_PASSWORD = '123456';

interface SeedResult {
  userOwnerPublicId: string;
  userOwnerPublicGlobalId: string;
  userOwnerPublicActorId: string;
  userOwnerPrivateId: string;
  userOwnerPrivateGlobalId: string;
  userOwnerPrivateActorId: string;
  userOwnerSecretId: string;
  userOwnerSecretGlobalId: string;
  userOwnerSecretActorId: string;
  userMemberId: string;
  userMemberGlobalId: string;
  userMemberActorId: string;
  groupPublicId: string;
  groupPrivateId: string;
  groupSecretId: string;
  categoryId: string;
  countryId: string;
}

/**
 * Helper para criar usuário
 */
async function createOrGetUser(email: string, label: string): Promise<{ userId: string; globalUserId: string; actorId: string }> {
  console.log(`📦 Verificando ${label}...`);

  const bcrypt = await import('bcrypt');

  // Verificar se usuário já existe
  const existing = await runQueryWithTenant<{ user_id: string; global_user_id: string | null }>(
    DEV_TENANT_ID,
    `SELECT user_id, global_user_id FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()]
  );

  let userId: string;
  let globalUserId: string;

  if (existing) {
    userId = existing.user_id;
    // Atualizar senha
    const passwordHash = await bcrypt.default.hash(DEFAULT_PASSWORD, 10);
    await runQueryWithTenant(
      DEV_TENANT_ID,
      `UPDATE users SET password_hash = $1, updated_at = now() WHERE user_id = $2`,
      [passwordHash, userId]
    );
    
    // Obter ou criar identidade global
    if (existing.global_user_id) {
      globalUserId = existing.global_user_id;
    } else {
      const identity = await identityService.createGlobalIdentityForUser(userId, DEV_TENANT_ID);
      globalUserId = identity.globalUserId;
    }
    console.log(`✅ ${label} já existe`);
  } else {
    // Criar novo usuário
    const { v4: uuidv4 } = await import('uuid');
    userId = uuidv4();
    const passwordHash = await bcrypt.default.hash(DEFAULT_PASSWORD, 10);

    await runQueryWithTenant(
      DEV_TENANT_ID,
      `
        INSERT INTO users (user_id, tenant_id, email, password_hash, is_test, plan, token_version, created_at)
        VALUES ($1, $2, $3, $4, true, 'pro', 0, now())
      `,
      [userId, DEV_TENANT_ID, email.toLowerCase(), passwordHash]
    );

    // Criar identidade global
    const identity = await identityService.createGlobalIdentityForUser(userId, DEV_TENANT_ID);
    globalUserId = identity.globalUserId;
    console.log(`✅ ${label} criado`);
  }

  // Criar ou obter actor
  const actor = await actorRepository.findOrCreateUserActor(DEV_TENANT_ID, userId);
  
  return { userId, globalUserId, actorId: actor.actor_id };
}

/**
 * 3. Buscar categoria válida para grupos
 */
async function getGroupCategory(): Promise<string> {
  console.log('📦 [3/8] Buscando categoria de grupo...');

  // Buscar da tabela group_categories (não categories)
  const categories = await runQueryWithTenant<{ category_id: string; name: string; slug: string }>(
    DEV_TENANT_ID,
    `SELECT category_id, name, slug FROM group_categories ORDER BY created_at ASC LIMIT 1`,
    []
  );

  if (!categories) {
    throw new Error('Nenhuma categoria de grupo encontrada. Execute as migrations primeiro (especialmente 113_groups_social_features.sql).');
  }

  console.log(`✅ Categoria encontrada: ${categories.name} (${categories.category_id})`);
  return categories.category_id;
}

/**
 * 4. Buscar localização (Brasil)
 */
async function getLocation(): Promise<{ countryId: string }> {
  console.log('📦 [4/8] Buscando localização...');
  
  // Buscar Brasil
  const countries = await worldService.getCountries();
  const brazil = countries.find(c => c.code === 'BR' || c.nameEn === 'Brazil' || c.name === 'Brasil');
  
  if (!brazil) {
    throw new Error('Brasil não encontrado. Execute seed de localização primeiro.');
  }

  console.log(`✅ Localização encontrada: ${brazil.name} (${brazil.countryId})`);
  return { countryId: brazil.countryId };
}

/**
 * 5. Criar 3 grupos (cada um com seu próprio owner)
 */
async function seedGroups(
  ownerPublicId: string,
  ownerPrivateId: string,
  ownerSecretId: string,
  categoryId: string,
  countryId: string
): Promise<{ publicId: string; privateId: string; secretId: string }> {
  console.log('📦 [5/8] Criando grupos...');

  // Grupo público
  console.log('   Criando grupo público...');
  const groupPublic = await groupsService.createGroup(DEV_TENANT_ID, ownerPublicId, {
    name: 'Grupo Público de Teste',
    description: 'Este é um grupo público para testes. Qualquer pessoa pode entrar diretamente.',
    category_id: categoryId,
    visibility: 'public',
    scope: 'national',
    country_id: countryId,
  });

  // Grupo privado
  console.log('   Criando grupo privado...');
  const groupPrivate = await groupsService.createGroup(DEV_TENANT_ID, ownerPrivateId, {
    name: 'Grupo Privado de Teste',
    description: 'Este é um grupo privado para testes. Requer solicitação de entrada.',
    category_id: categoryId,
    visibility: 'private',
    scope: 'national',
    country_id: countryId,
  });

  // Grupo secreto
  console.log('   Criando grupo secreto...');
  const groupSecret = await groupsService.createGroup(DEV_TENANT_ID, ownerSecretId, {
    name: 'Grupo Secreto de Teste',
    description: 'Este é um grupo secreto para testes. Apenas convites permitidos.',
    category_id: categoryId,
    visibility: 'secret',
    scope: 'national',
    country_id: countryId,
  });

  console.log('✅ 3 grupos criados');
  return {
    publicId: groupPublic.groupId,
    privateId: groupPrivate.groupId,
    secretId: groupSecret.groupId,
  };
}

/**
 * 6. Criar relacionamentos
 */
async function seedRelationships(
  memberUserId: string,
  groupPublicId: string,
  groupPrivateId: string,
  groupSecretId: string,
  ownerSecretId: string
): Promise<void> {
  console.log('📦 [6/8] Criando relacionamentos...');
  
  // user_member entra direto no grupo público
  try {
    await groupsService.joinGroup(DEV_TENANT_ID, groupPublicId, memberUserId);
    console.log('✅ user_member entrou no grupo público');
  } catch (err: any) {
    if (err.message?.includes('already a member')) {
      console.log('✅ user_member já é membro do grupo público');
    } else {
      throw err;
    }
  }

  // user_member solicita entrada no privado
  try {
    await groupsService.requestJoinGroup(DEV_TENANT_ID, groupPrivateId, memberUserId);
    console.log('✅ user_member solicitou entrada no grupo privado');
  } catch (err: any) {
    if (err.message?.includes('already has a pending')) {
      console.log('✅ user_member já tem solicitação pendente no grupo privado');
    } else {
      throw err;
    }
  }

  // Owner do grupo secreto cria convite para user_member
  try {
    await groupsService.createInvite(DEV_TENANT_ID, groupSecretId, memberUserId, ownerSecretId);
    console.log('✅ Convite criado para user_member no grupo secreto');
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log('✅ Convite já existe para user_member no grupo secreto');
    } else {
      throw err;
    }
  }
}

/**
 * 7. Criar posts
 */
async function seedPosts(
  ownerPublicId: string,
  ownerPublicGlobalId: string,
  ownerPublicActorId: string,
  ownerPrivateId: string,
  ownerPrivateGlobalId: string,
  ownerPrivateActorId: string,
  groupPublicId: string,
  groupPrivateId: string
): Promise<void> {
  console.log('📦 [7/8] Criando posts...');

  // Post no grupo público (por owner do grupo público)
  try {
    await social2Service.createPost(
      DEV_TENANT_ID,
      ownerPublicId,
      ownerPublicGlobalId,
      'Este é um post de teste no grupo público!',
      ownerPublicActorId,
      [],
      'personal',
      {},
      undefined,
      undefined,
      groupPublicId
    );
    console.log('✅ Post criado no grupo público');
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log('✅ Post no grupo público já existe');
    } else {
      console.warn('⚠️  Erro ao criar post no grupo público (continuando):', err.message);
    }
  }

  // Post no grupo privado (por owner do grupo privado)
  try {
    await social2Service.createPost(
      DEV_TENANT_ID,
      ownerPrivateId,
      ownerPrivateGlobalId,
      'Este é um post de teste no grupo privado!',
      ownerPrivateActorId,
      [],
      'personal',
      {},
      undefined,
      undefined,
      groupPrivateId
    );
    console.log('✅ Post criado no grupo privado');
  } catch (err: any) {
    console.warn('⚠️  Erro ao criar post no grupo privado (continuando):', err.message);
  }
}

/**
 * 8. Criar evento vinculado a grupo público
 */
async function seedEvent(
  ownerPublicGlobalId: string,
  ownerPublicActorId: string,
  groupPublicId: string
): Promise<void> {
  console.log('📦 [8/8] Criando evento...');

  try {
    const { eventsService } = await import('../modules/events/events.service');

    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 7); // 7 dias no futuro
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 2); // 2 horas de duração

    await eventsService.createEvent(
      DEV_TENANT_ID,
      {
        title: 'Evento de Teste no Grupo Público',
        description: 'Este é um evento de teste vinculado ao grupo público.',
        startTime,
        endTime,
        actorId: ownerPublicActorId,
      },
      ownerPublicGlobalId
    );

    // Vincular evento ao grupo (se houver tabela group_events)
    try {
      await runQueryWithTenant(
        DEV_TENANT_ID,
        `
          INSERT INTO group_events (group_id, event_id, tenant_id, created_at)
          VALUES ($1, (SELECT id FROM events WHERE tenant_id = $2 ORDER BY created_at DESC LIMIT 1), $2, now())
          ON CONFLICT DO NOTHING
        `,
        [groupPublicId, DEV_TENANT_ID]
      );
      console.log('✅ Evento criado e vinculado ao grupo público');
    } catch (err: any) {
      console.warn('⚠️  Erro ao vincular evento ao grupo (continuando):', err.message);
    }
  } catch (err: any) {
    console.warn('⚠️  Erro ao criar evento (continuando):', err.message);
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED DEV - GRUPOS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  ATENÇÃO: Este script é APENAS para desenvolvimento local');
  console.log('');

  try {
    // 1. Criar usuários
    console.log('📦 [1/8] Criando usuários...\n');
    const userOwnerPublic = await createOrGetUser(USER_OWNER_PUBLIC_EMAIL, 'Owner do grupo público');
    const userOwnerPrivate = await createOrGetUser(USER_OWNER_PRIVATE_EMAIL, 'Owner do grupo privado');
    const userOwnerSecret = await createOrGetUser(USER_OWNER_SECRET_EMAIL, 'Owner do grupo secreto');
    const userMember = await createOrGetUser(USER_MEMBER_EMAIL, 'Usuário membro');

    // 2. Buscar categoria e localização
    const categoryId = await getGroupCategory();
    const location = await getLocation();

    // 3. Criar grupos
    const groups = await seedGroups(
      userOwnerPublic.userId,
      userOwnerPrivate.userId,
      userOwnerSecret.userId,
      categoryId,
      location.countryId
    );

    // 4. Criar relacionamentos
    await seedRelationships(
      userMember.userId,
      groups.publicId,
      groups.privateId,
      groups.secretId,
      userOwnerSecret.userId
    );

    // 5. Criar posts
    await seedPosts(
      userOwnerPublic.userId,
      userOwnerPublic.globalUserId,
      userOwnerPublic.actorId,
      userOwnerPrivate.userId,
      userOwnerPrivate.globalUserId,
      userOwnerPrivate.actorId,
      groups.publicId,
      groups.privateId
    );

    // 6. Criar evento
    await seedEvent(userOwnerPublic.globalUserId, userOwnerPublic.actorId, groups.publicId);

    console.log('');
    console.log('✨ Seed DEV - Grupos concluído com sucesso!');
    console.log('');
    console.log('📋 Resumo:');
    console.log(`   Tenant: ${DEV_TENANT_ID}`);
    console.log(`   Owner Grupo Público: ${USER_OWNER_PUBLIC_EMAIL} (senha: ${DEFAULT_PASSWORD})`);
    console.log(`   Owner Grupo Privado: ${USER_OWNER_PRIVATE_EMAIL} (senha: ${DEFAULT_PASSWORD})`);
    console.log(`   Owner Grupo Secreto: ${USER_OWNER_SECRET_EMAIL} (senha: ${DEFAULT_PASSWORD})`);
    console.log(`   Usuário Member: ${USER_MEMBER_EMAIL} (senha: ${DEFAULT_PASSWORD})`);
    console.log(`   Grupo Público: ${groups.publicId}`);
    console.log(`   Grupo Privado: ${groups.privateId}`);
    console.log(`   Grupo Secreto: ${groups.secretId}`);
    console.log('');
    console.log('📝 Relacionamentos:');
    console.log('   - user_member → membro do grupo público');
    console.log('   - user_member → solicitação pendente no grupo privado');
    console.log('   - user_member → convite pendente no grupo secreto');
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

