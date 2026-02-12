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
  claimId: string;
  offerId: string;
  claimerUserId: string;
  
  status: VoucherClaimStatus;
  
  claimedAt: string;
  redemptionCode: string; // Código curto, não adivinhável (ex: "ABC123")
  
  redeemedAt?: string;
  expiresAt: string; // Prazo individual do claim (min(endAt + redemptionDeadlinePolicy, policyDefault))
  
  storeCheckinRequired: boolean;
  checkedInAt?: string; // Quando o usuário fez check-in (se exigido)
  
  // Auditoria (anti-revenda)
  audit: {
    ipHash?: string; // Hash do IP (opcional, para detecção de abuso)
    deviceHash?: string; // Hash do device (opcional)
    claimedFromNeighborhood?: string; // Bairro de onde foi resgatado
    claimedFromCity?: string; // Cidade de onde foi resgatado
  };
  
  // Vinculação após resgate
  linkedOrderId?: string; // Se type = product, vincula ao Order criado
  linkedServiceBookingId?: string; // Se type = service, vincula ao ServiceBooking criado
  
  createdAt: string;
  updatedAt: string;
  immutable: true; // Claim é imutável após criação (apenas status pode mudar)
}




