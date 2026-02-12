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
  hubId: string;
  industryId: string;
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
  supportedProducts: string[]; // IDs de produtos que o hub suporta
  fulfillmentType: 'pickup' | 'delivery' | 'mixed';
  marginOverride?: {
    percentage?: number; // Override da margem padrão da indústria
    fixedAmount?: number; // Margem fixa (opcional)
  };
  logisticsProfile: {
    defaultEtaMinutes: number; // ETA padrão em minutos
    supportedVehicles: Array<'bike' | 'moto' | 'car' | 'van' | 'truck'>;
    costPerKm?: number; // Custo por km (opcional)
    baseCost?: number; // Custo base de entrega
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}





