// backend/src/contracts/marketplace/ServiceGovernanceMetrics.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServiceGovernanceMetrics (Métricas de Governança de Serviços)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServiceGovernanceMetrics - Métricas de Governança de Serviços
 * 
 * Métricas canônicas para detectar e medir comportamento de desvio
 * ("vou orçar aqui e fechar por fora") sem bloquear o sistema.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServiceGovernanceMetrics {
  provider_actor_id: string;
  category_id?: string; // Opcional: métricas por categoria
  period: {
    start_date: string; // ISO 8601
    end_date: string; // ISO 8601
  };
  // Métricas canônicas
  visitas_sem_orcamento: number;
  orcamentos_enviados: number;
  orcamentos_aceitos: number;
  orcamentos_recusados: number;
  orcamentos_expirados: number;
  taxa_quote_to_execution: number; // Percentual (0-100)
  // Status de governança
  status: 'healthy' | 'warning' | 'sla_violation' | 'trust_penalty';
  warnings_count: number;
  sla_violations_count: number;
  trust_downgrades_count: number;
  // Timestamps
  calculated_at: string;
  last_warning_at?: string;
  last_sla_violation_at?: string;
  last_trust_downgrade_at?: string;
}





