// backend/src/contracts/marketplace/DeliveryOrder.contract.ts
// CONTRATO PÚBLICO CONGELADO - DeliveryOrder (Ordem de entrega)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * DeliveryOrder - Ordem de entrega
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface DeliveryOrder {
  deliveryId: string;
  checkoutId: string;
  storeId: string;
  type: 'own' | 'third_party';
  vehicle: 'bike' | 'moto' | 'car' | 'van';
  etaMinutes: number;
  cost: {
    amountCents: number;
    currency: string;
    payer: 'seller' | 'buyer' | 'platform';
  };
  status: 'created' | 'assigned' | 'in_transit' | 'delivered';
}






