/**
 * E2E — F-SEVERITY-CANONICAL-CONVERGENCE
 *
 * Prova COMPORTAMENTAL, dois modos via argv[2]:
 *   pre  — roda ANTES da migration 20260731130000_severity_priority_canonical_convergence.sql.
 *          Semeia audit_events com valores lowercase (simulando o unificard_dev de hoje) e
 *          confirma que o CHECK antigo aceita 'low'/'medium'/'high'/'critical'.
 *   post — roda DEPOIS da migration aplicada.
 *          1) as linhas semeadas na fase pre foram remapeadas para o vocabulário novo;
 *          2) os 4 CHECKs/ENUM agora REJEITAM valor antigo (lowercase) — prova vermelha real;
 *          3) os 4 aceitam o vocabulário novo — prova verde;
 *          4) alerts.severity (ENUM nativo) trocou de tipo e aceita os 5 valores;
 *          5) createAlert() real — COM severity e SEM severity (caminho do default) — os dois gravam.
 *
 * Roda SÓ em DB efêmera (runner run-severity-priority-convergence-ephemeral.ps1). NUNCA unificard_dev.
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-severity-priority-convergence.ts pre|post
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../core/database/pool';

const TENANT_HANDOFF_FILE = join(process.env.TEMP || process.env.TMP || '.', 'severity_convergence_e2e_tenant.json');

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const PHASE = process.argv[2];
if (PHASE !== 'pre' && PHASE !== 'post') {
  console.error('uso: validate-pipeline-e2e-severity-priority-convergence.ts pre|post');
  process.exit(1);
}

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/severity|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function setTenant(tenantId: string): Promise<void> {
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
}

const MARKER = 'sev-conv-e2e';

async function main(): Promise<void> {
  await assertEphemeralDb();

  let tenantId: string;
  if (PHASE === 'pre') {
    tenantId = (
      await pool.query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ('Severity Convergence E2E', $1) RETURNING id::text AS id`,
        [`sev-conv-e2e-${Date.now()}`]
      )
    ).rows[0].id;
    writeFileSync(TENANT_HANDOFF_FILE, JSON.stringify({ tenantId }));
  } else {
    tenantId = JSON.parse(readFileSync(TENANT_HANDOFF_FILE, 'utf8')).tenantId;
  }
  await setTenant(tenantId);

  if (PHASE === 'pre') {
    console.log('\n— PRE: semeando audit_events com vocabulário ANTIGO (simula unificard_dev hoje) —');
    for (const sev of ['low', 'medium', 'high', 'critical']) {
      await pool.query(
        `INSERT INTO audit_events (tenant_id, event_type, severity, source, context)
         VALUES ($1::uuid, $2, $3, 'validation', $4::jsonb)`,
        [tenantId, `${MARKER}_SEED`, sev, JSON.stringify({ marker: MARKER })]
      );
    }
    const seeded = await pool.query(
      `SELECT severity, count(*)::text n FROM audit_events WHERE tenant_id = $1::uuid AND event_type = $2 GROUP BY severity ORDER BY severity`,
      [tenantId, `${MARKER}_SEED`]
    );
    record('A 4 linhas semeadas com vocabulário antigo (low/medium/high/critical)', seeded.rowCount === 4, JSON.stringify(seeded.rows));
    console.log('  linhas semeadas:', JSON.stringify(seeded.rows));
  } else {
    console.log('\n— POST 1: as linhas semeadas na fase PRE (mesmo tenant, via handoff) foram remapeadas pela migration —');
    const converted = await pool.query<{ severity: string; n: string }>(
      `SELECT severity, count(*)::text n FROM audit_events WHERE tenant_id = $1::uuid AND event_type = $2 GROUP BY severity ORDER BY severity`,
      [tenantId, `${MARKER}_SEED`]
    );
    console.log('  linhas após migration:', JSON.stringify(converted.rows));
    const byValue = Object.fromEntries(converted.rows.map((r) => [r.severity, Number(r.n)]));
    record('4 linhas seguem existindo (nem uma a mais, nem uma a menos)', converted.rows.reduce((s, r) => s + Number(r.n), 0) === 4, JSON.stringify(converted.rows));
    record('low→INFO (1)', byValue.INFO === 1, JSON.stringify(byValue));
    record('medium→WARNING (1)', byValue.WARNING === 1, JSON.stringify(byValue));
    record('high→ERROR (1)', byValue.ERROR === 1, JSON.stringify(byValue));
    record('critical→CRITICAL (1)', byValue.CRITICAL === 1, JSON.stringify(byValue));
    record('nenhum valor antigo (low/medium/high/critical minúsculo) sobrou', !('low' in byValue) && !('medium' in byValue) && !('high' in byValue) && !('critical' in byValue), JSON.stringify(byValue));

    console.log('\n— POST 2: CHECK/ENUM REJEITAM valor antigo (lowercase) — vermelha real —');
    const rejectOld = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        record(label, false, 'não lançou — valor antigo foi aceito?');
      } catch (e) {
        const code = (e as { code?: string })?.code ?? '';
        record(label, code === '23514' || code === '22P02', `code=${code} message=${e instanceof Error ? e.message : String(e)}`);
      }
    };

    await rejectOld('audit_events rejeita severity=low', () =>
      pool.query(`INSERT INTO audit_events (tenant_id, event_type, severity, source, context) VALUES ($1::uuid,$2,'low','validation','{}'::jsonb)`, [tenantId, `${MARKER}_REJECT`])
    );
    await rejectOld('trust_events rejeita severity=HIGH (maiúsculo mas vocabulário errado)', async () => {
      const actor = await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name) VALUES ($1::uuid,'system',$2) RETURNING id::text AS id`, [tenantId, 'sev-e2e-actor']);
      const pack = await pool.query<{ id: string }>(`SELECT gen_random_uuid()::text AS id`);
      await pool.query(
        `INSERT INTO trust_events (event_id, tenant_id, actor_id, event_type, severity, score_impact, context_type, context_id, evidence_pack_id, metadata)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'agreement_respected', 'HIGH', 0, 'event', gen_random_uuid(), $3::uuid, '{}'::jsonb)`,
        [tenantId, actor.rows[0].id, pack.rows[0].id]
      );
    });
    // financial_alerts: prova por DEFINIÇÃO da constraint (não por INSERT direto na tabela alheia
    // ao Bank a partir de um script novo — audit-red-gates-baseline/financial-ssot marcariam
    // "repository/persistência financeira fora de src/core/bank" mesmo sendo só leitura de teste;
    // as outras 3 tabelas já provam REJEIÇÃO por INSERT real acima).
    const finAlertsCheck = await pool.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'chk_financial_alerts_severity'`
    );
    const def = finAlertsCheck.rows[0]?.def ?? '';
    record(
      'financial_alerts ganhou CHECK com vocabulário novo (rejeita minúsculo/antigo por definição)',
      /'CRITICAL'/.test(def) && /'INFO'/.test(def) && !/'warning'/.test(def) && !/'critical'/.test(def),
      def
    );
    await rejectOld('alerts rejeita severity=medium (enum antigo não existe mais)', () =>
      pool.query(`INSERT INTO alerts (tenant_id, type, severity, message) VALUES ($1::uuid,'other','medium','x')`, [tenantId])
    );

    console.log('\n— POST 3: CHECK/ENUM ACEITAM vocabulário novo — verde —');
    await pool.query(
      `INSERT INTO audit_events (tenant_id, event_type, severity, source, context) VALUES ($1::uuid,$2,'INFO','validation','{}'::jsonb)`,
      [tenantId, `${MARKER}_ACCEPT`]
    );
    const accepted = await pool.query(`SELECT severity FROM audit_events WHERE tenant_id = $1::uuid AND event_type = $2`, [tenantId, `${MARKER}_ACCEPT`]);
    record('audit_events aceita severity=INFO', accepted.rowCount === 1 && accepted.rows[0].severity === 'INFO');

    console.log('\n— POST 4: alerts.severity — 5 valores do vocabulário §4.34 —');
    for (const sev of ['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'AUDIT']) {
      await pool.query(
        `INSERT INTO alerts (tenant_id, type, severity, message, metadata) VALUES ($1::uuid,'other',$2,'x',$3::jsonb)`,
        [tenantId, sev, JSON.stringify({ marker: MARKER })]
      );
    }
    const fiveRows = await pool.query(
      `SELECT severity FROM alerts WHERE tenant_id = $1::uuid AND metadata->>'marker' = $2 ORDER BY severity`,
      [tenantId, MARKER]
    );
    record('alerts aceita os 5 valores de severity (CRITICAL/ERROR/WARNING/INFO/AUDIT)', fiveRows.rowCount === 5, JSON.stringify(fiveRows.rows));
    console.log('  linhas:', JSON.stringify(fiveRows.rows));

    console.log('\n— POST 5: E2E real — createAlert() COM severity e SEM severity (caminho default) —');
    const { alertService } = await import('../modules/automation/alert.service');
    const idWith = randomUUID();
    await alertService.createAlert(tenantId, {
      type: 'other',
      severity: 'ERROR',
      message: 'e2e com severity explícita',
      entityId: idWith,
      metadata: { marker: MARKER },
    });
    const withRow = await pool.query(`SELECT severity FROM alerts WHERE tenant_id = $1::uuid AND entity_id = $2::uuid`, [tenantId, idWith]);
    record('createAlert COM severity grava ERROR', withRow.rowCount === 1 && withRow.rows[0].severity === 'ERROR', JSON.stringify(withRow.rows));

    const idDefault = randomUUID();
    await alertService.createAlert(tenantId, {
      type: 'other',
      message: 'e2e SEM severity (default do repository)',
      entityId: idDefault,
      metadata: { marker: MARKER },
    } as any);
    const defaultRow = await pool.query(`SELECT severity FROM alerts WHERE tenant_id = $1::uuid AND entity_id = $2::uuid`, [tenantId, idDefault]);
    record('createAlert SEM severity usa default WARNING (grava, não lança)', defaultRow.rowCount === 1 && defaultRow.rows[0].severity === 'WARNING', JSON.stringify(defaultRow.rows));
  }

  console.log('\n════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? `✅ SEVERITY-CONVERGENCE[${PHASE}] :: PASS (${results.length}/${results.length})` : `❌ SEVERITY-CONVERGENCE[${PHASE}] :: FAIL (${results.length - failed.length}/${results.length})`);
  console.log('════════════════════════════════════════════');
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
