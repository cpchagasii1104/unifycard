/**
 * dev-clean-pj-residues.ts — limpeza AUTORIZADA de resíduos PJ no banco DEV (CP1 / PJ-B7).
 *
 * GO F-PJ-HUMAN-TO-COMPANY-END-TO-END-CLOSURE §3.5: limpeza de fixtures/probes com
 * dry-run default, --apply explícito, transação única, predicados reproduzíveis,
 * contagem antes/depois e relatório. NÃO é migration; NÃO roda em produção; NÃO é
 * substituto de constraint/gate (a coerência contínua é vigiada pelo gate estrutural PJ).
 *
 * Classes tratadas (origem comprovada por predicado, não por palpite):
 *   R1 — fiscal_identities ÓRFÃS de fixture: sem company, sem documentos, sem kyb_request,
 *        kyb_status='pending' (acúmulo dos E2Es que apagavam companies e vazavam a fonte
 *        fiscal — vazamento corrigido em helpers/pj-fiscal-cleanup.ts nesta mesma fatia).
 *   R2 — companies órfãs de PROBE: company_name LIKE 'PROBE-%', sem fiscal_identity,
 *        sem company_users, sem actors (resíduo de probe fail-first).
 *   R3 — companies PROVISIONAL SEM PAR operacional: violam o invariante vivo
 *        "PROVISIONAL ⇒ par gravado" (F-PJ-LIFECYCLE-DRAFT-TO-PROVISIONAL — a promoção
 *        canônica acontece NO MESMO UPDATE que grava o par). São dados dev anteriores ao
 *        writer; prova de elegibilidade: par NULL + zero publicações + KYB pending.
 *        Tratamento: REBAIXAR para DRAFT (não fabrica par semântico; não apaga histórico).
 *
 * Uso:  npx tsx src/scripts/dev-clean-pj-residues.ts            (dry-run, só relata)
 *       npx tsx src/scripts/dev-clean-pj-residues.ts --apply    (executa em transação)
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  // ── Proteção de ambiente: SÓ unificard_dev, NUNCA produção ──────────────────
  const dbRes = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = dbRes.rows[0]?.db;
  if (db !== 'unificard_dev') {
    throw new Error(`ABORT: este script é DEV-ONLY (alvo esperado unificard_dev; atual '${db}').`);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ABORT: NODE_ENV=production — limpeza dev recusada.');
  }
  console.log(`🔒 Banco confirmado: ${db} · modo: ${APPLY ? 'APPLY (transação)' : 'DRY-RUN (só relatório)'}\n`);

  // ── Predicados reproduzíveis ────────────────────────────────────────────────
  const R1_SELECT = `
    SELECT fi.fiscal_identity_id::text AS id, fi.cnpj, fi.created_at::text AS created_at
      FROM fiscal_identities fi
     WHERE fi.kyb_status = 'pending'
       AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.fiscal_identity_id = fi.fiscal_identity_id)
       AND NOT EXISTS (SELECT 1 FROM fiscal_identity_documents d WHERE d.fiscal_identity_id = fi.fiscal_identity_id)
       AND NOT EXISTS (SELECT 1 FROM fiscal_identity_kyb_requests r WHERE r.fiscal_identity_id = fi.fiscal_identity_id)`;
  const R2_SELECT = `
    SELECT c.company_id::text AS id, c.company_name, c.created_at::text AS created_at
      FROM companies c
     WHERE c.company_name LIKE 'PROBE-%'
       AND c.fiscal_identity_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM company_users cu WHERE cu.company_id = c.company_id)
       AND NOT EXISTS (SELECT 1 FROM actors a WHERE a.company_id = c.company_id)`;
  const R3_SELECT = `
    SELECT c.company_id::text AS id, c.company_name, c.company_status
      FROM companies c
      LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
     WHERE c.company_status = 'PROVISIONAL'
       AND c.primary_company_type_id IS NULL
       AND c.primary_concept_id IS NULL
       AND COALESCE(fi.kyb_status, 'pending') = 'pending'
       AND NOT EXISTS (SELECT 1 FROM company_concept_publications p WHERE p.company_id = c.company_id)`;

  const r1 = await pool.query(R1_SELECT);
  const r2 = await pool.query(R2_SELECT);
  const r3 = await pool.query(R3_SELECT);

  console.log(`R1 fiscal_identities órfãs de fixture: ${r1.rows.length}`);
  if (r1.rows.length > 0) {
    const dates = r1.rows.map((r) => String(r.created_at).slice(0, 10));
    console.log(`   janelas: ${[...new Set(dates)].sort().join(', ')}`);
  }
  console.log(`R2 companies órfãs de PROBE: ${r2.rows.length}`);
  r2.rows.forEach((r) => console.log(`   - ${r.id} "${r.company_name}" (${String(r.created_at).slice(0, 19)})`));
  console.log(`R3 PROVISIONAL sem par (→ DRAFT): ${r3.rows.length}`);
  r3.rows.forEach((r) => console.log(`   - ${r.id} "${r.company_name}"`));

  if (!APPLY) {
    console.log('\nDRY-RUN: nada alterado. Reexecute com --apply para aplicar em transação.');
    await pool.end();
    return;
  }

  // ── Aplicação em TRANSAÇÃO única, contagens antes/depois ───────────────────
  const counts = async () => {
    const r = await pool.query<{ fi: string; co: string; prov_nopair: string }>(
      `SELECT (SELECT count(*) FROM fiscal_identities)::text AS fi,
              (SELECT count(*) FROM companies)::text AS co,
              (SELECT count(*) FROM companies WHERE company_status='PROVISIONAL' AND primary_concept_id IS NULL)::text AS prov_nopair`
    );
    return r.rows[0];
  };
  const before = await counts();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const d1 = await client.query(
      `DELETE FROM fiscal_identities fi
        WHERE fi.kyb_status = 'pending'
          AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.fiscal_identity_id = fi.fiscal_identity_id)
          AND NOT EXISTS (SELECT 1 FROM fiscal_identity_documents d WHERE d.fiscal_identity_id = fi.fiscal_identity_id)
          AND NOT EXISTS (SELECT 1 FROM fiscal_identity_kyb_requests r WHERE r.fiscal_identity_id = fi.fiscal_identity_id)`
    );
    const d2 = await client.query(
      `DELETE FROM companies c
        WHERE c.company_id::text IN (SELECT id FROM (${R2_SELECT}) probe)`
    );
    const d3 = await client.query(
      `UPDATE companies c
          SET company_status = 'DRAFT', updated_at = NOW()
        WHERE c.company_id::text IN (SELECT id FROM (${R3_SELECT}) prov)`
    );
    await client.query('COMMIT');
    console.log(`\nAPLICADO: R1 deletadas=${d1.rowCount} · R2 deletadas=${d2.rowCount} · R3 rebaixadas=${d3.rowCount}`);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* best-effort */ }
    throw e;
  } finally {
    client.release();
  }

  const after = await counts();
  console.log(`fiscal_identities: ${before.fi} → ${after.fi}`);
  console.log(`companies: ${before.co} → ${after.co}`);
  console.log(`PROVISIONAL sem par: ${before.prov_nopair} → ${after.prov_nopair}`);

  // Pós-condição: invariante PROVISIONAL ⇒ par restabelecido
  if (after.prov_nopair !== '0') {
    console.error('⚠ Ainda há PROVISIONAL sem par fora dos predicados (preservadas por segurança — investigar).');
  } else {
    console.log('✅ Invariante "PROVISIONAL ⇒ par" coerente no dev.');
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error('💥', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
