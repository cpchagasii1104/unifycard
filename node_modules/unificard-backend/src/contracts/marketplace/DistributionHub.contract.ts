// backend/src/contracts/marketplace/DistributionHub.contract.ts
// CONTRATO PÚBLICO CONGELADO - DistributionHub (Hub de Distribuição Regional)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * DistributionHub - Hub de Distribuição Regional
 * 
 * Função:
 * - recebe pedidos
 * - executa logística
 * - garante SLA regional
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface DistributionHub {
  hub_id: string;
  industry_id: string;
  name: string;
  location: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  supported_products: string[]; // IDs de produtos que o hub suporta
  fulfillment_type: 'pickup' | 'delivery' | 'mixed';
  margin_override?: {
    percentage?: number; // Override da margem padrão da indústria
    fixed_amount?: number; // Margem fixa (opcional)
  };
  logistics_profile: {
    default_eta_minutes: number; // ETA padrão em minutos
    supported_vehicles: Array<'bike' | 'moto' | 'car' | 'van' | 'truck'>;
    cost_per_km?: number; // Custo por km (opcional)
    base_cost?: number; // Custo base de entrega
  };
  active: boolean;
  created_at: string;
  updated_at: string;
}





