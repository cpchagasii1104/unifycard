// canonical-units.service.ts
// DECISION-0117 H — registry canônico de unidades, FAIL-CLOSED.
//
// Compatibilidade = mesma dimension. SEM conversão automática nesta macrofrente:
// agregar/comparar exige a MESMA unidade; unidades distintas (mesmo compatíveis
// em dimensão, ex.: kg×g, l×garrafa) NÃO somam e NÃO comparam silenciosamente —
// separar, informar ou falhar fechado.

import { pool } from '../../database/pool';

export interface CanonicalUnit {
  unitCode: string;
  dimension: string;
  symbol: string;
  displayName: string;
  precisionScale: number;
  isActive: boolean;
}

export class CanonicalUnitError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'CanonicalUnitError';
  }
}

interface UnitRow {
  unit_code: string;
  dimension: string;
  symbol: string;
  display_name: string;
  precision_scale: number;
  is_active: boolean;
}

let cache: Map<string, CanonicalUnit> | null = null;

async function loadRegistry(): Promise<Map<string, CanonicalUnit>> {
  if (cache) return cache;
  const r = await pool.query<UnitRow>(
    `SELECT unit_code, dimension, symbol, display_name, precision_scale, is_active
       FROM canonical_units WHERE is_active = true`
  );
  const m = new Map<string, CanonicalUnit>();
  for (const row of r.rows) {
    m.set(row.unit_code, {
      unitCode: row.unit_code,
      dimension: row.dimension,
      symbol: row.symbol,
      displayName: row.display_name,
      precisionScale: row.precision_scale,
      isActive: row.is_active,
    });
  }
  cache = m;
  return m;
}

/** Invalida o cache (testes / seeds novos). */
export function invalidateCanonicalUnitsCache(): void {
  cache = null;
}

export const canonicalUnitsService = {
  async getUnit(unitCode: string): Promise<CanonicalUnit | null> {
    const reg = await loadRegistry();
    return reg.get(String(unitCode ?? '').trim()) ?? null;
  },

  async listUnits(): Promise<CanonicalUnit[]> {
    const reg = await loadRegistry();
    return [...reg.values()];
  },

  /** Unidade desconhecida ⇒ 422 UNIT_UNKNOWN (fail-closed; sem fallback). */
  async assertUnitKnown(unitCode: string): Promise<CanonicalUnit> {
    const u = await this.getUnit(unitCode);
    if (!u) {
      throw new CanonicalUnitError(
        422,
        'UNIT_UNKNOWN',
        `Unidade '${unitCode}' não existe no registry canônico — operação bloqueada (DECISION-0117 H).`
      );
    }
    return u;
  },

  /**
   * Agregação/comparação SÓ entre unidades IDÊNTICAS (sem conversão canônica
   * nesta frente). kg×un, l×garrafa, kg×g ⇒ 422 UNIT_INCOMPATIBLE.
   */
  async assertUnitsAggregatable(unitA: string, unitB: string): Promise<void> {
    const a = await this.assertUnitKnown(unitA);
    const b = await this.assertUnitKnown(unitB);
    if (a.unitCode !== b.unitCode) {
      throw new CanonicalUnitError(
        422,
        'UNIT_INCOMPATIBLE',
        `Unidades '${a.unitCode}' e '${b.unitCode}' não podem ser somadas/comparadas sem conversão canônica (DECISION-0117 H — fail-closed).`
      );
    }
  },

  /**
   * Soma quantidades fail-closed: todas as parcelas devem ter a MESMA unidade
   * conhecida; senão lança UNIT_INCOMPATIBLE/UNIT_UNKNOWN. Nunca soma silenciosa.
   */
  async sumQuantitiesStrict(parts: Array<{ quantity: number; unit: string }>): Promise<{ total: number; unit: string } | null> {
    if (parts.length === 0) return null;
    const first = await this.assertUnitKnown(parts[0].unit);
    let total = 0;
    for (const p of parts) {
      await this.assertUnitsAggregatable(first.unitCode, p.unit);
      total += p.quantity;
    }
    return { total, unit: first.unitCode };
  },
};
