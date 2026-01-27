// backend/src/contracts/marketplace/DisputeCase.contract.ts
// CONTRATO PÚBLICO CONGELADO - DisputeCase (Caso de Disputa)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * DisputeCase - Caso de disputa no Marketplace
 * 
 * Disputa NÃO trava ledger.
 * Ajustes geram novos lançamentos.
 * Tudo auditável e determinístico.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface DisputeCase {
  dispute_id: string;
  order_id: string;
  checkout_id?: string; // Opcional, se houver checkout
  actor_involved: {
    actor_id: string;
    actor_type: 'store' | 'hub' | 'industry' | 'service_provider' | 'customer';
    role: 'seller' | 'fulfillment' | 'buyer' | 'platform';
  };
  type: 'delivery' | 'quality' | 'payment' | 'cancellation' | 'other';
  status: 'open' | 'under_review' | 'resolved' | 'rejected' | 'escalated';
  description: string;
  resolution?: {
    resolution_type: 'refund' | 'partial_refund' | 'replacement' | 'credit' | 'dismissed';
    amount?: number; // Se houver reembolso
    currency?: string;
    ledger_entry_id?: string; // ID do novo lançamento gerado
    resolved_by: string; // user_id ou 'system'
    resolved_at: string;
    notes?: string;
  };
  created_at: string;
  updated_at: string;
}





