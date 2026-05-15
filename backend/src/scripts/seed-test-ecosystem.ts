// backend/src/scripts/seed-test-ecosystem.ts
//
// 2026-05-15: Ecossistema teste autorizado por Clayton ("popule o ambiente
// com identidades/empresas/grupos para validar comportamento contextual").
//
// 5 personas multi-contexto + grupo, modelando a REGRA DE DIVISÃO declarada:
//   - Actor separado quando há autonomia operacional/econômica/agenda/membros
//   - Contexto contextual da pessoa quando é só profissão/skill/área
//
// Personas:
//   1. João Silva — PF + Clínica Sorrisos (page) + Voltagem Bar Band (page)
//      Modelo multi-modal: dentista com clínica + músico com banda.
//   2. Maria Souza — PF apenas (profissão='confeiteira' no metadata)
//      Confeiteira autônoma — valida diretriz "contexto contextual da pessoa".
//   3. Pedro Tonho — PF + Bar do Tonho (page)
//      Restaurante = entidade econômica com operação própria.
//   4. Lúcia Lopes — PF apenas (profissão='advogada' no metadata)
//      Outra validação de profissional autônomo sem page.
//   5. Carla Mendes — PF apenas (sem profissão profissional)
//      Cliente comum, frequenta restaurantes e eventos.
//
// Grupo: "Vizinhos do Centro" — 5 membros.
//
// Primeira leva: identidades + pages + grupo. Posts virão na segunda leva via
// API canônica (evita risco do drift §28).
// Zero operação financeira nesta leva (Clayton: "validar UX antes de ligar
// ledger/p2p/splits").
//
// APENAS DEV — bloqueia em NODE_ENV=production.
// Idempotente — re-rodar não duplica.

import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool, runQueryWithTenant } from '../core/database/pool';
import { identityService } from '../core/identity/identity.service';
import { ensureUserActor, ensurePageActor } from '../modules/identity/actor-writer.service';
import { groupsService } from '../modules/groups/groups.service';
import { socialPortsRegistry } from '../core/social/ports-registry';
import { actorRepositoryAdapter } from '../modules/social/adapters';
import 'tsconfig-paths/register';

dotenv.config({ path: join(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL ausente');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Script NÃO pode rodar em produção');
  process.exit(1);
}

// ============================================================
// Configuração
// ============================================================
const TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';
const PASSWORD = 'dev12345';

interface PersonaSeed {
  email: string;
  cpf: string;
  fullName: string;
  birthdate: string; // YYYY-MM-DD
  gender: 'male' | 'female' | 'non_binary' | 'other' | 'prefer_not_to_say';
  profession?: string;
  professionalAreas?: string[];
  bio?: string;
}

const PERSONAS: PersonaSeed[] = [
  {
    email: 'joao.silva@teste.unificard.local',
    cpf: '11122233344',
    fullName: 'João Silva',
    birthdate: '1985-03-15',
    gender: 'male',
    profession: 'dentista',
    professionalAreas: ['odontologia', 'implantes', 'estética dental'],
    bio: 'Dentista, músico nas horas vagas. Pai do Bento.',
  },
  {
    email: 'maria.souza@teste.unificard.local',
    cpf: '22233344455',
    fullName: 'Maria Souza',
    birthdate: '1990-07-22',
    gender: 'female',
    profession: 'confeiteira',
    professionalAreas: ['doces', 'bolos de casamento', 'festas infantis'],
    bio: 'Confeiteira autônoma. Faço bolos com amor há 10 anos.',
  },
  {
    email: 'pedro.tonho@teste.unificard.local',
    cpf: '33344455566',
    fullName: 'Pedro Tonho',
    birthdate: '1978-11-03',
    gender: 'male',
    bio: 'Dono do Bar do Tonho. Boteco de bairro com música ao vivo.',
  },
  {
    email: 'lucia.lopes@teste.unificard.local',
    cpf: '44455566677',
    fullName: 'Lúcia Lopes',
    birthdate: '1988-05-19',
    gender: 'female',
    profession: 'advogada',
    professionalAreas: ['direito empresarial', 'LGPD', 'consultoria'],
    bio: 'Advogada especialista em LGPD para pequenas empresas.',
  },
  {
    email: 'carla.mendes@teste.unificard.local',
    cpf: '55566677788',
    fullName: 'Carla Mendes',
    birthdate: '1995-09-30',
    gender: 'female',
    bio: 'Frequento o Bar do Tonho toda sexta. Adoro casamentos.',
  },
];

interface PageSeed {
  ownerEmail: string;
  companyName: string;
  displayName: string;
  bio: string;
  category: string;
}

const PAGES: PageSeed[] = [
  {
    ownerEmail: 'joao.silva@teste.unificard.local',
    companyName: 'Clínica Sorrisos LTDA',
    displayName: 'Clínica Sorrisos',
    bio: 'Odontologia integrada — implantes, estética e ortodontia.',
    category: 'healthcare_dental',
  },
  {
    ownerEmail: 'joao.silva@teste.unificard.local',
    companyName: 'Voltagem Bar Band MEI',
    displayName: 'Voltagem Bar Band',
    bio: 'Banda cover de rock dos anos 80/90. Disponível para shows em bares e eventos.',
    category: 'music_band',
  },
  {
    ownerEmail: 'pedro.tonho@teste.unificard.local',
    companyName: 'Bar do Tonho LTDA',
    displayName: 'Bar do Tonho',
    bio: 'Boteco de bairro com música ao vivo todo fim de semana.',
    category: 'restaurant_bar',
  },
];

interface GroupSeed {
  name: string;
  description: string;
  ownerEmail: string;
  memberEmails: string[];
}

const GROUP: GroupSeed = {
  name: 'Vizinhos do Centro',
  description: 'Comunidade dos moradores e comerciantes do bairro Centro.',
  ownerEmail: 'pedro.tonho@teste.unificard.local',
  memberEmails: [
    'joao.silva@teste.unificard.local',
    'maria.souza@teste.unificard.local',
    'lucia.lopes@teste.unificard.local',
    'carla.mendes@teste.unificard.local',
  ],
};

// ============================================================
// Helpers
// ============================================================

async function ensureTestUser(persona: PersonaSeed): Promise<{ userId: string; actorId: string }> {
  const client = await pool.connect();
  try {
    // 1. UPSERT global_users por CPF
    const globalRes = await client.query<{ global_user_id: string }>(
      `
        INSERT INTO global_users (cpf, full_name, avatar_url, birthdate, metadata)
        VALUES ($1, $2, NULL, $3::DATE, '{}'::jsonb)
        ON CONFLICT (cpf) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING global_user_id
      `,
      [persona.cpf, persona.fullName, persona.birthdate]
    );
    const globalUserId = globalRes.rows[0].global_user_id;

    // 2. Check ou cria user
    const existing = await client.query<{ user_id: string }>(
      `SELECT user_id FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
      [TENANT_ID, persona.email.toLowerCase()]
    );

    let userId: string;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].user_id;
      // Garantir global_user_id atualizado
      await client.query(
        `UPDATE users SET global_user_id = $2 WHERE user_id = $1`,
        [userId, globalUserId]
      );
    } else {
      userId = uuidv4();
      const passwordHash = await bcrypt.hash(PASSWORD, 10);
      await client.query(
        `
          INSERT INTO users (id, tenant_id, global_user_id, email, password_hash, plan)
          VALUES ($1, $2, $3, $4, $5, 'free')
        `,
        [userId, TENANT_ID, globalUserId, persona.email.toLowerCase(), passwordHash]
      );
    }

    // 3. UPSERT profile (com fullName + bio + metadata profissional opcional)
    const profileMetadata: Record<string, any> = { gender: persona.gender };
    if (persona.profession) profileMetadata.profession = persona.profession;
    if (persona.professionalAreas) profileMetadata.professional_areas = persona.professionalAreas;
    if (persona.bio) profileMetadata.bio = persona.bio;

    await client.query(
      `
        INSERT INTO profiles (tenant_id, user_id, full_name, cpf, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
        ON CONFLICT (tenant_id, user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          metadata = profiles.metadata || EXCLUDED.metadata,
          updated_at = now()
      `,
      [TENANT_ID, userId, persona.fullName, persona.cpf, JSON.stringify(profileMetadata)]
    );

    // 4. UPSERT user_profiles (cpf canônico)
    await client.query(
      `
        INSERT INTO user_profiles (user_id, cpf)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET cpf = EXCLUDED.cpf
      `,
      [userId, persona.cpf]
    );

    // 5. Garantir identidade global (link já feito acima, mas chamada idempotente)
    await identityService.createGlobalIdentityForUser(userId, TENANT_ID);

    // 6. Garantir user actor
    const userActor = await ensureUserActor(TENANT_ID, userId);

    return { userId, actorId: userActor.actor_id };
  } finally {
    client.release();
  }
}

/**
 * Garante linha em company_users vinculando owner (global_user_id) à company.
 * Sem essa linha, findAvailableActors NÃO retorna a page (JOIN obrigatório).
 * Idempotente via UNIQUE(company_id, global_user_id).
 */
async function ensureCompanyUserLink(companyId: string, globalUserId: string): Promise<void> {
  await runQueryWithTenant(
    TENANT_ID,
    `
      INSERT INTO company_users (
        tenant_id, company_id, global_user_id, role,
        can_manage_company, is_active, is_primary,
        can_manage_financial, can_manage_employees, can_view_reports, can_manage_services
      )
      VALUES ($1, $2, $3, 'owner', true, true, true, true, true, true, true)
      ON CONFLICT (company_id, global_user_id) DO UPDATE
      SET is_active = true,
          can_manage_company = true,
          is_primary = true,
          updated_at = now()
    `,
    [TENANT_ID, companyId, globalUserId]
  );
}

async function ensureTestPage(page: PageSeed, ownerUserId: string): Promise<string> {
  const globalUser = await identityService.createGlobalIdentityForUser(ownerUserId, TENANT_ID);

  // Check existente por display_name (idempotência)
  const existing = await runQueryWithTenant<{ actor_id: string; company_id: string | null }>(
    TENANT_ID,
    `
      SELECT a.actor_id, a.company_id
      FROM actors a
      WHERE a.tenant_id = $1 AND a.display_name = $2 AND a.actor_type = 'page'
      LIMIT 1
    `,
    [TENANT_ID, page.displayName]
  );

  if (existing?.actor_id) {
    // Garante company_users mesmo em re-rodada (corrige seeds anteriores)
    if (existing.company_id) {
      await ensureCompanyUserLink(existing.company_id, globalUser.globalUserId);
    }
    return existing.actor_id;
  }

  // Cria company + page actor
  const cnpj = `SEED${uuidv4().replace(/-/g, '').slice(0, 11)}`;

  const companyRow = await runQueryWithTenant<{ company_id: string }>(
    TENANT_ID,
    `
      INSERT INTO companies (
        tenant_id, company_name, trade_name, cnpj, global_user_id, status, company_status
      )
      VALUES ($1, $2, $3, $4, $5, 'active', 'ACTIVE')
      RETURNING company_id
    `,
    [TENANT_ID, page.companyName, page.displayName, cnpj, globalUser.globalUserId]
  );
  if (!companyRow?.company_id) {
    throw new Error(`Falha ao criar company: ${page.displayName}`);
  }

  // Linka owner em company_users — sem isso findAvailableActors não retorna a page
  await ensureCompanyUserLink(companyRow.company_id, globalUser.globalUserId);

  const humanActor = await ensureUserActor(TENANT_ID, ownerUserId);
  const pageActor = await ensurePageActor(TENANT_ID, companyRow.company_id, humanActor.actor_id);

  await runQueryWithTenant(
    TENANT_ID,
    `
      UPDATE actors
      SET slug = $3,
          metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
          updated_at = now()
      WHERE tenant_id = $1 AND actor_id = $2
    `,
    [
      TENANT_ID,
      pageActor.actor_id,
      page.displayName.toLowerCase().replace(/\s+/g, '-'),
      JSON.stringify({
        seed_test_ecosystem: true,
        company_name: page.companyName,
        bio: page.bio,
        category: page.category,
      }),
    ]
  );

  return pageActor.actor_id;
}

async function getDefaultGroupCategoryId(): Promise<string | null> {
  // group_categories não existe como tabela própria; categoria é opcional no
  // groupsService.createGroup (validateCategoryForGroup retorna se !categoryId).
  // Retornamos null para criar grupo sem categoria nesta primeira leva.
  return null;
}

async function getDefaultCountryId(): Promise<string | null> {
  // Schema canônico usa iso_alpha2, não 'code'.
  const client = await pool.connect();
  try {
    const res = await client.query<{ country_id: string }>(
      `SELECT country_id FROM countries WHERE iso_alpha2 = 'BR' LIMIT 1`
    );
    return res.rows[0]?.country_id ?? null;
  } finally {
    client.release();
  }
}

async function ensureTestGroup(
  group: GroupSeed,
  ownerUserId: string,
  categoryId: string | null,
  countryId: string
): Promise<string> {
  // Check por nome — schema canônico usa "id" (não group_id) em groups table.
  const existing = await runQueryWithTenant<{ id: string }>(
    TENANT_ID,
    `SELECT id FROM groups WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
    [TENANT_ID, group.name]
  );

  if (existing?.id) {
    return existing.id;
  }

  const created = await groupsService.createGroup(TENANT_ID, ownerUserId, {
    name: group.name,
    description: group.description,
    ...(categoryId ? { category_id: categoryId } : {}),
    visibility: 'public',
    scope: 'national',
    country_id: countryId,
  });

  return created.groupId;
}

async function ensureGroupMember(
  groupId: string,
  userId: string,
  role: 'owner' | 'admin' | 'member' = 'member'
): Promise<void> {
  // Insert direto com ON CONFLICT canônico (tenant_id+group_id+user_id) —
  // independente de joinGroup (que falha se grupo está private/secret + check
  // de já-membro). Idempotente.
  await runQueryWithTenant(
    TENANT_ID,
    `
      INSERT INTO group_members (tenant_id, group_id, user_id, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, group_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `,
    [TENANT_ID, groupId, userId, role]
  );
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('🌱 Seed Ecossistema Teste — UnifiCard');
  console.log(`   Tenant: ${TENANT_ID}`);
  console.log(`   Senha padrão: ${PASSWORD}`);
  console.log('');

  // Bootstrap manual do ports registry (sem subir Fastify app inteiro)
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);

  // Validar tenant
  const tenantCheck = await pool.query(`SELECT id FROM tenants WHERE id = $1 LIMIT 1`, [TENANT_ID]);
  if (tenantCheck.rowCount === 0) {
    console.error(`❌ Tenant DEV ${TENANT_ID} não existe. Rode seed-dev-complete antes.`);
    process.exit(1);
  }

  // 1. Personas
  console.log('👥 [1/3] Criando personas...');
  const personaResults = new Map<string, { userId: string; actorId: string; persona: PersonaSeed }>();
  for (const persona of PERSONAS) {
    const result = await ensureTestUser(persona);
    personaResults.set(persona.email, { ...result, persona });
    const tag = persona.profession ? ` [profissão: ${persona.profession}]` : '';
    console.log(`   ✅ ${persona.fullName} (${persona.email})${tag}`);
  }

  // 2. Pages
  console.log('');
  console.log('🏢 [2/3] Criando pages (empresas/bandas/restaurantes)...');
  for (const page of PAGES) {
    const owner = personaResults.get(page.ownerEmail);
    if (!owner) {
      console.warn(`   ⚠️  Skipping ${page.displayName} — owner ${page.ownerEmail} não encontrado`);
      continue;
    }
    const pageActorId = await ensureTestPage(page, owner.userId);
    console.log(`   ✅ ${page.displayName} [${page.category}] — actor=${pageActorId.slice(0, 8)}`);
  }

  // 3. Grupo
  console.log('');
  console.log('👥 [3/3] Criando grupo + membros...');
  const groupCategoryId = await getDefaultGroupCategoryId();
  const countryId = await getDefaultCountryId();
  if (!countryId) {
    console.warn('   ⚠️  País Brasil não encontrado — pulando grupo.');
  } else {
    const groupOwner = personaResults.get(GROUP.ownerEmail);
    if (groupOwner) {
      try {
        const groupId = await ensureTestGroup(GROUP, groupOwner.userId, groupCategoryId, countryId);
        console.log(`   ✅ Grupo "${GROUP.name}" — id=${groupId.slice(0, 8)}`);

        // Garante owner também em group_members (createGroup pode falhar silenciosamente
        // em rodadas anteriores quando ON CONFLICT estava errado)
        await ensureGroupMember(groupId, groupOwner.userId, 'owner');
        console.log(`   ✅ Owner: ${GROUP.ownerEmail}`);

        for (const memberEmail of GROUP.memberEmails) {
          const member = personaResults.get(memberEmail);
          if (member) {
            await ensureGroupMember(groupId, member.userId, 'member');
            console.log(`   ✅ Membro: ${memberEmail}`);
          }
        }
      } catch (err: any) {
        console.warn(`   ⚠️  Grupo NÃO criado (drift §28 pré-existente em country.repository):`);
        console.warn(`       ${err?.message ?? err}`);
        console.warn(`       Personas + pages criadas com sucesso; grupo fica para 2ª leva.`);
      }
    }
  }

  console.log('');
  console.log('✅ Seed completo!');
  console.log('');
  console.log('Para fazer login na UI:');
  for (const p of PERSONAS) {
    console.log(`   ${p.email}  /  ${PASSWORD}`);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
