// service-category-guard.ts
// DECISION-0109 (D1/D3/D6): a categoria de um SERVIÇO (service_type='service') deve ser `domain='servicos'`
// e, quando o serviço pertence a uma EMPRESA classificada, deve estar na ponte de ramos do company_type
// (`company_type_service_categories`). NÃO usa taxonomia de marketplace; NÃO usa company_type_allowed_concepts
// (atuação/concept) como categoria; NÃO toca Bank/booking/availability.
//
// Fonte da empresa: o ACTOR dono do serviço (page-actor) → `actors.company_id` → `companies.primary_company_type_id`.
// (Para serviço, o actor É o ofertante; não há `companyId` separado no payload — derivar do actor é a fonte natural.)
//
// Bypass documentado (compat, não no-op silencioso):
//  - service_type ≠ 'service' (event/job/rental têm governança própria, fora desta fatia/DECISION-0109);
//  - sem categoryId (serviço sem categoria — MVP permite; nada a governar);
//  - actor inexistente (deixa a validação de actor na camada de serviço falhar);
//  - actor sem `company_id` (PF/legado — categoria já validada por domínio; sem ramo de empresa a aplicar).
//
// Fail-closed: categoria de domínio errado (ex.: marketplace) → Forbidden; empresa NÃO classificada
// (sem primary_company_type_id) → Forbidden; categoria fora da ponte do company_type → Forbidden.

import { runQueryWithTenant } from '@core/database/pool';
import { ForbiddenError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

export async function assertServiceCategoryAllowedForCompany(
  tenantId: string,
  actorId: string,
  categoryId: string | null | undefined,
  serviceType: string | null | undefined
): Promise<void> {
  // DECISION-0109 governa a taxonomia de SERVIÇO (service_type='service'); default do repo = 'service'.
  if ((serviceType ?? 'service') !== 'service') return;
  if (!categoryId) return; // serviço sem categoria — nada a governar (MVP permite).

  // 1. categoria existe E é domain='servicos' (D1) — universal para serviço.
  const cat = await runQueryWithTenant<{ domain: string | null }>(
    tenantId,
    `SELECT metadata->>'domain' AS domain FROM categories WHERE category_id = $1::uuid LIMIT 1`,
    [categoryId]
  );
  if (!cat) {
    throw new ForbiddenError(
      `Categoria de serviço inexistente (category_id=${categoryId}). DECISION-0109`,
      ErrorCode.FORBIDDEN
    );
  }
  if (cat.domain !== 'servicos') {
    throw new ForbiddenError(
      `Serviço exige categoria domain='servicos' (recebido '${cat.domain}'). DECISION-0109 D1`,
      ErrorCode.FORBIDDEN
    );
  }

  // 2. empresa do serviço = company do page-actor dono.
  const actorRow = await runQueryWithTenant<{ company_id: string | null }>(
    tenantId,
    `SELECT company_id::text AS company_id FROM actors WHERE id = $1::uuid LIMIT 1`,
    [actorId]
  );
  if (!actorRow) return; // actor inexistente — a camada de serviço já valida; aqui não inventa empresa.
  if (!actorRow.company_id) return; // PF/legado: sem empresa, sem ramo (domínio já garantido).

  // 3. empresa precisa estar CLASSIFICADA (primary_company_type_id).
  const company = await runQueryWithTenant<{ ct: string | null }>(
    tenantId,
    `SELECT primary_company_type_id::text AS ct FROM companies WHERE company_id = $1::uuid AND tenant_id = $2 LIMIT 1`,
    [actorRow.company_id, tenantId]
  );
  if (!company || !company.ct) {
    throw new ForbiddenError(
      `Empresa não classificada (sem primary_company_type_id) não pode ofertar serviço por ramo. DECISION-0109`,
      ErrorCode.FORBIDDEN
    );
  }

  // 4. categoria deve pertencer à ponte de ramos do company_type (company_type_service_categories).
  const bridge = await runQueryWithTenant<{ one: number }>(
    tenantId,
    `SELECT 1 AS one FROM company_type_service_categories
      WHERE company_type_id = $1::uuid AND service_category_id = $2::uuid LIMIT 1`,
    [company.ct, categoryId]
  );
  if (!bridge) {
    throw new ForbiddenError(
      `Categoria de serviço fora dos ramos do tipo de empresa (category_id=${categoryId}). DECISION-0109`,
      ErrorCode.FORBIDDEN
    );
  }
}
