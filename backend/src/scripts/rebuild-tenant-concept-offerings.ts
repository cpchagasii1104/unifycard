/**
 * rebuild-tenant-concept-offerings.ts — reconciliação idempotente do read-model de discovery
 * (DECISION-0099/0100 D10/D11; resíduo DT-PJ-TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD).
 *
 * Regra SOBERANA (única): tenant oferece concept SSE existe ≥1 publicação `active` em
 *   company_concept_publications para aquele (tenant_id, concept_id).
 * tenant_concept_offerings é READ-MODEL derivado — NÃO SSOT. Este script NÃO muda a verdade;
 * apenas reconcilia o read-model com o SSOT.
 *
 * Garantias:
 *   - dry-run por PADRÃO; `--apply` é obrigatório para escrever; sem `--apply` nenhum DML.
 *   - exige EXPECTED_DATABASE_NAME == current_database() (recusa alvo implícito).
 *   - apply roda em TRANSAÇÃO ÚNICA; rollback em erro.
 *   - NUNCA deleta linha; NUNCA cria linha inactive nova; só UPSERT(active) + UPDATE(is_active).
 *   - deriva EXCLUSIVAMENTE de ccp.status='active' — SEM join a fiscal_identities/kyb_status.
 *     (Reação a KYB-revocation é frente própria: DT-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-PROJECTION.)
 *   - idempotente: 2ª execução apply muda 0.
 *
 * Uso: EXPECTED_DATABASE_NAME=<db> npx tsx src/scripts/rebuild-tenant-concept-offerings.ts [--apply]
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

export type RebuildSampleRow = { tenantId: string; conceptId: string; current: string; target: string };
export type RebuildReport = {
  applied: boolean;
  // dry-run / pré-apply (contagens read-only)
  toCreate: number;       // ccp active sem linha tco
  toReactivate: number;   // tco inactive com ccp active
  toDeactivate: number;   // tco active sem ccp active (legado/stale)
  alreadyActive: number;  // tco active com ccp active
  inactiveStays: number;  // tco inactive sem ccp active (não tocada)
  sample: RebuildSampleRow[];
  // apply (rowCounts efetivos)
  created: number;
  reactivated: number;
  deactivated: number;
};

const Q_TO_CREATE = `
  SELECT count(*)::int AS n FROM (
    SELECT DISTINCT p.tenant_id, p.concept_id
      FROM company_concept_publications p
     WHERE p.status='active'
       AND NOT EXISTS (SELECT 1 FROM tenant_concept_offerings t
                        WHERE t.tenant_id=p.tenant_id AND t.concept_id=p.concept_id)
  ) s`;
const Q_TO_REACTIVATE = `
  SELECT count(*)::int AS n FROM tenant_concept_offerings t
   WHERE NOT t.is_active
     AND EXISTS (SELECT 1 FROM company_concept_publications p
                  WHERE p.tenant_id=t.tenant_id AND p.concept_id=t.concept_id AND p.status='active')`;
const Q_TO_DEACTIVATE = `
  SELECT count(*)::int AS n FROM tenant_concept_offerings t
   WHERE t.is_active
     AND NOT EXISTS (SELECT 1 FROM company_concept_publications p
                      WHERE p.tenant_id=t.tenant_id AND p.concept_id=t.concept_id AND p.status='active')`;
const Q_ALREADY_ACTIVE = `
  SELECT count(*)::int AS n FROM tenant_concept_offerings t
   WHERE t.is_active
     AND EXISTS (SELECT 1 FROM company_concept_publications p
                  WHERE p.tenant_id=t.tenant_id AND p.concept_id=t.concept_id AND p.status='active')`;
const Q_INACTIVE_STAYS = `
  SELECT count(*)::int AS n FROM tenant_concept_offerings t
   WHERE NOT t.is_active
     AND NOT EXISTS (SELECT 1 FROM company_concept_publications p
                      WHERE p.tenant_id=t.tenant_id AND p.concept_id=t.concept_id AND p.status='active')`;
const Q_SAMPLE = `
  (SELECT p.tenant_id::text AS tid, p.concept_id::text AS cid, 'absent' AS cur, 'active' AS tgt
     FROM (SELECT DISTINCT tenant_id, concept_id FROM company_concept_publications WHERE status='active') p
    WHERE NOT EXISTS (SELECT 1 FROM tenant_concept_offerings t WHERE t.tenant_id=p.tenant_id AND t.concept_id=p.concept_id))
  UNION ALL
  (SELECT t.tenant_id::text, t.concept_id::text, 'inactive', 'active'
     FROM tenant_concept_offerings t
    WHERE NOT t.is_active AND EXISTS (SELECT 1 FROM company_concept_publications p WHERE p.tenant_id=t.tenant_id AND p.concept_id=t.concept_id AND p.status='active'))
  UNION ALL
  (SELECT t.tenant_id::text, t.concept_id::text, 'active', 'inactive'
     FROM tenant_concept_offerings t
    WHERE t.is_active AND NOT EXISTS (SELECT 1 FROM company_concept_publications p WHERE p.tenant_id=t.tenant_id AND p.concept_id=t.concept_id AND p.status='active'))
  LIMIT 10`;

async function countOne(sql: string): Promise<number> {
  return Number((await pool.query<{ n: number }>(sql)).rows[0].n);
}

/**
 * Reconcilia tenant_concept_offerings a partir de company_concept_publications.
 * @param opts.apply false (default) = dry-run (zero DML); true = aplica em transação única.
 */
export async function rebuildTenantConceptOfferings(opts: { apply: boolean }): Promise<RebuildReport> {
  const [toCreate, toReactivate, toDeactivate, alreadyActive, inactiveStays] = await Promise.all([
    countOne(Q_TO_CREATE), countOne(Q_TO_REACTIVATE), countOne(Q_TO_DEACTIVATE),
    countOne(Q_ALREADY_ACTIVE), countOne(Q_INACTIVE_STAYS),
  ]);
  const sample = (await pool.query<{ tid: string; cid: string; cur: string; tgt: string }>(Q_SAMPLE)).rows
    .map((r) => ({ tenantId: r.tid, conceptId: r.cid, current: r.cur, target: r.tgt }));

  const report: RebuildReport = {
    applied: false, toCreate, toReactivate, toDeactivate, alreadyActive, inactiveStays, sample,
    created: 0, reactivated: 0, deactivated: 0,
  };

  if (!opts.apply) return report;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1) Cria os pares soberanos ausentes (sempre is_active=true; NUNCA cria inactive).
    const ins = await client.query(`
      INSERT INTO tenant_concept_offerings (tenant_id, concept_id, is_active)
      SELECT DISTINCT p.tenant_id, p.concept_id, true
        FROM company_concept_publications p
       WHERE p.status='active'
         AND NOT EXISTS (SELECT 1 FROM tenant_concept_offerings t
                          WHERE t.tenant_id=p.tenant_id AND t.concept_id=p.concept_id)`);
    // 2) Reativa tco inactive com lastro soberano.
    const react = await client.query(`
      UPDATE tenant_concept_offerings t SET is_active=true, updated_at=now()
       WHERE NOT t.is_active
         AND EXISTS (SELECT 1 FROM company_concept_publications p
                      WHERE p.tenant_id=t.tenant_id AND p.concept_id=t.concept_id AND p.status='active')`);
    // 3) Desativa tco active sem lastro soberano (legado/stale). NÃO deleta.
    const deact = await client.query(`
      UPDATE tenant_concept_offerings t SET is_active=false, updated_at=now()
       WHERE t.is_active
         AND NOT EXISTS (SELECT 1 FROM company_concept_publications p
                          WHERE p.tenant_id=t.tenant_id AND p.concept_id=t.concept_id AND p.status='active')`);
    await client.query('COMMIT');
    report.applied = true;
    report.created = ins.rowCount ?? 0;
    report.reactivated = react.rowCount ?? 0;
    report.deactivated = deact.rowCount ?? 0;
    return report;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* best-effort */ }
    throw err;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const EXPECTED = process.env.EXPECTED_DATABASE_NAME;
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0].db;

  if (!EXPECTED) {
    console.error('❌ ABORT: EXPECTED_DATABASE_NAME não definido — recuse-se a reconciliar sem alvo explícito.');
    await pool.end();
    process.exit(2);
  }
  if (db !== EXPECTED) {
    console.error(`❌ ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
    await pool.end();
    process.exit(2);
  }

  console.log(`🎯 Banco-alvo: ${db}`);
  console.log(`📋 Modo: ${apply ? 'APPLY (escreve)' : 'DRY-RUN (somente leitura)'}`);
  console.log('🧭 Regra: tenant oferece concept SSE ≥1 publicação active em company_concept_publications (NÃO filtra KYB).');

  const r = await rebuildTenantConceptOfferings({ apply });
  console.log('\n── Divergências (read-model vs SSOT) ──');
  console.log(`  a criar (ccp active sem tco) ........ ${r.toCreate}`);
  console.log(`  a reativar (tco inactive + ccp) ..... ${r.toReactivate}`);
  console.log(`  a desativar (tco active sem ccp) .... ${r.toDeactivate}`);
  console.log(`  já corretas (tco active + ccp) ...... ${r.alreadyActive}`);
  console.log(`  inactive sem ccp (mantidas) ......... ${r.inactiveStays}`);
  if (r.sample.length > 0) {
    console.log('  amostra de divergências:');
    r.sample.forEach((s) => console.log(`    tenant=${s.tenantId} concept=${s.conceptId} ${s.current} → ${s.target}`));
  }
  if (apply) {
    console.log('\n── Aplicado (transação única) ──');
    console.log(`  criadas active ...... ${r.created}`);
    console.log(`  reativadas .......... ${r.reactivated}`);
    console.log(`  desativadas ......... ${r.deactivated}`);
  } else {
    console.log('\n💡 DRY-RUN — nenhuma escrita. Rode com --apply para reconciliar.');
  }
  await pool.end();
}

// Só executa main() quando invocado como script (não quando importado pelo e2e).
const invokedDirectly = process.argv[1] && /rebuild-tenant-concept-offerings\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  main().catch(async (e) => {
    console.error('💥 Erro não tratado:', e);
    try { await pool.end(); } catch { /* noop */ }
    process.exit(1);
  });
}
