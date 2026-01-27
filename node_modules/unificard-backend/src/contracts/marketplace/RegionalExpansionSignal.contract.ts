// CONTRATO PÚBLICO CONGELADO - RegionalExpansionSignal (Sinal de Expansão Regional)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

import { BottleneckCause, SLARiskLevel, RegionalCapacityStatus } from './RegionalCapacitySnapshot.contract';

/**
 * Tipo de sinal de expansão
 */
export type ExpansionSignalType =
  | 'need_more_providers' // Precisa de mais prestadores
  | 'need_more_capacity' // Precisa de mais capacidade
  | 'need_specialized_provider' // Precisa de prestador especializado
  | 'need_extended_hours'; // Precisa de horários estendidos

/**
 * Funcionalidade desbloqueada
 */
export type ExpansionUnlockFeature =
  | 'facilitated_onboarding' // Onboarding facilitado para a categoria
  | 'economic_incentive' // Incentivo econômico disponível
  | 'service_catalog_suggestion' // Sugestão de ativação de novos serviços
  | 'b2b_capacity_market' // Mercado de capacidade B2B habilitado
  | 'strategic_vouchers'; // Vouchers estratégicos liberados

/**
 * Sinal de expansão regional (imutável)
 * Gerado automaticamente a partir de snapshots de capacidade regional
 */
export interface RegionalExpansionSignal {
  signal_id: string;
  region_id: string; // cidade ou bairro
  service_category: string; // Categoria de serviço afetada
  
  signal_type: ExpansionSignalType;
  bottleneck_cause: BottleneckCause;
  
  // Métricas que dispararam o sinal
  triggering_metrics: {
    status: RegionalCapacityStatus; // Status da capacidade regional
    sla_risk_level: SLARiskLevel; // Risco de SLA
    request_expiration_rate: number; // Taxa de expiração de requests
    dispatch_rejection_rate: number; // Taxa de rejeição de dispatches
    avg_utilization_rate: number; // Taxa média de utilização
    overloaded_resources_ratio: number; // Proporção de recursos sobrecarregados
  };
  
  // Horário crítico (se aplicável)
  critical_time_window?: {
    weekdays?: number[]; // Dias da semana críticos
    time_start?: string; // Horário de início crítico
    time_end?: string; // Horário de fim crítico
  };
  
  // Snapshot de origem
  source_snapshot_id: string; // ID do snapshot que gerou este sinal
  
  // Funcionalidades desbloqueadas
  unlocked_features: ExpansionUnlockFeature[];
  
  // Status do sinal
  status: 'active' | 'resolved' | 'expired'; // active = ainda relevante, resolved = gargalo resolvido, expired = expirou
  
  created_at: string;
  resolved_at?: string; // Quando o gargalo foi resolvido
  immutable: true; // Sinais são imutáveis
}

/**
 * Desbloqueio de expansão (registro de funcionalidade habilitada)
 */
export interface ExpansionUnlock {
  unlock_id: string;
  signal_id: string; // Sinal que gerou este desbloqueio
  region_id: string;
  service_category: string;
  
  feature: ExpansionUnlockFeature;
  
  // Detalhes do desbloqueio
  details: {
    description: string; // Descrição do que foi desbloqueado
    eligibility_criteria?: string[]; // Critérios de elegibilidade
    available_until?: string; // Data até quando está disponível
  };
  
  // Status
  status: 'available' | 'consumed' | 'expired';
  consumed_at?: string; // Quando foi consumido/utilizado
  
  created_at: string;
  updated_at: string;
  immutable: false; // Desbloqueios podem ser atualizados (status)
}




