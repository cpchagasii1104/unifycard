/**
 * E2E F6.5-CANAL3-MONEY — direct-query actor readers, cluster money (DECISION-0113, 3º padrão)
 *
 * 3º padrão (sweep Yala): handlers leem `req.query.actor_id`/`actorId`/`owner_actor_id` DIRETO, fora do
 * primitivo resolveActiveActorFromRequest → o fix `9996cbd2` não os alcança. Cluster money classificado de
 * 1ª mão (lição: money à mão, agente é breadth):
 *   bank-http GET /bank/balance?actorId  → JÁ GATEADO (B): actorCapabilitiesService.resolveForUser(actorId,userId)
 *     valida autoridade sobre o actorId específico → 403 se sem authority. NÃO é leak. (modelo correto)
 *   invoice  GET /invoices?actorId&recipientActorId → A: `financial:view_ledger` (escopo per-entidade, inclui
 *     MANAGER) é RBAC-only no actor do CALLER → exige canRepresentActor sobre o actorId/recipientActorId.
 *   payout   GET /payouts/orders?actorId            → F-OK (CORREÇÃO 2026-06-08): `financial:execute_payout`
 *     (operador financeiro: papel OWNER/ADMIN/FINANCE + capability `can_hold_assets`). PROVA ESTRUTURAL do
 *     over-gate: a rota SEM actorId já lista TODAS as orders do tenant → o `?actorId` é subconjunto; gatear só
 *     o subconjunto com canRepresentActor é incoerente → REMOVIDO. Isolamento multi-empresa = F própria (não aqui).
 *   reporting GET /reporting/financial-kpis?actorId → F-OK (CORREÇÃO 2026-06-08): exige `financial:view_all_ledger`
 *     = permissão CROSS-ACTOR por definição (OWNER/ADMIN/FINANCE, manual). canRepresentActor era OVER-GATE
 *     (bloqueava admin legítimo) → REMOVIDO. actorId é filtro autorizado pela permissão view-all, não spoof.
 * Régua: view_ledger (escopo) → canRepresentActor correto; view_all_ledger (cross-actor) → canRepresentActor over-gate.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor nega cross-user (a decisão do gate de escopo, ex.: invoice).
 *   B estrutural — invoice gateia o actorId da query ANTES de listar; reporting NÃO (over-gate removido,
 *     view_all_ledger é a autoridade); payout intocado; bank-http=B (resolveForUser).
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-canal3-money-direct-query-f6-5-c3m.ts
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

  console.log('\n— A behavioral REAL: o gate (canRepresentActor) nega cross-user —');
  record('A1 dev representa o próprio actor → true (filtro por actor próprio passa)',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o actor do dev → false (filtro alheio → 403)',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B estrutural: gate do actorId da query ANTES da leitura (money A) —');
  const inv = readFileSync(join(process.cwd(), 'src/modules/invoicing/invoice.routes.ts'), 'utf8');
  const pay = readFileSync(join(process.cwd(), 'src/modules/payout/payout.routes.ts'), 'utf8');
  const rep = readFileSync(join(process.cwd(), 'src/modules/reporting/reporting.routes.ts'), 'utf8');
  const bank = readFileSync(join(process.cwd(), 'src/core/unifybank/bank-http.routes.ts'), 'utf8');

  record('B1 invoice: canRepresentActor(actorId+recipientActorId da query) antes de listInvoices(',
    gateBeforeRead(inv, 'canRepresentActor(tenantId, callerUserId, partyId)', 'listInvoices(')
    && /\[req\.query\.actorId, req\.query\.recipientActorId\]/.test(inv));
  record('B2 payout: SEM chamada canRepresentActor( (over-gate removido) + preHandler execute_payout intacto + actorId segue filtro',
    !/canRepresentActor\(/.test(pay)
    && /'financial:execute_payout'/.test(pay)
    && /actorId: req\.query\.actorId/.test(pay));
  // F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION (2026-06-13): a autoridade do reporting migrou do
  // requirePermission legado (financial:view_all_ledger via organization_members ausente) para
  // company_users.can_view_reports (canUserPerformCompanyCapability). Subject server-side (req.user.id);
  // SEM over-gate canRepresentActor; actorId segue FILTRO de query.
  record('B3 reporting: SEM canRepresentActor( (over-gate removido) + gate R2 can_view_reports (subject req.user.id) + actorId segue filtro',
    !/canRepresentActor\(/.test(rep)
    && /canUserPerformCompanyCapability\(\s*[\s\S]*?,\s*userId,\s*'can_view_reports'/.test(rep)
    && /const userId = req\.user\?\.id/.test(rep)
    && /actorId: req\.query\.actorId/.test(rep));
  record('B4 invoice: actorId filtrado nu → 403 "Sem autoridade sobre o actor filtrado" (escopo view_ledger; reporting+payout reclassificados F-OK, fora)',
    /Sem autoridade sobre o actor filtrado/.test(inv));
  record('B5 bank-http /bank/balance = JÁ B (gateado via actorCapabilitiesService.resolveForUser — NÃO tocado)',
    /actorCapabilitiesService\.resolveForUser\(tenantId, actorIdParam, userId\)/.test(bank)
    && /User has no authority over this actor/.test(bank));

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
  console.log('✨ Canal 3 money direct-query (invoice/payout/reporting gateados; bank-http já B) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
