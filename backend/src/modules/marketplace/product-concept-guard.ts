// product-concept-guard.ts
// §7.3–7.5 PLANO_FASE_ATUAL: produto só pode referenciar canonical cujo concept_id pertence
// ao conjunto permitido para o tipo de empresa do tenant (company_type_allowed_concepts).
//
// SSOT: tenants.company_type_id → company_type_allowed_concepts.concept_id;
//       canonical_products.concept_id.
//
// Bypass intencional: sem canonical_product_id; canonical inexistente (deixa FK falhar);
// canonical sem concept_id (resolução pendente); tenant sem company_type ou tipo sem concepts
// configurados — não bloquear (sem restrição ativa para esse tenant).

import { runQueryWithTenant } from '@core/database/pool';
import { ForbiddenError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

export async function assertProductConceptAllowedForTenant(
  tenantId: string,
  canonicalProductId: string | null | undefined
): Promise<void> {
  if (!canonicalProductId) return;

  const row = await runQueryWithTenant<{
    concept_id: string | null;
    allowed_concept_ids: string[] | null;
  }>(
    tenantId,
    `
    SELECT
      cp.concept_id,
      COALESCE(
        (
          SELECT array_agg(DISTINCT ctac.concept_id::text)
          FROM tenants t
          JOIN company_type_allowed_concepts ctac
            ON ctac.company_type_id = t.company_type_id
          WHERE t.id = $1::uuid
        ),
        NULL
      ) AS allowed_concept_ids
    FROM canonical_products cp
    WHERE cp.id = $2::uuid
    LIMIT 1
    `,
    [tenantId, canonicalProductId]
  );

  if (!row) return;

  const { concept_id, allowed_concept_ids } = row;

  if (!concept_id) return;

  if (!allowed_concept_ids || allowed_concept_ids.length === 0) return;

  if (!allowed_concept_ids.includes(concept_id)) {
    throw new ForbiddenError(
      `Produto fora do catálogo permitido para este tipo de empresa (concept_id=${concept_id}). §7.5 PLANO_FASE_ATUAL`,
      ErrorCode.FORBIDDEN
    );
  }
}