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
}

export const vehicleCatalogService = new VehicleCatalogService();
