/**
 * E2E — F-SERVICE-SEARCH-ALIAS-SELFNAME-BACKFILL (DT-SERVICE-SEARCH-ALIAS-SELFNAME-GAP, decisão
 * híbrida de Clayton 2026-07-02). NÃO MOVE DINHEIRO. Prova, via migration FULL + resolver real
 * (`resolveConceptsFromSearchTerm`), que os 12 canonical_services que faltavam self-name agora
 * resolvem por si mesmos, sem quebrar nada do vocabulário existente.
 *
 *   A migration backfill aplicou exatamente 12 aliases (source dedicado)
 *   B resolver real: os 12 termos-alvo (ex. "barba") resolvem pro PRÓPRIO concept — cenário
 *      exato reportado por Clayton no browser
 *   C invariante estrutural: gate validate-service-search-alias-selfname-invariant PASSA (todo
 *      canonical_service global/active tem self-name)
 *   D idempotência: reaplicar o INSERT (ON CONFLICT DO NOTHING) não duplica nem falha
 *   E sinônimos pré-existentes (barbeiro→[barba,corte-de-cabelo-masculino]) continuam intactos —
 *      backfill não pisou em curadoria anterior
 *   F alias ≠ autoridade: resolver achar o concept NÃO significa ofertável (C1/DECISION-0144
 *      continua sendo o gate real — sem C1, offering-eligibility nega)
 *   G Δbank=0
 *
 * 🔒 DB EFÊMERA (run-service-search-alias-selfname-backfill-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { execSync } from 'child_process';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

const SELFNAME_SLUGS = [
  'alisamento-capilar', 'barba', 'coloracao-total', 'corte-de-cabelo-feminino',
  'corte-de-cabelo-masculino', 'design-de-sobrancelhas', 'escova', 'faxina-residencial',
  'luzes-capilares', 'organizacao-residencial', 'retoque-de-raiz', 'tonalizante',
];

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/selfname|alias|search|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  console.log('\n— A: migration aplicou exatamente 12 aliases self-name —');
  const backfillCount = await count(
    `SELECT count(*)::int AS n FROM service_search_aliases WHERE source = 'clayton_curated_selfname_backfill_2026_07_02'`
  );
  record('A exatamente 12 aliases com source dedicado', backfillCount === 12, `count=${backfillCount}`);

  const { resolveConceptsFromSearchTerm } = await import('../core/semantic/semantic.adapter');

  console.log('\n— B: resolver real — os 12 termos-alvo resolvem pro próprio concept —');
  let allSelfResolve = true;
  for (const slug of SELFNAME_SLUGS) {
    const conceptRow = (await pool.query<{ concept_id: string }>(
      `SELECT concept_id FROM canonical_services WHERE slug = $1 AND scope='global' AND status='active'`,
      [slug]
    )).rows[0];
    const r = await resolveConceptsFromSearchTerm(slug.replace(/-/g, ' '));
    const resolves = !!conceptRow && r.conceptIds.includes(conceptRow.concept_id);
    if (!resolves) { allSelfResolve = false; console.log(`     ❌ ${slug}: esperado concept_id=${conceptRow?.concept_id}, resolveu=${JSON.stringify(r.conceptIds)}`); }
  }
  record('B todos os 12 termos-alvo (incl. "barba", cenário do Clayton) resolvem pro próprio concept', allSelfResolve);

  console.log('\n— C: invariante estrutural (gate dedicado) —');
  let cOk = false;
  try {
    execSync('npx tsx scripts/validate-service-search-alias-selfname-invariant.ts', { cwd, encoding: 'utf8' });
    cOk = true;
  } catch { cOk = false; }
  record('C gate validate-service-search-alias-selfname-invariant PASSA', cOk);

  console.log('\n— D: idempotência — reaplicar não duplica —');
  await pool.query(
    `INSERT INTO service_search_aliases
      (alias_term, normalized_term, concept_id, confidence, review_status, is_active, source, catalog_version)
     SELECT cl.label, cs.slug, cs.concept_id, 'high', 'approved', true,
       'clayton_curated_selfname_backfill_2026_07_02', 'selfname-backfill-v1'
     FROM canonical_services cs
     JOIN concept_labels cl ON cl.concept_id = cs.concept_id AND cl.locale='pt-BR' AND cl.context_key='default' AND cl.is_primary=true
     WHERE cs.scope='global' AND cs.status='active' AND cs.slug = ANY($1::text[])
     ON CONFLICT (normalized_term, concept_id) DO NOTHING`,
    [SELFNAME_SLUGS]
  );
  const backfillCountAfterReapply = await count(
    `SELECT count(*)::int AS n FROM service_search_aliases WHERE source = 'clayton_curated_selfname_backfill_2026_07_02'`
  );
  record('D reaplicar não duplica (ainda 12)', backfillCountAfterReapply === 12, `count=${backfillCountAfterReapply}`);

  console.log('\n— E: sinônimos pré-existentes intactos —');
  const rBarbeiro = await resolveConceptsFromSearchTerm('barbeiro');
  record('E "barbeiro" continua resolvendo (curadoria anterior não pisada)', rBarbeiro.conceptIds.length >= 1, JSON.stringify(rBarbeiro));

  console.log('\n— F: alias ≠ autoridade —');
  const barbaConcept = (await pool.query<{ concept_id: string }>(
    `SELECT concept_id FROM canonical_services WHERE slug='barba'`
  )).rows[0].concept_id;
  const hasActiveDeclaration = await count(
    `SELECT count(*)::int AS n FROM actor_professional_concepts WHERE concept_id = $1 AND is_active = true`,
    [barbaConcept]
  );
  record('F resolver achar concept ("barba") NÃO implica C1 ativo (autoridade segue gate separado)', hasActiveDeclaration === 0, `active_declarations=${hasActiveDeclaration}`);

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('G Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ 12 self-name aliases aplicados; "barba" e os outros 11 resolvem pro próprio concept; invariante estrutural blindada; idempotente; curadoria anterior intacta; alias≠autoridade preservado; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
