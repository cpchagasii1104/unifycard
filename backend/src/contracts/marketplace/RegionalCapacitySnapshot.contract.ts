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
  region_id: string; // cidade ou bairro (ex: "curitiba" ou "curitiba-batel")
  service_category: string; // Categoria de serviço (ex: "cat-beauty", "cat-health")
  
  // Recursos
  total_resources: number; // Total de recursos disponíveis
  active_resources: number; // Recursos ativos (não sobrecarregados)
  overloaded_resources: number; // Recursos sobrecarregados
  
  // Utilização
  avg_utilization_rate: number; // Taxa média de utilização (0-1)
  peak_utilization_rate: number; // Pico de utilização (0-1)
  
  // Eventos
  overload_events_count: number; // Número de eventos de sobrecarga no período
  request_expiration_rate: number; // Taxa de requests expirados (0-1)
  dispatch_rejection_rate: number; // Taxa de dispatches sem aceite (0-1)
  
  // Tempos
  avg_response_time_minutes: number; // Tempo médio até resposta (minutos)
  avg_execution_time_minutes: number; // Tempo médio de execução (minutos)
  avg_confirmation_time_minutes: number; // Tempo médio até confirmação (minutos)
  
  // SLA
  sla_risk_level: SLARiskLevel; // Nível de risco de quebra de SLA
  sla_violation_rate: number; // Taxa de violação de SLA (0-1)
  
  // Conversão
  request_to_execution_rate: number; // Taxa de conversão request → execução (0-1)
  
  // Classificação
  status: RegionalCapacityStatus; // Status geral
  bottleneck_cause?: BottleneckCause; // Causa principal de gargalo (se houver)
  bottleneck_details?: string; // Detalhes do gargalo
  
  calculated_at: string;
  immutable: true; // Métricas são snapshots imutáveis
}

/**
 * Snapshot regional de capacidade (imutável, versionado)
 */
export interface RegionalCapacitySnapshot {
  snapshot_id: string;
  region_id: string; // cidade ou bairro
  period: {
    start: string; // Início do período
    end: string; // Fim do período
  };
  period_type: 'weekly' | 'monthly'; // Tipo de período
  
  // Métricas agregadas
  total_resources: number; // Total de recursos na região
  total_active_resources: number; // Total de recursos ativos
  total_overloaded_resources: number; // Total de recursos sobrecarregados
  
  // Métricas por categoria
  by_category: RegionalCapacityMetric[];
  
  // Métricas por tipo de empresa
  by_company_type: Array<{
    company_type: string; // Tipo de empresa (ex: "clinic", "gym")
    total_resources: number;
    active_resources: number;
    avg_utilization_rate: number;
    status: RegionalCapacityStatus;
  }>;
  
  // Gargalos identificados
  identified_bottlenecks: Array<{
    category: string;
    cause: BottleneckCause;
    severity: 'low' | 'medium' | 'high';
    details: string;
  }>;
  
  // Resumo
  overall_status: RegionalCapacityStatus; // Status geral da região
  overall_sla_risk: SLARiskLevel; // Risco geral de SLA
  
  version: string; // Versão do snapshot
  generated_at: string;
  immutable: true; // Snapshots são imutáveis
}




