/**
 * D2 — release-expired-service-orders (Camada 1 saída, 2026-05-26)
 *
 * Script CLI standalone que processa o caminho "timeout" da D2:
 *   service_orders com status='seller_pending', settlement_flow=
 *   'fixed_price_escrow', disputed_at IS NULL, release_eligible_at <= NOW().
 *
 * Para cada candidata, APROVA seller_pending → release_approved e
 * emite outbox SERVICE_ORDER_RELEASE_APPROVED no MESMO client (atômico).
 *
 * Significado: "ordem APROVADA para futura liberação financeira" — NÃO
 * "fundos liberados".
 *
 * NÃO MOVE DINHEIRO. Estado-only. Dinheiro permanece em escrow_payments
 * até frente própria de release financeiro mover para seller_available
 * (bank-account lastreado pela ledger). Ver DT-D2-WIRING-MONEY-PENDING.
 *
 * Uso:
 *   npx tsx backend/src/scripts/release-expired-service-orders.ts \
 *       [tenantId] [limit]
 *
 *   tenantId  default: process.env.E2E_TENANT_ID ou
 *             'fbe13b78-4516-493d-905a-363796aea1d1'.
 *   limit     default: 100.
 *
 * NÃO é worker periódico. DT-D2-TIMEOUT-WORKER-PENDING registra que
 * agendamento operacional é frente futura. Por hoje, chame este script
 * via cron / CI / operação manual conforme cadência decidida.
 */

import dotenv from 'dotenv';
import { join } from 'path';

import { pool } from '../core/database/pool';
import { serviceOrderService } from '../modules/services/service-order.service';

dotenv.config({ path: join(process.cwd(), '.env') });

async function bootstrapPortsForScript(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const {
    actorRepositoryAdapter, actorUtilsAdapter,
    socialRepositoryAdapter, socialServiceAdapter, eventFeedHandlersAdapter,
  } = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const tenantId = args[0] || process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
  const limitArg = args[1] ? Number(args[1]) : 100;
  const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 100;

  console.log(`release-expired-service-orders :: tenantId=${tenantId} limit=${limit}`);

  await bootstrapPortsForScript();

  const result = await serviceOrderService.approveExpiredServiceOrderReleases(tenantId, limit);

  console.log(`  approved=${result.approved.length} failed=${result.failed.length}`);
  for (const id of result.approved) {
    console.log(`    ✅ ${id}`);
  }
  for (const f of result.failed) {
    console.log(`    ❌ ${f.orderId}: ${f.error}`);
  }

  await pool.end();
  process.exit(result.failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('release-expired-service-orders FAIL:', err);
  process.exit(1);
});
