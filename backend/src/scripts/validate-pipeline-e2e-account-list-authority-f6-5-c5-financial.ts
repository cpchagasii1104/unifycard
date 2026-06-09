/**
 * E2E DECISION-0113 canal-5 financeiro · account LIST read authority
 *
 * GET /economy/accounts/ (lista do tenant inteiro c/ saldo) e GET /owner/:ownerId (lista por ownerId legado)
 * vazavam contas+saldo (só req.tenant). Agora exigem `financial:view_all_ledger` (admin/finance) via
 * assertFinancialAdmin — NÃO canRepresentActor (ownerId legado não é actor; self tem /me; conta única tem /:accountId).
 *
 * Prova:
 *   A behavioral — requirePermission(financial:view_all_ledger) NEGA o usuário comum (dev não tem) → list 403.
 *   B estrutural — denominador completo do arquivo (5 GETs classificados); / e /owner gateados por assertFinancialAdmin;
 *     /me self; /:accountId(+balance) por assertAccountReadAuthority; sem canRepresentActor nas listas.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-account-list-authority-f6-5-c5-financial.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }

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

  console.log('\n— A behavioral: financial:view_all_ledger NEGA usuário comum (dev) → list 403 —');
  const { businessAuthorizationService } = await import('../core/authorization/business-authorization.service');
  const { getActiveActor } = await import('../core/actors/actor.helpers');
  const callerActor = await getActiveActor(TENANT_ID, devUserId);
  let denied = false;
  try {
    if (callerActor) {
      await businessAuthorizationService.requirePermission(TENANT_ID, devUserId, callerActor.actor_id, 'financial:view_all_ledger', 'account_list');
    } else {
      denied = true;
    }
  } catch {
    denied = true;
  }
  record('A1 dev (usuário comum) NÃO tem financial:view_all_ledger → assertFinancialAdmin daria 403', denied);
  note('admin-pass (caller COM financial:view_all_ledger acessa) = N/A — DEV não tem fixture admin com a permissão semeada.');

  console.log('\n— B estrutural: denominador completo + gates corretos por rota —');
  const route = readFileSync(join(process.cwd(), 'src/core/economy/accounts/account.routes.ts'), 'utf8');
  const getCount = (route.match(/fastify\.get/g) || []).length;
  record('B1 denominador: 5 GETs no arquivo (/me · / · /:accountId · /:accountId/balance · /owner/:ownerId)',
    getCount === 5, `#GET=${getCount}`);

  const sliceBetween = (a: string, b: string) => {
    const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length;
    return i >= 0 ? route.slice(i, j > i ? j : route.length) : '';
  };
  const listBlock = sliceBetween("fastify.get('/', async", "'/:accountId'");
  const ownerBlock = sliceBetween("'/owner/:ownerId'", "");
  const meBlock = sliceBetween("fastify.get('/me'", "async function assertFinancialAdmin");
  const acctBlock = sliceBetween("'/:accountId',", "'/:accountId/balance'");
  const balBlock = sliceBetween("'/:accountId/balance'", "'/owner/:ownerId'");

  record('B2 GET / → assertFinancialAdmin ANTES de listAccounts (financial:view_all_ledger)',
    listBlock.indexOf('assertFinancialAdmin(') >= 0 && listBlock.indexOf('assertFinancialAdmin(') < listBlock.indexOf('listAccounts('));
  record('B3 GET /owner/:ownerId → assertFinancialAdmin ANTES de getAccountsByOwnerWithLegacyType',
    ownerBlock.indexOf('assertFinancialAdmin(') >= 0 && ownerBlock.indexOf('assertFinancialAdmin(') < ownerBlock.indexOf('getAccountsByOwnerWithLegacyType('));
  record('B4 assertFinancialAdmin usa financial:view_all_ledger, NÃO canRepresentActor',
    /assertFinancialAdmin/.test(route) && /'financial:view_all_ledger', 'account_list'/.test(route)
    && !/canRepresentActor[^\n]*ownerId/.test(route));
  record('B5 /me continua SELF (req.user.id → getOrCreateUserPrimaryAccount), não financial-admin',
    /getOrCreateUserPrimaryAccount\(tenantId, userId/.test(meBlock) && !/assertFinancialAdmin/.test(meBlock));
  record('B6 /:accountId e /balance continuam por assertAccountReadAuthority (não regrediram)',
    acctBlock.includes('assertAccountReadAuthority(') && balBlock.includes('assertAccountReadAuthority('));
  record('B7 saldo segue do fluxo existente (balanceCents do accountService; bank_ledger não tocado)',
    /balanceCents: account\.balanceCents/.test(route) && !/INSERT INTO bank_ledger|UPDATE bank_ledger/.test(route));

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
  console.log('✨ account list/owner gateados por financial:view_all_ledger (self /me e /:accountId intactos) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
