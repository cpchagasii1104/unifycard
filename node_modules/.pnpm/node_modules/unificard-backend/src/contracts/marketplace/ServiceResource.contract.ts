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
  resourceId: string;
  storeId: string; // Empresa que possui/gerencia o recurso
  type: ServiceResourceType;
  name: string;
  description?: string;
  
  // Identificação do recurso
  // Para individual_provider: actorId do prestador
  // Para company_professional: actorId do profissional + role
  // Para equipment/facility: identificador físico
  actorId?: string; // Se for pessoa (prestador ou profissional)
  physicalId?: string; // Se for equipamento/instalação (ex: "sala-1", "cadeira-odontologica-2")
  
  // Capacidade e agenda
  hasOwnAgenda: boolean; // Se o recurso tem agenda própria (independente da empresa)
  requiredForServices: string[]; // IDs de ServiceTemplate que exigem este recurso
  
  // Status atual
  status: ServiceResourceStatus;
  statusReason?: string; // Motivo do status (ex: "manutenção programada", "sobrecarga detectada")
  statusUpdatedAt: string;
  
  // Métricas históricas (calculadas, não configuradas)
  historicalMetrics: {
    averageExecutionTimeMinutes: number; // Tempo médio real de execução
    slaResponseRate: number; // Taxa de resposta dentro do SLA (0-1)
    slaExecutionRate: number; // Taxa de execução dentro do SLA (0-1)
    cancellationRate: number; // Taxa de cancelamento (0-1)
    overrunRate: number; // Taxa de atrasos (0-1)
    totalServicesCompleted: number;
    last30DaysServices: number;
  };
  
  // Capacidade atual (calculada dinamicamente)
  currentCapacity: {
    totalSlotsAvailable: number; // Total de slots disponíveis na agenda
    slotsReserved: number; // Slots com pré-reserva ativa
    slotsConfirmed: number; // Slots com serviço confirmado
    slotsInProgress: number; // Slots com serviço em execução
    slotsAvailable: number; // Slots realmente disponíveis (total - reservados - confirmados - em progresso)
    riskLevel: 'low' | 'medium' | 'high'; // Risco de quebra de SLA
  };
  
  // Modelo de compensação (PROMPT 24)
  compensationConfig?: {
    model: 'none' | 'fixed_percent' | 'fixed_value' | 'salary' | 'mixed';
    percentValue?: number; // Para fixed_percent
    fixedAmount?: number; // Para fixed_value (em centavos)
    monthlySalary?: number; // Para salary (em centavos)
    baseSalary?: number; // Para mixed (em centavos)
    variablePercent?: number; // Para mixed
    minCompensation?: number; // Mínimo por serviço (em centavos)
    maxCompensation?: number; // Máximo por serviço (em centavos)
    isActive: boolean;
    effectiveFrom: string;
    effectiveUntil?: string;
  };
  
  createdAt: string;
  updatedAt: string;
  immutable: false; // Recurso pode ser atualizado (status, métricas, capacidade)
}

/**
 * Dependência entre recursos
 * Define que um serviço exige múltiplos recursos simultaneamente
 */
export interface ServiceResourceDependency {
  dependencyId: string;
  serviceTemplateId: string; // Serviço que exige os recursos
  requiredResources: string[]; // IDs de ServiceResource que devem estar disponíveis
  allRequired: boolean; // true = todos devem estar disponíveis, false = pelo menos um
  createdAt: string;
  immutable: true; // Dependências são imutáveis
}

/**
 * Métricas de capacidade agregadas por empresa
 */
export interface CompanyCapacityMetrics {
  companyId: string;
  storeId: string;
  period: {
    start: string;
    end: string;
  };
  
  // Capacidade agregada
  totalCapacity: number; // Soma das capacidades de todos os recursos elegíveis
  utilizedCapacity: number; // Capacidade utilizada (reservada + confirmada + em progresso)
  availableCapacity: number; // Capacidade disponível
  
  // Análise de gargalos
  bottleneckResources: Array<{
    resourceId: string;
    resourceName: string;
    utilizationRate: number; // 0-1
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  
  // Taxa de saturação
  saturationRate: number; // 0-1 (utilized / total)
  
  // Serviços rejeitados por capacidade
  rejectedServicesCount: number; // Serviços que não puderam ser atendidos por falta de capacidade
  rejectedServicesLast30Days: number;
  
  calculatedAt: string;
  immutable: true; // Métricas são snapshots imutáveis
}

