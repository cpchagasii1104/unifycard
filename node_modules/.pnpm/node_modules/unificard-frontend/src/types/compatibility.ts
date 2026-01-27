// frontend/src/types/compatibility.ts
// Tipos de Compatibilidade Técnica

export type EventCapacityClass = 'S' | 'M' | 'L' | 'XL' | 'XXL';

export function getCapacityClass(attendance: number): EventCapacityClass {
  if (attendance <= 50) return 'S';
  if (attendance <= 200) return 'M';
  if (attendance <= 800) return 'L';
  if (attendance <= 3000) return 'XL';
  return 'XXL';
}

export interface EventCapacityMetadata {
  expectedAttendance: number;
  capacityClass: EventCapacityClass;
}

export interface VenueInfrastructureMetadata {
  available: string[];
  unavailable: string[];
  constraints: string[];
  notes?: string;
}

export interface ServiceSetupPackage {
  id: string;
  label: string;
  brings: string[];
  requires: string[];
  optional?: string[];
  minCapacityClass?: EventCapacityClass;
  maxCapacityClass?: EventCapacityClass;
  priceModifier: number;
}

export interface ServiceSetupsMetadata {
  setups: ServiceSetupPackage[];
}

export type CompatibilityStatus = 'OK' | 'WARNING' | 'BLOCKED';

export interface CompatibilityResult {
  status: CompatibilityStatus;
  missingRequired: string[];
  missingOptional: string[];
  extraAvailable: string[];
  capacityMismatch?: boolean;
  requiresProductionAssistance?: boolean;
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

