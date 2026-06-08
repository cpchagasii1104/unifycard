/**
 * E2E F6.5-CANAL3-NÃO-MONEY · IMPACT/LEDGER (DECISION-0113, canal 3 — A privado actor-keyed)
 *
 * /impact/ledger é EXTRATO detalhado (source_type/source_id/metadata/timestamps) = atividade PRIVADA do actor,
 * ≠ /impact/balance (score agregado público = B). Gate antes era SÓ req.user → actor_id da query (client-declared)
 * lido sem validação → leak cross-user (qualquer autenticado lê o extrato de impacto da vítima). Fix (A): prova
 * canRepresentActor(req.user.userId, actor_id) ANTES de getLedgerHistory; 401 sem user / 403 não-representável / 400
 * sem actor_id (preservado). /impact/balance NÃO tocado (B). impact_ledger = score SOCIAL, NÃO bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor nega cross-user (dev próprio=true / estranho=false).
 *   B estrutural — gate (canRepresentActor sobre actor_id) ANTES de getLedgerHistory; 401/403/400; balance intocado.
 *   C escopo — só /impact/ledger gateado; /impact/balance sem canRepresentActor; impact ≠ bank.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-impact-ledger-authority-f6-5-c3i.ts
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

  console.log('\n— A behavioral REAL: o gate (canRepresentActor) nega cross-user no extrato de impacto —');
  record('A1 dev representa o próprio actor → true (extrato do próprio passa)',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o actor do dev → false (extrato alheio → 403)',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B estrutural: gate sobre o actor_id filtrado ANTES de getLedgerHistory —');
  const src = readFileSync(join(process.cwd(), 'src/modules/social/social-2.0.routes.ts'), 'utf8');
  // slice do handler /impact/ledger para isolar do /impact/balance e dos ledgers de social
  const ledgerIdx = src.indexOf("'/impact/ledger'");
  const reputationIdx = src.indexOf("'/reputation/permissions'");
  const ledgerBlock = ledgerIdx >= 0 && reputationIdx > ledgerIdx ? src.slice(ledgerIdx, reputationIdx) : '';
  record('B1 /impact/ledger: canRepresentActor(req.user.userId, actorId) ANTES de getLedgerHistory(',
    gateBeforeRead(ledgerBlock, 'canRepresentActor(req.tenant.id, req.user.userId, actorId)', 'getLedgerHistory('));
  record('B2 /impact/ledger: 403 não-leak quando não representável',
    /Actor não representável pelo usuário autenticado/.test(ledgerBlock));
  record('B3 /impact/ledger: 401 sem req.user + 400 sem actor_id preservados',
    /Não autenticado/.test(ledgerBlock) && /actor_id e actor_type são obrigatórios/.test(ledgerBlock));

  console.log('\n— C escopo: /impact/balance intocado (B público); impact ≠ bank —');
  const balanceIdx = src.indexOf("'/impact/balance'");
  const ledgerIdx2 = src.indexOf("'/impact/ledger'");
  const balanceBlock = balanceIdx >= 0 && ledgerIdx2 > balanceIdx ? src.slice(balanceIdx, ledgerIdx2) : '';
  record('C1 /impact/balance NÃO tem canRepresentActor (B público — score agregado, não gatear)',
    balanceBlock.length > 0 && !/canRepresentActor/.test(balanceBlock));
  const impactSvc = readFileSync(join(process.cwd(), 'src/modules/social/impact.service.ts'), 'utf8');
  record('C2 impact_ledger é score SOCIAL, NÃO bank (zero bank_ledger/bank_transactions no service)',
    /FROM impact_ledger/.test(impactSvc) && !/bank_ledger|bank_transactions|bank_splits/.test(impactSvc));

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
  console.log('✨ Impact/ledger gateado (canRepresentActor sobre actor_id; balance=B intocado; impact≠bank) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
