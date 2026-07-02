/**
 * Invariante de dado — F-SERVICE-SEARCH-ALIAS-SELFNAME-BACKFILL
 * (DT-SERVICE-SEARCH-ALIAS-SELFNAME-GAP, decisão híbrida de Clayton 2026-07-02).
 *
 * Self-name (o próprio nome de um canonical_service resolver na busca) é tratado como GARANTIA
 * ESTRUTURAL, não tarefa editorial — diferente de sinônimo/gíria (barbeiro→barba), que continua
 * curado à mão. Este gate falha se algum canonical_service GLOBAL/ACTIVE não tiver um alias
 * (is_active + review_status='approved') cujo normalized_term seja o próprio slug.
 *
 * Roda contra o DATABASE_URL configurado (não é estático como os guards de
 * validate:regression-guards — segue o mesmo padrão de validate:schema-invariants: gate dedicado
 * que conecta no banco). Não altera runtime.
 *
 * Execução: tsx scripts/validate-service-search-alias-selfname-invariant.ts
 */
import 'tsconfig-paths/register';
import { pool } from '@core/database/pool';

async function main(): Promise<void> {
  console.log('🔍 Validando invariante: self-name alias para todo canonical_service global/active...\n');

  const missing = await pool.query<{ slug: string; concept_id: string }>(
    `
    SELECT cs.slug, cs.concept_id
    FROM canonical_services cs
    WHERE cs.scope = 'global' AND cs.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM service_search_aliases a
         WHERE a.normalized_term = cs.slug AND a.concept_id = cs.concept_id
           AND a.is_active = true AND a.review_status = 'approved'
      )
    ORDER BY cs.slug
    `
  );

  const total = (await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM canonical_services WHERE scope='global' AND status='active'`
  )).rows[0].n;

  await pool.end();

  if (missing.rows.length > 0) {
    console.error(`❌ GATE FAIL [service-search-alias-selfname-invariant]`);
    console.error(`   ${missing.rows.length} de ${total} canonical_services global/active SEM self-name alias:`);
    for (const row of missing.rows) {
      console.error(`   - ${row.slug} (concept_id=${row.concept_id})`);
    }
    console.error(`\n   Resolução: adicionar INSERT INTO service_search_aliases (alias_term, normalized_term, concept_id, ...)`);
    console.error(`   com normalized_term = slug do canonical_service, na MESMA migration que criou o(s) canonical_service(s)`);
    console.error(`   acima (mesmo molde da migration 20260702120000_seed_service_search_alias_selfname_backfill.sql).`);
    process.exit(1);
  }

  console.log(`✅ GATE OK [service-search-alias-selfname-invariant] — todos os ${total} canonical_services global/active têm self-name alias. DT-SERVICE-SEARCH-ALIAS-SELFNAME-GAP blindada (camada estrutural).`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Erro ao validar invariante de self-name alias:', error);
  process.exit(1);
});
