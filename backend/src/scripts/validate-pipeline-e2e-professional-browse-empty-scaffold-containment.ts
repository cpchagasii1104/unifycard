/**
 * E2E — F-PROFESSIONAL-BROWSE-EMPTY-SCAFFOLD-CONTAINMENT-SLICE-A (D1).
 *
 * Prova, contra o DB dev VIVO + os read-models VIVOS, que buckets L1 professional VAZIOS
 * (scope='professional' ∧ level=1 ∧ concept_id NULL ∧ 0 filhos) deixam de aparecer no BROWSE DO
 * PRODUTOR (árvore + autocomplete) — SEM apagar/fundir/reparentar nada e SEM tocar
 * concept/canonical/alias/label/autoridade. Money-free (Δbank=0 estrutural).
 *
 * READ-ONLY: apenas leitura via serviços canônicos + SELECT. NÃO altera dado.
 */
import { loadBackendEnv } from '../core/db/load-backend-env';
loadBackendEnv();

const CLEANING_SOURCE = 'clayton_curated_cleaning_slice_a_2026_07_01';
const GRAIN_SLUGS = ['faxina-residencial', 'passadoria', 'limpeza-comercial', 'organizacao-residencial'];
const FILLED_L1 = ['beleza-estetica', 'limpeza-conservacao', 'medicina'];

type Node = { categoryId: string; slug: string; scope?: string; level: number; conceptId?: string | null; children?: Node[] };

const flatten = (nodes: Node[]): Node[] => {
  const out: Node[] = [];
  const walk = (list: Node[]) => {
    for (const n of list) { out.push(n); if (n.children?.length) walk(n.children); }
  };
  walk(nodes || []);
  return out;
};
const emptyL1 = (n: Node) =>
  n.scope === 'professional' && n.level === 1 && (n.conceptId === null || n.conceptId === undefined) && (!n.children || n.children.length === 0);

(async () => {
  const { pool } = await import('../core/database/pool');
  const { categoriesService } = await import('../core/categories/categories.service');
  const { SYSTEM_TENANT, ensureSystemTenant } = await import('../core/tenants/system-tenant');
  const { resolveConceptsFromSearchTerm } = await import('../core/semantic/semantic.adapter');
  const { canonicalServiceService } = await import('../core/catalog/canonical/canonical-service.service');

  const results: Array<{ ok: boolean; label: string; detail?: string }> = [];
  const rec = (label: string, ok: boolean, detail = '') => results.push({ ok, label, detail });

  try {
    await ensureSystemTenant();
    const TENANT = SYSTEM_TENANT.tenantId;

    // ── BASELINE: árvore CRUA (getCategoriesForTenant) ainda contém os armários vazios.
    const rawTree = (await categoriesService.getCategoriesForTenant(TENANT, 'professional')) as unknown as Node[];
    const rawFlat = flatten(rawTree);
    const rawEmpties = rawFlat.filter(emptyL1);
    rec('0 baseline: árvore crua ainda tem armários vazios (o problema existe antes do filtro)',
      rawEmpties.length >= 2 && rawEmpties.some((n) => n.slug === 'limpeza-servicos'),
      `empties_crus=${rawEmpties.length} incl_limpeza-servicos=${rawEmpties.some((n) => n.slug === 'limpeza-servicos')}`);

    // ── PRUNED: aplicar o filtro de leitura (o que o produtor vê na ÁRVORE).
    const prunedTree = categoriesService.pruneEmptyProfessionalScaffolds(rawTree as any, 'professional') as unknown as Node[];
    const prunedFlat = flatten(prunedTree);

    // 1) ZERO buckets L1 professional vazios no browse (árvore) do produtor.
    const prunedEmpties = prunedFlat.filter(emptyL1);
    rec('1 buckets L1 professional vazios NÃO aparecem na árvore do produtor', prunedEmpties.length === 0,
      `restantes=${prunedEmpties.map((n) => n.slug).join(',') || '∅'}`);

    // 2) limpeza-servicos não aparece no browse do produtor.
    rec('2 limpeza-servicos ausente do browse do produtor',
      !prunedFlat.some((n) => n.slug === 'limpeza-servicos' && n.scope === 'professional'), '');

    // 3) os demais scaffolds vazios também não aparecem (prova por amostra: automotivo/jardinagem).
    const gone = ['automotivo-mecanica', 'jardinagem-manutencao', 'direito', 'educacao', 'tecnologia'];
    rec('3 demais scaffolds vazios também ausentes do browse',
      gone.every((s) => !prunedFlat.some((n) => n.slug === s && n.scope === 'professional')),
      `verificados=${gone.join(',')}`);

    // 4) buckets PREENCHIDOS continuam aparecendo (beleza-estetica, limpeza-conservacao, medicina).
    const filledPresent = FILLED_L1.every((s) => prunedFlat.some((n) => n.slug === s && n.level === 1));
    rec('4 buckets preenchidos preservados (beleza-estetica, limpeza-conservacao, medicina)', filledPresent,
      FILLED_L1.map((s) => `${s}=${prunedFlat.some((n) => n.slug === s && n.level === 1)}`).join(' '));

    // 5) folhas L2 concept-bound continuam na árvore (4 grãos de limpeza + grãos de beleza).
    const grainsPresent = GRAIN_SLUGS.every((s) => prunedFlat.some((n) => n.slug === s && n.level === 2 && !!n.conceptId));
    const belezaGrains = prunedFlat.filter((n) => n.level === 2 && !!n.conceptId && n.scope === 'professional').length;
    rec('5 folhas L2 concept-bound preservadas (4 grãos limpeza + grãos beleza ≥16)',
      grainsPresent && belezaGrains >= 20, `grãosL2_total=${belezaGrains} limpeza_ok=${grainsPresent}`);

    // 6) autocomplete do produtor não retorna bucket L1 vazio ("limpeza" casa limpeza-servicos por nome).
    const acLimpeza = (await categoriesService.autocompleteCategories('limpeza', TENANT, 'professional', 20)) as any[];
    rec('6 autocomplete("limpeza") NÃO retorna limpeza-servicos (bucket vazio)',
      !acLimpeza.some((r) => r.slug === 'limpeza-servicos'),
      `retornou=${acLimpeza.map((r) => r.slug).slice(0, 8).join(',')}`);

    // 6b) autocomplete não retorna NENHUM bucket L1 professional vazio (varredura geral).
    const emptyL1Slugs = new Set(rawEmpties.map((n) => n.slug));
    rec('6b autocomplete não retorna nenhum dos scaffolds vazios',
      !acLimpeza.some((r) => emptyL1Slugs.has(r.slug)), '');

    // 7) autocomplete continua retornando grãos concept-bound relevantes (limpeza-comercial ou bucket cheio).
    const acRelevant = acLimpeza.some((r) => r.slug === 'limpeza-comercial' || r.slug === 'limpeza-conservacao');
    rec('7 autocomplete continua retornando grãos/bucket preenchido relevante', acRelevant,
      `relevantes=${acLimpeza.filter((r) => r.slug === 'limpeza-comercial' || r.slug === 'limpeza-conservacao').map((r) => r.slug).join(',')}`);

    // 8) ALIAS continua LENTE: diarista → concept faxina-residencial (resolve), mas NÃO concede autoridade.
    const faxinaConcept = await pool.query(`SELECT concept_id FROM concepts WHERE domain='servicos' AND slug='faxina-residencial' LIMIT 1`);
    const faxinaId = faxinaConcept.rows[0]?.concept_id;
    const resolved = await resolveConceptsFromSearchTerm('diarista');
    const resolvesToFaxina = Array.isArray(resolved?.conceptIds) && resolved.conceptIds.includes(faxinaId);
    rec('8 alias "diarista" resolve concept faxina-residencial (lente intacta)', resolvesToFaxina,
      `resolve=${resolvesToFaxina}`);

    // 9) GATE C1/DECISION-0144 não regrediu: sem C1, "diarista" NÃO surge como ofertável.
    const noC1Actor = { actor_id: '00000000-0000-0000-0000-0000000000e2', actor_type: 'user', company_id: null as string | null };
    const offerable = await canonicalServiceService.searchOfferable(TENANT, noC1Actor, 'diarista');
    const faxinaOfferable = Array.isArray(offerable) && offerable.some((o: any) => o?.conceptId === faxinaId);
    rec('9 gate C1/DECISION-0144 não regrediu (alias sem C1 NÃO vira ofertável)', !faxinaOfferable,
      `offerableSemC1=${faxinaOfferable}`);

    // 10) concept_id continua obrigatório para identidade das folhas (grãos concept-bound no dado).
    const grainConcept = await pool.query(
      `SELECT count(*)::int n FROM categories ca JOIN concepts co ON co.concept_id=ca.concept_id
        WHERE ca.slug = ANY($1) AND ca.scope='professional' AND ca.level=2 AND co.domain='servicos' AND co.slug=ca.slug`, [GRAIN_SLUGS]);
    rec('10 concept_id obrigatório/intacto nas folhas L2 (4 grãos concept-bound)', grainConcept.rows[0].n === 4,
      `n=${grainConcept.rows[0].n}`);

    // 11) NENHUM concept/canonical/alias/label alterado (contagens da vertical limpeza).
    const cCanon = await pool.query(`SELECT count(*)::int n FROM canonical_services WHERE scope='global' AND status='active' AND slug=ANY($1)`, [GRAIN_SLUGS]);
    const cAlias = await pool.query(`SELECT count(*)::int n FROM service_search_aliases WHERE source=$1`, [CLEANING_SOURCE]);
    const cLabel = await pool.query(`SELECT count(*)::int n FROM concept_labels WHERE source=$1 AND is_primary=true`, [CLEANING_SOURCE]);
    const cConcept = await pool.query(`SELECT count(*)::int n FROM concepts WHERE domain='servicos' AND slug=ANY($1)`, [GRAIN_SLUGS]);
    rec('11 concept/canonical/alias/label INTACTOS (4/4/21/4)',
      cConcept.rows[0].n === 4 && cCanon.rows[0].n === 4 && cAlias.rows[0].n === 21 && cLabel.rows[0].n === 4,
      `concept=${cConcept.rows[0].n} canonical=${cCanon.rows[0].n} alias=${cAlias.rows[0].n} label=${cLabel.rows[0].n}`);

    // 12) limpeza-servicos PERMANECE no DB: professional, level 1, concept NULL, 0 filhos, NÃO apagado.
    const ls = await pool.query(
      `SELECT ca.scope, ca.level, ca.concept_id,
              (SELECT count(*)::int FROM categories ch WHERE ch.parent_id=ca.category_id) children
         FROM categories ca WHERE slug='limpeza-servicos' AND scope='professional' AND level=1`);
    const l = ls.rows[0];
    rec('12 limpeza-servicos PERMANECE no DB (não apagado; professional/L1/concept NULL/0 filhos)',
      ls.rows.length === 1 && l?.concept_id == null && l?.children === 0,
      `existe=${ls.rows.length === 1} concept=${l?.concept_id} children=${l?.children}`);

    // 12b) os 20 scaffolds vazios permanecem no DB (nada foi apagado).
    const scaffoldsDb = await pool.query(
      `SELECT count(*)::int n FROM categories c WHERE c.scope='professional' AND c.level=1 AND c.concept_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id=c.category_id)`);
    rec('12b scaffolds vazios PERMANECEM no dado (filtro é leitura, não deleção)', scaffoldsDb.rows[0].n >= 20,
      `scaffolds_no_db=${scaffoldsDb.rows[0].n}`);

    // 13) Δbank=0 — nenhuma bank_transaction referencia os concepts de limpeza (nav cleanup é money-free).
    const bank = await pool.query(
      `SELECT count(*)::int n FROM bank_transactions bt JOIN concepts co ON co.concept_id=bt.concept_id
        WHERE co.domain='servicos' AND co.slug=ANY($1)`, [GRAIN_SLUGS]);
    rec('13 Δbank=0 (nenhuma bank_transaction referencia concepts de limpeza)', bank.rows[0].n === 0, `n=${bank.rows[0].n}`);

    // 14) CONTEXT-GUARD: o filtro só age em professional — árvore sintética em outro context volta intacta.
    const synthetic: Node[] = [{ categoryId: 'x', slug: 'empty-bucket', scope: 'professional', level: 1, conceptId: null, children: [] }];
    const untouched = categoriesService.pruneEmptyProfessionalScaffolds(synthetic as any, 'marketplace' as any) as unknown as Node[];
    rec('14 context-guard: filtro NÃO age fora de professional (marketplace intacto)', untouched.length === 1, `len=${untouched.length}`);

  } finally {
    await pool.end().catch(() => {});
  }

  console.log('\n=== E2E professional-browse-empty-scaffold-containment (D1) ===');
  let fail = 0;
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? '  — ' + r.detail : ''}`);
    if (!r.ok) fail++;
  }
  console.log(`\n${results.length - fail}/${results.length} PASS`);
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
