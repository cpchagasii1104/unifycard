// backend/src/core/compatibility/service-setup.types.ts
// Setups do Artista/Banda
// 🔴 BLINDAGEM: Metadata para compatibilidade técnica

import type { EventCapacityClass } from './event-capacity.types';

export interface ServiceSetupPackage {
  id: string;
  label: string;
  brings: string[]; // O que o artista traz
  requires: string[]; // O que o local DEVE ter
  optional?: string[]; // O que o local PODE ter (recomendado)
  minCapacityClass?: EventCapacityClass;
  maxCapacityClass?: EventCapacityClass;
  priceModifier: number; // Multiplicador de preço (ex: 1.2 = +20%)
}

export interface ServiceSetupsMetadata {
  setups: ServiceSetupPackage[];
}




