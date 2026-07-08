// backend/src/core/catalog/vehicle-catalog.service.ts
// CAPACIDADE TRANSVERSAL (ARVORE.png: "Catálogo" na copa, reutilizado por N setores). Marca/modelo
// de veículo GOVERNADOS — impede texto livre duplicado entre rides, locação, venda e peças
// automotivas (achado Clayton 2026-07-07). NÃO redefine CONCEPT ('carro'/'motocicleta'/...) — é
// materialização operacional de atributo, análoga a canonical_products (doc 18 §5.1.1). Referência
// GLOBAL (sem tenant_id, mesmo padrão de domains/n1_nodes) — read-only aqui; escrita só por migration.

import { pool } from '@core/database/pool';

// Fix 2ª IA (2026-07-07): dimensão NOVA — não confundir com Authority/Capability (§4.9) nem
// CONTEXT formal (pessoal/profissional/institucional). Responde só "modo comercial de oferta".
export const CONCEPT_OFFER_KINDS = ['rentable'] as const;
export type ConceptOfferKind = (typeof CONCEPT_OFFER_KINDS)[number];

export interface VehicleMake {
  id: string;
  slug: string;
  name: string;
}

export interface VehicleModel {
  id: string;
  makeId: string;
  conceptId: string;
  slug: string;
  name: string;
}

class VehicleCatalogService {
  async searchMakes(q?: string): Promise<VehicleMake[]> {
    const term = (q ?? '').trim();
    const rows = await pool.query<{ id: string; slug: string; name: string }>(
      `SELECT id::text, slug, name FROM vehicle_makes
        WHERE $1 = '' OR name ILIKE '%' || $1 || '%'
        ORDER BY name ASC LIMIT 30`,
      [term]
    );
    return rows.rows;
  }

  /**
   * Modelo pertence a MARCA + TIPO (fix 2ª IA: "CG160 não deveria aparecer quando o recurso é
   * Carro, porque é moto"). conceptId é OBRIGATÓRIO — sem ele, mistura carro+moto da mesma marca.
   */
  async listModelsByMakeAndConcept(makeId: string, conceptId: string, q?: string): Promise<VehicleModel[]> {
    const term = (q ?? '').trim();
    const rows = await pool.query<{ id: string; make_id: string; concept_id: string; slug: string; name: string }>(
      `SELECT id::text, make_id::text, concept_id::text, slug, name FROM vehicle_models
        WHERE make_id = $1 AND concept_id = $2 AND ($3 = '' OR name ILIKE '%' || $3 || '%')
        ORDER BY name ASC LIMIT 50`,
      [makeId, conceptId, term]
    );
    return rows.rows.map((r) => ({ id: r.id, makeId: r.make_id, conceptId: r.concept_id, slug: r.slug, name: r.name }));
  }

  /** Anos VÁLIDOS de um modelo (F-VEHICLE-MODEL-YEAR). A verdade é existir linha em
   *  vehicle_model_years — não um range hardcoded no código. Vazio = modelo sem anos governados. */
  async listModelYears(modelId: string): Promise<number[]> {
    const rows = await pool.query<{ year: number }>(
      `SELECT year FROM vehicle_model_years WHERE model_id = $1 ORDER BY year DESC`, [modelId]);
    return rows.rows.map((r) => Number(r.year));
  }

  /**
   * Valida a combinação GOVERNADA marca→modelo→concept→ano (server-side, não confia no front).
   * Retorna { ok } ou { ok:false, code }. year é opcional; se informado, deve existir em
   * vehicle_model_years para o modelo. Todos os IDs são UUID reais do catálogo (nunca texto livre).
   */
  async validateVehicleCombo(input: {
    makeId?: string | null; modelId?: string | null; conceptId: string; year?: number | null;
  }): Promise<{ ok: boolean; code?: string }> {
    if (!input.makeId) return { ok: false, code: 'VEHICLE_MAKE_REQUIRED' };
    if (!input.modelId) return { ok: false, code: 'VEHICLE_MODEL_REQUIRED' };

    // modelo existe E pertence à marca E ao concept declarados (uma query, fail-closed).
    const m = await pool.query<{ id: string }>(
      `SELECT id::text FROM vehicle_models WHERE id = $1 AND make_id = $2 AND concept_id = $3`,
      [input.modelId, input.makeId, input.conceptId]);
    if (m.rowCount === 0) return { ok: false, code: 'VEHICLE_MODEL_MAKE_CONCEPT_MISMATCH' };

    // ano (se informado) deve existir em vehicle_model_years — a verdade é a tabela.
    if (input.year != null) {
      const y = await pool.query(
        `SELECT 1 FROM vehicle_model_years WHERE model_id = $1 AND year = $2`, [input.modelId, input.year]);
      if (y.rowCount === 0) return { ok: false, code: 'VEHICLE_YEAR_NOT_GOVERNED_FOR_MODEL' };
    }
    return { ok: true };
  }
}

export const vehicleCatalogService = new VehicleCatalogService();
