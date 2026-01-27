// backend/src/contracts/marketplace/B2BCommercialContract.contract.ts
// CONTRATO PÚBLICO CONGELADO - B2BCommercialContract (Contrato Comercial B2B)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * B2BCommercialContract - Contrato Comercial B2B entre Atores
 * 
 * Contrato fornecedor ↔ loja ↔ indústria
 * Preço, volume, prazo, multa
 * Execução via PaymentPlan
 * Sem renegociação automática
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface B2BCommercialContract {
  contract_id: string;
  supplier_id: string; // ID do fornecedor (loja, indústria, hub)
  supplier_type: 'store' | 'hub' | 'industry';
  buyer_id: string; // ID do comprador (loja, hub)
  buyer_type: 'store' | 'hub';
  region: {
    country: string;
    state: string;
    city: string;
  };
  products: Array<{
    product_id: string;
    name: string;
    unit_price: number;
    currency: string;
    minimum_quantity: number;
    maximum_quantity?: number;
  }>;
  terms: {
    volume_commitment: number; // Volume total comprometido
    delivery_schedule: 'weekly' | 'monthly' | 'quarterly';
    payment_terms: 'net_15' | 'net_30' | 'net_60' | 'prepaid';
    penalty_rate?: number; // Taxa de multa por atraso (percentual)
  };
  status: 'draft' | 'active' | 'fulfilled' | 'breached' | 'cancelled';
  start_date: string;
  end_date: string;
  created_at: string;
  signed_at?: string;
  // NÃO incluir updated_at - contrato só pode ser assinado, não editado
}





