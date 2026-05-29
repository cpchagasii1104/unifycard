// backend/src/scripts/bootstrap-dev-canonical.ts
//
// FASE 3A — Bootstrap canônico do tenant DEV (dev-only, idempotente, não-automático).
//
// Cria a "primeira vida" do banco limpo SOMENTE por caminhos canônicos de serviço:
//   1. tenant DEV        → tenantService.createTenant       (+ tenant_contexts no bootstrap)
//   2. RBAC              → rbacService.seedDefaultRBAC       (SELECT seed_default_rbac($1))
//   3. PF (admin DEV)    → authService.register             (global_users→users→identities→actor 'user')
//   4. role admin ao DEV → rbacService.assignRoleByName     (INSERT user_roles ON CONFLICT)
//
// PROIBIDO: INSERT direto em users/actors/global_users/identities. Só serviços canônicos.
//   (As únicas queries diretas aqui são SELECTs de leitura para idempotência/verificação.)
//
// A7 (adotada nesta etapa): o actor humano nasce com actor_type='user' via
//   register → ensureUserActor → findOrCreateUserActor, com global_user_id NOT NULL e
//   actor_id próprio (≠ user_id). O caminho Genesis (actor_type='actor_human' de
//   identity.service) NÃO é usado aqui — fica registrado como dívida técnica.
//
// NOTA SOBRE A ROLE 'admin': a atribuição de 'admin' ao usuário DEV é EXCLUSIVA deste
//   bootstrap, apenas para destravar o ambiente de desenvolvimento. O register normal de
//   produção NÃO atribui role alguma — isto NÃO é regra geral de cadastro.

import 'tsconfig-paths/register';
import { pool, runQueryWithTenant } from '../core/database/pool'; // import de pool → loadBackendEnv()
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';

// ── Configuração DEV (fixa) ────────────────────────────────────────────────
const DEV_TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1'; // reusa o id do seed-dev-complete
const DEV_TENANT_NAME = 'UnifyCard DEV';
const DEV_TENANT_SLUG = 'unificard-dev';
const DEV_EMAIL = 'dev@unificard.local';
const DEV_PASSWORD = '123456';
const DEV_CPF = '11144477735'; // CPF de teste com dígitos verificadores válidos
const DEV_FULLNAME = 'Dev Canonical';
const EXPECTED_DATABASE_NAME = 'unificard_dev';

// ── GUARDS ──────────────────────────────────────────────────────────────────
function assertDevOnly(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ABORT: bootstrap-dev-canonical é dev-only (NODE_ENV=production detectado).');
  }
  if (process.env.PILOT_MODE === 'true') {
    throw new Error(
      'ABORT: PILOT_MODE=true faria authService.register exigir convite (403). ' +
      'Desative PILOT_MODE para rodar o bootstrap DEV.'
    );
  }
}

async function assertTargetDatabase(): Promise<void> {
  const r = await pool.query<{ current_database: string }>('SELECT current_database()');
  const db = r.rows[0]?.current_database;
  if (db !== EXPECTED_DATABASE_NAME) {
    throw new Error(`ABORT: banco-alvo é "${db}", esperado "${EXPECTED_DATABASE_NAME}".`);
  }
  console.log(`🔒 Banco-alvo confirmado: ${db}`);
}

// ── DI: injeção dos social ports (mesma wiring de app.builder.ts:44-58) ───────
// Um script standalone não passa pelo BOOT do app, então o registry de social
// ports fica vazio e ensureUserActor/findOrCreateUserActor falham. Replicamos a
// injeção canônica do core aqui — sem isso o actor não nasce.
async function wireSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const {
    actorRepositoryAdapter,
    actorUtilsAdapter,
    socialRepositoryAdapter,
    socialServiceAdapter,
    eventFeedHandlersAdapter,
  } = await import('../modules/social/adapters');

  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);
  console.log('🔌 Social ports injetados (actor repository disponível)');
}

// ── PASSO 1 — tenant DEV (idempotente) ───────────────────────────────────────
async function step1Tenant(): Promise<void> {
  const existing = await pool.query('SELECT id FROM tenants WHERE id = $1 LIMIT 1', [DEV_TENANT_ID]);
  if (existing.rows.length > 0) {
    console.log('✅ [1/4] tenant DEV já existe — reusando');
    return;
  }
  await tenantService.createTenant({ id: DEV_TENANT_ID, name: DEV_TENANT_NAME, slug: DEV_TENANT_SLUG });
  console.log('✅ [1/4] tenant DEV criado (tenantService.createTenant)');
}

// ── PASSO 2 — RBAC canônico (idempotente: seed_default_rbac usa ON CONFLICT) ──
async function step2Rbac(): Promise<void> {
  await rbacService.seedDefaultRBAC(DEV_TENANT_ID);
  console.log('✅ [2/4] RBAC semeado (rbacService.seedDefaultRBAC → seed_default_rbac)');
}

// ── PASSO 3 — PF via register (idempotente: reusa se email já existe) ─────────
async function step3RegisterPF(): Promise<string> {
  const existing = await runQueryWithTenant<{ user_id: string }>(
    DEV_TENANT_ID,
    'SELECT user_id FROM users WHERE email = $1 LIMIT 1',
    [DEV_EMAIL.toLowerCase()]
  );
  if (existing) {
    console.log('✅ [3/4] PF já existia — reusando user (idempotente)');
  } else {
    await authService.register(DEV_TENANT_ID, DEV_EMAIL, DEV_PASSWORD, DEV_CPF, DEV_FULLNAME);
    console.log('✅ [3/4] PF registrada (authService.register: global_users→users→identities→actor)');
  }

  const row = await runQueryWithTenant<{ user_id: string }>(
    DEV_TENANT_ID,
    'SELECT user_id FROM users WHERE email = $1 LIMIT 1',
    [DEV_EMAIL.toLowerCase()]
  );
  if (!row) {
    throw new Error('[3/4] PARADA: user não encontrado após register.');
  }

  // Garantia canônica do actor (register cria best-effort com try/catch; aqui forçamos
  // pelo MESMO writer canônico, idempotente — nunca INSERT manual).
  await ensureUserActor(DEV_TENANT_ID, row.user_id);
  console.log('✅ [3/4] actor garantido (ensureUserActor → findOrCreateUserActor, actor_type=user)');

  return row.user_id;
}

// ── PASSO 4 — role admin ao DEV (EXCLUSIVO do bootstrap; idempotente) ─────────
async function step4AssignAdmin(userId: string): Promise<void> {
  await rbacService.assignRoleByName(DEV_TENANT_ID, userId, 'admin');
  console.log('✅ [4/4] role admin atribuída ao DEV (rbacService.assignRoleByName, idempotente)');
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FASE 3A — BOOTSTRAP CANÔNICO DO TENANT DEV');
  console.log('═══════════════════════════════════════════════════════════════');
  assertDevOnly();
  try {
    await assertTargetDatabase();
    await wireSocialPorts();
    await step1Tenant();
    await step2Rbac();
    const userId = await step3RegisterPF();
    await step4AssignAdmin(userId);
    console.log('');
    console.log('✨ Bootstrap DEV canônico concluído.');
    console.log(`   Tenant: ${DEV_TENANT_NAME} (${DEV_TENANT_ID})`);
    console.log(`   Email:  ${DEV_EMAIL}`);
    console.log(`   user_id: ${userId}`);
  } catch (error) {
    console.error('\n💥 Erro durante o bootstrap DEV:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

// Não-automático: só executa quando o arquivo é o entrypoint (nunca em import/boot).
main();
