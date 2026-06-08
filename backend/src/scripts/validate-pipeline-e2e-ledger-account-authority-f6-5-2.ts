/**
 * E2E F6.5.2 — ledger financeiro (DECISION-0113, resíduo de leituras operacionais — money)
 *
 * Antes: `requireLedgerPermission` é gate FALSO (só seta limited/full, nunca bloqueia ownership) →
 *   GET /ledger/accounts/:accountId/balance lê `req.params.accountId` (IDOR financeiro);
 *   GET /ledger/entries?accountId/contextId/<vazio> lê conta/contexto/tenant inteiro sem dono.
 * Fix (decisão Clayton, Opção 1 com trava forte):
 *   actor-owned (ownerType='user' + actorId) → canRepresentActor(req.user.userId, account.actorId) ANTES.
 *   system/escrow / sem actor / inexistente / list-all / by-contextId → fail-closed 403 (gate admin real é
 *     frente própria: DT-LEDGER-ADMIN-READ-GATE-MISSING). Permissão genérica NÃO autoriza accountId arbitrário.
 *
 * Prova (reproduz a decisão do helper `assertLedgerAccountAuthority` = getAccountById + canRepresentActor):
 *   A behavioral primitivo — canRepresentActor nega cross-user.
 *   B behavioral por conta (se DEV tiver) — actor-owned: dono=true/estranho=false; system/escrow: ownerType≠'user' → 403.
 *   C estrutural — gate antes da leitura nos 2 reads; list-all → 403; helper usa getAccountById+canRepresentActor.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-ledger-account-authority-f6-5-2.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }
function gateBeforeRead(src: string, gateMarker: string, readMarker: string): boolean {
  const g = src.indexOf(gateMarker);
  const r = src.indexOf(readMarker);
  return g >= 0 && r >= 0 && g < r;
}

async function main(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const dev = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ actor_id: string }>(
    `SELECT actor_id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]
  );
  const devActor = devActorRow.rows[0]?.actor_id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  const { authorizationService } = await import('../core/authorization/authorization.service');
  const { bankAccountRepository } = await import('../modules/bank/bank-account.repository');

  console.log('\n— A behavioral: o gate (canRepresentActor) nega cross-user —');
  record('A1 dev representa o próprio actor → true',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o actor do dev → false (read alheio seria 403)',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B behavioral por conta (decisão real do helper: getAccountById + canRepresentActor) —');
  // actor-owned: precisa de um user com user-actor + conta actor-owned.
  const actorAcct = await pool.query<{ id: string; actor_id: string; user_id: string }>(
    `SELECT ba.id::text AS id, ba.actor_id::text AS actor_id, a.user_id::text AS user_id
       FROM bank_accounts ba JOIN actors a ON a.actor_id = ba.actor_id AND a.tenant_id = ba.tenant_id
      WHERE ba.tenant_id=$1 AND ba.owner_type='actor' AND ba.actor_id IS NOT NULL AND a.user_id IS NOT NULL
      LIMIT 1`,
    [TENANT_ID]
  );
  if (actorAcct.rowCount && actorAcct.rows[0]) {
    const acc = actorAcct.rows[0];
    const resolved = await bankAccountRepository.getAccountById(TENANT_ID, acc.id);
    record('B1 conta actor-owned resolve ownerType=user + actorId (getAccountById)',
      !!resolved && (resolved as any).ownerType === 'user' && (resolved as any).actorId === acc.actor_id);
    record('B2 dono real da conta representa o actor → leitura LIBERADA',
      (await authorizationService.canRepresentActor(TENANT_ID, acc.user_id, acc.actor_id)) === true);
    record('B3 estranho NÃO representa → leitura BLOQUEADA (403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, acc.actor_id)) === false);
  } else {
    note('sem conta actor-owned em DEV (carteira lazy) — B1-B3 N/A (não simulado; cobertura estrutural+primitivo).');
  }
  // system/escrow: helper rejeita por ownerType !== 'user' (fail-closed), SEM consultar canRepresentActor.
  const sysAcct = await pool.query<{ id: string; owner_type: string }>(
    `SELECT id::text AS id, owner_type FROM bank_accounts WHERE tenant_id=$1 AND owner_type IN ('system','escrow') LIMIT 1`,
    [TENANT_ID]
  );
  if (sysAcct.rowCount && sysAcct.rows[0]) {
    const resolved = await bankAccountRepository.getAccountById(TENANT_ID, sysAcct.rows[0].id);
    record('B4 conta system/escrow: ownerType ≠ user → helper fail-closed 403 (não liberada por acidente)',
      !!resolved && (resolved as any).ownerType !== 'user');
  } else {
    note('sem conta system/escrow em DEV — B4 N/A (cobertura estrutural: branch non-actor → 403).');
  }

  console.log('\n— C estrutural: gate de autoridade ANTES da leitura + list-all fail-closed —');
  const src = readFileSync(join(process.cwd(), 'src/modules/ledger/ledger.routes.ts'), 'utf8');
  record('C1 balance: assertLedgerAccountAuthority ANTES de calculateBalance(',
    gateBeforeRead(src, 'assertLedgerAccountAuthority(req, reply, tenantId, req.params.accountId)', 'calculateBalance(tenantId, req.params.accountId)'));
  record('C2 entries: list-all (sem accountId) → 403 fail-closed ANTES de qualquer leitura',
    /if \(!filters\.accountId\) \{[\s\S]*?status\(403\)/.test(src));
  record('C3 entries: assertLedgerAccountAuthority ANTES de getEntriesByAccount(',
    gateBeforeRead(src, 'assertLedgerAccountAuthority(req, reply, tenantId, filters.accountId)', 'getEntriesByAccount('));
  record('C4 helper resolve dono via getAccountById e gateia actor-owned via canRepresentActor',
    /getAccountById\(tenantId, accountId\)/.test(src)
    && /account\.ownerType !== 'user' \|\| !account\.actorId/.test(src)
    && /canRepresentActor\(tenantId, userId, account\.actorId\)/.test(src));
  record('C5 non-actor é fail-closed (sem canRepresentActor): ownerType≠user → 403 (gate admin = frente própria)',
    /Conta não acessível por este usuário/.test(src) && /DT-LEDGER-ADMIN-READ-GATE-MISSING/.test(src));

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
  console.log('✨ Ledger account authority F6.5.2 (dono real antes da leitura; non-actor fail-closed) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
