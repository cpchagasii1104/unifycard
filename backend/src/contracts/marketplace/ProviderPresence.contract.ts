// backend/src/contracts/marketplace/ProviderPresence.contract.ts
// CONTRATO PÚBLICO CONGELADO - ProviderPresence (Presença/Online de Provider)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * ProviderPresence - Presença/Online de Provider
 * 
 * Sistema canônico de presença para providers de serviços.
 * Dispatch só para providers online.
 * SLA de resposta alimenta governança.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface ProviderPresence {
  presenceId: string;
  providerActorId: string; // ID do provider (store/service_provider)
  status: 'online' | 'offline';
  region: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
  };
  lastSeen: string; // ISO 8601 - Última vez que foi visto online
  responseSlaMetrics?: {
    averageResponseTimeMinutes: number; // Tempo médio de resposta a dispatches
    totalDispatchesReceived: number; // Total de dispatches recebidos
    totalDispatchesAccepted: number; // Total de dispatches aceitos
    totalDispatchesDeclined: number; // Total de dispatches recusados
    lastResponseTimeMinutes?: number; // Tempo de resposta do último dispatch
  };
  createdAt: string;
  updatedAt: string;
}





