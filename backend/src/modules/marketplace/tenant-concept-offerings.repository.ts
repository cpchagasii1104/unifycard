import { pool } from '@core/database/pool';

export type TenantOfferingRow = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
};

/**
 * Tenants que declaram oferta ativa para o concept (discovery cross-tenant).
 *
 * Defesa-em-profundidade KYB (DT-PJ-KYB-REVOCATION-READER-DEFENSE / DECISION-0101 D9): além de
 * `tco.is_active`, exige que exista uma publicação soberana `active` por trás cuja identidade fiscal
 * esteja `kyb_status='approved'`. É CINTO-E-SUSPENSÓRIO sobre a projeção — NÃO inverte a fonte
 * (`tenant_concept_offerings` segue o read-model derivado; o writer de revogação KYB já corrige o SSOT).
 * Se a projeção ficar stale (tco active sem lastro KYB-approved), o reader não vaza a oferta no discovery.
 */
export async function listTenantsOfferingConcept(conceptId: string): Promise<TenantOfferingRow[]> {
  const { rows } = await pool.query<TenantOfferingRow>(
    `
    SELECT t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug
    FROM tenant_concept_offerings tco
    INNER JOIN tenants t ON t.id = tco.tenant_id
    WHERE tco.concept_id = $1::uuid
      AND tco.is_active = TRUE
      AND EXISTS (
        SELECT 1
        FROM company_concept_publications ccp
        INNER JOIN companies c ON c.company_id = ccp.company_id
        INNER JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
        WHERE ccp.tenant_id = tco.tenant_id
          AND ccp.concept_id = tco.concept_id
          AND ccp.status = 'active'
          AND fi.kyb_status = 'approved'
      )
    ORDER BY t.name ASC
    `,
    [conceptId]
  );
  return rows;
}