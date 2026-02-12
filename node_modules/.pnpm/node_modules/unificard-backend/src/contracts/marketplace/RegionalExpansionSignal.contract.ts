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
  signalId: string;
  regionId: string; // cidade ou bairro
  serviceCategory: string; // Categoria de serviço afetada
  
  signalType: ExpansionSignalType;
  bottleneckCause: BottleneckCause;
  
  // Métricas que dispararam o sinal
  triggeringMetrics: {
    status: RegionalCapacityStatus; // Status da capacidade regional
    slaRiskLevel: SLARiskLevel; // Risco de SLA
    requestExpirationRate: number; // Taxa de expiração de requests
    dispatchRejectionRate: number; // Taxa de rejeição de dispatches
    avgUtilizationRate: number; // Taxa média de utilização
    overloadedResourcesRatio: number; // Proporção de recursos sobrecarregados
  };
  
  // Horário crítico (se aplicável)
  criticalTimeWindow?: {
    weekdays?: number[]; // Dias da semana críticos
    timeStart?: string; // Horário de início crítico
    timeEnd?: string; // Horário de fim crítico
  };
  
  // Snapshot de origem
  sourceSnapshotId: string; // ID do snapshot que gerou este sinal
  
  // Funcionalidades desbloqueadas
  unlockedFeatures: ExpansionUnlockFeature[];
  
  // Status do sinal
  status: 'active' | 'resolved' | 'expired'; // active = ainda relevante, resolved = gargalo resolvido, expired = expirou
  
  createdAt: string;
  resolvedAt?: string; // Quando o gargalo foi resolvido
  immutable: true; // Sinais são imutáveis
}

/**
 * Desbloqueio de expansão (registro de funcionalidade habilitada)
 */
export interface ExpansionUnlock {
  unlockId: string;
  signalId: string; // Sinal que gerou este desbloqueio
  regionId: string;
  serviceCategory: string;
  
  feature: ExpansionUnlockFeature;
  
  // Detalhes do desbloqueio
  details: {
    description: string; // Descrição do que foi desbloqueado
    eligibilityCriteria?: string[]; // Critérios de elegibilidade
    availableUntil?: string; // Data até quando está disponível
  };
  
  // Status
  status: 'available' | 'consumed' | 'expired';
  consumedAt?: string; // Quando foi consumido/utilizado
  
  createdAt: string;
  updatedAt: string;
  immutable: false; // Desbloqueios podem ser atualizados (status)
}




