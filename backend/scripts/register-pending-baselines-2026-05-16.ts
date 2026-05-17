// Script para registrar migrations pendentes que JA FORAM aplicadas
// materialmente em runtime mas nao constam em schema_migrations.
//
// Contexto (2026-05-16): pipeline npm run migrate estava bloqueado em
// 20260530516500_add_states_country_abbreviation_unique.sql porque tentava
// CREATE de constraint que ja existia. Auditoria material via SQL confirmou
// que 10 migrations pendentes ja tem seus efeitos no DB. Baseline = registrar
// como executadas (checksum=NULL) seguindo padrao da funcao
// `markMigrationAsBaseline` em src/core/db/migrate.ts:373-380.
//
// Padrao institucional referenciado: register-migration-113.ts (este projeto).

import { pool } from '../src/core/database/pool';
import 'dotenv/config';

const BASELINES = [
  '20260530517000_seed_location_core_brazil_minimal.sql',
  '20260530518000_create_payment_milestones.sql',
  '20260530518500_add_addresses_created_by_tenant_id.sql',
  '20260530519000_seed_concept_split_engineering.sql',
  '20260530520000_add_company_users_updated_at.sql',
  '20260530520500_add_company_users_rbac_columns.sql',
  '20260530521000_add_companies_primary_address_id.sql',
  '20260530530000_tenant_products_drop_price_numeric.sql',
  '20260530538000_bank_splits_target_account_id.sql',
  '20260530539000_fix_servicos_orphans_path.sql',
  '20260530540000_seed_learning_categories.sql',
  '20260530541000_company_users_membership_expansion.sql',
];

async function main() {
  let marked = 0;
  let skipped = 0;
  try {
    for (const filename of BASELINES) {
      const existing = await pool.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [filename]
      );
      if (existing.rows.length > 0) {
        skipped++;
        console.log(`  [SKIP] ${filename} ja registrada`);
        continue;
      }
      await pool.query(
        `INSERT INTO schema_migrations (filename, executed_at, checksum)
         VALUES ($1, now(), NULL)
         ON CONFLICT (filename) DO NOTHING`,
        [filename]
      );
      marked++;
      console.log(`  [BASELINE] ${filename} marcada como executada (SQL nao re-executado)`);
    }
    console.log(`\nResumo: ${marked} marcadas como baseline, ${skipped} ja registradas.`);
  } catch (err) {
    console.error('Erro:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
