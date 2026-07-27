// backend/src/modules/events/__tests__/event-sector.math.test.ts
// SLICE S3 (SETORES) — prova que deriveMeiaTicketFloor arredonda o PISO legal PARA CIMA (ceil), nunca
// para baixo (floor) — floor pode devolver MENOS que os 40% mínimos que a lei garante (Lei 12.933/2013
// + Decreto 8.537/2015). Teste PURO (sem DB) — Bank-free, Δbank=0.

import { describe, it, expect } from '@jest/globals';
import { deriveMeiaTicketFloor } from '../event-sector.math';

describe('deriveMeiaTicketFloor (SLICE S3 — piso legal da meia, arredondamento CEIL)', () => {
  it('capacity=7, meiaQuotaBps=4000 (40%) → 3 (42.9% ≥ 40% ✓); floor daria 2 (28.6% < 40% ✗ ILEGAL)', () => {
    const capacity = 7;
    const meiaQuotaBps = 4000;
    const ceilResult = deriveMeiaTicketFloor(capacity, meiaQuotaBps);
    const floorWouldGive = Math.floor((capacity * meiaQuotaBps) / 10000);

    expect(ceilResult).toBe(3);
    expect(floorWouldGive).toBe(2);
    // prova que o floor (convenção ERRADA) cai abaixo do piso legal de 40%.
    expect(floorWouldGive / capacity).toBeLessThan(0.4);
    // prova que o ceil (convenção CORRETA) cumpre o piso legal de 40%.
    expect(ceilResult / capacity).toBeGreaterThanOrEqual(0.4);
  });

  it('capacity=5000, meiaQuotaBps=4000 (40%) → 2000 (caso par, sem diferença floor×ceil)', () => {
    expect(deriveMeiaTicketFloor(5000, 4000)).toBe(2000);
  });

  it('capacity=1, meiaQuotaBps=4000 (40%) → 1 (setor de 1 ingresso ainda reserva esse único ingresso à meia — leitura conservadora/compliant do piso mínimo da lei)', () => {
    expect(deriveMeiaTicketFloor(1, 4000)).toBe(1);
  });

  it('capacity=10, meiaQuotaBps=10000 (100%) → 10 (cota máxima cobre a capacidade inteira)', () => {
    expect(deriveMeiaTicketFloor(10, 10000)).toBe(10);
  });
});
