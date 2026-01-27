// CONTRATO PÚBLICO CONGELADO - VoucherRedemptionEvent (Evento de Voucher)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * Tipo de evento de voucher
 */
export type VoucherEventType =
  | 'offer_created'
  | 'offer_activated'
  | 'offer_paused'
  | 'offer_expired'
  | 'offer_depleted'
  | 'claim_created'
  | 'claim_cancelled'
  | 'claim_expired'
  | 'redeemed'
  | 'no_show_marked';

/**
 * Evento de voucher (append-only, imutável)
 */
export interface VoucherRedemptionEvent {
  event_id: string;
  offer_id: string;
  claim_id?: string; // Se for evento relacionado a claim
  
  actor_id: string; // Quem executou: usuário/empresa
  type: VoucherEventType;
  
  metadata: {
    // Determinístico, sem dados sensíveis
    offer_title?: string;
    claimer_user_id?: string;
    redemption_code?: string;
    reason?: string; // Motivo de cancelamento, expiração, etc.
    quantity_remaining?: number; // Quantidade restante na oferta
  };
  
  created_at: string;
  immutable: true; // Eventos são imutáveis
}




