/**
 * E2E DECISION-0113 canal-5 financeiro by-id · account read authority
 *
 * GET /:accountId e /:accountId/balance vazavam conta/saldo por accountId (só req.tenant). Agora herdam
 * assertAccountReadAuthority: accountId = bank_accounts.id; dono = bank_accounts.actor_id (via bankAccountService,
 * NÃO o toLegacyAccount que dropa actorId). actor != null → canRepresentActor(actor_id) (403); actor == null
 * (system/escrow = cofre) → financial:view_all_ledger (admin), senão 403. 404 inexistente; 401 sem user.
 *
 * Prova:
 *   A behavioral REAL — getAccountById por id traz actorId (conta actor) ou undefined (system); canRepresentActor
 *     decide o branch actor (dono=true / estranho=false); saldo continua vindo de bank_ledger (calculateBalance).
 *   B estrutural — helper + branch actor/system; 2 rotas chamam o helper ANTES do read; usa account.actorId; /owner intocado.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-account-read-authority-f6-5-c5-financial.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const MARKER = 'E2E-ACCT';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

async function main(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const dev = await pool.query<{ id: string }>(`SELECT id::text AS id FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ id: string }>(`SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`, [TENANT_ID, devUserId]);
  const devActor = devActorRow.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  await pool.query(`DELETE FROM bank_accounts WHERE tenant_id=$1 AND owner_id LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  const actorAcctId = randomUUID();
  const sysAcctId = randomUUID();
  try {
    // conta ACTOR-owned (actor_id = devActor)
    await pool.query(
      `INSERT INTO bank_accounts (id, tenant_id, actor_id, owner_type, owner_id, account_type) VALUES ($1,$2,$3,'actor',$4,'credit')`,
      [actorAcctId, TENANT_ID, devActor, `${MARKER}-actor-${actorAcctId}`]);
    // conta SYSTEM (actor_id NULL = cofre da plataforma)
    await pool.query(
      `INSERT INTO bank_accounts (id, tenant_id, actor_id, owner_type, owner_id, account_type) VALUES ($1,$2,NULL,'system',$3,'credit')`,
      [sysAcctId, TENANT_ID, `${MARKER}-sys-${sysAcctId}`]);

    const { bankAccountService } = await import('../modules/bank/bank-account.service');
    const { authorizationService } = await import('../core/authorization/authorization.service');

    console.log('\n— A behavioral REAL: dono via bank_accounts.actor_id; lookup por bank_accounts.id —');
    const actorAcct = await bankAccountService.getAccountById(TENANT_ID, actorAcctId);
    const sysAcct = await bankAccountService.getAccountById(TENANT_ID, sysAcctId);
    const ghost = await bankAccountService.getAccountById(TENANT_ID, randomUUID());
    record('A1 getAccountById(actorAcctId) traz actorId = devActor (dono autoritativo, não ownerId legado)',
      actorAcct?.actorId === devActor, `actorId=${actorAcct?.actorId}`);
    record('A2 getAccountById(sysAcctId) → actorId undefined (system/escrow = cofre, sem actor)',
      !sysAcct?.actorId, `actorId=${sysAcct?.actorId}`);
    record('A3 getAccountById(inexistente) → null (→ 404)', ghost === null);
    record('A4 branch actor: dev representa o devActor → true (dono acessa)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A5 branch actor: estranho NÃO representa o devActor → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
  } finally {
    await pool.query(`DELETE FROM bank_accounts WHERE tenant_id=$1 AND owner_id LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  }

  console.log('\n— B estrutural —');
  const route = readFileSync(join(process.cwd(), 'src/core/economy/accounts/account.routes.ts'), 'utf8');
  const acctBlock = route.slice(route.indexOf("'/:accountId'"), route.indexOf("'/:accountId/balance'"));
  const balBlock = route.slice(route.indexOf("'/:accountId/balance'"), route.indexOf("'/owner/:ownerId'"));
  record('B1 helper assertAccountReadAuthority: branch actor (canRepresentActor(account.actorId)) + system (financial:view_all_ledger)',
    /if \(account\.actorId\)/.test(route) && /canRepresentActor\(tenantId, callerUserId, account\.actorId\)/.test(route)
    && /'financial:view_all_ledger'/.test(route));
  record('B2 GET /:accountId chama assertAccountReadAuthority ANTES de accountService.getAccountById',
    acctBlock.indexOf('assertAccountReadAuthority(') >= 0 && acctBlock.indexOf('assertAccountReadAuthority(') < acctBlock.indexOf('accountService.getAccountById('));
  record('B3 GET /:accountId/balance chama assertAccountReadAuthority ANTES do read',
    balBlock.indexOf('assertAccountReadAuthority(') >= 0 && balBlock.indexOf('assertAccountReadAuthority(') < balBlock.indexOf('accountService.getAccountById('));
  record('B4 gate usa o objeto RAW (bankAccountService) e account.actorId — NÃO ownerId legado/accountId',
    /bankAccountService\.getAccountById\(tenantId, accountId\)/.test(route) && !/canRepresentActor\([^)]*ownerId/.test(route) && !/canRepresentActor\([^)]*accountId\)/.test(route));
  record('B5 saldo continua via accountService (bank_ledger/calculateBalance) — lógica de saldo não alterada',
    /balanceCents: account\.balanceCents/.test(route));
  record('B6 GET /owner/:ownerId NÃO tocado (resíduo separado)',
    !/assertAccountReadAuthority/.test(route.slice(route.indexOf("'/owner/:ownerId'"))));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ account read gateado (actor→canRepresentActor; system/escrow→financial:view_all_ledger; 404/401) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
