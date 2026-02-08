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
  disputeId: string;
  orderId: string;
  checkoutId?: string; // Opcional, se houver checkout
  actorInvolved: {
    actorId: string;
    actorType: 'store' | 'hub' | 'industry' | 'service_provider' | 'customer';
    role: 'seller' | 'fulfillment' | 'buyer' | 'platform';
  };
  type: 'delivery' | 'quality' | 'payment' | 'cancellation' | 'other';
  status: 'open' | 'under_review' | 'resolved' | 'rejected' | 'escalated';
  description: string;
  resolution?: {
    resolutionType: 'refund' | 'partial_refund' | 'replacement' | 'credit' | 'dismissed';
    amountCents: number; // Se houver reembolso
    currency?: string;
    ledgerEntryId?: string; // ID do novo lançamento gerado
    resolvedBy: string; // userId ou 'system'
    resolvedAt: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}






