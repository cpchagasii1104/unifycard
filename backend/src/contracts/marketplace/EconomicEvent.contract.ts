// backend/src/contracts/marketplace/EconomicEvent.contract.ts
// CONTRATO PÚBLICO CONGELADO - EconomicEvent (Evento Econômico)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * EconomicEvent - Evento Econômico do Marketplace
 * 
 * Feed Econômico determinístico, transparente e anti-spam.
 * Mostra impacto real do ecossistema local.
 * NÃO é rede social. NÃO é timeline. É observabilidade econômica pública.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface EconomicEvent {
  event_id: string;
  type:
    | 'order_created'
    | 'order_completed'
    | 'service_booked'
    | 'subscription_started'
    | 'subscription_cycle_generated'
    | 'regional_fund_credit'
    | 'regional_fund_allocation'
    | 'new_store_opened'
    | 'industry_product_activated'
    | 'batch_executed'
    | 'company_onboarded'
    | 'service_request_created'
    | 'service_request_accepted'
    | 'bundle_service_booked'
    | 'service_pre_reservation_created'
    | 'service_pre_reservation_expired'
    | 'service_pre_reservation_confirmed'
    | 'service_dispatch_retried'
    | 'service_completed'
    | 'service_evaluation_submitted'
    | 'service_evaluation_missing'
    | 'user_low_evaluation';
  region: {
    country: string;
    state: string;
    city: string;
  };
  actor_id: string; // ID do ator principal (loja, usuário, fundo, etc.)
  actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider' | 'regional_fund';
  reference_id?: string; // order_id, fund_id, subscription_id, etc.
  amount?: number; // Quando aplicável (pedidos, alocações, etc.)
  currency?: string; // Quando aplicável
  visibility: 'public' | 'local' | 'restricted'; // Escopo de visibilidade
  display_text: string; // Texto canônico gerado no backend
  created_at: string;
  // NÃO incluir updated_at - eventos são imutáveis
}

