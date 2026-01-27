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
  offer_id: string;
  issuer_actor_id: string; // Empresa/loja que emite
  store_id: string;
  
  type: VoucherType;
  title: string;
  description: string;
  
  // Visibilidade
  visibility_scope: VoucherVisibilityScope;
  restricted_group_ids?: string[]; // Se scope = restricted_group
  
  // Janela de resgate
  start_at: string; // Quando a oferta fica disponível para resgate
  end_at: string; // Quando a oferta para de aceitar novos resgates
  redemption_deadline_at?: string; // Prazo para usar após resgatar (opcional, padrão: end_at + X dias)
  
  // Quantidade
  quantity_total: number; // Total de vouchers disponíveis
  quantity_claimed: number; // Quantidade já resgatada
  quantity_per_user: number; // Máximo por usuário (padrão: 1)
  
  // Elegibilidade
  eligibility: {
    min_trust_level?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
    new_users_only?: boolean; // Apenas usuários novos
    first_purchase_required?: boolean; // Requer primeira compra
  };
  
  // Restrições
  schedule_constraints?: {
    weekdays?: number[]; // 0 = domingo, 6 = sábado
    time_start?: string; // Ex: "14:00"
    time_end?: string; // Ex: "17:00"
  };
  
  pickup_constraints?: {
    max_minutes_after_claim?: number; // Ex: 45 minutos após resgate
    requires_checkin?: boolean; // Requer check-in geofence
  };
  
  // Vinculação
  linked_product_id?: string; // Se type = product
  linked_service_template_id?: string; // Se type = service
  linked_service_offering_id?: string; // Se type = service
  linked_bundle_items?: Array<{
    product_id?: string;
    service_offering_id?: string;
    quantity: number;
  }>;
  
  // Valor (opcional, pode ser 100% desconto)
  discount_value?: {
    type: 'percentage' | 'fixed';
    amount: number; // Percentual (0-100) ou valor fixo em centavos
    currency: string;
  };
  
  status: VoucherOfferStatus;
  
  created_at: string;
  updated_at: string;
  immutable: false; // Oferta pode ser atualizada (mas não após ativação)
}




