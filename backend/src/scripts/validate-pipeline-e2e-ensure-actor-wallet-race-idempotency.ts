// validate-pipeline-e2e-ensure-actor-wallet-race-idempotency.ts
// DT-ENSURE-ACTOR-WALLET-NOT-IDEMPOTENT-UNDER-RACE (D_FIX Onda 2, 2026-07-05).
// Prova REAL de concorrência: 2 chamadas simultâneas de ensureActorWalletAccount pro MESMO actor
// devem devolver a MESMA conta, sem erro cru de violação de unicidade.
// 🔒 DB EFÊMERA. Orquestrado por scripts/run-ensure-actor-wallet-race-idempotency-ephemeral.ps1.
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '@core/database/pool';
import { tenantService } from '@core/tenants/tenant.service';
import { rbacService } from '@core/rbac/rbac.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME;

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/ephemeral|smoke|test|race/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let passed = 0;
let failed = 0;
function record(label: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); }
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Race Idempotency Test', slug: `race-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const { socialPortsRegistry } = await import('@core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);

  const globalId = randomUUID();
  const userId = randomUUID();
  const cpf = String(Date.now() % 100000000).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, 'Race Test']);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, TENANT_ID, globalId, `${userId}@e2e.local`]);
  const actorRepo = socialPortsRegistry.getActorRepository();
  const actorId = (await actorRepo.findOrCreateUserActor(TENANT_ID, userId)).actor_id;

  const { bankAccountService } = await import('../modules/bank/bank-account.service');

  const CONCURRENCY = Number(process.env.RACE_CONCURRENCY || 5);
  console.log(`\n— 1: ${CONCURRENCY} chamadas concorrentes de ensureActorWalletAccount pro MESMO actor —`);
  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, () => bankAccountService.ensureActorWalletAccount(TENANT_ID, actorId, 'BRL'))
  );
  const rejected = results.filter((r) => r.status === 'rejected');
  record('1a nenhuma chamada rejeitada (sem erro cru de unicidade)', rejected.length === 0, rejected.map((r) => (r as PromiseRejectedResult).reason?.message).join('; '));

  const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ accountId: string }>[];
  const ids = new Set(fulfilled.map((r) => r.value.accountId));
  record('1b todas as 5 devolvem a MESMA conta (idempotência real sob corrida)', ids.size === 1, `ids únicos=${ids.size}`);

  const countRow = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM bank_accounts WHERE tenant_id=$1 AND owner_id=$2`,
    [TENANT_ID, `${actorId}:actor_wallet`]
  );
  record('1c só 1 linha física criada em bank_accounts (não 5)', countRow.rows[0]?.n === '1', `linhas=${countRow.rows[0]?.n}`);

  console.log(`\n══════════════════════════════════════════\nRESULTADO: ${passed}/${passed + failed} verdes`);
  if (failed > 0) { console.error(`❌ ${failed} falha(s)`); process.exit(1); }
  console.log('✨ ensureActorWalletAccount idempotente sob corrida real — verde.');
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Erro não tratado:', err);
  process.exit(1);
});
