// backend/src/core/compatibility/venue-infrastructure.types.ts
// Inventário de Infraestrutura do Local
// 🔴 BLINDAGEM: Metadata para compatibilidade técnica

export interface VenueInfrastructureMetadata {
  available: string[]; // Ex: ["PA", "monitor", "backline", "iluminação", "palco"]
  unavailable: string[]; // Ex: ["som", "backline"]
  constraints: string[]; // Ex: ["sem elevador", "acesso limitado"]
  notes?: string;
}

// Itens comuns de infraestrutura
export const COMMON_INFRASTRUCTURE_ITEMS = [
  'PA',
  'monitor',
  'backline',
  'iluminação',
  'palco',
  'som',
  'energia',
  'internet',
  'estacionamento',
  'camarim',
  'área de carga',
  'elevador',
] as const;

export type InfrastructureItem = typeof COMMON_INFRASTRUCTURE_ITEMS[number];




