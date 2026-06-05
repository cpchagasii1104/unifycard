// product-concept-guard.ts
// DECISION-0108: a elegibilidade de um produto industrial/global para uma PJ é governada por
// CATEGORIA/RAMO pré-moldado do `company_type` (a régua CERTA), NÃO por igualdade entre
// `canonical_products.concept_id` (camada item-comercial/SKU) e `company_type_allowed_concepts.concept_id`
// (camada vendor/atuação) — comparação que a DECISION-0105 tornou inválida (camadas distintas).
//
// "Trocar a régua errada, não desligar a segurança." Esta não é uma liberação ampla:
//  - canonical de camada item-comercial NÃO é validado contra a allowlist vendor;
//  - MAS o item ainda precisa pertencer a um RAMO pré-moldado do tipo de empresa quando há contexto
//    de company/company_type → fail-closed por categoria fora do recorte (DECISION-0108 §8/§9 D9).
//
// SSOT do company_type no fluxo PJ novo: `companies.primary_company_type_id` (empresa CLASSIFICADA vence,
// igual à ponte da Op1). `tenants.company_type_id` é APENAS legado/compat — nunca autoridade no fluxo PJ novo.
// Ramos pré-moldados: `company_types.default_department_slugs` + `default_branch_slugs` → `categories`.
//
// Bypass documentado (compat, não no-op silencioso — DECISION-0108 D9 "legado/compat"):
//  - sem `canonicalProductId`: produto sem canônico (ex.: templates) — o recorte é o `categoryId` do próprio
//    caller, fora do escopo deste guard;
//  - canônico inexistente: deixa a FK falhar adiante (comportamento legado preservado);
//  - canônico sem `category_id`: nada a recortar (resolução pendente);
//  - sem `company_type` resolvível (tenant legado sem classificação): sem recorte aplicável — o caller já
//    validou domínio marketplace; o fluxo PJ novo SEMPRE traz companyId → company_type, então este ramo
//    só atinge legado/compat;
//  - `company_type` sem ramos configurados: mesma porta de compat do legado.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { ForbiddenError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

/**
 * Fonte do company_type para o recorte: empresa CLASSIFICADA vence
 * (`companies.primary_company_type_id`); `tenants.company_type_id` é legado/compat.
 * Espelha `store-onboarding.resolveStage4CompanyTypeId` (Op1) — nunca usa o tenant como autoridade
 * quando há `companyId`.
 */
async function resolveGuardCompanyTypeId(
  tenantId: string,
  companyId: string | null | undefined
): Promise<string | null> {
  if (companyId) {
    const c = await runQueryWithTenant<{ t: string | null }>(
      tenantId,
      `SELECT primary_company_type_id::text AS t FROM companies WHERE company_id = $1 AND tenant_id = $2 LIMIT 1`,
      [companyId, tenantId]
    );
    return c?.t ?? null;
  }
  const tenantRow = await runQueryWithTenant<{ t: string | null }>(
    tenantId,
    `SELECT company_type_id::text AS t FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId]
  );
  return tenantRow?.t ?? null;
}

/**
 * Categorias dos ramos pré-moldados do tipo de empresa
 * (`default_department_slugs` + `default_branch_slugs` → `categories.category_id`).
 */
async function resolveCompanyTypeBranchCategoryIds(
  tenantId: string,
  companyTypeId: string
): Promise<string[]> {
  const rows = await runQueriesWithTenant<{ category_id: string }>(
    tenantId,
    `
    SELECT DISTINCT c.category_id::text AS category_id
    FROM company_types ct
    JOIN categories c
      ON c.slug = ANY(
        COALESCE(ct.default_department_slugs, '{}'::text[])
        || COALESCE(ct.default_branch_slugs, '{}'::text[])
      )
    WHERE ct.id = $1::uuid
      AND c.is_active = true
    `,
    [companyTypeId]
  );
  return rows.map((r) => r.category_id);
}

/**
 * Garante que o canônico (camada item-comercial) referenciado por um produto pertence a um RAMO
 * pré-moldado do tipo de empresa (DECISION-0108). NÃO compara concept item × concept vendor.
 *
 * @param tenantId  tenant atual.
 * @param canonicalProductId  `canonical_products.id` (ou null/undefined → bypass; produto sem canônico).
 * @param companyId  empresa CLASSIFICADA (fonte do company_type); ausente → legado/compat (lê tenant).
 */
export async function assertProductCategoryAllowedForCompany(
  tenantId: string,
  canonicalProductId: string | null | undefined,
  companyId?: string | null
): Promise<void> {
  if (!canonicalProductId) return;

  const cp = await runQueryWithTenant<{ category_id: string | null }>(
    tenantId,
    `SELECT category_id::text AS category_id FROM canonical_products WHERE id = $1::uuid LIMIT 1`,
    [canonicalProductId]
  );

  if (!cp) return; // canônico inexistente — deixa a FK falhar adiante (legado).
  if (!cp.category_id) return; // canônico sem categoria — nada a recortar (resolução pendente).

  const companyTypeId = await resolveGuardCompanyTypeId(tenantId, companyId);
  if (!companyTypeId) return; // sem classificação — legado/compat (sem recorte aplicável).

  const allowedCategoryIds = await resolveCompanyTypeBranchCategoryIds(tenantId, companyTypeId);
  if (allowedCategoryIds.length === 0) return; // tipo sem ramos configurados — compat.

  if (!allowedCategoryIds.includes(cp.category_id)) {
    throw new ForbiddenError(
      `Produto fora dos ramos pré-moldados deste tipo de empresa ` +
        `(category_id=${cp.category_id} não pertence ao recorte do company_type). DECISION-0108`,
      ErrorCode.FORBIDDEN
    );
  }
}
