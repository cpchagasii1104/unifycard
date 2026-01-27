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
  snapshot_id: string;
  actor_id: string;
  actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
  period: {
    year: number;
    month: number; // 1-12
  };
  metrics: {
    total_orders: number;
    fulfilled_orders: number;
    cancelled_orders: number;
    disputed_orders: number;
    average_fulfillment_time_hours: number;
    cancellation_rate_percentage: number; // (cancelled / total) * 100
    dispute_rate_percentage: number; // (disputed / total) * 100
    on_time_delivery_percentage: number; // % de entregas dentro do SLA
  };
  score: {
    // Score calculado deterministicamente (0-100)
    // Fórmula: base_score - penalties
    base_score: number; // 100
    fulfillment_penalty: number; // Penalidade por atraso
    cancellation_penalty: number; // Penalidade por cancelamento
    dispute_penalty: number; // Penalidade por disputa
    final_score: number; // base_score - todas as penalidades
  };
  sla_status: {
    fulfillment_time: 'compliant' | 'warning' | 'violation';
    cancellation_rate: 'compliant' | 'warning' | 'violation';
    dispute_rate: 'compliant' | 'warning' | 'violation';
    overall: 'compliant' | 'warning' | 'violation';
  };
  created_at: string; // Timestamp de criação (imutável)
  // NÃO incluir updated_at - snapshot é imutável
}





