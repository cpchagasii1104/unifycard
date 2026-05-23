#!/usr/bin/env tsx
/**
 * Remoção governada do CONTEXT `nutricao` (plano 21 v3.0.1).
 * Pré-requisito: migration 0081 (deprecation); ordem: mapping → localized → context.
 * Uso: pnpm exec tsx src/scripts/remove-deprecated-context-nutricao.ts
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { enableN2GovernanceWrite } from '../core/navigation/n2-governance.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const CONTEXT_SLUG = 'nutricao';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ausente');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const sel = await client.query<{ context_id: string }>(
      `SELECT context_id FROM context_nodes WHERE context_slug = $1 LIMIT 1`,
      [CONTEXT_SLUG]
    );
    const row = sel.rows[0];
    if (!row) {
      console.log(`OK: context_slug "${CONTEXT_SLUG}" já ausente de context_nodes`);
      return;
    }

    const contextId = row.context_id;
    await client.query('BEGIN');
    await enableN2GovernanceWrite(client);

    const delMap = await client.query(
      `DELETE FROM context_n2_mapping WHERE context_id = $1::uuid`,
      [contextId]
    );
    const delLoc = await client.query(
      `DELETE FROM context_localized_names WHERE context_id = $1::uuid`,
      [contextId]
    );
    const delCtx = await client.query(
      `DELETE FROM context_nodes WHERE context_id = $1::uuid`,
      [contextId]
    );

    await client.query('COMMIT');
    console.log(
      `OK: removido "${CONTEXT_SLUG}" — mapping ${delMap.rowCount ?? 0}, localized ${delLoc.rowCount ?? 0}, context ${delCtx.rowCount ?? 0}`
    );
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});