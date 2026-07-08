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
  /**
   * Marcas do catálogo. Se conceptId for informado, retorna SÓ marcas que TÊM ao menos um modelo
   * daquela categoria (fix Clayton 2026-07-08: com Categoria=Caminhonete apareciam Yamaha/Honda/Renault
   * — marcas sem caminhonete). Mesma coerência de listModelsByMakeAndConcept: a Marca é filtrada pelo
   * concept escolhido. Sem conceptId = todas (compat).
   */
  async searchMakes(q?: string, conceptId?: string): Promise<VehicleMake[]> {
    const term = (q ?? '').trim();
    const cid = (conceptId ?? '').trim();
    const rows = await pool.query<{ id: string; slug: string; name: string }>(
      `SELECT mk.id::text, mk.slug, mk.name FROM vehicle_makes mk
        WHERE ($1 = '' OR mk.name ILIKE '%' || $1 || '%')
          AND ($2 = '' OR EXISTS (
            SELECT 1 FROM vehicle_models m WHERE m.make_id = mk.id AND m.concept_id = $2::uuid
          ))
        ORDER BY mk.name ASC LIMIT 60`,
      [term, cid]
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

  /** Versões (trims) de um modelo-ano COM a ficha técnica (auto-completada — a verdade é do catálogo,
   *  não digitada pelo anunciante). Retorna a variante identitária + os 23 campos de spec. */
  async listVersionsWithSpecs(modelId: string, year: number): Promise<Record<string, unknown>[]> {
    const rows = await pool.query(
      `SELECT version, motor, cilindrada_cc, potencia_cv, torque_kgfm, combustivel, tracao, cambio,
              num_portas, capacidade_carga_kg, peso_kg, comprimento_cm, largura_cm, altura_cm,
              entre_eixos_cm, pneus, freios_diant, freios_tras, suspensao_diant, suspensao_tras,
              direcao, tanque_litros, cacamba_litros,
              -- ficha rica (catálogo consolidado): identidade estável + campos do CSV canônico
              variant_id, categoria, linha, geracao, versao_nome, carroceria, numero_lugares,
              motor_nome, motor_codigo, motor_familia, cilindros, valvulas_total, aspiracao, alimentacao,
              potencia_cv_gasolina, potencia_cv_etanol, potencia_rpm,
              torque_kgfm_gasolina, torque_kgfm_etanol, torque_rpm,
              codigo_cambio, numero_marchas, porta_malas_litros, pneus_diant, pneus_tras, rodas,
              abs, airbags, controle_estabilidade, start_stop, observacoes_fitment, source_confidence
         FROM vehicle_model_specs WHERE model_id = $1 AND year = $2 ORDER BY version ASC`,
      [modelId, year]);
    return rows.rows;
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
