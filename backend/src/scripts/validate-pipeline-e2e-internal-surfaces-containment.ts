/**
 * E2E — F-FINANCIAL-INTERNAL-SURFACES-P1-CONTAINMENT (P1).
 *
 * Prova a CONTENÇÃO fail-closed de duas superfícies internas P1 (READ-FIRST do Core de Aprovação):
 *
 *   R18 — POST /automation/schedule/run-due: executava executeDueActions com `now` da query, sem
 *         gate admin/internal forte (usuário comum autenticado disparava varredura de vencidos com
 *         tempo arbitrário). Agora 403 AUTOMATION_RUN_DUE_HTTP_DISABLED.
 *   R19 — /internal/financial/disputes: controller FORA do protectedScope (sem auth), `tenant_id`
 *         do body/query como autoridade, gravava financial_disputes/_alerts e listava cross-tenant.
 *         Agora 403 FINANCIAL_DISPUTES_HTTP_DISABLED nas 3 rotas (POST/GET/PATCH).
 *
 *   R18:
 *     T1 — usuário comum autenticado POST run-due → 403 AUTOMATION_RUN_DUE_HTTP_DISABLED.
 *     T2 — ?now=2000-01-01 malicioso → ainda 403 (now NÃO controla execução).
 *     T3 — zero alteração em scheduled_actions (service não chamado).
 *     T4 — erro explícito fail-closed (code + message).
 *   R19:
 *     T5 — POST SEM auth + tenant_id no body → 403; zero linha em financial_disputes.
 *     T6 — POST com tenant_id de OUTRO tenant → 403; zero linha em financial_alerts.
 *     T7 — GET ?tenant_id=foreign → 403; NÃO lista cross-tenant.
 *     T8 — PATCH /:id → 403.
 *     T9 — bank_ledger e bank_transactions intocados (count before==after).
 *   + estrutural: handlers reduzidos ao gate; sem executeDueActions / sem create/update/list/alert.
 *
 * 🔒 DB EFÊMERA (wrapper run-internal-surfaces-containment-ephemeral.ps1). Zero Bank; services intactos.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;
const REPO = join(process.cwd(), '..');
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/internal|surface|contain|test|ephemeral/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

// Stub de autoridade: injeta EXATAMENTE o que authPlugin+tenantPlugin produzem para um usuário
// COMUM autenticado do tenant (req.user + req.tenant), SEM papel admin. Decopla a prova da
// contenção do handler da instabilidade do stack de auth/register na DB efêmera. A claim material
// — "usuário autenticado comum do tenant recebe 403 e NÃO executa" — é provada diretamente no
// handler, que é 403 fail-closed independadamente da identidade.
const STUB_TENANT = '00000000-0000-4000-8000-000000000abc';
const STUB_USER = '00000000-0000-4000-8000-000000000def';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  const automationRoutes = (await import('../modules/automation/automation.routes')).default;
  const financialDisputeController = (await import('../modules/disputes/financial-dispute.controller')).default;

  // R19 replica produção: controller registrado em /internal no app CRU (fora do protectedScope, sem auth).
  await app.register(financialDisputeController, { prefix: '/internal' });
  // R18: automation atrás de um stub que simula authPlugin+tenantPlugin (usuário COMUM autenticado).
  await app.register(async (scope) => {
    scope.decorateRequest('user', null);
    scope.decorateRequest('tenant', null);
    scope.addHook('preHandler', async (req) => {
      (req as any).user = { id: STUB_USER, userId: STUB_USER, tenantId: STUB_TENANT };
      (req as any).tenant = { id: STUB_TENANT };
    });
    await scope.register(automationRoutes, { prefix: '/automation' });
  });
  await app.ready();
  return app;
}

const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);
const tableExists = async (t: string): Promise<boolean> =>
  (await count(`SELECT count(*)::text n FROM information_schema.tables WHERE table_name=$1`, [t])) === 1;

async function main(): Promise<void> {
  await assertEphemeralDb();
  delete process.env.PILOT_MODE;
  const app = await buildApp();

  // R18 usa o stub (usuário comum autenticado); R19 não precisa de auth (controller em app cru).
  const auth = { 'content-type': 'application/json' };

  const dispTable = await tableExists('financial_disputes');
  const alertTable = await tableExists('financial_alerts');
  const schedTable = await tableExists('scheduled_actions');
  const ledgerTable = await tableExists('bank_ledger');
  const txTable = await tableExists('bank_transactions');

  const dispBefore = dispTable ? await count(`SELECT count(*)::text n FROM financial_disputes`) : 0;
  const alertBefore = alertTable ? await count(`SELECT count(*)::text n FROM financial_alerts`) : 0;
  const schedBefore = schedTable ? await count(`SELECT count(*)::text n FROM scheduled_actions`) : 0;
  const ledgerBefore = ledgerTable ? await count(`SELECT count(*)::text n FROM bank_ledger`) : 0;
  const txBefore = txTable ? await count(`SELECT count(*)::text n FROM bank_transactions`) : 0;

  try {
    // ── R18 ────────────────────────────────────────────────────────────────────
    const r1 = await app.inject({ method: 'POST', url: '/automation/schedule/run-due', headers: auth, payload: '{}' });
    const b1 = JSON.parse(r1.body);
    record('T1 run-due (usuário comum autenticado) → 403 AUTOMATION_RUN_DUE_HTTP_DISABLED',
      r1.statusCode === 403 && b1.code === 'AUTOMATION_RUN_DUE_HTTP_DISABLED',
      `status=${r1.statusCode} body=${r1.body.slice(0, 140)}`);

    const r2 = await app.inject({ method: 'POST', url: '/automation/schedule/run-due?now=2000-01-01T00:00:00.000Z', headers: auth, payload: '{}' });
    record('T2 ?now malicioso NÃO dispara execução (ainda 403; now não é autoridade)',
      r2.statusCode === 403 && JSON.parse(r2.body).code === 'AUTOMATION_RUN_DUE_HTTP_DISABLED', `status=${r2.statusCode}`);

    const schedAfter = schedTable ? await count(`SELECT count(*)::text n FROM scheduled_actions`) : 0;
    record('T3 zero alteração de estado em scheduled_actions (service não chamado)',
      schedAfter === schedBefore, `sched ${schedBefore}->${schedAfter}`);

    record('T4 erro explícito fail-closed (code + message)',
      b1.code === 'AUTOMATION_RUN_DUE_HTTP_DISABLED' && /disabled/i.test(b1.message || '') && b1.ok === false);

    // ── R19 ────────────────────────────────────────────────────────────────────
    const foreignTenant = randomUUID();
    // T5 — POST SEM auth + tenant_id no body.
    const r5 = await app.inject({
      method: 'POST', url: '/internal/financial/disputes', headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ tenant_id: foreignTenant, reference_id: randomUUID(), dispute_type: 'spoof', amount_cents: 9999 }),
    });
    const b5 = JSON.parse(r5.body);
    const dispAfter5 = dispTable ? await count(`SELECT count(*)::text n FROM financial_disputes`) : 0;
    record('T5 POST sem auth + tenant_id body → 403 FINANCIAL_DISPUTES_HTTP_DISABLED; zero linha em financial_disputes',
      r5.statusCode === 403 && b5.code === 'FINANCIAL_DISPUTES_HTTP_DISABLED' && dispAfter5 === dispBefore,
      `status=${r5.statusCode} disp ${dispBefore}->${dispAfter5}`);

    // T6 — POST com tenant_id de outro tenant → 403; zero financial_alerts.
    const r6 = await app.inject({
      method: 'POST', url: '/internal/financial/disputes', headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ tenant_id: randomUUID(), reference_id: randomUUID(), dispute_type: 'cross', amount_cents: 1 }),
    });
    const alertAfter = alertTable ? await count(`SELECT count(*)::text n FROM financial_alerts`) : 0;
    record('T6 POST tenant_id de outro tenant → 403; zero linha em financial_alerts',
      r6.statusCode === 403 && JSON.parse(r6.body).code === 'FINANCIAL_DISPUTES_HTTP_DISABLED' && alertAfter === alertBefore,
      `status=${r6.statusCode} alert ${alertBefore}->${alertAfter}`);

    // T7 — GET ?tenant_id=foreign → 403; não lista cross-tenant.
    const r7 = await app.inject({ method: 'GET', url: `/internal/financial/disputes?tenant_id=${foreignTenant}`, headers: { 'content-type': 'application/json' } });
    const b7 = JSON.parse(r7.body);
    record('T7 GET ?tenant_id=foreign → 403; NÃO retorna lista cross-tenant',
      r7.statusCode === 403 && b7.code === 'FINANCIAL_DISPUTES_HTTP_DISABLED' && b7.disputes === undefined,
      `status=${r7.statusCode}`);

    // T8 — PATCH → 403.
    const r8 = await app.inject({
      method: 'PATCH', url: `/internal/financial/disputes/${randomUUID()}`, headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ tenant_id: foreignTenant, status: 'resolved' }),
    });
    record('T8 PATCH /:id → 403 FINANCIAL_DISPUTES_HTTP_DISABLED',
      r8.statusCode === 403 && JSON.parse(r8.body).code === 'FINANCIAL_DISPUTES_HTTP_DISABLED', `status=${r8.statusCode}`);

    // T9 — Bank intocado.
    const ledgerAfter = ledgerTable ? await count(`SELECT count(*)::text n FROM bank_ledger`) : 0;
    const txAfter = txTable ? await count(`SELECT count(*)::text n FROM bank_transactions`) : 0;
    record('T9 bank_ledger e bank_transactions intocados (count before==after)',
      ledgerAfter === ledgerBefore && txAfter === txBefore,
      `ledger ${ledgerBefore}->${ledgerAfter} tx ${txBefore}->${txAfter}`);

    // ── Estrutural ──────────────────────────────────────────────────────────────
    const autoRaw = readFileSync(join(REPO, 'backend/src/modules/automation/automation.routes.ts'), 'utf8');
    const autoCode = autoRaw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    record('S1 run-due reduzido ao gate: AUTOMATION_RUN_DUE_HTTP_DISABLED presente e sem executeDueActions( no código',
      /AUTOMATION_RUN_DUE_HTTP_DISABLED/.test(autoCode) && !/executeDueActions\s*\(/.test(autoCode) && !/query\.now\b/.test(autoCode));

    const dispRaw = readFileSync(join(REPO, 'backend/src/modules/disputes/financial-dispute.controller.ts'), 'utf8');
    const dispCode = dispRaw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    record('S2 controller de disputas reduzido: 3× status(403) e sem create/update/list/alert no código',
      (dispCode.match(/status\(403\)/g) || []).length >= 3 &&
      !/createDispute\s*\(|updateDisputeStatus\s*\(|listOpenDisputes\s*\(|createFinancialAlert\s*\(/.test(dispCode) &&
      /FINANCIAL_DISPUTES_HTTP_DISABLED/.test(dispCode));
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Superfícies internas P1 (run-due / financial-disputes) contidas fail-closed; Bank/services intactos — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
