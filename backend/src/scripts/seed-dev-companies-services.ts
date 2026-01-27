// backend/src/scripts/seed-dev-companies-services.ts
// P1: Seed DEV Mínimo - Companies e Serviços para Matching
// ⚠️ APENAS para ambiente de desenvolvimento local
// ⚠️ NÃO executar em produção
//
// OBJETIVO:
// Criar 3-5 companies/pages com serviços essenciais para validação ponta-a-ponta
// Serviços com categorias: venue_rental, kids_entertainment, dj_music, photography, catering, decoration, cleaning, security, waitstaff

import dotenv from 'dotenv';
import { join } from 'path';
import { pool, runQueryWithTenant } from '../core/database/pool';
import { actorRepository } from '../modules/social/actor.repository';
import { identityService } from '../core/identity/identity.service';
import { v4 as uuidv4 } from 'uuid';
import 'tsconfig-paths/register';

// Carrega variáveis de ambiente
dotenv.config({ path: join(process.cwd(), '.env') });

// Valida se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
  process.exit(1);
}

// 🔴 P1: BLOQUEAR EM PRODUÇÃO
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERRO: Este script NÃO pode ser executado em produção');
  console.error('   NODE_ENV está definido como "production"');
  console.error('   Este seed é APENAS para ambiente de desenvolvimento local');
  process.exit(1);
}

// Configuração DEV
const DEV_TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';

/**
 * 🔴 P1: Companies e Serviços para Matching
 */
interface CompanySeed {
  name: string;
  displayName: string;
  services: Array<{
    name: string;
    category: string;
    description: string;
  }>;
}

const COMPANIES_SEED: CompanySeed[] = [
  {
    name: 'Espaços Festa LTDA',
    displayName: 'Espaços Festa',
    services: [
      {
        name: 'Locação de Salão',
        category: 'venue_rental',
        description: 'Salão para eventos com capacidade para até 200 pessoas',
      },
    ],
  },
  {
    name: 'Diversão Kids',
    displayName: 'Diversão Kids',
    services: [
      {
        name: 'Brinquedos Infláveis',
        category: 'kids_entertainment',
        description: 'Aluguel de brinquedos infláveis para festas infantis',
      },
      {
        name: 'Recreação Infantil',
        category: 'kids_entertainment',
        description: 'Recreadores e atividades para crianças',
      },
    ],
  },
  {
    name: 'DJ Sound',
    displayName: 'DJ Sound',
    services: [
      {
        name: 'DJ para Festas',
        category: 'dj_music',
        description: 'DJ profissional com equipamento de som completo',
      },
    ],
  },
  {
    name: 'Fotos & Vídeos Eventos',
    displayName: 'Fotos & Vídeos',
    services: [
      {
        name: 'Fotografia de Eventos',
        category: 'photography',
        description: 'Cobertura fotográfica completa do evento',
      },
      {
        name: 'Filmagem de Eventos',
        category: 'videography',
        description: 'Filmagem profissional com edição',
      },
    ],
  },
  {
    name: 'Buffet Completo',
    displayName: 'Buffet Completo',
    services: [
      {
        name: 'Buffet para Festas',
        category: 'catering',
        description: 'Buffet completo com salgados, doces e bebidas',
      },
    ],
  },
  {
    name: 'Decoração Premium',
    displayName: 'Decoração Premium',
    services: [
      {
        name: 'Decoração de Festas',
        category: 'decoration',
        description: 'Decoração temática completa para eventos',
      },
    ],
  },
  {
    name: 'Serviços Operacionais',
    displayName: 'Serviços Operacionais',
    services: [
      {
        name: 'Limpeza Pós-Evento',
        category: 'cleaning',
        description: 'Serviço de limpeza após o evento',
      },
      {
        name: 'Segurança para Eventos',
        category: 'security',
        description: 'Equipe de segurança para eventos',
      },
      {
        name: 'Garçons para Eventos',
        category: 'waitstaff',
        description: 'Equipe de garçons para servir',
      },
    ],
  },
];

/**
 * Busca usuário DEV
 */
async function getDevUser(): Promise<{ user_id: string; email: string } | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT user_id, email
        FROM users
        WHERE tenant_id = $1 AND email = $2
        LIMIT 1
      `,
      [DEV_TENANT_ID, DEV_EMAIL.toLowerCase()]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Cria actor do tipo "page" (company)
 */
async function createPageActor(
  tenantId: string,
  userId: string,
  name: string,
  displayName: string
): Promise<string> {
  // Verificar se já existe
  const existing = await runQueryWithTenant<{ actor_id: string }>(
    tenantId,
    `
      SELECT actor_id
      FROM actors
      WHERE tenant_id = $1 AND display_name = $2 AND actor_type = 'page'
      LIMIT 1
    `,
    [tenantId, displayName]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].actor_id;
  }

  // Criar identidade global se necessário
  const globalUser = await identityService.createGlobalIdentityForUser(userId, tenantId);

  // Criar actor do tipo "page"
  const actorId = uuidv4();
  await runQueryWithTenant(
    tenantId,
    `
      INSERT INTO actors (
        actor_id, tenant_id, user_id, global_user_id,
        actor_type, display_name, slug, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'page', $5, $6, $7::jsonb, NOW(), NOW())
    `,
    [
      actorId,
      tenantId,
      userId,
      globalUser.globalUserId,
      displayName,
      name.toLowerCase().replace(/\s+/g, '-'),
      JSON.stringify({ seed_dev: true, company_name: name }),
    ]
  );

  return actorId;
}

/**
 * Cria serviço para um actor
 */
async function createService(
  tenantId: string,
  actorId: string,
  service: { name: string; category: string; description: string }
): Promise<void> {
  // Verificar se já existe
  const existing = await runQueryWithTenant<{ service_id: string }>(
    tenantId,
    `
      SELECT service_id
      FROM services
      WHERE tenant_id = $1 AND actor_id = $2 AND name = $3
      LIMIT 1
    `,
    [tenantId, actorId, service.name]
  );

  if (existing.rows.length > 0) {
    return; // Já existe
  }

  const serviceId = uuidv4();
  const slug = service.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  
  await runQueryWithTenant(
    tenantId,
    `
      INSERT INTO services (
        service_id, tenant_id, actor_id, name, slug, description,
        service_type, status, category_id, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'service', 'active', NULL, $7::jsonb, NOW(), NOW())
    `,
    [
      serviceId,
      tenantId,
      actorId,
      service.name,
      slug,
      service.description,
      JSON.stringify({ 
        seed_dev: true,
        service_category: service.category, // 🔴 P1: Armazenar categoria em metadata
      }),
    ]
  );
}

/**
 * Seed companies e serviços
 */
async function seedCompaniesAndServices(): Promise<void> {
  console.log('📦 P1: Seed DEV - Criando companies e serviços...\n');

  // 1. Buscar usuário DEV
  const user = await getDevUser();
  if (!user) {
    console.error('❌ ERRO: Usuário DEV não encontrado');
    console.error(`   Email: ${DEV_EMAIL}`);
    console.error(`   Tenant: ${DEV_TENANT_ID}`);
    console.error('   Execute seed:dev:user primeiro.\n');
    throw new Error('Usuário DEV não encontrado. Execute seed:dev:user primeiro.');
  }

  console.log(`✅ Usuário DEV encontrado: ${user.user_id}\n`);

  // 2. Criar companies e serviços
  for (const company of COMPANIES_SEED) {
    console.log(`🏢 Criando empresa: ${company.displayName}`);
    
    const actorId = await createPageActor(
      DEV_TENANT_ID,
      user.user_id,
      company.name,
      company.displayName
    );
    
    console.log(`   ✅ Actor criado: ${actorId}`);

    // Criar serviços
    for (const service of company.services) {
      await createService(DEV_TENANT_ID, actorId, service);
      console.log(`   ✅ Serviço criado: ${service.name} (${service.category})`);
    }
    
    console.log('');
  }

  console.log('✨ Seed DEV concluído!');
  console.log(`   Total de companies: ${COMPANIES_SEED.length}`);
  console.log(`   Total de serviços: ${COMPANIES_SEED.reduce((sum, c) => sum + c.services.length, 0)}\n`);
}

/**
 * Função principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  P1: SEED DEV - Companies e Serviços para Matching');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  ATENÇÃO: Este script é APENAS para desenvolvimento local');
  console.log('');

  try {
    await seedCompaniesAndServices();
    console.log('✨ Seed concluído com sucesso!');
  } catch (error: any) {
    console.error('❌ Erro ao executar seed:');
    console.error(error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

export { seedCompaniesAndServices };

