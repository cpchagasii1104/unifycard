// CONTRATO PÚBLICO CONGELADO - ServiceResource (Recurso de Serviço)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * Tipo de recurso de serviço
 */
export type ServiceResourceType = 'individual_provider' | 'company_professional' | 'equipment' | 'facility';

/**
 * Status do recurso
 */
export type ServiceResourceStatus = 'active' | 'unavailable' | 'overloaded' | 'maintenance';

/**
 * Recurso de serviço (prestador individual, profissional de empresa, equipamento, instalação)
 * Pode ter agenda própria, SLA histórico, métricas de execução
 */
export interface ServiceResource {
  resource_id: string;
  store_id: string; // Empresa que possui/gerencia o recurso
  type: ServiceResourceType;
  name: string;
  description?: string;
  
  // Identificação do recurso
  // Para individual_provider: actor_id do prestador
  // Para company_professional: actor_id do profissional + role
  // Para equipment/facility: identificador físico
  actor_id?: string; // Se for pessoa (prestador ou profissional)
  physical_id?: string; // Se for equipamento/instalação (ex: "sala-1", "cadeira-odontologica-2")
  
  // Capacidade e agenda
  has_own_agenda: boolean; // Se o recurso tem agenda própria (independente da empresa)
  required_for_services: string[]; // IDs de ServiceTemplate que exigem este recurso
  
  // Status atual
  status: ServiceResourceStatus;
  status_reason?: string; // Motivo do status (ex: "manutenção programada", "sobrecarga detectada")
  status_updated_at: string;
  
  // Métricas históricas (calculadas, não configuradas)
  historical_metrics: {
    average_execution_time_minutes: number; // Tempo médio real de execução
    sla_response_rate: number; // Taxa de resposta dentro do SLA (0-1)
    sla_execution_rate: number; // Taxa de execução dentro do SLA (0-1)
    cancellation_rate: number; // Taxa de cancelamento (0-1)
    overrun_rate: number; // Taxa de atrasos (0-1)
    total_services_completed: number;
    last_30_days_services: number;
  };
  
  // Capacidade atual (calculada dinamicamente)
  current_capacity: {
    total_slots_available: number; // Total de slots disponíveis na agenda
    slots_reserved: number; // Slots com pré-reserva ativa
    slots_confirmed: number; // Slots com serviço confirmado
    slots_in_progress: number; // Slots com serviço em execução
    slots_available: number; // Slots realmente disponíveis (total - reservados - confirmados - em progresso)
    risk_level: 'low' | 'medium' | 'high'; // Risco de quebra de SLA
  };
  
  // Modelo de compensação (PROMPT 24)
  compensation_config?: {
    model: 'none' | 'fixed_percent' | 'fixed_value' | 'salary' | 'mixed';
    percent_value?: number; // Para fixed_percent
    fixed_amount?: number; // Para fixed_value (em centavos)
    monthly_salary?: number; // Para salary (em centavos)
    base_salary?: number; // Para mixed (em centavos)
    variable_percent?: number; // Para mixed
    min_compensation?: number; // Mínimo por serviço (em centavos)
    max_compensation?: number; // Máximo por serviço (em centavos)
    active: boolean;
    effective_from: string;
    effective_until?: string;
  };
  
  created_at: string;
  updated_at: string;
  immutable: false; // Recurso pode ser atualizado (status, métricas, capacidade)
}

/**
 * Dependência entre recursos
 * Define que um serviço exige múltiplos recursos simultaneamente
 */
export interface ServiceResourceDependency {
  dependency_id: string;
  service_template_id: string; // Serviço que exige os recursos
  required_resources: string[]; // IDs de ServiceResource que devem estar disponíveis
  all_required: boolean; // true = todos devem estar disponíveis, false = pelo menos um
  created_at: string;
  immutable: true; // Dependências são imutáveis
}

/**
 * Métricas de capacidade agregadas por empresa
 */
export interface CompanyCapacityMetrics {
  company_id: string;
  store_id: string;
  period: {
    start: string;
    end: string;
  };
  
  // Capacidade agregada
  total_capacity: number; // Soma das capacidades de todos os recursos elegíveis
  utilized_capacity: number; // Capacidade utilizada (reservada + confirmada + em progresso)
  available_capacity: number; // Capacidade disponível
  
  // Análise de gargalos
  bottleneck_resources: Array<{
    resource_id: string;
    resource_name: string;
    utilization_rate: number; // 0-1
    risk_level: 'low' | 'medium' | 'high';
  }>;
  
  // Taxa de saturação
  saturation_rate: number; // 0-1 (utilized / total)
  
  // Serviços rejeitados por capacidade
  rejected_services_count: number; // Serviços que não puderam ser atendidos por falta de capacidade
  rejected_services_last_30_days: number;
  
  calculated_at: string;
  immutable: true; // Métricas são snapshots imutáveis
}

