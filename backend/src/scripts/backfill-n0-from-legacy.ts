/**
 * Preenche concepts.n0_domain (antes da migração 0074) a partir de:
 * 1) categories.scope (via qualquer categoria ligada ao concept)
 * 2) fallback: primeiro scope entre linhas; se sem categoria, só slug manual em SLUG_FALLBACK
 *
 * Uso: pnpm exec tsx src/scripts/backfill-n0-from-legacy.ts --apply
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { inferN0FromCategoryScope, isN0DomainKey, type N0DomainKey } from '../core/ontology/n0-domains';

dotenv.config({ path: join(process.cwd(), '.env') });

const APPLY = process.argv.includes('--apply');

/** Slugs sem categoria ligada: definir manualmente antes do --apply */
const SLUG_FALLBACK: Record<string, N0DomainKey> = {};

/**
 * Sobrescreve inferência por scope (ex.: árvore com scope global mas slug semântico claro).
 * Alinhado aos eixos típicos de perfil / marketplace.
 */
const SLUG_N0_HINT: Record<string, N0DomainKey> = {
  aprendizado: 'educacao-e-conhecimento',
  'educacao-formal': 'educacao-e-conhecimento',
  fisico: 'saude-e-bem-estar',
  saude: 'saude-e-bem-estar',
  medicina: 'saude-e-bem-estar',
  pessoal: 'pessoas-e-identidades',
  profissional: 'servicos',
  familia: 'pessoas-e-identidades',
  hobbies: 'cultura-lazer-e-eventos',
  esportes: 'cultura-lazer-e-eventos',
  habilidades: 'educacao-e-conhecimento',
  'tecnologia-informacao': 'produtos-e-comercio',
  advocacia: 'servicos',
};

async function main(): Promise<void> {
  const { rows: hasN0 } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'concepts' AND column_name = 'n0_domain' LIMIT 1`
  );
  if (hasN0.length === 0) {
    console.log(
      'Coluna n0_domain não existe — migração 0074 já aplicada. Nada a fazer neste script.'
    );
    return;
  }

  const { rows: concepts } = await pool.query<{
    concept_id: string;
    slug: string;
    domain: string;
    n0_domain: string | null;
  }>(
    `
    SELECT concept_id, slug, domain, n0_domain
    FROM concepts
    WHERE n0_domain IS NULL
    ORDER BY slug
    `
  );

  if (concepts.length === 0) {
    console.log('Nada a fazer: todos concepts já têm n0_domain.');
    return;
  }

  for (const c of concepts) {
    const scopes = await pool.query<{ scope: string | null }>(
      `
      SELECT DISTINCT scope FROM categories WHERE concept_id = $1::uuid
      `,
      [c.concept_id]
    );

    let chosen: N0DomainKey | null = null;
    if (SLUG_N0_HINT[c.slug]) {
      chosen = SLUG_N0_HINT[c.slug];
    } else if (scopes.rows.length >= 1) {
      const inferred = scopes.rows.map((r) => inferN0FromCategoryScope(r.scope));
      const first = inferred[0];
      const conflict = inferred.some((x) => x !== first);
      if (conflict) {
        console.warn(
          `⚠ concept_id=${c.concept_id} slug=${c.slug}: scopes divergem em N0 inferido — usando o primeiro: ${first}`
        );
      }
      chosen = first;
    } else if (SLUG_FALLBACK[c.slug]) {
      chosen = SLUG_FALLBACK[c.slug];
    } else {
      console.error(
        `❌ concept_id=${c.concept_id} slug=${c.slug}: sem category e sem SLUG_FALLBACK — preencha SLUG_FALLBACK em backfill-n0-from-legacy.ts`
      );
      process.exit(1);
    }

    if (!chosen || !isN0DomainKey(chosen)) {
      console.error(`Domínio inválido para ${c.slug}: ${chosen}`);
      process.exit(1);
    }

    if (!APPLY) {
      console.log(`[dry-run] ${c.slug} (${c.domain}) → n0_domain=${chosen}`);
      continue;
    }

    await pool.query(`UPDATE concepts SET n0_domain = $1::text WHERE concept_id = $2::uuid`, [
      chosen,
      c.concept_id,
    ]);
    console.log(`✅ ${c.slug} → ${chosen}`);
  }

  if (!APPLY) {
    console.log('\nPara gravar: adicione --apply');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});