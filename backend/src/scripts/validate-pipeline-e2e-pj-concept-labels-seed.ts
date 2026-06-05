/**
 * E2E F-PJ-CONCEPT-LABELS-SEED-MVP — seed pt-BR dos 7 labels primários (DECISION-0107 D10).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-concept-labels-seed-ephemeral.ps1. O seed roda como migration FULL.
 *
 * Prova: 7 labels primárias pt-BR/default curadas; cada uma resolve o concept correto por slug; idempotente
 * (re-aplicar não duplica + atualiza); índice parcial impede 2ª primária; `concepts` seco; Bank intocado.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const SRC = 'clayton_curated_mvp_2026_06_05';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/concept|label|seed|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const EXPECTED_LABELS: Array<[string, string, string]> = [
  ['varejo-alimentar-integrado', 'Supermercado', 'Supermercado'],
  ['varejo-alimentar-especializado-hortifruti', 'Hortifruti', 'Hortifruti'],
  ['varejo-alimentar-especializado-carnes', 'Açougue / Varejo de Carnes', 'Açougue'],
  ['varejo-alimentar-especializado-padaria', 'Padaria', 'Padaria'],
  ['saude-varejo-farmaceutico', 'Farmácia', 'Farmácia'],
  ['servicos-pessoais-beleza', 'Salão de Beleza / Estética', 'Beleza'],
  ['alimentacao-servico-preparado', 'Restaurante', 'Restaurante'],
];

async function main(): Promise<void> {
  await assertEphemeralDb();

  // 1. 7 primárias pt-BR/default curadas (semeadas pela migration FULL).
  const total = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM concept_labels WHERE source=$1 AND locale='pt-BR' AND context_key='default' AND is_primary=true`, [SRC]
  )).rows[0].n);
  record('1 exatamente 7 labels primárias pt-BR/default curadas', total === 7, `n=${total}`);

  // 2. cada label resolve o concept correto por slug + label/short_label corretos.
  let allMatch = true;
  for (const [slug, label, shortLabel] of EXPECTED_LABELS) {
    const r = await pool.query<{ label: string; short_label: string; is_primary: boolean }>(
      `SELECT cl.label, cl.short_label, cl.is_primary
         FROM concept_labels cl JOIN concepts c ON c.concept_id = cl.concept_id
        WHERE c.slug=$1 AND cl.locale='pt-BR' AND cl.context_key='default' AND cl.is_primary=true`, [slug]
    );
    const ok = r.rowCount === 1 && r.rows[0].label === label && r.rows[0].short_label === shortLabel;
    if (!ok) { allMatch = false; record(`2 ${slug} → "${label}"/"${shortLabel}"`, false, JSON.stringify(r.rows[0])); }
  }
  if (allMatch) record('2 todos os 7 resolvem concept por slug + label/short_label corretos', true);

  // 3. idempotência: re-aplicar o seed (mesmo ON CONFLICT) não duplica + atualiza.
  await pool.query(
    `INSERT INTO concept_labels (concept_id, locale, context_key, label, short_label, is_primary, source)
     SELECT c.concept_id, 'pt-BR', 'default', v.label, v.short_label, true, $1
     FROM (VALUES
       ('varejo-alimentar-integrado','Supermercado','Supermercado'),
       ('varejo-alimentar-especializado-hortifruti','Hortifruti','Hortifruti'),
       ('varejo-alimentar-especializado-carnes','Açougue / Varejo de Carnes','Açougue'),
       ('varejo-alimentar-especializado-padaria','Padaria','Padaria'),
       ('saude-varejo-farmaceutico','Farmácia','Farmácia'),
       ('servicos-pessoais-beleza','Salão de Beleza / Estética','Beleza'),
       ('alimentacao-servico-preparado','Restaurante','Restaurante')
     ) AS v(concept_slug, label, short_label)
     JOIN concepts c ON c.slug = v.concept_slug
     ON CONFLICT (concept_id, locale, context_key) WHERE is_primary = true
     DO UPDATE SET label=EXCLUDED.label, short_label=EXCLUDED.short_label, source=EXCLUDED.source, updated_at=now()`,
    [SRC]
  );
  const afterReapply = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM concept_labels WHERE source=$1 AND is_primary=true`, [SRC]
  )).rows[0].n);
  record('3 idempotência: re-aplicar o seed continua 7 (ON CONFLICT, sem duplicar)', afterReapply === 7, `n=${afterReapply}`);

  // 4. índice parcial impede 2ª primária para o mesmo (concept, locale, context).
  const conceptA = (await pool.query<{ c: string }>(`SELECT c.concept_id::text AS c FROM concepts c WHERE c.slug='alimentacao-servico-preparado'`)).rows[0].c;
  let blocked = false; let code = '';
  try {
    await pool.query(`INSERT INTO concept_labels (concept_id, locale, context_key, label, source, is_primary) VALUES ($1::uuid,'pt-BR','default','Outra Primária','test',true)`, [conceptA]);
  } catch (e: any) { blocked = e?.code === '23505'; code = e?.code ?? ''; }
  record('4 índice parcial impede 2ª primária (23505)', blocked, `code=${code}`);

  // 5. concepts segue seco.
  const dry = Number((await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.columns WHERE table_name='concepts' AND column_name IN ('display_name','name','label')`
  )).rows[0].n);
  record('5 concepts segue seco (sem display_name/name/label)', dry === 0, `n=${dry}`);

  // 6. Bank intocado.
  const bank = Number((await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text AS n`)).rows[0].n);
  record('6 Bank intocado (0)', bank === 0, `n=${bank}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Seed concept_labels MVP verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
