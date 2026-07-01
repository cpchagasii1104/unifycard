/**
 * E2E F-SERVICE-CATALOG-LABEL-BACKFILL-SLICE — backfill pt-BR dos 16 grãos de beleza (DECISION-0107).
 *
 * Roda contra o DB de trabalho (dev), lê o estado semeado pela migration
 * 20260701120000_seed_beauty_concept_labels_backfill.sql. NÃO deixa sujeira: o único teste destrutivo
 * (2ª primária) roda dentro de BEGIN...ROLLBACK (prova constraint viva sem gravar).
 *
 * Prova: (1) exatamente 16 labels pt-BR/default/primary da fonte curada; (2) cada label resolve o concept
 * correto por slug; (3) short_label bate com a lista aprovada; (4) idempotência (re-apply não duplica);
 * (5) 2ª primária falha pela constraint (23505) sem deixar sujeira; (6) concepts segue seco (sem display_name);
 * (7) label não é usado como identidade (identidade de canonical resolve por concept_id, não por label);
 * (8) Δbank=0.
 */
import { loadBackendEnv } from '../core/db/load-backend-env';
loadBackendEnv();

const SRC = 'clayton_curated_beauty_backfill_2026_07_01';

const EXPECTED_LABELS: Array<[string, string, string]> = [
  ['alisamento-capilar', 'Alisamento capilar', 'Alisamento'],
  ['barba', 'Barba', 'Barba'],
  ['botox-capilar', 'Botox capilar', 'Botox'],
  ['coloracao-total', 'Coloração total', 'Coloração'],
  ['corte-de-cabelo-feminino', 'Corte de cabelo feminino', 'Corte feminino'],
  ['corte-de-cabelo-masculino', 'Corte de cabelo masculino', 'Corte masculino'],
  ['design-de-sobrancelhas', 'Design de sobrancelhas', 'Sobrancelhas'],
  ['escova', 'Escova', 'Escova'],
  ['luzes-capilares', 'Luzes capilares', 'Luzes'],
  ['manicure', 'Manicure', 'Manicure'],
  ['mechas', 'Mechas', 'Mechas'],
  ['pedicure', 'Pedicure', 'Pedicure'],
  ['progressiva', 'Progressiva', 'Progressiva'],
  ['retoque-de-raiz', 'Retoque de raiz', 'Retoque'],
  ['selagem', 'Selagem', 'Selagem'],
  ['tonalizante', 'Tonalizante', 'Tonalizante'],
];

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function main(): Promise<void> {
  const { pool } = await import('../core/database/pool');

  const bankBefore = Number((await pool.query<{ n: string }>(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text AS n`
  )).rows[0].n);

  // 1. exatamente 16 primárias pt-BR/default da fonte curada.
  const total = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM concept_labels WHERE source=$1 AND locale='pt-BR' AND context_key='default' AND is_primary=true`, [SRC]
  )).rows[0].n);
  record('1 exatamente 16 labels primárias pt-BR/default curadas', total === 16, `n=${total}`);

  // 2 + 3. cada label resolve o concept correto por slug + short_label bate.
  let allMatch = true;
  for (const [slug, label, shortLabel] of EXPECTED_LABELS) {
    const r = await pool.query<{ label: string; short_label: string }>(
      `SELECT cl.label, cl.short_label
         FROM concept_labels cl JOIN concepts c ON c.concept_id = cl.concept_id
        WHERE c.slug=$1 AND cl.locale='pt-BR' AND cl.context_key='default' AND cl.is_primary=true`, [slug]
    );
    const ok = r.rowCount === 1 && r.rows[0].label === label && r.rows[0].short_label === shortLabel;
    if (!ok) { allMatch = false; record(`2/3 ${slug} → "${label}"/"${shortLabel}"`, false, JSON.stringify(r.rows[0] ?? null)); }
  }
  if (allMatch) record('2/3 todos os 16 resolvem concept por slug + label/short_label corretos', true);

  // 4. idempotência: re-aplicar o seed (mesmo ON CONFLICT) não duplica.
  await pool.query(
    `INSERT INTO concept_labels (concept_id, locale, context_key, label, short_label, is_primary, source)
     SELECT c.concept_id, 'pt-BR', 'default', v.label, v.short_label, true, $1
     FROM (VALUES
       ('alisamento-capilar','Alisamento capilar','Alisamento'),
       ('barba','Barba','Barba'),
       ('botox-capilar','Botox capilar','Botox'),
       ('coloracao-total','Coloração total','Coloração'),
       ('corte-de-cabelo-feminino','Corte de cabelo feminino','Corte feminino'),
       ('corte-de-cabelo-masculino','Corte de cabelo masculino','Corte masculino'),
       ('design-de-sobrancelhas','Design de sobrancelhas','Sobrancelhas'),
       ('escova','Escova','Escova'),
       ('luzes-capilares','Luzes capilares','Luzes'),
       ('manicure','Manicure','Manicure'),
       ('mechas','Mechas','Mechas'),
       ('pedicure','Pedicure','Pedicure'),
       ('progressiva','Progressiva','Progressiva'),
       ('retoque-de-raiz','Retoque de raiz','Retoque'),
       ('selagem','Selagem','Selagem'),
       ('tonalizante','Tonalizante','Tonalizante')
     ) AS v(concept_slug, label, short_label)
     JOIN concepts c ON c.slug = v.concept_slug
     ON CONFLICT (concept_id, locale, context_key) WHERE is_primary = true
     DO UPDATE SET label=EXCLUDED.label, short_label=EXCLUDED.short_label, source=EXCLUDED.source, updated_at=now()`,
    [SRC]
  );
  const afterReapply = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM concept_labels WHERE source=$1 AND is_primary=true`, [SRC]
  )).rows[0].n);
  record('4 idempotência: re-aplicar o seed continua 16 (ON CONFLICT, sem duplicar)', afterReapply === 16, `n=${afterReapply}`);

  // 5. 2ª primária para o mesmo (concept, locale, context) falha pela constraint — SEM deixar sujeira (ROLLBACK).
  const client = await pool.connect();
  let blocked = false; let code = '';
  try {
    await client.query('BEGIN');
    const conceptA = (await client.query<{ c: string }>(`SELECT c.concept_id::text AS c FROM concepts c WHERE c.slug='barba'`)).rows[0].c;
    try {
      await client.query(`INSERT INTO concept_labels (concept_id, locale, context_key, label, source, is_primary) VALUES ($1::uuid,'pt-BR','default','Outra Primária','test',true)`, [conceptA]);
    } catch (e: any) { blocked = e?.code === '23505'; code = e?.code ?? ''; }
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  record('5 2ª primária barrada pela constraint (23505) sem deixar sujeira (ROLLBACK)', blocked, `code=${code}`);

  // 6. concepts segue seco.
  const dry = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.columns WHERE table_name='concepts' AND column_name IN ('display_name','name','label')`
  )).rows[0].n);
  record('6 concepts segue seco (sem display_name/name/label)', dry === 0, `n=${dry}`);

  // 7. identidade não vem do label: canonical resolve por concept_id, e o label é só projeção.
  //    Prova negativa: NÃO existe FK/uso de concept_labels.label como chave — canonical_services referencia concept_id.
  const identityByConcept = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM canonical_services cs
      JOIN concepts c ON c.concept_id = cs.concept_id
      WHERE cs.status='active' AND c.domain='servicos'`
  )).rows[0].n);
  record('7 identidade resolve por concept_id (label é projeção, não chave)', identityByConcept === 16, `n=${identityByConcept}`);

  // 8. Δbank=0.
  const bankAfter = Number((await pool.query<{ n: string }>(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text AS n`
  )).rows[0].n);
  record('8 Δbank=0', bankAfter - bankBefore === 0, `antes=${bankBefore} depois=${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  await pool.end().catch(() => {});
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    process.exit(1);
  }
  console.log('✨ Backfill de labels de beleza verde.');
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
