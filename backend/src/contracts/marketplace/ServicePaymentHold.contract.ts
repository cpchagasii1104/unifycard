// backend/src/contracts/marketplace/ServicePaymentHold.contract.ts
// CONTRATO PÚBLICO CONGELADO - ServicePaymentHold (Retenção de Pagamento de Serviço)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ServicePaymentHold - Retenção de Pagamento de Serviço (Escrow Light)
 * 
 * Sistema de retenção de pagamento para serviços, garantindo que o dinheiro
 * só seja liberado após confirmação de conclusão do serviço.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ServicePaymentHold {
  holdId: string;
  requestId: string;
  paymentPlanId: string;
  amountCents: number;
  currency: string;
  status: 'held' | 'released' | 'disputed' | 'expired';
  createdAt: string;
  releaseDeadlineAt: string; // ISO 8601 - Quando o hold expira (auto-release se não houver disputa)
  releasePolicy: 'client_confirm' | 'auto_after_deadline' | 'provider_confirm_with_proof';
  releasedAt?: string; // ISO 8601 - Quando foi liberado
  releasedBy?: string; // actorId que liberou (customer, provider, ou 'auto')
  disputeCaseId?: string; // ID do DisputeCase se houver disputa
}





