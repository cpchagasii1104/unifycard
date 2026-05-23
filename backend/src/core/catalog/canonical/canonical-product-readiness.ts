import type { ConceptResolutionStatus } from './canonical-concept.types';

export interface CanonicalProductReadinessInput {
  type: string;
  name: string;
  categoryId: string | null;
  conceptId: string | null;
  conceptResolutionStatus: ConceptResolutionStatus;
  /** Atributos mínimos: objeto não vazio quando exigido pelo trilho industrial */
  attributes?: unknown;
}

function hasMinimalAttributes(attributes: unknown): boolean {
  if (attributes == null) return true;
  if (typeof attributes !== 'object' || Array.isArray(attributes)) return false;
  return true;
}

/**
 * Estado READY explícito para `canonical_products` INDUSTRIAL:
 * conceito resolvido e confirmado, categoria e nome, invariantes mínimos.
 * Não usa slug como identidade; não altera persistência.
 */
export function isCanonicalProductOperationalReady(p: CanonicalProductReadinessInput): boolean {
  if (p.type !== 'INDUSTRIAL') {
    return true;
  }
  const nameOk = Boolean(p.name && String(p.name).trim().length > 0);
  const categoryOk = p.categoryId != null && String(p.categoryId).trim().length > 0;
  const conceptOk =
    p.conceptId != null &&
    String(p.conceptId).trim().length > 0 &&
    p.conceptResolutionStatus === 'confirmed';
  const attrsOk = hasMinimalAttributes(p.attributes);
  return nameOk && categoryOk && conceptOk && attrsOk;
}

/**
 * Predicado SQL alinhado a `isCanonicalProductOperationalReady` para `canonical_products`.
 * Atributos: o helper TS aceita `attributes` ausente como OK; não filtramos JSONB aqui.
 * Manter sincronizado com `isCanonicalProductOperationalReady` (INDUSTRIAL).
 */
export function sqlCanonicalIndustrialOperationalReady(tableAlias: string): string {
  const a = tableAlias;
  return `(
    ${a}.type IS DISTINCT FROM 'INDUSTRIAL'
    OR (
      ${a}.concept_resolution_status = 'confirmed'
      AND ${a}.concept_id IS NOT NULL
      AND btrim(${a}.name::text) <> ''
      AND ${a}.category_id IS NOT NULL
    )
  )`;
}

/**
 * Escopo A (C.11): linha `canonical_products` referenciada por UUID é visível se
 * scoped do tenant ou global (`tenant_id IS NULL`). Sem OR de descoberta por GTIN.
 *
 * @param tableAlias — ex.: `cp`
 * @param tenantUuidExpr — expressão UUID do tenant do pedido, ex. `$2::uuid` ou `p.tenant_id`
 */
export function sqlCanonicalIdMatchesTenantContext(
  tableAlias: string,
  tenantUuidExpr: string
): string {
  const cp = tableAlias;
  return `(
    (${cp}.scope = 'scoped' AND ${cp}.tenant_id = ${tenantUuidExpr})
    OR (${cp}.scope = 'global' AND ${cp}.tenant_id IS NULL)
  )`;
}

/** Escopo B: ordenar para preferir scoped antes de global (C.20). */
export function sqlOrderScopedCanonicalFirst(tableAlias: string): string {
  return `(CASE WHEN ${tableAlias}.scope = 'scoped' THEN 0 ELSE 1 END)`;
}