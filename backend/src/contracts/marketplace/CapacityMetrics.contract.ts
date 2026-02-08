// CONTRATO PÚBLICO CONGELADO - CapacityMetrics (Métricas de Capacidade)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

import { ServiceResource, CompanyCapacityMetrics } from './ServiceResource.contract';

/**
 * Métricas detalhadas de capacidade por recurso
 */
export interface ResourceCapacityMetrics {
  resourceId: string;
  resourceName: string;
  storeId: string;
  
  // Capacidade total (baseada em agenda real)
  capacityTotal: number; // Total de slots disponíveis na agenda
  
  // Capacidade utilizada
  capacityReserved: number; // Pré-reservas ativas
  capacityConfirmed: number; // Serviços confirmados
  capacityInProgress: number; // Serviços em execução
  capacityUtilized: number; // Total utilizado (reserved + confirmed + in_progress)
  
  // Capacidade disponível
  capacityAvailable: number; // Total - Utilizado
  
  // Risco de SLA
  riskSla: 'low' | 'medium' | 'high';
  riskFactors: string[]; // Fatores que aumentam o risco (ex: "alta taxa de atraso", "capacidade < 10%")
  
  // Métricas históricas
  historicalAverageUtilization: number; // Média histórica de utilização (0-1)
  historicalPeakUtilization: number; // Pico histórico de utilização (0-1)
  
  calculatedAt: string;
  immutable: true; // Métricas são snapshots imutáveis
}

/**
 * Evento de capacidade (para auditoria e feed econômico)
 */
export interface CapacityEvent {
  eventId: string;
  resourceId?: string; // Se for evento de recurso específico
  storeId: string;
  companyId: string;
  
  eventType: 
    | 'resource_overloaded' // Recurso atingiu capacidade máxima
    | 'resource_available' // Recurso voltou a ter capacidade disponível
    | 'service_rejected_capacity' // Serviço rejeitado por falta de capacidade
    | 'capacity_threshold_warning' // Aviso de capacidade próxima do limite
    | 'bottleneck_detected'; // Gargalo detectado
  
  details: {
    capacityAvailable?: number;
    capacityUtilized?: number;
    saturationRate?: number;
    serviceRequestId?: string; // Se for rejeição de serviço
    reason?: string;
  };
  
  createdAt: string;
  immutable: true; // Eventos são imutáveis
}

/**
 * Snapshot de capacidade por período (para análise histórica)
 */
export interface CapacitySnapshot {
  snapshotId: string;
  storeId: string;
  period: {
    start: string;
    end: string;
  };
  
  // Métricas agregadas
  totalResources: number;
  activeResources: number;
  overloadedResources: number;
  
  // Capacidade
  totalCapacity: number;
  averageUtilization: number;
  peakUtilization: number;
  
  // Serviços
  servicesCompleted: number;
  servicesRejected: number;
  rejectionRate: number; // Taxa de rejeição por capacidade (0-1)
  
  // Gargalos
  bottleneckCount: number;
  bottleneckResources: string[]; // IDs dos recursos que foram gargalo
  
  generatedAt: string;
  immutable: true; // Snapshots são imutáveis
}




