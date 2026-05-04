import { pool } from '@core/database/pool';

export type TenantOfferingRow = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
};

/**
 * Tenants que declaram oferta ativa para o concept (discovery cross-tenant).
 */
export async function listTenantsOfferingConcept(conceptId: string): Promise<TenantOfferingRow[]> {
  const { rows } = await pool.query<TenantOfferingRow>(
    `
    SELECT t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug
    FROM tenant_concept_offerings tco
    INNER JOIN tenants t ON t.id = tco.tenant_id
    WHERE tco.concept_id = $1::uuid
      AND tco.is_active = TRUE
    ORDER BY t.name ASC
    `,
    [conceptId]
  );
  return rows;
}