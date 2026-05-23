#!/usr/bin/env tsx
/**
 * Expansão N2 governada — onda 1 (plano 21 v3.0.1).
 * Fluxo: transação + enableN2GovernanceWrite + getOrCreateN2 + tryLink.
 * Não executa SQL direto fora do serviço.
 *
 * Uso: pnpm exec tsx src/scripts/seed-n2-governed.ts
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import {
  getOrCreateN2NodeWithClient,
  tryLinkContextToN2WithClient,
} from '../core/navigation/n2-governance.service';
import { PLAN21_N2_EXPANSION_WAVE1 } from './n2-expansion-plan21.data';
import type { PoolClient } from 'pg';

dotenv.config({ path: join(process.cwd(), '.env') });

async function resolveN1Id(
  client: PoolClient,
  n1Slug: string,
  domainKey: string
): Promise<string | null> {
  const r = await client.query<{ n1_id: string }>(
    `SELECT n1_id FROM n1_nodes WHERE slug = $1 AND domain_key = $2 LIMIT 1`,
    [n1Slug, domainKey]
  );
  return r.rows[0]?.n1_id ?? null;
}

async function resolveContextId(
  client: PoolClient,
  contextSlug: string
): Promise<string | null> {
  const r = await client.query<{ context_id: string }>(
    `
    SELECT context_id
    FROM context_nodes
    WHERE context_slug = $1
      AND is_active = true
      AND deprecated_at IS NULL
    LIMIT 1
    `,
    [contextSlug]
  );
  return r.rows[0]?.context_id ?? null;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ausente');
    process.exit(1);
  }

  let n2Created = 0;
  let n2Skipped = 0;
  let linksNew = 0;
  let linksSkip = 0;
  let warnings = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const row of PLAN21_N2_EXPANSION_WAVE1) {
      const n1Id = await resolveN1Id(client, row.n1Slug, row.domainKey);
      if (!n1Id) {
        console.warn(`SKIP: N1 não encontrado ${row.n1Slug} / ${row.domainKey}`);
        warnings++;
        continue;
      }

      const { n2Id, created } = await getOrCreateN2NodeWithClient(client, {
        slug: row.slug,
        n1Id,
        sortOrder: row.sortOrder,
        displayName: row.displayNamePtBr,
        locale: 'pt-BR',
      });
      if (created) {
        n2Created++;
      } else {
        n2Skipped++;
      }

      for (const m of row.mappings) {
        const contextId = await resolveContextId(client, m.contextSlug);
        if (!contextId) {
          console.warn(`SKIP mapping: context "${m.contextSlug}" inativo/ausente ou deprecated`);
          warnings++;
          continue;
        }
        const out = await tryLinkContextToN2WithClient(client, {
          contextId,
          n2Id,
          isDefault: m.isDefault,
          sortOrder: m.sortOrder,
        });
        if (out === 'linked') {
          linksNew++;
        } else {
          linksSkip++;
        }
      }
    }

    await client.query('COMMIT');
    console.log('--- seed-n2-governed (onda 1) ---');
    console.log(`N2 criados: ${n2Created}`);
    console.log(`N2 já existentes (ignorados): ${n2Skipped}`);
    console.log(`Mappings novos: ${linksNew}`);
    console.log(`Mappings já existentes: ${linksSkip}`);
    console.log(`Avisos: ${warnings}`);
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