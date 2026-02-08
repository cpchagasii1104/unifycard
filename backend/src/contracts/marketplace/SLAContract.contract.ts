// backend/src/contracts/marketplace/SLAContract.contract.ts
// CONTRATO PÚBLICO CONGELADO - SLAContract (Contrato de SLA)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * SLAContract - Contrato de Service Level Agreement
 * 
 * Define métricas, thresholds e penalidades para atores do Marketplace.
 * Tudo determinístico e auditável, sem algoritmos opacos.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface SLAContract {
  slaId: string;
  actorType: 'store' | 'hub' | 'industry' | 'service_provider';
  actorId: string; // ID do ator (storeId, hubId, industryId, etc.)
  metrics: {
    fulfillmentTime: {
      targetHours: number; // Tempo alvo em horas
      maxHours: number; // Tempo máximo permitido
      unit: 'hours';
    };
    cancellationRate: {
      targetPercentage: number; // Taxa alvo (ex: 2%)
      maxPercentage: number; // Taxa máxima permitida (ex: 5%)
      unit: 'percentage';
    };
    disputeRate: {
      targetPercentage: number; // Taxa alvo (ex: 1%)
      maxPercentage: number; // Taxa máxima permitida (ex: 3%)
      unit: 'percentage';
    };
  };
  thresholds: {
    warning: {
      fulfillmentTimeHours: number;
      cancellationRatePercentage: number;
      disputeRatePercentage: number;
    };
    violation: {
      fulfillmentTimeHours: number;
      cancellationRatePercentage: number;
      disputeRatePercentage: number;
    };
  };
  penalties: {
    fulfillmentTimeViolation: {
      type: 'percentage' | 'fixed';
      valueCents: number; // Percentual sobre split ou valor fixo
      redirectTo: 'regional_fund' | 'customer' | 'platform';
    };
    cancellationRateViolation: {
      type: 'percentage' | 'fixed';
      valueCents: number;
      redirectTo: 'regional_fund' | 'customer' | 'platform';
    };
    disputeRateViolation: {
      type: 'percentage' | 'fixed';
      valueCents: number;
      redirectTo: 'regional_fund' | 'customer' | 'platform';
    };
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}






