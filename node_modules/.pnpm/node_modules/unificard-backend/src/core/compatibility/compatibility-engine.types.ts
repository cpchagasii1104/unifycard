// backend/src/core/compatibility/compatibility-engine.types.ts
// Tipos do Motor de Compatibilidade
// 🔴 BLINDAGEM: Validação técnica antes de booking

export type CompatibilityStatus = 'OK' | 'WARNING' | 'BLOCKED';

export interface CompatibilityResult {
  status: CompatibilityStatus;
  missingRequired: string[];
  missingOptional: string[];
  extraAvailable: string[];
  capacityMismatch?: boolean;
  requiresProductionAssistance?: boolean; // Para XL/XXL
  pricing: {
    basePriceCents?: number;
    modifierApplied?: number;
    finalPriceCents?: number;
    reason: string[];
  };
}

export interface CompatibilityInput {
  eventCapacity: {
    expectedAttendance: number;
    capacityClass: string;
  };
  venueInfrastructure: {
    available: string[];
    unavailable: string[];
    constraints: string[];
  };
  serviceSetup: {
    id: string;
    label: string;
    brings: string[];
    requires: string[];
    optional?: string[];
    minCapacityClass?: string;
    maxCapacityClass?: string;
    priceModifier: number;
  };
  basePriceCents?: number;
}




