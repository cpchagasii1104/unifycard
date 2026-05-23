// Anti-Fraud Financial Guards — detecção de padrões suspeitos (apenas alerta, sem bloqueio)

export interface FinancialAnomalyEvent {
  type: string;
  tenant_id: string;
  actor_id?: string;
  account_id?: string;
  amount_cents?: number;
  metadata?: Record<string, unknown>;
}

export function detectFinancialAnomaly(event: FinancialAnomalyEvent) {
  // Jest define NODE_ENV=test — evita flood de console.warn em E2E (alertas continuam em dev/prod).
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (event.type === 'fragmentation_pattern') {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        anomaly: 'FRAGMENTATION_PATTERN_DETECTED',
        ...event,
      })
    );
  }

  if (event.type === 'high_frequency_transactions') {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        anomaly: 'HIGH_FREQUENCY_TRANSACTIONS',
        ...event,
      })
    );
  }
}

// Detector de fragmentação: múltiplas transações do mesmo actor < 500 centavos em sequência (em memória)
const fragmentationByActor = new Map<string, number>();
const FRAGMENTATION_THRESHOLD_CENTS = 500;
const FRAGMENTATION_MIN_COUNT = 2;

export function recordTransactionForFragmentation(
  tenantId: string,
  actorId: string,
  accountId: string,
  amountCents: number
) {
  const key = `${tenantId}:${actorId}`;
  if (amountCents >= FRAGMENTATION_THRESHOLD_CENTS) {
    fragmentationByActor.set(key, 0);
    return;
  }
  const prev = fragmentationByActor.get(key) ?? 0;
  const next = prev + 1;
  fragmentationByActor.set(key, next);
  if (next >= FRAGMENTATION_MIN_COUNT) {
    detectFinancialAnomaly({
      type: 'fragmentation_pattern',
      tenant_id: tenantId,
      actor_id: actorId,
      account_id: accountId,
      amount_cents: amountCents,
    });
    fragmentationByActor.set(key, 0);
  }
}