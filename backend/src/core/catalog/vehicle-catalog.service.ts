// backend/src/core/catalog/vehicle-catalog.service.ts
// CAPACIDADE TRANSVERSAL (ARVORE.png: "Catálogo" na copa, reutilizado por N setores). Marca/modelo
// de veículo GOVERNADOS — impede texto livre duplicado entre rides, locação, venda e peças
// automotivas (achado Clayton 2026-07-07). NÃO redefine CONCEPT ('carro'/'motocicleta'/...) — é
// materialização operacional de atributo, análoga a canonical_products (doc 18 §5.1.1). Referência
// GLOBAL (sem tenant_id, mesmo padrão de domains/n1_nodes) — read-only aqui; escrita só por migration.

import { pool } from '@core/database/pool';

export interface VehicleMake {
  id: string;
  slug: string;
  name: string;
}

export interface VehicleModel {
  id: string;
  makeId: string;
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

  async listModelsByMake(makeId: string, q?: string): Promise<VehicleModel[]> {
    const term = (q ?? '').trim();
    const rows = await pool.query<{ id: string; make_id: string; slug: string; name: string }>(
      `SELECT id::text, make_id::text, slug, name FROM vehicle_models
        WHERE make_id = $1 AND ($2 = '' OR name ILIKE '%' || $2 || '%')
        ORDER BY name ASC LIMIT 50`,
      [makeId, term]
    );
    return rows.rows.map((r) => ({ id: r.id, makeId: r.make_id, slug: r.slug, name: r.name }));
  }
}

export const vehicleCatalogService = new VehicleCatalogService();
