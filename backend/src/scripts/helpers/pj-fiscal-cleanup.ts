/**
 * Cleanup canônico PJ para E2Es (CP1 / PJ-B7 — F-PJ-HUMAN-TO-COMPANY-END-TO-END-CLOSURE).
 *
 * Companies de fixture nascem FISCAL-FIRST: cada uma carrega uma fiscal_identity
 * (FK companies.fiscal_identity_id → fiscal_identities, ON DELETE RESTRICT). Os cleanups
 * antigos apagavam só `companies` e VAZAVAM as fiscal_identities — acúmulo real medido em
 * unificard_dev (557 órfãs em 2026-06-11). Este helper captura os fiscal_ids ANTES de
 * apagar as companies e remove a cadeia fiscal DEPOIS (docs → requests → atividades → fonte),
 * só para fiscal_identities que ficaram sem NENHUMA company (não toca identidades vivas).
 *
 * O caller continua responsável pelos filhos de companies (company_users, actors, etc.).
 */
type QueryablePool = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> };

export async function deleteCompaniesAndFiscal(
  pool: QueryablePool,
  whereSql: string, // ex.: 'company_id = ANY($1::uuid[])' | 'company_name LIKE $1'
  params: unknown[]
): Promise<void> {
  const fiscal = await pool.query(
    `SELECT fiscal_identity_id::text AS fid FROM companies WHERE (${whereSql}) AND fiscal_identity_id IS NOT NULL`,
    params
  );
  await pool.query(`DELETE FROM companies WHERE (${whereSql})`, params);

  const fids = fiscal.rows.map((r) => r.fid as string);
  if (fids.length === 0) return;

  const tolerateMissing = async (sql: string): Promise<void> => {
    try {
      await pool.query(sql, [fids]);
    } catch (e) {
      if ((e as { code?: string }).code !== '42P01') throw e;
    }
  };
  await tolerateMissing(`DELETE FROM fiscal_identity_documents WHERE fiscal_identity_id = ANY($1::uuid[])`);
  await tolerateMissing(`DELETE FROM fiscal_identity_kyb_requests WHERE fiscal_identity_id = ANY($1::uuid[])`);
  await tolerateMissing(`DELETE FROM fiscal_identity_economic_activities WHERE fiscal_identity_id = ANY($1::uuid[])`);
  await pool.query(
    `DELETE FROM fiscal_identities fi
      WHERE fi.fiscal_identity_id = ANY($1::uuid[])
        AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.fiscal_identity_id = fi.fiscal_identity_id)`,
    [fids]
  );
}
