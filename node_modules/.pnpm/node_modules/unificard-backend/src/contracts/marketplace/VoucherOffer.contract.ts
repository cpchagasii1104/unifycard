// CONTRATO PÚBLICO CONGELADO - VoucherOffer (Oferta de Voucher)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * Tipo de voucher
 */
export type VoucherType = 'product' | 'service' | 'bundle';

/**
 * Escopo de visibilidade
 */
export type VoucherVisibilityScope = 'local_neighborhood' | 'city' | 'restricted_group';

/**
 * Status da oferta
 */
export type VoucherOfferStatus = 'draft' | 'active' | 'paused' | 'expired' | 'depleted';

/**
 * Oferta de voucher (ofertas relâmpago, benefícios imediatos)
 */
export interface VoucherOffer {
  offerId: string;
  issuerActorId: string; // Empresa/loja que emite
  storeId: string;
  
  type: VoucherType;
  title: string;
  description: string;
  
  // Visibilidade
  visibilityScope: VoucherVisibilityScope;
  restrictedGroupIds?: string[]; // Se scope = restricted_group
  
  // Janela de resgate
  startAt: string; // Quando a oferta fica disponível para resgate
  endAt: string; // Quando a oferta para de aceitar novos resgates
  redemptionDeadlineAt?: string; // Prazo para usar após resgatar (opcional, padrão: endAt + X dias)
  
  // Quantidade
  quantityTotal: number; // Total de vouchers disponíveis
  quantityClaimed: number; // Quantidade já resgatada
  quantityPerUser: number; // Máximo por usuário (padrão: 1)
  
  // Elegibilidade
  eligibility: {
    minTrustLevel?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
    newUsersOnly?: boolean; // Apenas usuários novos
    firstPurchaseRequired?: boolean; // Requer primeira compra
  };
  
  // Restrições
  scheduleConstraints?: {
    weekdays?: number[]; // 0 = domingo, 6 = sábado
    timeStart?: string; // Ex: "14:00"
    timeEnd?: string; // Ex: "17:00"
  };
  
  pickupConstraints?: {
    maxMinutesAfterClaim?: number; // Ex: 45 minutos após resgate
    requiresCheckin?: boolean; // Requer check-in geofence
  };
  
  // Vinculação
  linkedProductId?: string; // Se type = product
  linkedServiceTemplateId?: string; // Se type = service
  linkedServiceOfferingId?: string; // Se type = service
  linkedBundleItems?: Array<{
    productId?: string;
    serviceOfferingId?: string;
    quantity: number;
  }>;
  
  // Valor (opcional, pode ser 100% desconto)
  discountValue?: {
    type: 'percentage' | 'fixed';
    amountCents: number; // Percentual (0-100) ou valor fixo em centavos
    currency: string;
  };
  
  status: VoucherOfferStatus;
  
  createdAt: string;
  updatedAt: string;
  immutable: false; // Oferta pode ser atualizada (mas não após ativação)
}





