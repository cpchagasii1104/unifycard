/**
 * E2E — DT-ALERTS-SUBSTRATE-MISSING-BREAKS-ARTIGO-II
 *
 * Prova COMPORTAMENTAL, dois modos via argv[2]:
 *   red   — roda ANTES da migration 20260731120000_alerts_substrate.sql ser aplicada.
 *           Dispara um caminho vivo (automationService.processEvent → alertService.createAlert)
 *           e confirma que a falha é 42P01 (relation "alerts" does not exist).
 *   green — roda DEPOIS da migration aplicada.
 *           1) o mesmo caminho vivo grava a linha (prova de escrita real, não só "tabela existe").
 *           2) insere um alerta de CADA um dos 9 valores de alert_type (inclui RISK_SCORE_LOW,
 *              DECISÃO D-E) via alertService.createAlert diretamente — prova que a decisão D-E
 *              foi materializada e que nenhum caller vivo bate em enum inválido.
 *
 * Roda SÓ em DB efêmera (runner run-alerts-substrate-ephemeral.ps1). NUNCA unificard_dev.
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-alerts-substrate.ts red|green
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const PHASE = process.argv[2];
if (PHASE !== 'red' && PHASE !== 'green') {
  console.error('uso: validate-pipeline-e2e-alerts-substrate.ts red|green');
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
  if (!/alerts|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function setTenant(tenantId: string): Promise<void> {
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const tenantId = (
    await pool.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ('Alerts E2E', $1) RETURNING id::text AS id`,
      [`alerts-e2e-${Date.now()}`]
    )
  ).rows[0].id;
  await setTenant(tenantId);

  const { automationService } = await import('../modules/automation/automation.service');
  const { alertService } = await import('../modules/automation/alert.service');

  if (PHASE === 'red') {
    console.log('\n— RED: caminho vivo automationService.processEvent → alertService.createAlert → alert.repository.createAlert (INSERT em `alerts`) SEM a migration —');
    let threw = false;
    let message = '';
    let code = '';
    try {
      await automationService.processEvent(tenantId, {
        eventType: 'PAYMENT_FAILED',
        tenantId,
        entityType: 'payment',
        entityId: randomUUID(),
        context: { errorCode: 'red_proof', eventId: randomUUID(), orderId: randomUUID() },
      });
    } catch (e) {
      threw = true;
      message = e instanceof Error ? e.message : String(e);
      code = (e as { code?: string })?.code ?? '';
      console.log(`  erro capturado: code=${code} message=${message}`);
    }
    record('A processEvent(PAYMENT_FAILED) LANÇA (não engole)', threw, 'não lançou — tabela existia?');
    record('B erro é 42P01 (undefined_table)', code === '42P01', `code=${code} message=${message}`);
  } else {
    console.log('\n— GREEN 1: mesmo caminho vivo agora GRAVA —');
    const entityId = randomUUID();
    const eventId = randomUUID();
    await automationService.processEvent(tenantId, {
      eventType: 'PAYMENT_FAILED',
      tenantId,
      entityType: 'payment',
      entityId,
      context: { errorCode: 'green_proof', eventId, orderId: randomUUID() },
    });
    const written = await pool.query(
      `SELECT id::text, type, severity, status, entity_type, entity_id::text, message FROM alerts WHERE tenant_id = $1::uuid AND entity_id = $2::uuid`,
      [tenantId, entityId]
    );
    record('C linha gravada pelo caminho vivo (automationService → alertService → alerts)', written.rowCount === 1, `rowCount=${written.rowCount}`);
    if (written.rowCount === 1) {
      const r = written.rows[0];
      console.log(`  linha: id=${r.id} type=${r.type} severity=${r.severity} status=${r.status} entity_type=${r.entity_type} entity_id=${r.entity_id} message="${r.message}"`);
    }

    console.log('\n— GREEN 2: os 9 valores de alert_type, um alerta cada, incluindo RISK_SCORE_LOW (DECISÃO D-E) —');
    const NINE: Array<{ type: string; severity: string; entityType: string }> = [
      { type: 'INVENTORY_LOW_STOCK', severity: 'medium', entityType: 'variant' },
      { type: 'INVENTORY_OUT_OF_STOCK', severity: 'high', entityType: 'variant' },
      { type: 'PAYMENT_FAILED', severity: 'high', entityType: 'payment' },
      { type: 'PAYOUT_FAILED', severity: 'high', entityType: 'disbursement' },
      { type: 'FISCAL_PENDING', severity: 'medium', entityType: 'fiscal_document' },
      { type: 'ORDER_EXPIRED', severity: 'low', entityType: 'order' },
      { type: 'RESERVATION_EXPIRED', severity: 'low', entityType: 'reservation' },
      { type: 'OTHER', severity: 'medium', entityType: 'unknown' },
      { type: 'RISK_SCORE_LOW', severity: 'medium', entityType: 'user' },
    ];
    const marker = `nine-proof-${Date.now()}`;
    for (const spec of NINE) {
      const id = randomUUID();
      try {
        await alertService.createAlert(tenantId, {
          type: spec.type as any,
          severity: spec.severity as any,
          message: `prova 9-valores :: ${spec.type} :: ${marker}`,
          entityType: spec.entityType,
          entityId: id,
          metadata: { marker },
        });
      } catch (e) {
        record(`D insert aceito para alert_type=${spec.type}`, false, e instanceof Error ? e.message : String(e));
        continue;
      }
      record(`D insert aceito para alert_type=${spec.type}`, true);
    }

    const nineRows = await pool.query(
      `SELECT type, severity, entity_type FROM alerts WHERE tenant_id = $1::uuid AND metadata->>'marker' = $2 ORDER BY type`,
      [tenantId, marker]
    );
    record('E exatamente 9 linhas gravadas (uma por alert_type)', nineRows.rowCount === 9, `rowCount=${nineRows.rowCount}`);
    console.log('  linhas:');
    for (const r of nineRows.rows) console.log(`    type=${r.type} severity=${r.severity} entity_type=${r.entity_type}`);
    const distinctTypes = new Set(nineRows.rows.map((r) => r.type));
    record('F os 9 tipos são todos distintos (nenhum duplicado/rejeitado)', distinctTypes.size === 9, `distintos=${distinctTypes.size}`);
    record('G RISK_SCORE_LOW está entre as linhas gravadas (DECISÃO D-E materializada)', distinctTypes.has('RISK_SCORE_LOW'));
  }

  console.log('\n════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? `✅ ALERTS-SUBSTRATE[${PHASE}] :: PASS (${results.length}/${results.length})` : `❌ ALERTS-SUBSTRATE[${PHASE}] :: FAIL (${results.length - failed.length}/${results.length})`);
  console.log('════════════════════════════════════════════');
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
