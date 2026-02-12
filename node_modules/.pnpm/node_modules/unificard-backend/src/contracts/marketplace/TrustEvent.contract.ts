// backend/src/contracts/marketplace/TrustEvent.contract.ts
// CONTRATO PÚBLICO CONGELADO - TrustEvent (Evento de Trust)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * TrustEvent - Evento de mudança de Trust Level
 * 
 * Eventos são imutáveis.
 * Registram todas as mudanças de trust level com motivo e fonte.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface TrustEvent {
  trustEventId: string;
  actorId: string;
  actorType: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  type: 'upgrade' | 'downgrade' | 'restriction' | 'suspension';
  fromLevel: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  toLevel: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  reason: string; // Motivo determinístico da mudança
  source: 'sla' | 'dispute' | 'payment' | 'manual_system' | 'verification';
  metadata?: Record<string, any>; // Dados adicionais (ex: snapshotId, disputeId)
  createdAt: string;
  // NÃO incluir updatedAt - eventos são imutáveis
}





