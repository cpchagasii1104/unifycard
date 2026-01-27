// CONTRATO PÚBLICO CONGELADO - VoucherClaim (Resgate de Voucher)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * Status do claim
 */
export type VoucherClaimStatus = 'claimed' | 'redeemed' | 'expired' | 'cancelled' | 'no_show';

/**
 * Resgate de voucher (claim)
 */
export interface VoucherClaim {
  claim_id: string;
  offer_id: string;
  claimer_user_id: string;
  
  status: VoucherClaimStatus;
  
  claimed_at: string;
  redemption_code: string; // Código curto, não adivinhável (ex: "ABC123")
  
  redeemed_at?: string;
  expires_at: string; // Prazo individual do claim (min(end_at + redemption_deadline_policy, policy_default))
  
  store_checkin_required: boolean;
  checked_in_at?: string; // Quando o usuário fez check-in (se exigido)
  
  // Auditoria (anti-revenda)
  audit: {
    ip_hash?: string; // Hash do IP (opcional, para detecção de abuso)
    device_hash?: string; // Hash do device (opcional)
    claimed_from_neighborhood?: string; // Bairro de onde foi resgatado
    claimed_from_city?: string; // Cidade de onde foi resgatado
  };
  
  // Vinculação após resgate
  linked_order_id?: string; // Se type = product, vincula ao Order criado
  linked_service_booking_id?: string; // Se type = service, vincula ao ServiceBooking criado
  
  created_at: string;
  updated_at: string;
  immutable: true; // Claim é imutável após criação (apenas status pode mudar)
}




