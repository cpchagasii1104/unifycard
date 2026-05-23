/**
 * Backfill determinístico: `category_n1_mapping` só via mapa explícito e/ou match de identidade
 * (slug da categoria = slug N1 no mesmo domain_key), opcional.
 *
 * Não usa heurística por nome nem IA.
 *
 * Uso (o `--` repassa flags ao tsx):
 *   pnpm backfill:n1 -- --dry-run
 *   pnpm backfill:n1 -- --apply
 *   pnpm backfill:n1 -- --dry-run --allow-identity-match
 */
import dotenv from 'dotenv';
import { join } from 'path';
import type { PoolClient } from 'pg';
import { pool } from '../core/database/pool';
import { normalizeConceptSlug } from '../core/ontology/concept-governance.service';
import { inferN0FromCategoryScope } from '../core/ontology/n0-domains';
import {
  enableN1GovernanceWrite,
  linkCategoryToN1WithClient,
} from '../core/ontology/n1-governance.service';
import {
  EXPLICIT_CATEGORY_ID_TO_N1_SLUG,
  EXPLICIT_DOMAIN_SLUG_TO_N1_SLUG,
} from './category-n1-explicit-registry';

dotenv.config({ path: join(process.cwd(), '.env') });

const N1_CRITICAL_DOMAINS = new Set([
  'produtos-e-comercio',
  'servicos',
  'financas-e-economia',
]);

type CategoryRow = {
  category_id: string;
  slug: string;
  path: string[] | null;
  scope: string;
  concept_id: string | null;
};

type ConflictRow = {
  categoryId: string;
  slug: string;
  reason: string;
};

function parseArgs(argv: string[]): { dryRun: boolean; apply: boolean; allowIdentityMatch: boolean } {
  const apply = argv.includes('--apply');
  const dryRun = argv.includes('--dry-run') || !apply;
  if (apply && argv.includes('--dry-run')) {
    console.error('❌ Use apenas um modo: --dry-run ou --apply');
    process.exit(1);
  }
  const allowIdentityMatch = argv.includes('--allow-identity-match');
  return { dryRun: apply ? false : dryRun, apply, allowIdentityMatch };
}

async function loadN1SlugsByDomain(
  client: PoolClient
): Promise<Map<string, Set<string>>> {
  const { rows } = await client.query<{ domain_key: string; slug: string }>(
    `SELECT domain_key, slug FROM n1_nodes`
  );
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.domain_key)) {
      map.set(r.domain_key, new Set());
    }
    map.get(r.domain_key)!.add(r.slug);
  }
  return map;
}

async function resolveN1Id(
  client: PoolClient,
  domainKey: string,
  n1Slug: string
): Promise<string | null> {
  const { rows } = await client.query<{ n1_id: string }>(
    `SELECT n1_id FROM n1_nodes WHERE domain_key = $1 AND slug = $2 LIMIT 1`,
    [domainKey, n1Slug]
  );
  return rows[0]?.n1_id ?? null;
}

async function loadExistingMappings(
  client: PoolClient
): Promise<Map<string, string>> {
  const { rows } = await client.query<{ category_id: string; n1_id: string }>(
    `SELECT category_id, n1_id FROM category_n1_mapping`
  );
  const m = new Map<string, string>();
  for (const r of rows) {
    m.set(r.category_id, r.n1_id);
  }
  return m;
}

export async function runBackfillCategoryN1Mapping(options: {
  dryRun: boolean;
  allowIdentityMatch: boolean;
}): Promise<{
  totalCategories: number;
  skippedWrongDomain: number;
  /** Sem regra explícita / identity (quando desligado) */
  ignoredNoRule: number;
  /** Já em category_n1_mapping com o mesmo n1_id */
  alreadyCorrect: number;
  /** Novas linhas ou alterações (toApply.length) */
  newMappings: number;
  /** alreadyCorrect + newMappings (cobertura lógica) */
  totalResolved: number;
  conflicts: ConflictRow[];
}> {
  const client = await pool.connect();
  const conflicts: ConflictRow[] = [];
  let skippedWrongDomain = 0;
  let ignoredNoRule = 0;
  let alreadyCorrect = 0;

  try {
    const n1ByDomain = await loadN1SlugsByDomain(client);
    const existing = await loadExistingMappings(client);

    const { rows: categories } = await client.query<CategoryRow>(
      `SELECT category_id, slug, path, scope, concept_id FROM categories`
    );

    const toApply: { categoryId: string; n1Id: string; label: string }[] = [];

    for (const c of categories) {
      const domainKey = inferN0FromCategoryScope(c.scope);
      if (!N1_CRITICAL_DOMAINS.has(domainKey)) {
        skippedWrongDomain++;
        continue;
      }

      const normSlug = normalizeConceptSlug(c.slug);
      if (!normSlug) {
        ignoredNoRule++;
        continue;
      }

      const compositeKey = `${domainKey}:${normSlug}`;
      let n1Slug: string | null = null;
      let source = '';

      const idOverride = EXPLICIT_CATEGORY_ID_TO_N1_SLUG[c.category_id];
      if (idOverride) {
        n1Slug = normalizeConceptSlug(idOverride);
        source = 'id-override';
      } else if (EXPLICIT_DOMAIN_SLUG_TO_N1_SLUG[compositeKey]) {
        n1Slug = normalizeConceptSlug(EXPLICIT_DOMAIN_SLUG_TO_N1_SLUG[compositeKey]);
        source = 'registry';
      } else if (options.allowIdentityMatch) {
        const set = n1ByDomain.get(domainKey);
        if (set?.has(normSlug)) {
          n1Slug = normSlug;
          source = 'identity';
        }
      }

      if (!n1Slug) {
        ignoredNoRule++;
        continue;
      }

      const n1Id = await resolveN1Id(client, domainKey, n1Slug);
      if (!n1Id) {
        conflicts.push({
          categoryId: c.category_id,
          slug: c.slug,
          reason: `n1 slug resolvido mas inexistente no banco: domain=${domainKey} n1=${n1Slug} (${source})`,
        });
        continue;
      }

      const prev = existing.get(c.category_id);
      if (prev === n1Id) {
        alreadyCorrect++;
        continue;
      }
      if (prev && prev !== n1Id) {
        conflicts.push({
          categoryId: c.category_id,
          slug: c.slug,
          reason: `já mapeado para outro n1_id (existente=${prev}, novo=${n1Id}; ${source})`,
        });
        continue;
      }

      toApply.push({
        categoryId: c.category_id,
        n1Id,
        label: `${c.slug} → ${n1Slug} [${source}]`,
      });
    }

    const newMappings = toApply.length;
    const totalResolved = alreadyCorrect + newMappings;

    if (options.dryRun) {
      console.log('\n--- DRY RUN (nenhuma escrita) ---\n');
      console.log(`Propostas novas: ${toApply.length}`);
      for (const p of toApply.slice(0, 200)) {
        console.log(`  ${p.label}  category_id=${p.categoryId}`);
      }
      if (toApply.length > 200) {
        console.log(`  ... e mais ${toApply.length - 200} linhas`);
      }
    } else {
      try {
        await client.query('BEGIN');
        await enableN1GovernanceWrite(client);
        for (const p of toApply) {
          await linkCategoryToN1WithClient(client, p.categoryId, p.n1Id);
        }
        await client.query('COMMIT');
        console.log(`\n✅ Aplicados ${toApply.length} mapeamentos (transação única).`);
      } catch (writeErr) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* ignore */
        }
        throw writeErr;
      }
    }

    return {
      totalCategories: categories.length,
      skippedWrongDomain,
      ignoredNoRule,
      alreadyCorrect,
      newMappings,
      totalResolved,
      conflicts,
    };
  } catch (e) {
    throw e;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada');
    process.exit(1);
  }

  const { dryRun, apply, allowIdentityMatch } = parseArgs(process.argv.slice(2));

  console.log(
    `Modo: ${dryRun ? 'DRY-RUN' : 'APPLY'} | identity-match: ${allowIdentityMatch ? 'sim' : 'não'}`
  );

  const stats = await runBackfillCategoryN1Mapping({ dryRun, allowIdentityMatch });

  console.log('\n--- Resumo ---');
  console.log(`Total categories (linhas):        ${stats.totalCategories}`);
  console.log(`Fora dos 3 N0 com N1 (skip):      ${stats.skippedWrongDomain}`);
  console.log(`Ignoradas (sem regra clara):     ${stats.ignoredNoRule}`);
  console.log(`Já mapeadas corretamente:        ${stats.alreadyCorrect}`);
  console.log(`Novas / alterações (${dryRun ? 'simuladas' : 'aplicadas'}): ${stats.newMappings}`);
  console.log(`Total com destino N1 resolvido:  ${stats.totalResolved}`);
  console.log(`Conflitos / erros de resolução:  ${stats.conflicts.length}`);

  if (stats.conflicts.length > 0) {
    console.log('\n--- Conflitos ---');
    for (const x of stats.conflicts) {
      console.log(`  ${x.categoryId} slug=${x.slug} :: ${x.reason}`);
    }
  }

  const inScope = stats.totalCategories - stats.skippedWrongDomain;
  const pct =
    inScope > 0 ? ((stats.totalResolved / inScope) * 100).toFixed(1) : '0';
  console.log(
    `\nCobertura (resolvidas / categorias nos 3 N0 N1): ${pct}% — meta comum em prod: >80% após enriquecer category-n1-explicit-registry.ts`
  );
}

main()
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });