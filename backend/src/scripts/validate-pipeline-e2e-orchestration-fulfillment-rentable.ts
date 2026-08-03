/**
 * E2E — F-EVENT-ORCHESTRATION-RENTABLE. 🔒 SÓ DB efêmera (EXPECTED_DATABASE_NAME).
 *
 * PROVA que o CHECK de fulfillment_kind era MAIS ESTRITO que o vocabulário GOVERNADO
 * (concept_offer_kinds.offer_kind = 'service' | 'rentable'), e que ampliá-lo não afrouxa nada:
 * o enforcement material continua sendo a FK composta (need_concept_id, fulfillment_kind).
 *
 *  RED   (sem a migration): declarar item de template 'rentable' é RECUSADO pelo CHECK (23514).
 *  GREEN (com a migration): ① 'rentable' aceito para concept locável
 *                           ② concept NÃO-locável AINDA recusado (23503) — a FK composta segue
 *                              mordendo. Sem esta asserção o verde não provaria nada: um CHECK
 *                              simplesmente removido teria o mesmo verde.
 *                           ③ valor fora do vocabulário governado ainda recusado (23514)
 *                           ④ event_operational_needs tem o MESMO vocabulário (asserção estrutural
 *                              em pg_constraint — a tabela exige um evento real, que a efêmera não
 *                              tem por não rodar seeds)
 *
 * A efêmera roda sem seeds: usamos os concepts do próprio GENESIS, lidos do banco, NUNCA inventados.
 */
import { Client } from 'pg';

const phase = process.argv[2] as 'red' | 'green' | undefined;

function assertEphemeral(): string {
  const url = process.env.DATABASE_URL;
  const expected = process.env.EXPECTED_DATABASE_NAME;
  if (!url || !expected) throw new Error('DATABASE_URL/EXPECTED_DATABASE_NAME ausentes — recusa fail-closed.');
  if (expected === 'unificard_dev') throw new Error('ABORT: alvo é unificard_dev.');
  if (!url.endsWith(`/${expected}`)) throw new Error(`DATABASE_URL não aponta para ${expected}.`);
  return url;
}

/** Devolve o SQLSTATE do erro, ou null se a inserção foi aceita. Sempre desfaz. */
async function tryTemplateItem(
  c: Client,
  formatConceptId: string,
  needConceptId: string,
  fulfillmentKind: string
): Promise<string | null> {
  try {
    await c.query('BEGIN');
    await c.query(
      `INSERT INTO event_orchestration_template_items
         (format_concept_id, need_concept_id, fulfillment_kind, is_required, sort_order)
       VALUES ($1, $2, $3, false, 999)`,
      [formatConceptId, needConceptId, fulfillmentKind]
    );
    await c.query('ROLLBACK');
    return null;
  } catch (err) {
    await c.query('ROLLBACK');
    return (err as { code?: string }).code ?? 'UNKNOWN';
  }
}

async function main(): Promise<void> {
  if (phase !== 'red' && phase !== 'green') throw new Error('uso: <red|green>');
  const url = assertEphemeral();
  const c = new Client({ connectionString: url });
  await c.connect();

  try {
    const fmt = await c.query<{ concept_id: string }>(`SELECT concept_id FROM event_format_concepts LIMIT 1`);
    if (!fmt.rows[0]) throw new Error('nenhum event_format_concepts na efêmera');
    const formatConceptId = fmt.rows[0].concept_id;

    // Concepts lidos do vocabulário GOVERNADO — nunca inventados aqui.
    const rentable = await c.query<{ concept_id: string }>(
      `SELECT k.concept_id FROM concept_offer_kinds k
        WHERE k.offer_kind = 'rentable'
          AND NOT EXISTS (SELECT 1 FROM event_orchestration_template_items t
                           WHERE t.format_concept_id = $1 AND t.need_concept_id = k.concept_id)
        LIMIT 1`,
      [formatConceptId]
    );
    const serviceOnly = await c.query<{ concept_id: string }>(
      `SELECT s.concept_id FROM concept_offer_kinds s
        WHERE s.offer_kind = 'service'
          AND NOT EXISTS (SELECT 1 FROM concept_offer_kinds r
                           WHERE r.concept_id = s.concept_id AND r.offer_kind = 'rentable')
          AND NOT EXISTS (SELECT 1 FROM event_orchestration_template_items t
                           WHERE t.format_concept_id = $1 AND t.need_concept_id = s.concept_id)
        LIMIT 1`,
      [formatConceptId]
    );
    if (!rentable.rows[0] || !serviceOnly.rows[0]) {
      throw new Error('vocabulário insuficiente na efêmera (falta concept rentable e/ou service-only livre)');
    }

    if (phase === 'red') {
      const code = await tryTemplateItem(c, formatConceptId, rentable.rows[0].concept_id, 'rentable');
      if (code !== '23514') {
        throw new Error(`RED esperava 23514 (check_violation) e obteve: ${code ?? 'INSERÇÃO ACEITA'}`);
      }
      console.log('✅ RED — sem a migration, fulfillment_kind=rentable é recusado pelo CHECK (23514).');
      return;
    }

    const ok = await tryTemplateItem(c, formatConceptId, rentable.rows[0].concept_id, 'rentable');
    if (ok !== null) throw new Error(`GREEN① esperava INSERÇÃO ACEITA e obteve erro ${ok}`);
    console.log('✅ GREEN① — concept locável aceito com fulfillment_kind=rentable.');

    const fk = await tryTemplateItem(c, formatConceptId, serviceOnly.rows[0].concept_id, 'rentable');
    if (fk !== '23503') {
      throw new Error(`GREEN② esperava 23503 (foreign_key_violation) e obteve: ${fk ?? 'INSERÇÃO ACEITA'}`);
    }
    console.log('✅ GREEN② — concept NÃO-locável segue recusado pela FK composta (23503): o CHECK ampliou, o enforcement NÃO afrouxou.');

    const bad = await tryTemplateItem(c, formatConceptId, rentable.rows[0].concept_id, 'sales_channel');
    if (bad !== '23514') {
      throw new Error(`GREEN③ esperava 23514 para valor fora do vocabulário e obteve: ${bad ?? 'INSERÇÃO ACEITA'}`);
    }
    console.log('✅ GREEN③ — valor fora do vocabulário governado (sales_channel) recusado pelo CHECK (23514).');

    const needsCheck = await c.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'event_operational_needs'::regclass
          AND conname = 'chk_event_op_needs_fulfillment'`
    );
    const def = needsCheck.rows[0]?.def ?? '';
    if (!def.includes('rentable') || !def.includes('service')) {
      throw new Error(`GREEN④ event_operational_needs não tem o vocabulário esperado. CHECK atual: ${def || 'AUSENTE'}`);
    }
    console.log('✅ GREEN④ — event_operational_needs carrega o MESMO vocabulário (service | rentable).');
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error(`💥 ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
