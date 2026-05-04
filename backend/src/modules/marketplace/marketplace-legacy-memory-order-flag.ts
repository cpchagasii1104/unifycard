import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@core/errors';

/**
 * Rotas que usam MarketplaceOrdersModule (Map em memória): delivery/from-checkout, rotas públicas legadas, etc.
 * `/marketplace/pdv/*` foi removido — PDV HTTP canónico: `modules/pdv` (`/pdv/*`).
 * Definir MARKETPLACE_LEGACY_MEMORY_ORDER_ROUTES=true apenas para demo/local explícito.
 */
export function isMarketplaceLegacyMemoryOrderRoutesEnabled(): boolean {
  const v = process.env.MARKETPLACE_LEGACY_MEMORY_ORDER_ROUTES?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/** Valor bruto da env (undefined = chave ausente). Útil para detetar typos tipo `FALSE` ou string vazia. */
export function getMarketplaceLegacyMemoryOrderRoutesEnvRaw(): string | undefined {
  return process.env.MARKETPLACE_LEGACY_MEMORY_ORDER_ROUTES;
}

/** Uma linha no boot — evita dúvida em staging/prod. */
export function logMarketplaceLegacyMemoryOrderRoutesBootState(): void {
  const raw = getMarketplaceLegacyMemoryOrderRoutesEnvRaw();
  const rawLabel = raw === undefined ? 'undefined' : JSON.stringify(raw);
  const on = isMarketplaceLegacyMemoryOrderRoutesEnabled();
  console.log(
    `[BOOT][MARKETPLACE] MARKETPLACE_LEGACY_MEMORY_ORDER_ROUTES env=${rawLabel} → effective=${on ? 'ON' : 'OFF'}${on ? ' (mutações via facade em memória permitidas — exceto /marketplace/pdv removido)' : ' (mutações legadas desativadas; pedidos: orderService / intent; PDV: /pdv)'}`
  );
}

/** 410 Gone — superfície legada em memória desativada (§9.5: erro via plugin). */
export async function replyLegacyMemoryOrderRoutesGone(
  _req: FastifyRequest,
  _reply: FastifyReply
): Promise<never> {
  throw new AppError(
    410,
    'Pedido/checkout/delivery em memória desativado. Use intent-execute + orderService (PostgreSQL). Para demo: MARKETPLACE_LEGACY_MEMORY_ORDER_ROUTES=true.',
    'LEGACY_MEMORY_ORDER_ROUTES_DISABLED'
  );
}