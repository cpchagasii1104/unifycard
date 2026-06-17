/**
 * E2E DECISION-0113 canal-3 (query) · dashboard/reports actorId gates (6 rotas A)
 *
 * `dashboard:view`/`reports:view_operational` provam acesso ao MÓDULO (ownership do próprio actor), NÃO
 * autoridade sobre o actor filtrado. As 6 rotas A passavam `query.actorId` CRU ao service (filtra orders/
 * payouts/margem/preço de actor alheio). Agora: helper resolveReportActorId → req.user (401); query.actorId
 * representável (canRepresentActor) OU self via actionContext (validado); 403 fail-closed; nunca tenant-wide
 * silencioso. As 6: dashboard/sales · reports/financial · reports/margin/{variants,actors,channels} ·
 * reports/pricing/strategy. Zero Bank; services intocados; rotas C (suggestions/holding-costs/sales/overview…) intactas.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor decide (próprio=true / alheio=false / estranho=false).
 *   B estrutural — cada uma das 6 rotas chama resolveReportActorId ANTES do service e seta actorId =
 *     authorizedActorId (não query.actorId cru); rotas C intactas; sem Bank.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-dashboard-reports-actorid-authority-f6-5.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const MARKER = 'E2E-DR';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }

async function main(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const dev = await pool.query<{ id: string }>(`SELECT id::text AS id FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ id: string }>(`SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`, [TENANT_ID, devUserId]);
  const devActor = devActorRow.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  await pool.query(`DELETE FROM actors WHERE tenant_id=$1 AND display_name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  const O = randomUUID();
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [O, TENANT_ID, `${MARKER}-other`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor (decisão do gate resolveReportActorId) —');
    record('A1 dev representa o PRÓPRIO actor → true (query.actorId próprio / self passam)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o actor O → false (query.actorId=O alheio → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
    note('Régua: query.actorId presente → canRepresentActor(query.actorId); ausente → self via actionContext (validado). Sem tenant-wide silencioso.');
  } finally {
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: 6 rotas A gateadas; helper; rotas C intactas; sem Bank —');
  const dash = readFileSync(join(process.cwd(), 'src/modules/dashboard/dashboard.routes.ts'), 'utf8');
  const rep = readFileSync(join(process.cwd(), 'src/modules/reports/reports.routes.ts'), 'utf8');

  // helper + import nos dois arquivos
  record('B1 helper resolveReportActorId + import authorizationService em ambos os arquivos',
    /async function resolveReportActorId/.test(dash) && /async function resolveReportActorId/.test(rep)
    && /from '@core\/authorization\/authorization\.service'/.test(dash) && /from '@core\/authorization\/authorization\.service'/.test(rep));
  record('B2 helper: query.actorId é hint; canRepresentActor; self via actionContext; 401/403; sem LIMIT 1/admin escape',
    /req\.query\?\.actorId \? String\(req\.query\.actorId\) : String\(req\.actionContext\.actorId\)/.test(rep)
    && /canRepresentActor\(req\.tenant\.id, userId, target\)/.test(rep)
    && /REPORT_ACTOR_NOT_REPRESENTABLE/.test(rep) && !/LIMIT 1/.test(rep));

  const sliceBetween = (s: string, a: string, b: string) => { const i = s.indexOf(a); const j = b ? s.indexOf(b, i + 1) : s.length; return i >= 0 ? s.slice(i, j > i ? j : s.length) : ''; };

  // dashboard/sales
  const dsSales = sliceBetween(dash, "Dashboard de vendas", "Dashboard de estoque");
  record('B3 dashboard/sales: resolveReportActorId ANTES de getSalesDashboard; filters.actorId = authorizedActorId (não query cru)',
    dsSales.indexOf('resolveReportActorId(req, reply)') >= 0
    && dsSales.indexOf('resolveReportActorId(') < dsSales.indexOf('getSalesDashboard(')
    && /filters\.actorId = authorizedActorId/.test(dsSales)
    && !/filters\.actorId = query\.actorId/.test(dsSales));

  // reports/financial + margin×3 + pricing
  const rFin = sliceBetween(rep, "GET /reports/financial", "GET /reports/inventory/aging");
  record('B4 reports/financial: resolveReportActorId ANTES de financialReportService.generateReport; filters.actorId = authorizedActorId',
    rFin.indexOf('resolveReportActorId(req, reply)') >= 0
    && rFin.indexOf('resolveReportActorId(') < rFin.indexOf('financialReportService.generateReport(')
    && /filters\.actorId = authorizedActorId/.test(rFin) && !/filters\.actorId = query\.actorId/.test(rFin));
  const rMv = sliceBetween(rep, "groupBy: 'variant'", "groupBy: 'actor'");
  record('B5 reports/margin/variants: gate antes de getMarginByVariant; options.actorId = authorizedActorId',
    rMv.indexOf('resolveReportActorId(') < rMv.indexOf('getMarginByVariant(') && /options\.actorId = authorizedActorId/.test(rMv) && !/options\.actorId = query\.actorId/.test(rMv));
  const rMa = sliceBetween(rep, "groupBy: 'actor'", "groupBy: 'channel'");
  record('B6 reports/margin/actors: gate antes de getMarginByActor; options.actorId = authorizedActorId',
    rMa.indexOf('resolveReportActorId(') < rMa.indexOf('getMarginByActor(') && /options\.actorId = authorizedActorId/.test(rMa) && !/options\.actorId = query\.actorId/.test(rMa));
  const rMc = sliceBetween(rep, "groupBy: 'channel'", "POST /reports/simulations");
  record('B7 reports/margin/channels: gate antes de getMarginByChannel; options.actorId = authorizedActorId',
    rMc.indexOf('resolveReportActorId(') < rMc.indexOf('getMarginByChannel(') && /options\.actorId = authorizedActorId/.test(rMc) && !/options\.actorId = query\.actorId/.test(rMc));
  const rPr = sliceBetween(rep, "GetPricingStrategyOptions = {", "Erro ao buscar estratégia de preço");
  record('B8 reports/pricing/strategy: gate antes de getPriceStrategy; options.actorId = authorizedActorId',
    rPr.indexOf('resolveReportActorId(') < rPr.indexOf('getPriceStrategy(') && /options\.actorId = authorizedActorId/.test(rPr) && !/options\.actorId = query\.actorId/.test(rPr));
  record('B9 reports: resolveReportActorId chamado exatamente 5x (financial + margin×3 + pricing)',
    (rep.match(/resolveReportActorId\(req, reply\)/g) || []).length === 5);

  // rotas C intactas
  record('B10 C intactas: suggestions + holding-costs ainda com options.actorId = query.actorId CRU (2 ocorrências); NÃO gateadas',
    (rep.match(/options\.actorId = query\.actorId/g) || []).length === 2);
  record('B11 reports/sales override preservado; dashboard overview/today/month/sales gateados via resolveReportActorId (Z2-R2)',
    /actorId: actionContext\.actorId/.test(rep)
    && (dash.match(/resolveReportActorId\(req, reply\)/g) || []).length === 4); // overview/today/month/sales (Z2-R2)

  // sem Bank
  record('B12 sem Bank/ledger nos dois route files',
    !/bank_ledger|bank_transactions|bank_accounts/.test(dash + rep));
  note('Denominador: 6 rotas A gateadas; dashboard overview/today/month gateados via Z2-R2 (query.actorId só com canRepresentActor); C remanescentes (suggestions/holding-costs/inventory/aging/transfers/simulations) intactas; F consolidated preservado; M=nenhuma; G=nenhuma.');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ dashboard/reports: 6 rotas A gateadas (canRepresentActor/self via resolveReportActorId); C intactas — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
