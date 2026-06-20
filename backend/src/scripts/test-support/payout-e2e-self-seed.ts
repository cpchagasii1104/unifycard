// backend/src/scripts/test-support/payout-e2e-self-seed.ts
//
// DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED — semeia, SÓ em DB efêmero, o grafo mínimo que os E2Es
// F2/F3/C3/C7 esperam encontrar (hoje dev-seeded). Usa EXCLUSIVAMENTE caminhos canônicos de
// serviço (authService.register → global_users→users→identities→actor + ensureUserActor +
// bankAccountService.*). NUNCA roda contra unificard_dev. NÃO ativa payout, NÃO semeia
// financial_approval real, NÃO liga worker.
//
// O cadastro orgânico resolve o tenant SERVER-SIDE (unificard-inicial); este helper DESCOBRE o
// tenant efetivo a partir do user registrado e alinha actors/contas/E2Es a ele. Emite o tenant
// efetivo em scripts/.tmp-payout-e2e-tenant.txt para o runner repassar como E2E_TENANT_ID.

import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../core/database/pool';
import { rbacService } from '../../core/rbac/rbac.service';
import { authService } from '../../core/auth/auth.service';
import { ensureUserActor } from '../../modules/identity/actor-writer.service';
import { bankAccountService } from '../../modules/bank/bank-account.service';
import { bankAccountRepository } from '../../modules/bank/bank-account.repository';
import { bankTransactionService } from '../../modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '../../modules/bank/financial-authorship.helper';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED_DB = process.env.EXPECTED_DATABASE_NAME || '';
const TENANT_OUT_FILE = join(process.cwd(), 'scripts', '.tmp-payout-e2e-tenant.txt');

const DEBTOR = { email: 'payout-debtor@e2e.internal', cpf: '11144477735', name: 'Payout Debtor E2E' };
const CREDITOR = { email: 'payout-creditor@e2e.internal', cpf: '52998224725', name: 'Payout Creditor E2E' };
const PASSWORD = '123456';

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('Refusing to run payout/recovery E2E self-seed against non-ephemeral database.');
  if (!EXPECTED_DB || db !== EXPECTED_DB) throw new Error(`Refusing self-seed: db="${db}" != EXPECTED "${EXPECTED_DB}".`);
  if (!/payout|recovery|wallet|test|ephemeral/i.test(db)) throw new Error(`Refusing self-seed: db="${db}" not ephemeral.`);
  console.log(`🔒 self-seed DB efêmera confirmada: ${db}`);
}

async function wireSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../../core/social/ports-registry');
  const a = await import('../../modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(a.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(a.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(a.eventFeedHandlersAdapter);
}

/** Registra PF (tenant resolvido server-side) e retorna {userId(=users.id), tenantId}. */
async function registerPF(p: { email: string; cpf: string; name: string }): Promise<{ userId: string; tenantId: string }> {
  const email = p.email.toLowerCase();
  const existing = await pool.query<{ id: string; tenant_id: string }>(`SELECT id, tenant_id FROM users WHERE email=$1 LIMIT 1`, [email]);
  if (!existing.rows[0]) {
    await authService.register(undefined, p.email, PASSWORD, p.cpf, p.name);
  }
  const row = (await pool.query<{ id: string; tenant_id: string }>(`SELECT id, tenant_id FROM users WHERE email=$1 LIMIT 1`, [email])).rows[0];
  if (!row) throw new Error(`PF não encontrada após register: ${p.email}`);
  return { userId: row.id, tenantId: row.tenant_id };
}

async function resolveActorId(tenantId: string, userId: string): Promise<string> {
  const r = (await pool.query<{ id: string }>(
    `SELECT id FROM actors WHERE tenant_id=$1 AND user_id=$2 AND actor_type='user' LIMIT 1`, [tenantId, userId]
  )).rows[0];
  if (!r) throw new Error(`actor não encontrado para user ${userId} no tenant ${tenantId}`);
  return r.id;
}

/**
 * Funding COVERAGE-AWARE (não burla o invariant): credita capacidade numa conta SYSTEM via caminho canônico
 * (createSimpleTransaction → crédito a conta system é coverage-exempt). Com capacidade no system, os créditos de
 * teste dos E2Es a contas não-system ficam sob o limite de 80% (system_coverage). NÃO usa raw insert em bank_*,
 * NÃO desliga trigger, NÃO usa session_replication_role. "money de teste nasce lastreado por caminho canônico."
 */
async function fundSystemCoverage(tenantId: string, actingActorId: string): Promise<void> {
  let sys = await bankAccountService.getSystemAccount(tenantId, 'reserve');
  if (!sys) {
    await bankAccountRepository.createAccount(tenantId, {
      ownerId: `system:reserve:${tenantId}`, ownerType: 'system', accountType: 'credit', currency: 'BRL',
    });
    sys = await bankAccountService.getSystemAccount(tenantId, 'reserve');
  }
  if (!sys) throw new Error('SELF-SEED GAP: conta system:reserve ausente.');
  await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId: uuidv4(),
    referenceType: 'e2e_system_liquidity_mint',
    toAccountId: sys.accountId,
    amountCents: 50_000_000,
    currency: 'BRL',
    transactionType: 'deposit',
    description: 'E2E payout-proof mint system coverage capacity',
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({ actingForAccountId: sys.accountId, actingForActorId: actingActorId }),
  });
  console.log('   system coverage capacity mintada (caminho canônico; sem raw insert/trigger bypass).');
}

async function ensureRecoveryConcept(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.concept_governance','true',true)`);
    await client.query(`INSERT INTO domains (domain_key) VALUES ('financeiro-reversal') ON CONFLICT (domain_key) DO NOTHING`);
    await client.query(`INSERT INTO concepts (slug, domain) VALUES ('actor-wallet-recovery','financeiro-reversal') ON CONFLICT (domain, slug) DO NOTHING`);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}

export async function ensurePayoutE2EBaseFixtures(): Promise<string> {
  await assertEphemeral();
  await wireSocialPorts();

  // Cadastra debtor; o tenant efetivo é resolvido server-side (unificard-inicial).
  const debtor = await registerPF(DEBTOR);
  const tenantId = debtor.tenantId;
  console.log(`   tenant efetivo (server-side) = ${tenantId}`);
  await rbacService.seedDefaultRBAC(tenantId);
  const creditor = await registerPF(CREDITOR);
  if (creditor.tenantId !== tenantId) throw new Error(`creditor caiu em tenant diferente (${creditor.tenantId} != ${tenantId}).`);

  await ensureUserActor(tenantId, debtor.userId);
  await ensureUserActor(tenantId, creditor.userId);
  const debtorActorId = await resolveActorId(tenantId, debtor.userId);
  const creditorActorId = await resolveActorId(tenantId, creditor.userId);

  // Contas via serviço canônico (sem referência direta a tabelas SSOT bancárias).
  const aw = await bankAccountService.ensureActorWalletAccount(tenantId, debtorActorId);
  const uw = await bankAccountService.ensureUserWalletForActor(tenantId, creditorActorId);
  await bankAccountService.ensurePlatformAccounts(tenantId);
  await fundSystemCoverage(tenantId, debtorActorId);
  await ensureRecoveryConcept();

  // Verificação via serviço (getFixtures/buildFixture validam o join no runtime do E2E).
  const settlement = await bankAccountService.getPlatformLifecycleAccount(tenantId, 'bank_settlement', 'BRL');
  console.log(`   actor_wallet=${!!aw} user_wallet=${!!uw} bank_settlement=${!!settlement}`);
  if (!aw) throw new Error('SELF-SEED GAP: actor_wallet ausente.');
  if (!uw) throw new Error('SELF-SEED GAP: user_wallet ausente.');
  if (!settlement) throw new Error('SELF-SEED GAP: bank_settlement ausente.');

  writeFileSync(TENANT_OUT_FILE, tenantId, 'utf-8');
  console.log(`✨ payout-e2e self-seed completo. tenant=${tenantId} (emitido em .tmp-payout-e2e-tenant.txt)`);
  return tenantId;
}

if (process.argv[1] && process.argv[1].includes('payout-e2e-self-seed')) {
  ensurePayoutE2EBaseFixtures()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (e) => { console.error('💥 self-seed falhou:', e instanceof Error ? e.message : e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
}
