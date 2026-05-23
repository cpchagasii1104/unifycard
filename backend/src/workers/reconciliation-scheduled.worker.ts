// INFRA-3 — worker agendado: `runFullReconciliation()` (só leitura; sem mutação).
// Não altera `reconciliation.service.ts`; métricas adicionais + alerta estruturado quando há drift.

import { reconciliationService } from '@core/reconciliation/reconciliation.service';
import { canonicalLogger } from '@core/logging/canonical-logger';

/** Intervalo entre ciclos (ms). Ajustável por ambiente. */
const RECONCILIATION_INTERVAL_MS = Number(
  process.env.RECONCILIATION_INTERVAL_MS ?? 60_000
);

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Um ciclo completo (para testes / runbook / chamada manual).
 * Idempotente em relação ao serviço: delega em `runFullReconciliation` sem escrever dados.
 */
export async function runReconciliationOnce(): Promise<void> {
  await runReconciliationCycle();
}

async function runReconciliationCycle(): Promise<void> {
  try {
    const { inventory, ledger, reservation, totalDrifts } =
      await reconciliationService.runFullReconciliation();
    const all = [...inventory, ...ledger, ...reservation];

    for (const drift of all) {
      canonicalLogger.warn(null, 'reconciliation_drift_detected', {
        metric_event: 'reconciliation_drift_detected',
        reconciliationKind: drift.type,
        tenantId: '_all_tenants',
        entityId: drift.entityId,
        drift: drift.drift,
        source: 'reconciliation_scheduled_worker',
      });
    }

    canonicalLogger.info(null, 'reconciliation_run_completed', {
      metric_event: 'reconciliation_run_completed',
      reconciliationKind: 'full',
      driftCount: totalDrifts,
      source: 'reconciliation_scheduled_worker',
    });

    if (totalDrifts > 0) {
      canonicalLogger.error(null, 'reconciliation_drift_detected', {
        metric_event: 'reconciliation_drift_detected',
        severity: 'critical',
        driftCount: totalDrifts,
        source: 'reconciliation_scheduled_worker',
      });
    }
  } catch (error: unknown) {
    canonicalLogger.error(null, 'reconciliation_worker_failed', {
      metric_event: 'reconciliation_worker_failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Inicia o loop periódico (não bloqueia o processo em caso de erro num ciclo). */
export function startReconciliationScheduledWorker(): void {
  if (intervalId !== null) return;
  void runReconciliationCycle().catch(() => {
    /* erros já registados dentro do ciclo */
  });
  intervalId = setInterval(() => {
    void runReconciliationCycle().catch(() => {
      /* erros já registados dentro do ciclo */
    });
  }, RECONCILIATION_INTERVAL_MS);
  console.log(
    `[ReconciliationScheduledWorker] Started (INFRA-3 runFullReconciliation every ${RECONCILIATION_INTERVAL_MS}ms)`
  );
}