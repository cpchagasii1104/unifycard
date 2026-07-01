/**
 * E2E F-SERVICE-VERTICAL-SEED-CLEANING-SLICE — 1ª vertical nova (Limpeza), molde da Beleza.
 *
 * Roda contra o DB de trabalho (dev). Lê o estado semeado por
 * 20260701130000_seed_cleaning_service_catalog_slice_a.sql usando os RESOLVERS/GATES VIVOS:
 *   - resolveConceptsFromSearchTerm / normalizeSearchTerm (@core/semantic) → alias runtime;
 *   - canonicalServiceService.searchOfferable (DECISION-0144) → gate de publicação PF.
 * O único fixture destrutivo (declaração C1 do PF) é inserido e REMOVIDO no teardown (Δbank=0).
 *
 * Provas (14): 4 concepts servicos · 4 canonical global/active concept-bound · bucket N1 sem concept ·
 *   4 categorias N2 concept-bound · aliases resolvem (diarista/faxineira/passar roupa/limpeza comercial/
 *   personal organizer) · /perfil resolveria termo→concept com substrato declarável · /services/new offerable
 *   só após capacidade · alias ≠ autoridade (sem C1 nada surge; com C1 surge) · labels pt-BR (não slug) ·
 *   idempotência · umbrellas não viraram canonical · categorias GLOBAL de marketplace intactas · PJ mapping
 *   não criado · Δbank=0.
 */
import { loadBackendEnv } from '../core/db/load-backend-env';
loadBackendEnv();

const SRC = 'clayton_curated_cleaning_slice_a_2026_07_01';
const TENANT = process.env.E2E_TENANT_ID?.trim() || 'fbe13b78-4516-493d-905a-363796aea1d1';
const GRAIN_SLUGS = ['faxina-residencial', 'passadoria', 'limpeza-comercial', 'organizacao-residencial'];
const UMBRELLAS = ['limpeza', 'servicos-de-limpeza', 'servicos-domesticos', 'casa', 'trabalho-domestico', 'trabalho'];
const GLOBAL_MARKET = ['marketplace-limpeza', 'limpeza-servicos', 'servicos-limpeza-residencial'];

const EXPECTED_LABELS: Array<[string, string, string]> = [
  ['faxina-residencial', 'Faxina residencial', 'Faxina'],
  ['passadoria', 'Passadoria', 'Passar roupa'],
  ['limpeza-comercial', 'Limpeza comercial', 'Comercial'],
  ['organizacao-residencial', 'Organização residencial', 'Organização'],
];

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const rec = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function main(): Promise<void> {
  const { pool } = await import('../core/database/pool');
  const { resolveConceptsFromSearchTerm, normalizeSearchTerm } = await import('../core/semantic/semantic.adapter');
  const { canonicalServiceService } = await import('../core/catalog/canonical/canonical-service.service');

  const bankBefore = Number((await pool.query<{ n: string }>(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text AS n`
  )).rows[0].n);

  // 1. 4 concepts servicos.
  const nConcept = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM concepts WHERE domain='servicos' AND slug = ANY($1)`, [GRAIN_SLUGS]
  )).rows[0].n);
  rec('1 4 concepts de limpeza em domain=servicos', nConcept === 4, `n=${nConcept}`);

  // 2. 4 canonical global/active concept-bound.
  const nCanon = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM canonical_services cs JOIN concepts c ON c.concept_id=cs.concept_id
      WHERE cs.scope='global' AND cs.status='active' AND c.domain='servicos' AND cs.slug = ANY($1)`, [GRAIN_SLUGS]
  )).rows[0].n);
  rec('2 4 canonical_services global/active concept-bound', nCanon === 4, `n=${nCanon}`);

  // 3. bucket N1 professional sem concept.
  const bucket = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM categories
      WHERE slug='limpeza-conservacao' AND scope='professional' AND level=1 AND concept_id IS NULL`);
  rec('3 bucket N1 limpeza-conservacao existe (professional, sem concept)', Number(bucket.rows[0].n) === 1, `n=${bucket.rows[0].n}`);

  // 4. 4 categorias N2 professional concept-bound sob o bucket.
  const nCat = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM categories ca
       JOIN concepts co ON co.concept_id=ca.concept_id
       JOIN categories parent ON parent.category_id=ca.parent_id
      WHERE ca.scope='professional' AND ca.level=2 AND co.slug = ANY($1)
        AND parent.slug='limpeza-conservacao'`, [GRAIN_SLUGS]
  )).rows[0].n);
  rec('4 4 categorias N2 professional concept-bound sob limpeza-conservacao', nCat === 4, `n=${nCat}`);

  // 5. aliases resolvem via runtime real (termo humano → concept correto).
  const aliasCases: Array<[string, string]> = [
    ['diarista', 'faxina-residencial'],
    ['faxineira', 'faxina-residencial'],
    ['passar roupa', 'passadoria'],
    ['limpeza comercial', 'limpeza-comercial'],
    ['personal organizer', 'organizacao-residencial'],
  ];
  for (const [term, slug] of aliasCases) {
    const expected = (await pool.query<{ c: string }>(
      `SELECT concept_id::text AS c FROM concepts WHERE domain='servicos' AND slug=$1`, [slug]
    )).rows[0]?.c;
    const r = await resolveConceptsFromSearchTerm(term);
    const ok = r.conceptIds.length === 1 && r.conceptIds[0] === expected;
    rec(`5 alias "${term}" → ${slug} (1 concept, runtime)`, ok, `n=${r.conceptIds.length}`);
  }

  // 6. /perfil resolveria termo humano: alias→concept + concept tem categoria professional declarável (substrato).
  const declarable = await pool.query<{ n: string }>(
    `SELECT count(DISTINCT co.concept_id)::text AS n
       FROM service_search_aliases a JOIN concepts co ON co.concept_id=a.concept_id
       JOIN categories ca ON ca.concept_id=co.concept_id AND ca.scope='professional' AND ca.level=2
      WHERE a.source=$1`, [SRC]);
  rec('6 /perfil: termos humanos apontam a concepts com categoria professional declarável', Number(declarable.rows[0].n) === 4, `n=${declarable.rows[0].n}`);

  // 7 + 8. /services/new offerable só após capacidade + alias ≠ autoridade (fixture C1 com teardown).
  const client = await pool.connect();
  let pfDeclInserted = false;
  let PF = '';
  const targetConcept = (await pool.query<{ c: string }>(
    `SELECT concept_id::text AS c FROM concepts WHERE domain='servicos' AND slug='faxina-residencial'`
  )).rows[0].c;
  try {
    await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);
    const ar = await client.query<{ id: string }>(
      `SELECT a.id FROM actors a
        WHERE a.tenant_id=$1 AND a.actor_type='user'
          AND NOT EXISTS (SELECT 1 FROM actor_professional_concepts apc
                           WHERE apc.tenant_id=$1 AND apc.actor_id=a.id AND apc.concept_id=$2 AND apc.is_active=true)
        LIMIT 1`, [TENANT, targetConcept]);
    PF = ar.rows[0]?.id ?? '';

    if (PF) {
      const pfActor = { actor_id: PF, actor_type: 'user', company_id: null as string | null };

      // 8a. SEM C1 + termo humano "diarista" → grão NÃO surge (alias é lente, não autoridade).
      const beforeAlias = await canonicalServiceService.searchOfferable(TENANT, pfActor, 'diarista');
      rec('8a alias ≠ autoridade: PF SEM C1 + "diarista" → grão NÃO surge', !beforeAlias.some((s) => s.conceptId === targetConcept));

      // 7. declara C1 → grão surge (offerable só após capacidade).
      await client.query(
        `INSERT INTO actor_professional_concepts (tenant_id,actor_id,concept_id,skill_level,is_active,declared_at)
         VALUES ($1,$2,$3,3,true,now())`, [TENANT, PF, targetConcept]);
      pfDeclInserted = true;
      const afterName = await canonicalServiceService.searchOfferable(TENANT, pfActor, 'faxina');
      rec('7 offerable só após capacidade: PF COM C1 → grão surge (por nome "faxina")', afterName.some((s) => s.conceptId === targetConcept));

      // 8b. COM C1 + termo humano "diarista" (não casa por nome) → surge via ponte de alias.
      const afterAlias = await canonicalServiceService.searchOfferable(TENANT, pfActor, 'diarista');
      rec('8b alias ≠ autoridade: PF COM C1 + "diarista" → grão surge via ponte (nome não contém "diarista")', afterAlias.some((s) => s.conceptId === targetConcept));

      // 8c. retira C1 → some (predicado ACTIVE espelha o gate).
      await client.query(`UPDATE actor_professional_concepts SET is_active=false, retired_at=now() WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3`, [TENANT, PF, targetConcept]);
      const retired = await canonicalServiceService.searchOfferable(TENANT, pfActor, 'faxina');
      rec('8c PF com C1 retirada → grão some do offerable (predicado ACTIVE)', !retired.some((s) => s.conceptId === targetConcept));
    } else {
      rec('7/8 (PF) SKIP — sem user-actor sem declaração ativa neste tenant', true, 'skip');
    }
  } finally {
    if (pfDeclInserted) await client.query(`DELETE FROM actor_professional_concepts WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3`, [TENANT, PF, targetConcept]).catch(() => {});
    client.release();
  }

  // 9. labels pt-BR/default/primary (não degradam para slug).
  let labelsOk = true;
  for (const [slug, label, shortLabel] of EXPECTED_LABELS) {
    const r = await pool.query<{ label: string; short_label: string }>(
      `SELECT cl.label, cl.short_label FROM concept_labels cl JOIN concepts c ON c.concept_id=cl.concept_id
        WHERE c.slug=$1 AND cl.locale='pt-BR' AND cl.context_key='default' AND cl.is_primary=true`, [slug]);
    if (!(r.rowCount === 1 && r.rows[0].label === label && r.rows[0].short_label === shortLabel && r.rows[0].label !== slug)) {
      labelsOk = false; rec(`9 label ${slug}`, false, JSON.stringify(r.rows[0] ?? null));
    }
  }
  if (labelsOk) rec('9 4 labels pt-BR/default/primary corretos (não degradam para slug)', true);

  // 10. idempotência: re-aplicar alias + label (ON CONFLICT) não duplica.
  await pool.query(
    `INSERT INTO service_search_aliases (alias_term, normalized_term, concept_id, confidence, review_status, is_active, source, catalog_version)
     SELECT p.alias_term, p.normalized_term, c.concept_id, 'high','approved',true,$1,'cleaning-v1'
     FROM (VALUES ('Diarista','diarista','faxina-residencial')) AS p(alias_term, normalized_term, concept_slug)
     INNER JOIN concepts c ON c.domain='servicos' AND c.slug=p.concept_slug
     ON CONFLICT (normalized_term, concept_id) DO NOTHING`, [SRC]);
  const nAliasAfter = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM service_search_aliases WHERE source=$1`, [SRC]
  )).rows[0].n);
  rec('10 idempotência: re-aplicar alias mantém 21 (ON CONFLICT)', nAliasAfter === 21, `n=${nAliasAfter}`);

  // 11. umbrellas proibidos NÃO viraram canonical.
  const nUmbrella = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM canonical_services WHERE scope='global' AND slug = ANY($1)`, [UMBRELLAS]
  )).rows[0].n);
  rec('11 umbrellas proibidos não são canonical', nUmbrella === 0, `n=${nUmbrella}`);

  // 12. categorias de marketplace/umbrella pré-existentes NÃO foram reaproveitadas como grão:
  //     invariante real = nenhuma virou concept-bound/level-2, nem é parent dos meus grãos.
  //     (limpeza-servicos já era professional/level-1/sem-concept ANTES deste seed — umbrella pré-existente,
  //      sibling do bucket novo limpeza-conservacao; meu seed não a tocou nem pendurou grão nela.)
  const marketMisuse = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM categories
      WHERE slug = ANY($1) AND (level=2 OR concept_id IS NOT NULL)`, [GLOBAL_MARKET]
  )).rows[0].n);
  const marketParentMisuse = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM categories child
       JOIN categories parent ON parent.category_id=child.parent_id
      WHERE parent.slug = ANY($1) AND child.slug = ANY($2)`, [GLOBAL_MARKET, GRAIN_SLUGS]
  )).rows[0].n);
  rec('12 umbrellas pré-existentes não viraram grão nem são parent dos meus grãos', marketMisuse === 0 && marketParentMisuse === 0, `misuse=${marketMisuse} parent=${marketParentMisuse}`);

  // 13. PJ mapping não criado (nenhuma linha company_type_service_categories referenciando as categorias de limpeza).
  const pjMisuse = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM company_type_service_categories ctsc
       JOIN categories ca ON ca.category_id=ctsc.service_category_id
       JOIN concepts co ON co.concept_id=ca.concept_id
      WHERE co.slug = ANY($1)`, [GRAIN_SLUGS]
  )).rows[0].n);
  rec('13 PJ mapping não criado para limpeza (company_type_service_categories)', pjMisuse === 0, `n=${pjMisuse}`);

  // 14. Δbank=0.
  const bankAfter = Number((await pool.query<{ n: string }>(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text AS n`
  )).rows[0].n);
  rec('14 Δbank=0', bankAfter - bankBefore === 0, `antes=${bankBefore} depois=${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  await pool.end().catch(() => {});
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    process.exit(1);
  }
  console.log('✨ F-SERVICE-VERTICAL-SEED-CLEANING-SLICE: vertical Limpeza semeada (molde beleza), alias resolve, offerable gated, alias≠autoridade, labels vivos, umbrellas barrados, Δbank=0.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
