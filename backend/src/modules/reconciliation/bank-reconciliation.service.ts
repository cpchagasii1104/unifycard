// Nível 3 (legado): detecção banco vs ledger foi removida.
// Inconsistências financeiras: apenas reconciliation-engine.service.ts (Prompt 52 / 0053+).

import { reconciliationService } from './reconciliation.service';
import type { ReconciliationReport } from './reconciliation.types';

class BankReconciliationService {
  /**
   * Orquestração legada sem detecção local.
   * Motor canônico: runReconciliation (reconciliation-engine-worker).
   */
  async runBankReconciliation(
    tenantId: string,
    _bankTransfers: { bankTransferId: string; amountCents: number; currency: string }[]
  ): Promise<ReconciliationReport> {
    void _bankTransfers;
    return reconciliationService.buildReport(tenantId, 'bank', []);
  }
}

export const bankReconciliationService = new BankReconciliationService();