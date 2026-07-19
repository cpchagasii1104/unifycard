// validate-yala-final-availability.ts — PROVA Etapa C (DECISION-0189B — C2 / D6–D7)
//
// Roda contra CLONE EFÊMERO (faz DDL destrutivo SOMENTE no clone — nunca no dev).
//   C1  economic-overview com dependências presentes + membro com view_financial → 200 no-store.
//   C2  substrato ausente (rename de bank_splits no clone) → 503 estável ECONOMIC_OVERVIEW_UNAVAILABLE,
//       corpo SEM nome de tabela / SQLSTATE / error.message. (restaura)
//   C3  falha de audit (rename de financial_audit_trail) → 503 sanitizado e SEM payload financeiro
//       (nenhuma chave `data`). (restaura)
//   C4  invoices: porta de ativação FECHADA → 503 INVOICES_NOT_ACTIVATED mesmo com schema — não
//       consulta substrato; INVOICES_ACTIVATED === false.
//   C5  invoice-activation NÃO deriva de existência de schema (constante literal).

import { pool } from '@core/database/pool';
import Fastify from 'fastify';
import economicOverviewRoutes from '../modules/economy/economic-overview.routes';
import invoiceRoutes from '../modules/invoicing/invoice.routes';
import { INVOICES_ACTIVATED } from '../modules/invoicing/invoice-activation';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const FLAGS = ['can_manage_company','can_manage_members','can_manage_financial','can_view_financial','can_publish_feed','can_create_events','can_manage_employees','can_manage_services','can_view_reports'];
async function setMember(cuId: string, patch: Record<string, boolean>) {
  const reset = FLAGS.map((f) => `${f} = false`).join(', ');
  await pool.query(`UPDATE company_users SET ${reset}, member_status='active' WHERE id=$1`, [cuId]);
  const keys = Object.keys(patch);
  if (keys.length) await pool.query(`UPDATE company_users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id=$1`, [cuId, ...keys.map((k) => patch[k])]);
}

const leaks = (body: unknown, needles: string[]) => {
  const s = JSON.stringify(body ?? {});
  return needles.some((n) => s.includes(n));
};

async function buildApp(tenantId: string, userId: string, prefix: string, routes: unknown) {
  const app = Fastify();
  app.addHook('onRequest', async (req) => {
    (req as { user?: unknown }).user = { id: userId, userId };
    (req as { tenant?: unknown }).tenant = { id: tenantId };
  });
  await app.register(routes as never, { prefix });
  await app.ready();
  return app;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/closeout|ephemeral|clone|upgrade|final/i.test(dbUrl)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()})`);
    process.exit(1);
  }
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const a = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(a.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(a.actorUtilsAdapter);

  const fx = (await pool.query(`
    SELECT cu.id AS cu_id, cu.tenant_id, cu.company_id, u.user_id, pa.id AS page_actor_id
      FROM company_users cu
      JOIN users u  ON u.global_user_id = cu.global_user_id AND u.tenant_id = cu.tenant_id
      JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`)).rows[0] as { cu_id: string; tenant_id: string; company_id: string; user_id: string; page_actor_id: string };
  const T = fx.tenant_id;

  await setMember(fx.cu_id, { can_view_financial: true });
  const overviewApp = await buildApp(T, fx.user_id, '/economy', economicOverviewRoutes);

  // C1 — dependências presentes → 200 no-store
  const okRes = await overviewApp.inject({ method: 'GET', url: `/economy/actors/${fx.page_actor_id}/overview` });
  check('C1 overview com deps presentes + view_financial → 200',
    okRes.statusCode === 200, `${okRes.statusCode} ${okRes.body.slice(0, 120)}`);
  check('C1 overview 200 traz Cache-Control: no-store', (okRes.headers['cache-control'] ?? '') === 'no-store');

  // C2 — substrato ausente → 503 sanitizado (rename no clone, restaura depois)
  await pool.query('ALTER TABLE bank_splits RENAME TO bank_splits__hidden');
  try {
    const unavailRes = await overviewApp.inject({ method: 'GET', url: `/economy/actors/${fx.page_actor_id}/overview` });
    const body = unavailRes.json();
    check('C2 substrato ausente → 503 ECONOMIC_OVERVIEW_UNAVAILABLE estável',
      unavailRes.statusCode === 503 && (body as { code?: string }).code === 'ECONOMIC_OVERVIEW_UNAVAILABLE', `${unavailRes.statusCode} ${JSON.stringify(body)}`);
    check('C2 corpo NÃO vaza nome de tabela / SQLSTATE / message',
      !leaks(body, ['bank_splits', 'relation', 'does not exist', 'não existe', 'SQLSTATE', 'message', '42P01']), JSON.stringify(body));
  } finally {
    await pool.query('ALTER TABLE bank_splits__hidden RENAME TO bank_splits');
  }

  // C3 — falha de audit → 503 sanitizado, SEM payload financeiro
  await pool.query('ALTER TABLE financial_audit_trail RENAME TO financial_audit_trail__hidden');
  try {
    const auditFailRes = await overviewApp.inject({ method: 'GET', url: `/economy/actors/${fx.page_actor_id}/overview` });
    const body = auditFailRes.json();
    check('C3 falha de audit → 503 sanitizado', auditFailRes.statusCode === 503 && (body as { code?: string }).code === 'ECONOMIC_OVERVIEW_UNAVAILABLE', `${auditFailRes.statusCode} ${JSON.stringify(body)}`);
    check('C3 falha de audit NÃO devolve payload financeiro (sem chave data)', !('data' in (body as object)) && !leaks(body, ['totalReceived', 'totalPaid', 'amountCents']));
  } finally {
    await pool.query('ALTER TABLE financial_audit_trail__hidden RENAME TO financial_audit_trail');
  }
  await overviewApp.close();

  // C4 — invoices porta fechada → 503 INVOICES_NOT_ACTIVATED
  const invoiceApp = await buildApp(T, fx.user_id, '/invoicing', invoiceRoutes);
  const invRes = await invoiceApp.inject({ method: 'GET', url: `/invoicing/invoices?actorId=${fx.page_actor_id}` });
  const invById = await invoiceApp.inject({ method: 'GET', url: `/invoicing/invoices/00000000-0000-0000-0000-000000000000` });
  await invoiceApp.close();
  check('C4 GET /invoices (com filtro) → 503 INVOICES_NOT_ACTIVATED (porta fechada, não consulta substrato)',
    invRes.statusCode === 503 && (invRes.json() as { code?: string }).code === 'INVOICES_NOT_ACTIVATED', `${invRes.statusCode} ${invRes.body.slice(0, 120)}`);
  check('C4 GET /invoices/:id → 503 INVOICES_NOT_ACTIVATED',
    invById.statusCode === 503 && (invById.json() as { code?: string }).code === 'INVOICES_NOT_ACTIVATED', `${invById.statusCode}`);
  check('C5 INVOICES_ACTIVATED é literal false (não derivado de schema)', INVOICES_ACTIVATED === false);

  console.log(`\n──────── RESULTADO: ${passed} passaram, ${failed} falharam ────────`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
