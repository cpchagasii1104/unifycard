/**
 * ⚠️ POST-0092 GLOBAL ONTOLOGY MODE
 * This script MUST NOT scope categories by tenant (no tenant-scoped ontology).
 * Any attempt to reintroduce tenant-scoped logic is a structural violation.
 *
 * Normalização controlada: aumentar cobertura de categories.concept_id sem alterar schema.
 *
 * Critérios de segurança (só aplicação automática quando explícito):
 *
 * R1 — Mesmo slug (global): liga-se a concept em concepts(domain, slug) com
 *       domain = N0 inferido de categories.scope, ou cria-se um concept novo (slug + domain N0).
 *
 * R2 — Mesmo path idêntico (TEXT[]) global: se existe exatamente um concept_id distinto
 *       entre linhas com esse path e concept preenchido, propaga-se para linhas com NULL;
 *       se houver 2+ concepts distintos para o mesmo path → ambíguo, não atualizar.
 *
 * R3 — Parent/child: NÃO propagar automaticamente concept do pai para o filho (semântica
 *       divergente por nível). Apenas diagnóstico para decisão manual.
 *
 * Pares affinity (diagnóstico apenas): slugs físico→aprendizado alinhados ao hardcode de
 * inferência; sugere revisão manual se concept_ids diferirem.
 *
 * Uso:
 *   pnpm normalize:category-concepts              # dry-run (padrão)
 *   pnpm normalize:category-concepts -- --apply   # aplica propostas seguras
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { createConceptWithClient } from '../core/ontology/concept-governance.service';
import { inferN0FromCategoryScope } from '../core/ontology/n0-domains';

dotenv.config({ path: join(process.cwd(), '.env') });

const APPLY = process.argv.includes('--apply');

/** Pares (physical slug → primeiro learning slug) espelhados para diagnóstico de alinhamento. */
const AFFINITY_PHYSICAL_TO_LEARNING: ReadonlyArray<{ physical: string; learning: string }> = [
  { physical: 'criar-expressar', learning: 'fotografia-aprendizado' },
  { physical: 'fotografia', learning: 'fotografia-aprendizado' },
  { physical: 'desenho', learning: 'desenho-ilustracao' },
  { physical: 'video', learning: 'video-aprendizado' },
  { physical: 'escrita', learning: 'escrita-criativa' },
  { physical: 'musica', learning: 'musica-aprendizado' },
  { physical: 'tecnologia', learning: 'programacao' },
  { physical: 'jogos', learning: 'games-aprendizado' },
  { physical: 'cozinhar-comer-bem', learning: 'culinaria-aprendizado' },
  { physical: 'se-movimentar', learning: 'atividade-fisica-aprendizado' },
  { physical: 'cuidar-de-si', learning: 'saude-mental-aprendizado' },
];

type CategoryRow = {
  category_id: string;
  parent_id: string | null;
  slug: string;
  path: string[] | null;
  concept_id: string | null;
  scope: string | null;
  level: number | null;
};

type Proposal =
  | {
      kind: 'link_concept_row';
      category_id: string;
      slug: string;
      concept_id: string;
      rule: 'R1_existing_concept_table';
    }
  | {
      kind: 'create_concept_and_link';
      category_id: string;
      slug: string;
      scope: string | null;
      rule: 'R1_new_concept';
    }
  | {
      kind: 'copy_concept_same_path';
      category_id: string;
      slug: string;
      concept_id: string;
      source_category_id: string;
      rule: 'R2_same_path';
    };

async function loadCategoriesMissingConcept(client: import('pg').PoolClient): Promise<CategoryRow[]> {
  const r = await client.query<CategoryRow>(
    `
    SELECT category_id, parent_id, slug, path, concept_id, scope, level
    FROM categories
    WHERE concept_id IS NULL
    ORDER BY slug
    `,
  );
  return r.rows;
}

async function loadAllCategoryCounts(client: import('pg').PoolClient): Promise<{
  total: number;
  withConcept: number;
  withoutConcept: number;
}> {
  const r = await client.query<{ total: string; with_c: string; without_c: string }>(
    `
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE concept_id IS NOT NULL)::text AS with_c,
      COUNT(*) FILTER (WHERE concept_id IS NULL)::text AS without_c
    FROM categories
    `,
  );
  const row = r.rows[0];
  return {
    total: parseInt(row?.total ?? '0', 10),
    withConcept: parseInt(row?.with_c ?? '0', 10),
    withoutConcept: parseInt(row?.without_c ?? '0', 10),
  };
}

/** Path idêntico com múltiplos concept_id → ambíguo para R2. */
async function loadAmbiguousPaths(client: import('pg').PoolClient): Promise<
  { path: string[]; distinct_concepts: number }[]
> {
  const r = await client.query<{ path: string[]; n: string }>(
    `
    SELECT path, COUNT(DISTINCT concept_id)::text AS n
    FROM categories
    WHERE concept_id IS NOT NULL AND path IS NOT NULL
    GROUP BY path
    HAVING COUNT(DISTINCT concept_id) > 1
    `,
  );
  return r.rows.map((row) => ({
    path: row.path,
    distinct_concepts: parseInt(row.n, 10),
  }));
}

async function loadParentChildGaps(
  client: import('pg').PoolClient,
): Promise<
  {
    child_id: string;
    child_slug: string;
    parent_id: string;
    parent_slug: string;
    parent_concept_id: string;
  }[]
> {
  const r = await client.query<{
    child_id: string;
    child_slug: string;
    parent_id: string;
    parent_slug: string;
    parent_concept_id: string;
  }>(
    `
    SELECT
      c.category_id AS child_id,
      c.slug AS child_slug,
      p.category_id AS parent_id,
      p.slug AS parent_slug,
      p.concept_id AS parent_concept_id
    FROM categories c
    JOIN categories p ON p.category_id = c.parent_id
    WHERE c.concept_id IS NULL
      AND p.concept_id IS NOT NULL
    ORDER BY c.slug
    `,
  );
  return r.rows;
}

async function findConceptIdForSlug(
  client: import('pg').PoolClient,
  row: Pick<CategoryRow, 'slug' | 'scope'>,
): Promise<string | null> {
  const n0 = inferN0FromCategoryScope(row.scope);
  const r = await client.query<{ concept_id: string }>(
    `SELECT concept_id FROM concepts WHERE domain = $1 AND slug = $2 LIMIT 1`,
    [n0, row.slug],
  );
  return r.rows[0]?.concept_id ?? null;
}

/**
 * Para categoria com concept NULL: se outra linha com mesmo path tem concept,
 * e há exatamente um concept_id distinto nesse conjunto, devolve esse concept_id.
 */
async function resolveConceptBySamePath(
  client: import('pg').PoolClient,
  row: CategoryRow,
): Promise<{ concept_id: string; source_category_id: string } | 'ambiguous' | 'none'> {
  if (!row.path || row.path.length === 0) {
    return 'none';
  }
  const r = await client.query<{ category_id: string; concept_id: string }>(
    `
    SELECT category_id, concept_id
    FROM categories
    WHERE path = $1::text[]
      AND concept_id IS NOT NULL
      AND category_id <> $2::uuid
    `,
    [row.path, row.category_id],
  );
  const concepts = new Map<string, string>();
  for (const x of r.rows) {
    concepts.set(x.concept_id, x.category_id);
  }
  if (concepts.size === 0) {
    return 'none';
  }
  if (concepts.size > 1) {
    return 'ambiguous';
  }
  const [conceptId, sourceId] = [...concepts.entries()][0];
  return { concept_id: conceptId, source_category_id: sourceId };
}

async function buildProposals(
  client: import('pg').PoolClient,
  missing: CategoryRow[],
): Promise<{
  proposals: Proposal[];
  skippedAmbiguousPath: CategoryRow[];
  categoriesWithConceptBefore: number;
}> {
  const proposals: Proposal[] = [];
  const skippedAmbiguousPath: CategoryRow[] = [];

  const counts = await loadAllCategoryCounts(client);
  const categoriesWithConceptBefore = counts.withConcept;

  const handled = new Set<string>();

  for (const row of missing) {
    const samePath = await resolveConceptBySamePath(client, row);
    if (samePath === 'ambiguous') {
      skippedAmbiguousPath.push(row);
      continue;
    }
    if (samePath !== 'none') {
      proposals.push({
        kind: 'copy_concept_same_path',
        category_id: row.category_id,
        slug: row.slug,
        concept_id: samePath.concept_id,
        source_category_id: samePath.source_category_id,
        rule: 'R2_same_path',
      });
      handled.add(row.category_id);
    }
  }

  const ambiguousIds = new Set(skippedAmbiguousPath.map((r) => r.category_id));

  for (const row of missing) {
    if (handled.has(row.category_id) || ambiguousIds.has(row.category_id)) {
      continue;
    }
    const existing = await findConceptIdForSlug(client, row);
    if (existing) {
      proposals.push({
        kind: 'link_concept_row',
        category_id: row.category_id,
        slug: row.slug,
        concept_id: existing,
        rule: 'R1_existing_concept_table',
      });
      continue;
    }
    proposals.push({
      kind: 'create_concept_and_link',
      category_id: row.category_id,
      slug: row.slug,
      scope: row.scope,
      rule: 'R1_new_concept',
    });
  }

  return { proposals, skippedAmbiguousPath, categoriesWithConceptBefore };
}

async function diagnoseAffinityPairs(client: import('pg').PoolClient): Promise<void> {
  console.log('\n--- Diagnóstico: pares affinity (apenas sugestão manual de alinhamento) ---\n');
  for (const pair of AFFINITY_PHYSICAL_TO_LEARNING) {
    const r = await client.query<{
      slug: string;
      concept_id: string | null;
      category_id: string;
    }>(
      `
      SELECT slug, concept_id, category_id
      FROM categories
      WHERE slug = ANY($1::text[])
      `,
      [[pair.physical, pair.learning]],
    );
    if (r.rows.length < 2) {
      continue;
    }
    const phys = r.rows.find((x) => x.slug === pair.physical);
    const learn = r.rows.find((x) => x.slug === pair.learning);
    if (!phys || !learn) {
      continue;
    }
    if (phys.concept_id && learn.concept_id && phys.concept_id !== learn.concept_id) {
      console.log(
        `suggest_manual_merge physical=${pair.physical} concept=${phys.concept_id} | learning=${pair.learning} concept=${learn.concept_id}`,
      );
    }
  }
}

function printInventoryRows(rows: CategoryRow[], title: string, limit = 200): void {
  console.log(`\n${title} (${rows.length} linhas, mostrando até ${limit})\n`);
  for (const row of rows.slice(0, limit)) {
    const pathStr = row.path ? row.path.join('/') : '';
    console.log(
      `category_id=${row.category_id} slug=${row.slug} parent_id=${row.parent_id ?? 'null'} scope=${row.scope ?? ''} level=${row.level ?? ''} path=${pathStr} concept_id=${row.concept_id ?? 'NULL'}`,
    );
  }
  if (rows.length > limit) {
    console.log(`... e mais ${rows.length - limit} linhas`);
  }
}

async function applyProposals(client: import('pg').PoolClient, proposals: Proposal[]): Promise<{
  linked: number;
  created: number;
  copied: number;
}> {
  let linked = 0;
  let created = 0;
  let copied = 0;

  for (const p of proposals) {
    if (p.kind === 'copy_concept_same_path') {
      await client.query(`UPDATE categories SET concept_id = $1::uuid WHERE category_id = $2::uuid`, [
        p.concept_id,
        p.category_id,
      ]);
      copied += 1;
      console.log(
        `✅ atualizado R2_same_path category_id=${p.category_id} ← concept_id=${p.concept_id} (fonte=${p.source_category_id})`,
      );
      continue;
    }
    if (p.kind === 'link_concept_row') {
      await client.query(`UPDATE categories SET concept_id = $1::uuid WHERE category_id = $2::uuid`, [
        p.concept_id,
        p.category_id,
      ]);
      linked += 1;
      console.log(
        `✅ atualizado R1_existing_concept_table category_id=${p.category_id} ← concept_id=${p.concept_id}`,
      );
      continue;
    }
    if (p.kind === 'create_concept_and_link') {
      const dom = inferN0FromCategoryScope(p.scope);
      const { concept_id: conceptId } = await createConceptWithClient(client, {
        slug: p.slug,
        domain: dom,
      });
      await client.query(`UPDATE categories SET concept_id = $1::uuid WHERE category_id = $2::uuid`, [
        conceptId,
        p.category_id,
      ]);
      created += 1;
      console.log(
        `✅ atualizado R1_new_concept category_id=${p.category_id} ← novo concept_id=${conceptId}`,
      );
    }
  }

  return { linked, created, copied };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada');
    process.exit(1);
  }

  console.warn(
    '[normalize-category-concepts] Ontologia global (pós-0092): normalização determinística por slug, path e concept.',
  );

  const client = await pool.connect();
  try {
    const counts = await loadAllCategoryCounts(client);
    console.log('=== Inventário global categories ===');
    console.log(`total=${counts.total} com concept_id=${counts.withConcept} sem concept_id=${counts.withoutConcept}`);

    const missing = await loadCategoriesMissingConcept(client);
    printInventoryRows(missing, '1) Categories sem concept_id');

    const ambiguousPaths = await loadAmbiguousPaths(client);
    if (ambiguousPaths.length > 0) {
      console.log('\n2) Paths com múltiplos concept_id (ambiguidade estrutural)\n');
      for (const a of ambiguousPaths.slice(0, 50)) {
        console.log(
          `distinct_concepts=${a.distinct_concepts} path=${(a.path || []).join('/')}`,
        );
      }
      if (ambiguousPaths.length > 50) {
        console.log(`... e mais ${ambiguousPaths.length - 50} paths`);
      }
    } else {
      console.log('\n2) Nenhum path com múltiplos concept_id detectado.\n');
    }

    const parentGaps = await loadParentChildGaps(client);
    printInventoryRows(
      parentGaps.map((g) => ({
        category_id: g.child_id,
        parent_id: g.parent_id,
        slug: `${g.child_slug} (filho de ${g.parent_slug})`,
        path: null,
        concept_id: null,
        scope: null,
        level: null,
      })),
      '3) Filhos sem concept_id com pai com concept_id (R3: só manual — não auto)',
      100,
    );

    await diagnoseAffinityPairs(client);

    const { proposals, skippedAmbiguousPath, categoriesWithConceptBefore } = await buildProposals(
      client,
      missing,
    );

    if (skippedAmbiguousPath.length > 0) {
      printInventoryRows(
        skippedAmbiguousPath,
        'Ignoradas por ambiguidade R2 (mesmo path, vários concepts)',
        100,
      );
    }

    const nR2 = proposals.filter((p) => p.kind === 'copy_concept_same_path').length;
    const nR1Link = proposals.filter((p) => p.kind === 'link_concept_row').length;
    const nR1New = proposals.filter((p) => p.kind === 'create_concept_and_link').length;

    console.log('\n=== Resumo de normalização proposta ===');
    console.log(`categories com concept_id antes (referência)=${categoriesWithConceptBefore}`);
    console.log(`sem concept_id agora (missing)=${missing.length}`);
    console.log(`propostas R2_same_path=${nR2}`);
    console.log(`propostas R1_existing_concept_table=${nR1Link}`);
    console.log(`propostas R1_new_concept=${nR1New}`);
    console.log(`ambiguidade R2 (ignoradas, sem proposta)=${skippedAmbiguousPath.length}`);
    console.log(`total propostas=${proposals.length}`);

    const stillNullAfterApply = skippedAmbiguousPath.length;
    console.log(
      `\nSe aplicar: ${proposals.length} categories passariam a ter concept_id; ${stillNullAfterApply} permaneceriam NULL (ambiguidade R2).`,
    );
    console.log(
      `Estimativa sem concept após apply: ${Math.max(0, missing.length - proposals.length)} (= ambíguas + qualquer linha não coberta).`,
    );

    if (!APPLY) {
      console.log('\n🔒 Modo dry-run. Nenhuma alteração gravada. Para aplicar: pnpm normalize:category-concepts -- --apply\n');
      return;
    }

    console.log('\n⚠️  Aplicando alterações (--apply)...\n');
    await client.query('BEGIN');
    try {
      const stats = await applyProposals(client, proposals);
      await client.query('COMMIT');
      console.log('\n=== Aplicação concluída ===');
      console.log(JSON.stringify(stats));
      const countsAfter = await loadAllCategoryCounts(client);
      console.log(
        `Após apply: total=${countsAfter.total} com concept_id=${countsAfter.withConcept} sem concept_id=${countsAfter.withoutConcept}`,
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});