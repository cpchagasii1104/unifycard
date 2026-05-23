// Reconciliation Engine — orquestrador e regras comuns.
// Objetivo: ledger = gateway = banco. Correção sempre via adjustment, nunca UPDATE/DELETE no ledger.

import { reconciliationDiscrepancyRepository } from './reconciliation-discrepancy.repository';
import type {
  ReconciliationDiscrepancyType,
  ReconciliationReport,
  CreateDiscrepancyInput,
} from './reconciliation.types';

class ReconciliationService {
  /**
   * Registra uma divergência (gateway, settlement ou bank).
   * Correção posterior deve ser feita via adjustment transaction, não alterando o ledger diretamente.
   */
  async recordDiscrepancy(input: CreateDiscrepancyInput) {
    return reconciliationDiscrepancyRepository.create(input.tenantId, {
      type: input.type,
      referenceId: input.referenceId,
      referenceType: input.referenceType,
      expectedAmountCents: input.expectedAmountCents,
      actualAmountCents: input.actualAmountCents,
      currency: input.currency,
    });
  }

  /**
   * Lista divergências abertas (para resolução manual ou automática).
   */
  async getOpenDiscrepancies(tenantId: string, type?: ReconciliationDiscrepancyType) {
    return reconciliationDiscrepancyRepository.findOpenByTenant(tenantId, type);
  }

  /**
   * Marca divergência como resolvida após criar adjustment transaction.
   */
  async markResolved(
    tenantId: string,
    discrepancyId: string,
    adjustmentTransactionId: string,
    resolutionNote?: string
  ) {
    await reconciliationDiscrepancyRepository.markResolved(
      tenantId,
      discrepancyId,
      adjustmentTransactionId,
      resolutionNote
    );
  }

  /**
   * Gera relatório de uma execução de reconciliação (em memória).
   */
  buildReport(
    tenantId: string,
    level: 'transaction' | 'settlement' | 'bank',
    discrepancyIds: string[]
  ): ReconciliationReport {
    return {
      tenantId,
      runAt: new Date().toISOString(),
      level,
      discrepanciesFound: discrepancyIds.length,
      discrepancyIds,
    };
  }
}

export const reconciliationService = new ReconciliationService();