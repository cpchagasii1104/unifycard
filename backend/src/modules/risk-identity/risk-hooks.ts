/**
 * Prompt 53 — integração com fluxos existentes (fire-and-forget; não bloqueia pipeline).
 */

import { recordEvent } from './actor-events.repository';
import { evaluateActorRisk } from './risk-engine.service';

export async function recordActorRiskEvent(
  tenantId: string,
  actorId: string,
  eventType: string,
  referenceId?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordEvent(tenantId, {
    actorId,
    eventType,
    referenceId: referenceId ?? undefined,
    metadata,
  });
  await evaluateActorRisk(tenantId, actorId);
}

/**
 * Não propaga erro para não interferir em PaymentIntent, ledger, etc.
 */
export function recordActorRiskEventAsync(
  tenantId: string,
  actorId: string | null | undefined,
  eventType: string,
  referenceId?: string | null,
  metadata?: Record<string, unknown>
): void {
  if (!actorId) return;
  void recordActorRiskEvent(tenantId, actorId, eventType, referenceId, metadata).catch((e) => {
    console.warn('[RiskIdentity] recordActorRiskEventAsync:', e instanceof Error ? e.message : e);
  });
}