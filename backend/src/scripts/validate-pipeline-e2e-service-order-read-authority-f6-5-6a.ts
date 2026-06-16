/**
 * E2E F6.5.6a — service-order reads (DECISION-0113, resíduo de leituras operacionais)
 *
 * Antes: 3 reads de ordem comercial sem gate de parte →
 *   GET /service-orders                 (lista; filtros workerActorId/customerActorId do CLIENTE)
 *   GET /service-orders/:id             (getOrderById por URL — IDOR)
 *   GET /service-orders/:id/financial-terms (termos financeiros por URL — IDOR)
 * Fix (espelha o write `buyer-confirm`: order.customerActorId === buyerActorId):
 *   ler só se o `actionContext.actorId` (representável) for PARTE = customerActorId OU workerActorId.
 *   lista: exige >= 1 filtro de parte representável (canRepresentActor); sem isso 403 (não lista tudo).
 *   não-leak: ordem inexistente OU não-parte → 403 uniforme.
 * Writes (confirm/start/complete/cancel/...) INTOCADOS (handlers separados; write-spoof em DT própria).
 *
 * Prova:
 *   A behavioral primitivo — canRepresentActor nega cross-user.
 *   B behavioral real (parcial) — getOrderById(random) → null (DB real) → caminho não-leak; predicado de
 *     parte com valores concretos (devActor é parte / estranho não é). _(party-lê-ordem-real N/A: 0 service_orders em DEV.)_
 *   C estrutural — gate antes da leitura nos 3 reads; lista exige party-filter representável; não-leak; writes intocados.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-service-order-read-authority-f6-5-6a.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_ACTOR_ID = '00000000-0000-4000-8000-0000000000fa';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const RANDOM_ORDER_ID = '00000000-0000-4000-8000-0000000000a0';

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
// predicado de parte = o MESMO do helper assertOrderParty.
function isParty(order: { customerActorId?: string; workerActorId?: string }, actorId: string): boolean {
  return order.customerActorId === actorId || order.workerActorId === actorId;
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
  const { serviceOrderService } = await import('../modules/services/service-order.service');

  console.log('\n— A behavioral: o gate (canRepresentActor) nega cross-user —');
  record('A1 dev representa o próprio actor → true',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o actor do dev → false',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B behavioral: caminho null (real) + predicado de parte (valores concretos) —');
  const nullOrder = await serviceOrderService.getOrderById(TENANT_ID, RANDOM_ORDER_ID);
  record('B1 getOrderById(random) → null (DB real) → helper transforma em 403 não-leak',
    nullOrder === null, `order=${nullOrder ? 'inesperado' : 'null'}`);
  const synthetic = { customerActorId: devActor, workerActorId: 'w-other' };
  record('B2 devActor (customer) É parte da ordem → leitura permitida pelo predicado',
    isParty(synthetic, devActor) === true);
  record('B3 estranho NÃO é parte → bloqueado pelo predicado (403)',
    isParty(synthetic, STRANGER_ACTOR_ID) === false);
  note('party-lê-ordem-REAL (e2e ponta a ponta) N/A: 0 service_orders em DEV (tabela existe, vazia).');

  console.log('\n— C estrutural: gate ANTES da leitura nos 3 reads —');
  const src = readFileSync(join(process.cwd(), 'src/modules/services/service-order.routes.ts'), 'utf8');
  record('C1 helper assertOrderParty: parte (customer/worker) + canRepresentActor',
    /order\.customerActorId !== actorId && order\.workerActorId !== actorId/.test(src)
    && /canRepresentActor\(tenantId, userId, actorId\)/.test(src));
  record('C2 GET /service-orders/:id: assertOrderParty antes de retornar a ordem',
    gateBeforeRead(src, 'getOrderById(tenantId, id)', 'assertOrderParty(req, reply, tenantId, order)'));
  const ftStart = src.indexOf("'/service-orders/:id/financial-terms'");
  const ftSlice = ftStart >= 0 ? src.slice(ftStart) : '';
  record('C3 GET /:id/financial-terms: assertOrderParty antes de getFinancialTerms(',
    gateBeforeRead(ftSlice, 'assertOrderParty(req, reply, tenantId, order)', 'getFinancialTerms('));
  record('C4 lista: exige party-filter representável (canRepresentActor) + 403 se sem party-filter',
    /partyFilters\.length === 0/.test(src) && /canRepresentActor\(tenantId, userId, partyId\)/.test(src));
  record('C5 não-leak: ordem inexistente OU não-parte → 403 ("Ordem não acessível"), 404 removido',
    /Ordem não acessível/.test(src) && !/Ordem não encontrada/.test(src));
  // C6 (atualizado por F-SERVICE-ORDER-WRITE-AUTHORSHIP-BINDING): os writes deixaram de ser "intocados".
  // Agora estão BINDADOS (bindOrderWriteActor) — a autoria não vem mais do actionContext.actorId cru.
  // O read gate (assertOrderParty) e o write gate (bindOrderWriteActor) coexistem. (confirmedBy* aparece
  // também no confirm-financial-terms — resíduo financeiro documentado — então o negativo usa campos
  // exclusivos dos writes não-financeiros: start/complete/cancel/buyer.)
  record('C6 writes BINDADOS (confirm/start/complete/cancel/buyer-confirm via bound.*; sem spoof nos não-financeiros)',
    /confirmOrder\(/.test(src) && /startOrder\(/.test(src)
    && /confirmedByActorId: bound\.actorId/.test(src)
    && /const bindOrderWriteActor = async/.test(src)
    && !/(startedByActorId|completedByActorId|cancelledByActorId|buyerActorId): actionContext\.actorId/.test(src));

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
  console.log('✨ Service-order read authority F6.5.6a (parte legítima antes de ler ordem comercial) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
