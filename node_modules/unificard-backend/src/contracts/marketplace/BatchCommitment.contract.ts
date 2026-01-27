// backend/src/contracts/marketplace/BatchCommitment.contract.ts
// CONTRATO PÚBLICO CONGELADO - BatchCommitment (Compromisso de Compra em Lote)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * BatchCommitment - Compromisso de Compra em Lote
 * 
 * Representa o compromisso de um ator (usuário, loja, hub) em participar
 * de um lote de produção programado.
 * 
 * Nenhum pagamento é realizado até o lote ser fechado e executado.
 * Compromisso pode ser cancelado antes do deadline.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface BatchCommitment {
  commitment_id: string;
  batch_id: string; // Referência ao ProductionBatch
  actor_id: string; // ID do ator (user, store, hub)
  actor_type: 'user' | 'store' | 'hub';
  quantity: number; // Quantidade comprometida
  created_at: string;
  cancelled_at?: string; // Quando foi cancelado (se aplicável)
  status: 'active' | 'cancelled' | 'converted'; // converted = virou Order
  order_id?: string; // ID do Order gerado quando convertido
}





