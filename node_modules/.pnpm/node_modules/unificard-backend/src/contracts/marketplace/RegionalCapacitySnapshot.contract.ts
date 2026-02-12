// CONTRATO PÚBLICO CONGELADO - RegionalCapacitySnapshot (Snapshot de Capacidade Regional)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * Status de capacidade regional
 */
export type RegionalCapacityStatus = 'healthy' | 'warning' | 'critical';

/**
 * Causa principal de gargalo
 */
export type BottleneckCause =
  | 'lack_of_professionals' // Falta de profissionais
  | 'excess_demand' // Excesso de demanda
  | 'capacity_distribution_issue' // Má distribuição de capacidade
  | 'schedule_bottleneck' // Gargalo de agenda
  | 'time_bottleneck'; // Gargalo de horário (ex: noite/fim de semana)

/**
 * Nível de risco de SLA
 */
export type SLARiskLevel = 'low' | 'medium' | 'high';

/**
 * Métrica de capacidade regional por categoria
 */
export interface RegionalCapacityMetric {
  regionId: string; // cidade ou bairro (ex: "curitiba" ou "curitiba-batel")
  serviceCategory: string; // Categoria de serviço (ex: "cat-beauty", "cat-health")
  
  // Recursos
  totalResources: number; // Total de recursos disponíveis
  activeResources: number; // Recursos ativos (não sobrecarregados)
  overloadedResources: number; // Recursos sobrecarregados
  
  // Utilização
  avgUtilizationRate: number; // Taxa média de utilização (0-1)
  peakUtilizationRate: number; // Pico de utilização (0-1)
  
  // Eventos
  overloadEventsCount: number; // Número de eventos de sobrecarga no período
  requestExpirationRate: number; // Taxa de requests expirados (0-1)
  dispatchRejectionRate: number; // Taxa de dispatches sem aceite (0-1)
  
  // Tempos
  avgResponseTimeMinutes: number; // Tempo médio até resposta (minutos)
  avgExecutionTimeMinutes: number; // Tempo médio de execução (minutos)
  avgConfirmationTimeMinutes: number; // Tempo médio até confirmação (minutos)
  
  // SLA
  slaRiskLevel: SLARiskLevel; // Nível de risco de quebra de SLA
  slaViolationRate: number; // Taxa de violação de SLA (0-1)
  
  // Conversão
  requestToExecutionRate: number; // Taxa de conversão request → execução (0-1)
  
  // Classificação
  status: RegionalCapacityStatus; // Status geral
  bottleneckCause?: BottleneckCause; // Causa principal de gargalo (se houver)
  bottleneckDetails?: string; // Detalhes do gargalo
  
  calculatedAt: string;
  immutable: true; // Métricas são snapshots imutáveis
}

/**
 * Snapshot regional de capacidade (imutável, versionado)
 */
export interface RegionalCapacitySnapshot {
  snapshotId: string;
  regionId: string; // cidade ou bairro
  period: {
    start: string; // Início do período
    end: string; // Fim do período
  };
  periodType: 'weekly' | 'monthly'; // Tipo de período
  
  // Métricas agregadas
  totalResources: number; // Total de recursos na região
  totalActiveResources: number; // Total de recursos ativos
  totalOverloadedResources: number; // Total de recursos sobrecarregados
  
  // Métricas por categoria
  byCategory: RegionalCapacityMetric[];
  
  // Métricas por tipo de empresa
  byCompanyType: Array<{
    companyType: string; // Tipo de empresa (ex: "clinic", "gym")
    totalResources: number;
    activeResources: number;
    avgUtilizationRate: number;
    status: RegionalCapacityStatus;
  }>;
  
  // Gargalos identificados
  identifiedBottlenecks: Array<{
    category: string;
    cause: BottleneckCause;
    severity: 'low' | 'medium' | 'high';
    details: string;
  }>;
  
  // Resumo
  overallStatus: RegionalCapacityStatus; // Status geral da região
  overallSlaRisk: SLARiskLevel; // Risco geral de SLA
  
  version: string; // Versão do snapshot
  generatedAt: string;
  immutable: true; // Snapshots são imutáveis
}




