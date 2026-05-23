/**
 * BOOTSTRAP (não normativo): liga categories a concepts via slug + domain N0 (inferido de scope).
 *
 * domain em concepts = domínio N0 oficial (FK domains), alinhado a inferN0FromCategoryScope.
 *
 * Uso: pnpm backfill:concepts-bootstrap
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { enableConceptGovernanceInsert } from '../core/ontology/concept-governance.service';

dotenv.config({ path: join(process.cwd(), '.env') });

/** Deve coincidir com core/ontology/n0-domains.ts inferN0FromCategoryScope */
const DOMAIN_FROM_SCOPE_SQL = `
  CASE c.scope
    WHEN 'learning' THEN 'educacao-e-conhecimento'
    WHEN 'professional' THEN 'servicos'
    WHEN 'interest' THEN 'cultura-lazer-e-eventos'
    WHEN 'company' THEN 'organizacoes-e-instituicoes'
    WHEN 'cause' THEN 'comunidades-e-grupos'
    WHEN 'event' THEN 'cultura-lazer-e-eventos'
    WHEN 'group' THEN 'comunidades-e-grupos'
    WHEN 'campaign' THEN 'produtos-e-comercio'
    WHEN 'global' THEN 'produtos-e-comercio'
    ELSE 'produtos-e-comercio'
  END
`;

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await enableConceptGovernanceInsert(client);

    const insertRes = await client.query(`
      INSERT INTO concepts (slug, domain)
      SELECT DISTINCT c.slug, (${DOMAIN_FROM_SCOPE_SQL})::text AS dom
      FROM categories c
      WHERE c.concept_id IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM concepts x
          WHERE x.slug = c.slug
            AND x.domain = (${DOMAIN_FROM_SCOPE_SQL})::text
        )
    `);

    const updateRes = await client.query(`
      UPDATE categories c
      SET concept_id = k.concept_id
      FROM concepts k
      WHERE c.concept_id IS NULL
        AND k.slug = c.slug
        AND k.domain = (${DOMAIN_FROM_SCOPE_SQL})::text
    `);

    await client.query('COMMIT');

    console.log(`✅ concepts inseridos (novos): ${insertRes.rowCount ?? 0}`);
    console.log(`✅ categories atualizadas: ${updateRes.rowCount ?? 0}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Backfill falhou:', e);
    process.exit(1);
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });