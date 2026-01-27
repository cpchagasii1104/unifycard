// backend/src/core/compatibility/event-capacity.types.ts
// Classificação de Capacidade de Evento
// 🔴 BLINDAGEM: Enum canônico para compatibilidade técnica

export type EventCapacityClass = 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface EventCapacityMetadata {
  expectedAttendance: number;
  capacityClass: EventCapacityClass;
}

export function getCapacityClass(attendance: number): EventCapacityClass {
  if (attendance <= 50) return 'S';
  if (attendance <= 200) return 'M';
  if (attendance <= 800) return 'L';
  if (attendance <= 3000) return 'XL';
  return 'XXL';
}

export function getCapacityClassLabel(capacityClass: EventCapacityClass): string {
  const labels: Record<EventCapacityClass, string> = {
    S: 'Pequeno (≤50)',
    M: 'Médio (51-200)',
    L: 'Grande (201-800)',
    XL: 'Extra Grande (801-3000)',
    XXL: 'Mega (>3000)',
  };
  return labels[capacityClass];
}

export function getCapacityClassRange(capacityClass: EventCapacityClass): { min: number; max: number | null } {
  const ranges: Record<EventCapacityClass, { min: number; max: number | null }> = {
    S: { min: 0, max: 50 },
    M: { min: 51, max: 200 },
    L: { min: 201, max: 800 },
    XL: { min: 801, max: 3000 },
    XXL: { min: 3001, max: null },
  };
  return ranges[capacityClass];
}




