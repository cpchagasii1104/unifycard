// canonical-product-db.types.ts
// Fronteira explícita PG → TypeScript (snake_case) — §5.3 (07_NOMENCLATURA_CANONICA.md).
//
// REGRAS (arquitetura):
// - Não reexportar este módulo a partir de `index.ts` / barrel do pacote.
// - Nenhum consumidor fora de `src/core/catalog/canonical/` deve importar este ficheiro
//   (validado por dependency-cruiser: `canonical-product-db-types-boundary`).
// - Linhas vindas do PG devem passar sempre por mapper antes de domínio/API:
//   `mapDbRowToCanonicalProduct` / `toPersistRow` (serviço READ / repositório).

/** Colunas retornadas pelos SELECTs do repositório (sem timestamps no RETURNING). */
export interface CanonicalProductDbRow {
  id: string;
  /** NULL quando `scope = 'global'` (catálogo partilhado). */
  tenant_id: string | null;
  gtin: string | null;
  name: string;
  brand: string | null;
  images: unknown;
  attributes: unknown;
  category_id: string | null;
  type: string;
  /** Preenchido pelos SELECTs que incluem a coluna (repositório); omitido noutros fluxos. */
  fingerprint_v1?: string | null;
  /** FK opcional para `concepts` (SSOT semântico). */
  concept_id?: string | null;
  /** Estado da ligação semântica; independente de fingerprint_v1. */
  concept_resolution_status?: string;
  version?: number;
  created_by_actor_id?: string | null;
}

/** Mesmas colunas + auditoria temporal quando o SELECT inclui `created_at` / `updated_at`. */
export interface CanonicalProductDbRowWithTimestamps extends CanonicalProductDbRow {
  created_at: Date;
  updated_at: Date;
}