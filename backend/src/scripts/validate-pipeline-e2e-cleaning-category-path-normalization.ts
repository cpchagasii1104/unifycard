/**
 * E2E — F-SERVICE-CLEANING-CATEGORY-PATH-NORMALIZATION-SLICE (B1 / W-M1).
 *
 * Prova, contra o DB dev VIVO, que a normalização de `categories.path` das 5 categorias
 * da vertical Limpeza corrigiu a duplicação de "profissoes" SEM alterar identidade/autoridade
 * e SEM tocar o vizinho `limpeza-servicos`. Money-free (Δbank=0 estrutural — nenhuma escrita bank).
 *
 * NÃO altera dado. Apenas SELECT + asserções.
 */
import { loadBackendEnv } from '../core/db/load-backend-env';
loadBackendEnv();

const CLEANING_SOURCE = 'clayton_curated_cleaning_slice_a_2026_07_01';
const GRAIN_SLUGS = ['faxina-residencial', 'passadoria', 'limpeza-comercial', 'organizacao-residencial'];

(async () => {
  const { pool } = await import('../core/database/pool');
  const results: Array<{ ok: boolean; label: string; detail?: string }> = [];
  const rec = (label: string, ok: boolean, detail = '') => results.push({ ok, label, detail });
  const eqPath = (a: string[] | null, b: string[]) =>
    Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

  try {
    // 1) bucket limpeza-conservacao com path=["profissoes"]
    const bucket = await pool.query(
      `SELECT category_id, path, level, concept_id, parent_id, scope
         FROM categories WHERE slug='limpeza-conservacao' AND scope='professional' AND level=1`);
    const b = bucket.rows[0];
    rec('1 bucket limpeza-conservacao path=["profissoes"]', bucket.rows.length === 1 && eqPath(b?.path, ['profissoes']),
      `path=[${b?.path?.join(', ')}]`);

    // 2) 4 grãos com path=["profissoes","limpeza-conservacao"]
    const grains = await pool.query(
      `SELECT slug, path, level, concept_id, parent_id FROM categories
        WHERE parent_id=$1 AND scope='professional' AND level=2 ORDER BY slug`, [b?.category_id]);
    const allGrainPaths = grains.rows.length === 4 &&
      grains.rows.every((r) => eqPath(r.path, ['profissoes', 'limpeza-conservacao']));
    rec('2 os 4 grãos path=["profissoes","limpeza-conservacao"]', allGrainPaths,
      grains.rows.map((r) => `${r.slug}=[${r.path?.join(', ')}]`).join(' | '));

    // 3) ZERO duplicação path[1]=path[2] nas 5 categorias da slice
    const dup = await pool.query(
      `SELECT count(*)::int n FROM categories
        WHERE (category_id=$1 OR parent_id=$1) AND array_length(path,1)>=2 AND path[1]=path[2]`, [b?.category_id]);
    rec('3 zero duplicação path[1]=path[2] nas 5 categorias', dup.rows[0].n === 0, `n=${dup.rows[0].n}`);

    // 3b) e no DB inteiro não sobrou nenhuma linha duplicada (a slice era a única fonte)
    const dupAll = await pool.query(
      `SELECT count(*)::int n FROM categories WHERE array_length(path,1)>=2 AND path[1]=path[2]`);
    rec('3b DB inteiro sem path[1]=path[2] (slice era a única fonte)', dupAll.rows[0].n === 0, `n=${dupAll.rows[0].n}`);

    // 4) parent_id correto: bucket->profissoes ; grãos->bucket
    const bucketParent = await pool.query(`SELECT slug FROM categories WHERE category_id=$1`, [b?.parent_id]);
    const grainsParentOk = grains.rows.every((r) => r.parent_id === b?.category_id);
    rec('4 parent_id intacto (bucket→profissoes, grãos→bucket)',
      bucketParent.rows[0]?.slug === 'profissoes' && grainsParentOk,
      `bucket.parent=${bucketParent.rows[0]?.slug}`);

    // 5) concept_id dos 4 grãos segue correto (concept-bound, domain servicos, slug casa)
    const conceptBound = await pool.query(
      `SELECT ca.slug FROM categories ca JOIN concepts co ON co.concept_id=ca.concept_id
        WHERE ca.parent_id=$1 AND ca.scope='professional' AND ca.level=2
          AND co.domain='servicos' AND co.slug=ca.slug`, [b?.category_id]);
    rec('5 concept_id dos 4 grãos intacto/concept-bound', conceptBound.rows.length === 4,
      `n=${conceptBound.rows.length}`);

    // 6) bucket segue SEM concept_id
    rec('6 bucket limpeza-conservacao sem concept_id', b?.concept_id == null, `concept=${b?.concept_id}`);

    // 7) limpeza-servicos NÃO foi alterado (path=["profissoes"], sem concept, vazio, professional L1)
    const ls = await pool.query(
      `SELECT ca.path, ca.concept_id, ca.level, ca.scope,
              (SELECT count(*)::int FROM categories ch WHERE ch.parent_id=ca.category_id) children
         FROM categories ca WHERE slug='limpeza-servicos' AND scope='professional' AND level=1`);
    const l = ls.rows[0];
    rec('7 limpeza-servicos intocado (path=["profissoes"], sem concept, vazio)',
      ls.rows.length === 1 && eqPath(l?.path, ['profissoes']) && l?.concept_id == null && l?.children === 0,
      `path=[${l?.path?.join(', ')}] concept=${l?.concept_id} children=${l?.children}`);

    // 8) canonical_services seguem 4 concept-bound
    const canon = await pool.query(
      `SELECT count(*)::int n FROM canonical_services cs JOIN concepts co ON co.concept_id=cs.concept_id
        WHERE cs.scope='global' AND cs.status='active' AND cs.slug=ANY($1) AND co.slug=cs.slug`, [GRAIN_SLUGS]);
    rec('8 canonical_services seguem 4 concept-bound', canon.rows[0].n === 4, `n=${canon.rows[0].n}`);

    // 9) aliases seguem 21
    const alias = await pool.query(
      `SELECT count(*)::int n FROM service_search_aliases WHERE source=$1`, [CLEANING_SOURCE]);
    rec('9 aliases seguem 21', alias.rows[0].n === 21, `n=${alias.rows[0].n}`);

    // 10) labels seguem 4 primárias
    const label = await pool.query(
      `SELECT count(*)::int n FROM concept_labels
        WHERE source=$1 AND locale='pt-BR' AND context_key='default' AND is_primary=true`, [CLEANING_SOURCE]);
    rec('10 labels seguem 4 primárias', label.rows[0].n === 4, `n=${label.rows[0].n}`);

    // 11) alias ≠ autoridade não regrediu: o grão só é ofertável após C1 (gate DECISION-0144 VIVO).
    //     Sem qualquer declaração ativa, o termo "diarista" resolve o concept mas NÃO surge como ofertável.
    const { resolveConceptsFromSearchTerm } = await import('../core/semantic/semantic.adapter');
    const { canonicalServiceService } = await import('../core/catalog/canonical/canonical-service.service');
    const TENANT = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
    const faxinaConcept = await pool.query(
      `SELECT concept_id FROM concepts WHERE domain='servicos' AND slug='faxina-residencial' LIMIT 1`);
    const faxinaId = faxinaConcept.rows[0]?.concept_id;
    const resolved = await resolveConceptsFromSearchTerm('diarista');
    const resolvesToFaxina = Array.isArray(resolved?.conceptIds) && resolved.conceptIds.includes(faxinaId);
    // actor sintético user/sem-empresa (o gate só o usa no EXISTS contra actor_professional_concepts):
    // sem C1 → grão NÃO surge, mesmo o alias resolvendo o concept. READ-ONLY (não cria declaração).
    const noC1Actor = { actor_id: '00000000-0000-0000-0000-0000000000e2', actor_type: 'user', company_id: null as string | null };
    const offerable = await canonicalServiceService.searchOfferable(TENANT, noC1Actor, 'diarista');
    const faxinaOfferable = Array.isArray(offerable) && offerable.some((o: any) => o?.conceptId === faxinaId);
    rec('11 alias≠autoridade não regrediu (resolve concept, mas gate C1 barra ofertável)',
      resolvesToFaxina && !faxinaOfferable,
      `resolve=${resolvesToFaxina} offerableSemC1=${faxinaOfferable}`);

    // 12) Δbank=0 — normalização de path é money-free: nenhuma bank_transaction referencia
    //     os concepts de Limpeza (checagem por concept_id, coluna real de bank_transactions).
    const bank = await pool.query(
      `SELECT count(*)::int n FROM bank_transactions bt
        JOIN concepts co ON co.concept_id = bt.concept_id
       WHERE co.domain='servicos' AND co.slug = ANY($1)`, [GRAIN_SLUGS]);
    rec('12 Δbank=0 (nenhuma bank_transaction referencia os concepts de limpeza)', bank.rows[0].n === 0, `n=${bank.rows[0].n}`);

  } finally {
    await pool.end().catch(() => {});
  }

  console.log('\n=== E2E path-normalization (Limpeza / W-M1) ===');
  let fail = 0;
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? '  — ' + r.detail : ''}`);
    if (!r.ok) fail++;
  }
  console.log(`\n${results.length - fail}/${results.length} PASS`);
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
