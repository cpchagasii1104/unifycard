// backend/src/contracts/marketplace/ProductionBatch.contract.ts
// CONTRATO PÚBLICO CONGELADO - ProductionBatch (Lote de Produção Programado)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ProductionBatch - Lote de Produção Programado (Compra Coletiva)
 * 
 * Sistema de Compra Coletiva Programada e Lotes de Produção Comprometidos.
 * Permite que indústrias criem lotes de produção baseados em demanda real,
 * com preço estruturalmente menor por escala (não por promoção).
 * 
 * Nenhum pagamento antes do fechamento.
 * Nenhum estoque encalhado para indústria.
 * Zero risco para comprador (pode cancelar antes do prazo).
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ProductionBatch {
  batchId: string;
  industryId: string; // ID da indústria que cria o lote
  productId: string; // Produto canônico
  minQuantity: number; // Quantidade mínima para executar o lote
  maxQuantity?: number; // Quantidade máxima (opcional)
  unitPrice: {
    amountCents: number;
    currency: string;
  };
  commitDeadline: string; // ISO 8601 - Prazo para compromissos
  regionsAllowed: Array<{
    country: string;
    state: string;
    city: string;
  }>;
  status: 'open' | 'closed' | 'executed' | 'expired';
  totalCommittedQuantity: number; // Quantidade total comprometida
  createdAt: string;
  closedAt?: string; // Quando foi fechado (executado ou expirado)
  updatedAt: string;
}





