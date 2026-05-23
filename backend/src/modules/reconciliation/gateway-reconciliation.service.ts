// Nível 1 (legado): detecção de divergência gateway vs ledger foi removida.
// Inconsistências financeiras: apenas reconciliation-engine.service.ts (Prompt 52 / 0053+).

import { reconciliationService } from './reconciliation.service';
import type { ReconciliationReport } from './reconciliation.types';

class GatewayReconciliationService {
  /**
   * Orquestração legada sem detecção local.
   * Motor canônico: runReconciliation (reconciliation-engine-worker).
   */
  async runTransactionReconciliation(tenantId: string): Promise<ReconciliationReport> {
    return reconciliationService.buildReport(tenantId, 'transaction', []);
  }
}

export const gatewayReconciliationService = new GatewayReconciliationService();