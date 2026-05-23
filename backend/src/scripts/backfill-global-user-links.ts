/**
 * Backfill: preenche users.global_user_id para linhas sem vínculo.
 * Executar após deploy de ensureGlobalUserLinked (dev/staging/prod conforme política).
 *
 * Uso: pnpm exec tsx src/scripts/backfill-global-user-links.ts
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { identityService } from '../core/identity/identity.service';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não configurada');
    process.exit(1);
  }

  console.log('🔧 Backfill global_user_id (users → global_users)...');
  const { fixed, errors } = await identityService.backfillMissingGlobalUserLinks();

  console.log(`✅ Corrigidos: ${fixed}`);
  if (errors.length > 0) {
    console.error('❌ Erros:');
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
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