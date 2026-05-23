/**
 * Consome jobs `reconciliation-trigger` da fila payment-events (BullMQ).
 * Não roda no path síncrono de mutação; apenas aqui chama o motor canônico.
 */

import type { ReconciliationTriggerJob } from '@core/events/payment-events-queue';
import { logFinancialEvent } from '@core/observability/financial-logger';
import { runReconciliation } from './reconciliation-engine.service';

export async function processReconciliationTrigger(payload: ReconciliationTriggerJob): Promise<void> {
  logFinancialEvent({
    financial_event: 'reconciliation_trigger_consumed',
    tenant_id: payload.tenant_id,
    metadata: {
      reference_type: payload.reference_type,
      reference_id: payload.reference_id,
    },
  });
  await runReconciliation(payload.tenant_id);
}