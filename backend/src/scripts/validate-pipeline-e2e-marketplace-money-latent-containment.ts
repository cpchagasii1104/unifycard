/**
 * E2E — F-AUTHORITY-Z2-R4-MONEY-LATENT-CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2).
 *
 * Prova que as 6 rotas money-latent A1–A6 (settlement/regionAccount/unifycard) estão CONTIDAS
 * explicitamente (403 fail-closed no edge), NÃO chamam o service, NÃO movem dinheiro, e o erro é a
 * contenção (não o erro cru do Proxy "migrated to Bank").
 *
 * (A) ESTRUTURAL (data-flow dos route files):
 *     A1 settlement.routes contém os codes SETTLEMENT_/REGION_ACCOUNT_HTTP_EXECUTION_DISABLED.
 *     A2 unifycard.routes contém UNIFYCARD_HTTP_EXECUTION_DISABLED.
 *     A3 nenhum sink de mutação alcançável (settlementService.settle / regionAccountService.credit|debit
 *        / unifyCardService.authorize|capture|settle) nem bank_ledger/transactions/splits nas rotas.
 * (C) RUNTIME-HTTP (inject nos handlers reais):
 *     C1..C6 POST A1–A6 → 403 com o code de contenção esperado e ok:false.
 *     C7 o body NÃO é o erro cru do Proxy ("migrated to Bank") nem INTERNAL_ERROR → o service NÃO foi atingido.
 *     C8 bank_ledger/bank_transactions/bank_splits (+ tabelas money-adjacent) inalterados antes/depois.
 * (D) NÃO-REGRESSÃO R1/R2/R3/R5:
 *     D1 intent-execute (R5) mantém canRepresentActor(tenantId, authUserId, buyerActorId).
 *     D2 groups (R1) · D3 reports (R3) · D4 dashboard (R2).
 *
 * 🔒 DB EFÊMERA (run-marketplace-money-latent-containment-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
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
  if (!/marketplace|money|latent|containment|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function tableCount(table: string): Promise<number> {
  const reg = (await pool.query<{ t: string | null }>(`SELECT to_regclass($1) AS t`, [table])).rows[0].t;
  if (!reg) return -1; // tabela ausente (ex.: migrada para Bank)
  const r = await pool.query<{ c: number }>(`SELECT count(*)::int AS c FROM ${table}`);
  return r.rows[0].c;
}

const MONEY_TABLES = ['bank_ledger', 'bank_transactions', 'bank_splits', 'settlements', 'region_accounts', 'unifycard_transactions'];
async function snapshot(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of MONEY_TABLES) out[t] = await tableCount(t);
  return out;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // ── (A) Estrutural ──────────────────────────────────────────────────────────────────────
  const sr = readFileSync(join(process.cwd(), 'src/modules/marketplace/settlement.routes.ts'), 'utf8');
  const ur = readFileSync(join(process.cwd(), 'src/modules/marketplace/unifycard.routes.ts'), 'utf8');
  record('A1 settlement.routes contém SETTLEMENT_ e REGION_ACCOUNT_HTTP_EXECUTION_DISABLED',
    /SETTLEMENT_HTTP_EXECUTION_DISABLED/.test(sr) && /REGION_ACCOUNT_HTTP_EXECUTION_DISABLED/.test(sr));
  record('A2 unifycard.routes contém UNIFYCARD_HTTP_EXECUTION_DISABLED', /UNIFYCARD_HTTP_EXECUTION_DISABLED/.test(ur));
  // Tira comentários para checar que o SINK não é chamado em código.
  const strip = (s: string): string => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
  const srC = strip(sr), urC = strip(ur);
  const sinkReachable =
    /settlementService\.settle\s*\(/.test(srC) || /regionAccountService\.(credit|debit)\s*\(/.test(srC) ||
    /unifyCardService\.(authorize|capture|settle)\s*\(/.test(urC) ||
    /bank_ledger|bank_transactions|bank_splits/.test(srC) || /bank_ledger|bank_transactions|bank_splits/.test(urC);
  record('A3 nenhum sink de mutação nem bank_* alcançável pelas rotas', !sinkReachable);

  // ── (C) Runtime-HTTP ─────────────────────────────────────────────────────────────────────
  const Fastify = (await import('fastify')).default;
  const { default: settlementRoutes } = await import('../modules/marketplace/settlement.routes');
  const { default: unifyCardRoutes } = await import('../modules/marketplace/unifycard.routes');
  const app = Fastify();
  app.addHook('preHandler', async (req) => {
    // Simula protectedScope (auth/tenant/action-context). actionContext.actorId = HINT client-declared.
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = { userId: randomUUID(), id: r.user?.userId, tenantId: r.tenant.id };
    r.actionContext = { actorId: randomUUID() }; // spoof: deve ser IGNORADO (rota contida)
  });
  await app.register(settlementRoutes, { prefix: '/marketplace' });
  await app.register(unifyCardRoutes, { prefix: '/marketplace' });
  await app.ready();

  const cases = [
    { label: 'C1 A1 POST /marketplace/settlements/:id/settle', url: `/marketplace/settlements/${randomUUID()}/settle`, code: 'SETTLEMENT_HTTP_EXECUTION_DISABLED' },
    { label: 'C2 A2 POST /marketplace/regions/:id/account/credit', url: `/marketplace/regions/${randomUUID()}/account/credit`, code: 'REGION_ACCOUNT_HTTP_EXECUTION_DISABLED' },
    { label: 'C3 A3 POST /marketplace/regions/:id/account/debit', url: `/marketplace/regions/${randomUUID()}/account/debit`, code: 'REGION_ACCOUNT_HTTP_EXECUTION_DISABLED' },
    { label: 'C4 A4 POST /marketplace/unifycard/authorize', url: '/marketplace/unifycard/authorize', code: 'UNIFYCARD_HTTP_EXECUTION_DISABLED' },
    { label: 'C5 A5 POST /marketplace/unifycard/capture', url: '/marketplace/unifycard/capture', code: 'UNIFYCARD_HTTP_EXECUTION_DISABLED' },
    { label: 'C6 A6 POST /marketplace/unifycard/settle', url: '/marketplace/unifycard/settle', code: 'UNIFYCARD_HTTP_EXECUTION_DISABLED' },
  ];

  const before = await snapshot();
  let allProxyClean = true;
  for (const c of cases) {
    const r = await app.inject({ method: 'POST', url: c.url, headers: { 'content-type': 'application/json' }, payload: { amountCents: 100, currency: 'BRL' } });
    let body: any = {};
    try { body = r.json(); } catch { body = {}; }
    record(`${c.label} → 403 ${c.code}`, r.statusCode === 403 && body.code === c.code && body.ok === false, `status=${r.statusCode} code=${body.code}`);
    // C7: o erro NÃO é o Proxy cru nem INTERNAL_ERROR → service não atingido.
    const proxyLeak = body.code === 'INTERNAL_ERROR' || (typeof body.message === 'string' && /migrated to Bank/i.test(body.message));
    if (proxyLeak) allProxyClean = false;
  }
  record('C7 nenhum body é Proxy cru ("migrated to Bank") nem INTERNAL_ERROR → service NÃO atingido', allProxyClean);
  const after = await snapshot();
  const changed = MONEY_TABLES.filter((t) => before[t] >= 0 && after[t] !== before[t]);
  record('C8 bank_ledger/bank_transactions/bank_splits (+ money-adjacent) inalterados', changed.length === 0,
    `mudaram: ${changed.join(',')} (${MONEY_TABLES.map((t) => `${t}:${before[t]}→${after[t]}`).join(' ')})`);

  await app.close();

  // ── (D) Não-regressão R1/R2/R3/R5 ─────────────────────────────────────────────────────────
  const intentSrc = readFileSync(join(process.cwd(), 'src/core/intent/intent-execute.routes.ts'), 'utf8');
  record('D1 intent-execute (R5) mantém canRepresentActor(tenantId, authUserId, buyerActorId)',
    /canRepresentActor\(\s*tenantId\s*,\s*authUserId\s*,\s*buyerActorId\s*\)/.test(intentSrc));
  const groupsSrc = readFileSync(join(process.cwd(), 'src/modules/groups/groups.routes.ts'), 'utf8');
  record('D2 groups (R1) mantém canRepresentActor(tenantId, userIdForCheck, group.ownerActorId)',
    /canRepresentActor\(\s*tenantId\s*,\s*userIdForCheck\s*,\s*group\.ownerActorId\s*\)/.test(groupsSrc));
  const reportsSrc = readFileSync(join(process.cwd(), 'src/modules/reports/reports.routes.ts'), 'utf8');
  record('D3 reports (R3) mantém resolveReportActorId (≥8)', (reportsSrc.match(/resolveReportActorId\(req, reply\)/g) || []).length >= 8);
  const dashboardSrc = readFileSync(join(process.cwd(), 'src/modules/dashboard/dashboard.routes.ts'), 'utf8');
  record('D4 dashboard (R2) mantém resolveReportActorId', /resolveReportActorId\(req, reply\)/.test(dashboardSrc));

  console.log('\n════════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed !== total) {
    console.log('❌ FALHAS:');
    for (const r of results.filter((x) => !x.ok)) console.log(`   - ${r.label}: ${r.reason}`);
    process.exitCode = 1;
  } else {
    console.log('✨ marketplace money-latent A1–A6: contidas (403 fail-closed); service não atingido; Bank/money inalterados; R1/R2/R3/R5 intactos.');
  }
}

main()
  .catch((e) => { console.error('💥', e); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
