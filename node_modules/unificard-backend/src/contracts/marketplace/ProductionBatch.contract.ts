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
  batch_id: string;
  industry_id: string; // ID da indústria que cria o lote
  product_id: string; // Produto canônico
  min_quantity: number; // Quantidade mínima para executar o lote
  max_quantity?: number; // Quantidade máxima (opcional)
  unit_price: {
    amount: number;
    currency: string;
  };
  commit_deadline: string; // ISO 8601 - Prazo para compromissos
  regions_allowed: Array<{
    country: string;
    state: string;
    city: string;
  }>;
  status: 'open' | 'closed' | 'executed' | 'expired';
  total_committed_quantity: number; // Quantidade total comprometida
  created_at: string;
  closed_at?: string; // Quando foi fechado (executado ou expirado)
  updated_at: string;
}





