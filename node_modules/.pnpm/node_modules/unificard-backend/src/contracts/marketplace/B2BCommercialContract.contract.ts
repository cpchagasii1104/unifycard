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
  contractId: string;
  supplierId: string; // ID do fornecedor (loja, indústria, hub)
  supplierType: 'store' | 'hub' | 'industry';
  buyerId: string; // ID do comprador (loja, hub)
  buyerType: 'store' | 'hub';
  region: {
    country: string;
    state: string;
    city: string;
  };
  products: Array<{
    productId: string;
    name: string;
    unitPrice: number;
    currency: string;
    minimumQuantity: number;
    maximumQuantity?: number;
  }>;
  terms: {
    volumeCommitment: number; // Volume total comprometido
    deliverySchedule: 'weekly' | 'monthly' | 'quarterly';
    paymentTerms: 'net_15' | 'net_30' | 'net_60' | 'prepaid';
    penaltyRate?: number; // Taxa de multa por atraso (percentual)
  };
  status: 'draft' | 'active' | 'fulfilled' | 'breached' | 'cancelled';
  startDate: string;
  endDate: string;
  createdAt: string;
  signedAt?: string;
  // NÃO incluir updatedAt - contrato só pode ser assinado, não editado
}





