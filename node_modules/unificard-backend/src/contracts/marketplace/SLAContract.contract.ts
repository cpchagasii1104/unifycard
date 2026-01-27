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
  sla_id: string;
  actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
  actor_id: string; // ID do ator (store_id, hub_id, industry_id, etc.)
  metrics: {
    fulfillment_time: {
      target_hours: number; // Tempo alvo em horas
      max_hours: number; // Tempo máximo permitido
      unit: 'hours';
    };
    cancellation_rate: {
      target_percentage: number; // Taxa alvo (ex: 2%)
      max_percentage: number; // Taxa máxima permitida (ex: 5%)
      unit: 'percentage';
    };
    dispute_rate: {
      target_percentage: number; // Taxa alvo (ex: 1%)
      max_percentage: number; // Taxa máxima permitida (ex: 3%)
      unit: 'percentage';
    };
  };
  thresholds: {
    warning: {
      fulfillment_time_hours: number;
      cancellation_rate_percentage: number;
      dispute_rate_percentage: number;
    };
    violation: {
      fulfillment_time_hours: number;
      cancellation_rate_percentage: number;
      dispute_rate_percentage: number;
    };
  };
  penalties: {
    fulfillment_time_violation: {
      type: 'percentage' | 'fixed';
      value: number; // Percentual sobre split ou valor fixo
      redirect_to: 'regional_fund' | 'customer' | 'platform';
    };
    cancellation_rate_violation: {
      type: 'percentage' | 'fixed';
      value: number;
      redirect_to: 'regional_fund' | 'customer' | 'platform';
    };
    dispute_rate_violation: {
      type: 'percentage' | 'fixed';
      value: number;
      redirect_to: 'regional_fund' | 'customer' | 'platform';
    };
  };
  active: boolean;
  created_at: string;
  updated_at: string;
}





