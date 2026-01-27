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
  resource_id: string;
  resource_name: string;
  store_id: string;
  
  // Capacidade total (baseada em agenda real)
  capacity_total: number; // Total de slots disponíveis na agenda
  
  // Capacidade utilizada
  capacity_reserved: number; // Pré-reservas ativas
  capacity_confirmed: number; // Serviços confirmados
  capacity_in_progress: number; // Serviços em execução
  capacity_utilized: number; // Total utilizado (reserved + confirmed + in_progress)
  
  // Capacidade disponível
  capacity_available: number; // Total - Utilizado
  
  // Risco de SLA
  risk_sla: 'low' | 'medium' | 'high';
  risk_factors: string[]; // Fatores que aumentam o risco (ex: "alta taxa de atraso", "capacidade < 10%")
  
  // Métricas históricas
  historical_average_utilization: number; // Média histórica de utilização (0-1)
  historical_peak_utilization: number; // Pico histórico de utilização (0-1)
  
  calculated_at: string;
  immutable: true; // Métricas são snapshots imutáveis
}

/**
 * Evento de capacidade (para auditoria e feed econômico)
 */
export interface CapacityEvent {
  event_id: string;
  resource_id?: string; // Se for evento de recurso específico
  store_id: string;
  company_id: string;
  
  event_type: 
    | 'resource_overloaded' // Recurso atingiu capacidade máxima
    | 'resource_available' // Recurso voltou a ter capacidade disponível
    | 'service_rejected_capacity' // Serviço rejeitado por falta de capacidade
    | 'capacity_threshold_warning' // Aviso de capacidade próxima do limite
    | 'bottleneck_detected'; // Gargalo detectado
  
  details: {
    capacity_available?: number;
    capacity_utilized?: number;
    saturation_rate?: number;
    service_request_id?: string; // Se for rejeição de serviço
    reason?: string;
  };
  
  created_at: string;
  immutable: true; // Eventos são imutáveis
}

/**
 * Snapshot de capacidade por período (para análise histórica)
 */
export interface CapacitySnapshot {
  snapshot_id: string;
  store_id: string;
  period: {
    start: string;
    end: string;
  };
  
  // Métricas agregadas
  total_resources: number;
  active_resources: number;
  overloaded_resources: number;
  
  // Capacidade
  total_capacity: number;
  average_utilization: number;
  peak_utilization: number;
  
  // Serviços
  services_completed: number;
  services_rejected: number;
  rejection_rate: number; // Taxa de rejeição por capacidade (0-1)
  
  // Gargalos
  bottleneck_count: number;
  bottleneck_resources: string[]; // IDs dos recursos que foram gargalo
  
  generated_at: string;
  immutable: true; // Snapshots são imutáveis
}




