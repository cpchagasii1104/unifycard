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
  providerActorId: string;
  categoryId?: string; // Opcional: métricas por categoria
  period: {
    startDate: string; // ISO 8601
    endDate: string; // ISO 8601
  };
  // Métricas canônicas
  visitasSemOrcamento: number;
  orcamentosEnviados: number;
  orcamentosAceitos: number;
  orcamentosRecusados: number;
  orcamentosExpirados: number;
  taxaQuoteToExecution: number; // Percentual (0-100)
  // Status de governança
  status: 'healthy' | 'warning' | 'sla_violation' | 'trust_penalty';
  warningsCount: number;
  slaViolationsCount: number;
  trustDowngradesCount: number;
  // Timestamps
  calculatedAt: string;
  lastWarningAt?: string;
  lastSlaViolationAt?: string;
  lastTrustDowngradeAt?: string;
}





