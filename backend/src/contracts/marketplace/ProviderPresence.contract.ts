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
  presence_id: string;
  provider_actor_id: string; // ID do provider (store/service_provider)
  status: 'online' | 'offline';
  region: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
  };
  last_seen: string; // ISO 8601 - Última vez que foi visto online
  response_sla_metrics?: {
    average_response_time_minutes: number; // Tempo médio de resposta a dispatches
    total_dispatches_received: number; // Total de dispatches recebidos
    total_dispatches_accepted: number; // Total de dispatches aceitos
    total_dispatches_declined: number; // Total de dispatches recusados
    last_response_time_minutes?: number; // Tempo de resposta do último dispatch
  };
  created_at: string;
  updated_at: string;
}





