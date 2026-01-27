// backend/src/contracts/marketplace/OperationalCostProfile.contract.ts
// CONTRATO PÚBLICO CONGELADO - OperationalCostProfile (Perfil de Custo Operacional)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * OperationalCostProfile - Perfil de Custo Operacional (Opt-in, Privado)
 * 
 * Sistema de Consciência de Custo e Sustentabilidade Econômica.
 * Ferramenta interna para ajudar o comerciante a entender a viabilidade econômica do próprio negócio.
 * 
 * NÃO sugere preços.
 * NÃO altera valores automaticamente.
 * NÃO compara negócios entre si.
 * NÃO gera score público.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface OperationalCostProfile {
  profile_id: string;
  actor_id: string; // ID da loja ou serviço
  actor_type: 'store' | 'service_provider';
  period: {
    year: number;
    month: number; // 1-12
  };
  fixed_costs: {
    rent?: number; // Aluguel
    utilities?: number; // Energia, água, gás
    internet?: number; // Internet
    salaries?: number; // Salários
    taxes?: number; // Impostos
    other?: number; // Outros custos fixos
  };
  variable_costs: Array<{
    product_id?: string; // Se aplicável
    service_id?: string; // Se aplicável
    cost_per_unit: number; // Custo médio por unidade
    currency: string;
  }>;
  declared_volume_expectation?: number; // Volume esperado (opcional)
  currency: string;
  created_at: string;
  updated_at: string; // Permite atualização (opt-in)
}





