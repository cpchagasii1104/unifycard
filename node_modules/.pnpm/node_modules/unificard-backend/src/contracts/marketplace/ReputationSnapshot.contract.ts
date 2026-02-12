// backend/src/contracts/marketplace/ReputationSnapshot.contract.ts
// CONTRATO PÚBLICO CONGELADO - ReputationSnapshot (Snapshot de Reputação)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ReputationSnapshot - Snapshot imutável de reputação
 * 
 * Snapshot mensal agregado de métricas de um ator.
 * IMUTÁVEL - não pode ser editado retroativamente.
 * Cálculo determinístico e auditável.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ReputationSnapshot {
  snapshotId: string;
  actorId: string;
  actorType: 'store' | 'hub' | 'industry' | 'service_provider';
  period: {
    year: number;
    month: number; // 1-12
  };
  metrics: {
    totalOrders: number;
    fulfilledOrders: number;
    cancelledOrders: number;
    disputedOrders: number;
    averageFulfillmentTimeHours: number;
    cancellationRatePercentage: number; // (cancelled / total) * 100
    disputeRatePercentage: number; // (disputed / total) * 100
    onTimeDeliveryPercentage: number; // % de entregas dentro do SLA
  };
  score: {
    // Score calculado deterministicamente (0-100)
    // Fórmula: baseScore - penalties
    baseScore: number; // 100
    fulfillmentPenalty: number; // Penalidade por atraso
    cancellationPenalty: number; // Penalidade por cancelamento
    disputePenalty: number; // Penalidade por disputa
    finalScore: number; // baseScore - todas as penalidades
  };
  slaStatus: {
    fulfillmentTime: 'compliant' | 'warning' | 'violation';
    cancellationRate: 'compliant' | 'warning' | 'violation';
    disputeRate: 'compliant' | 'warning' | 'violation';
    overall: 'compliant' | 'warning' | 'violation';
  };
  createdAt: string; // Timestamp de criação (imutável)
  // NÃO incluir updatedAt - snapshot é imutável
}





