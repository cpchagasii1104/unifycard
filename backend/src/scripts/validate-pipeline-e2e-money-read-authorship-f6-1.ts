/**
 * E2E F-MONEY-READ-AUTHORSHIP-GATE-F6_1 (DECISION-0113 fatia 6 — leitura cross-user, cluster money)
 *
 * 5 reads financeiros liam dado de actor keyed em `req.actionContext.actorId` (spoofável), SEM gate:
 *   social-2.0   GET /social/ledger            → socialLedgerService.getUserLedger
 *   social-2.0   GET /social/ledger/summary    → socialLedgerService.getUserLedgerSummary
 *   identity     GET /identity/wallet/actor-statement → actorWalletStatementService.getActorWalletStatement
 *   identity     GET /identity/wallet          → accountService.getAccountsByGlobalUserId (via globalUserId)
 *   identity     GET /identity/ledger          → bank read port getWalletSummaryByActorId/listRecent…
 * Fix: cada handler prova `canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId)`
 * ANTES do read (fail-closed → 403 não-leak). Reads (sem mutação): nada a limpar.
 *
 * Prova:
 *   A behavioral — o primitivo nega cross-user: canRepresentActor(dev→próprio actor)=true;
 *     canRepresentActor(estranho→actor do dev)=false (é o gate que cada rota passou a aplicar).
 *   B estrutural — em cada um dos 5 handlers, o gate canRepresentActor aparece ANTES da chamada de leitura.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-money-read-authorship-f6-1.ts
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

// gate aparece ANTES do read no MESMO arquivo (ordenação textual = wiring gate-antes-da-leitura).
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

  console.log('\n— A behavioral: o gate (canRepresentActor) nega cross-user —');
  record('A1 dev representa o próprio actor → true',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o actor do dev → false (read alheio seria 403)',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B estrutural: gate canRepresentActor ANTES da leitura em cada um dos 5 handlers —');
  const socialSrc = readFileSync(join(process.cwd(), 'src/modules/social/social-2.0.routes.ts'), 'utf8');
  const identitySrc = readFileSync(join(process.cwd(), 'src/core/identity/identity.routes.ts'), 'utf8');

  record('B1 social /ledger: gate antes de getUserLedger(',
    gateBeforeRead(socialSrc, 'canReadLedger = await authorizationService.canRepresentActor', 'getUserLedger('));
  record('B2 social /ledger/summary: gate antes de getUserLedgerSummary(',
    gateBeforeRead(socialSrc, 'canReadSummary = await authorizationService.canRepresentActor', 'getUserLedgerSummary('));
  record('B3 identity /wallet/actor-statement: gate antes de getActorWalletStatement(',
    gateBeforeRead(identitySrc, 'canReadStatement = await authorizationService.canRepresentActor', 'getActorWalletStatement('));
  record('B4 identity /wallet: gate antes de getAccountsByGlobalUserId(',
    gateBeforeRead(identitySrc, 'canReadWallet = await authorizationService.canRepresentActor', 'getAccountsByGlobalUserId('));
  record('B5 identity /ledger: gate antes de getWalletSummaryByActorId(',
    gateBeforeRead(identitySrc, 'canReadAggLedger = await authorizationService.canRepresentActor', 'getWalletSummaryByActorId('));

  // sanidade: a assinatura canônica do primitivo é (tenantId, userId, actorId)
  record('B6 assinatura canônica canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId) nos 2 arquivos',
    /canRepresentActor\(req\.tenant\.id, req\.user\.userId, req\.actionContext\.actorId\)/.test(socialSrc)
    && /canRepresentActor\(req\.tenant\.id, req\.user\.userId, req\.actionContext\.actorId\)/.test(identitySrc));

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
  console.log('✨ Money read authorship gate F6.1 (5 reads financeiros: canRepresentActor antes da leitura) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
