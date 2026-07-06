/**
 * E2E — Lote L5: contenção fail-closed dos módulos FROZEN/FANTASMA (2026-07-06).
 * 🔒 DB-FREE: as rotas contidas retornam 501 ANTES de qualquer service/DB; os arquivos de rota nem importam
 *    service → registro DB-free. NÃO toca unificard_dev. Modo: npx tsx <este arquivo>.
 *
 * Prova (via app.inject HTTP real, mesmo padrão do E2E de automation/human-mvp):
 *   venue: 15 rotas (admin+public, inclui /pay financeira e QR público sem auth) → 501 VENUE_SCHEMA_GHOST_CONTAINED;
 *   work-instant: 12 rotas (instant + worker-status + status) → 501 WORK_INSTANT_SCHEMA_GHOST_CONTAINED;
 *   policy-engine: 11 rotas → 501 POLICY_ENGINE_SCHEMA_GHOST_CONTAINED;
 *   residence: 3 rotas → 501 RESIDENCE_SCHEMA_GHOST_CONTAINED;
 *   spoof (x-test-spoof em actionContext/actor) não altera (continua 501 — binding sobre rota morta é proibido);
 *   guard l5-frozen-modules-ghost-containment verde; typecheck-independente: as tabelas realmente não existem
 *     é provado à parte pelo próprio motivo da contenção (to_regclass=NULL, verificado na auditoria).
 */
import 'tsconfig-paths/register';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const rec = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();

async function main(): Promise<void> {
  const Fastify = (await import('fastify')).default;
  const { venueAdminRoutes, venuePublicRoutes } = await import('../modules/venue/venue.routes');
  const { default: instantRoutes } = await import('../modules/work-instant/instant.routes');
  const { default: workerStatusRoutes } = await import('../modules/work-instant/worker-status.routes');
  const { default: statusRoutes } = await import('../modules/work-instant/status.routes');
  const { default: policyRoutes } = await import('../modules/policy-engine/policy.routes');
  const { default: residenceRoutes } = await import('../core/residence/residence.routes');

  const app = Fastify({ logger: false });
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = { userId: randomUUID(), id: randomUUID(), globalUserId: randomUUID() };
    r.actionContext = { actorId: req.headers['x-test-spoof'] ? String(req.headers['x-test-spoof']) : randomUUID() };
  });
  await app.register(venueAdminRoutes, { prefix: '/venue' });
  await app.register(venuePublicRoutes, { prefix: '/venue' });
  await app.register(instantRoutes, { prefix: '/work/instant' });
  await app.register(workerStatusRoutes, { prefix: '/work/instant' });
  await app.register(statusRoutes, { prefix: '/work/instant' });
  await app.register(policyRoutes, { prefix: '/policy' });
  await app.register(residenceRoutes, { prefix: '/identity/residence' });
  await app.ready();

  const code = (r: { statusCode: number; body: string }): string | null => { try { return JSON.parse(r.body)?.code ?? null; } catch { return null; } };
  const is501 = (r: { statusCode: number; body: string }, expected: string) => r.statusCode === 501 && code(r) === expected;
  const id = randomUUID();
  const j = { 'content-type': 'application/json' };
  const POST = (url: string, hdr: Record<string, string> = j) => app.inject({ method: 'POST', url, headers: hdr, payload: '{}' });
  const PATCH = (url: string) => app.inject({ method: 'PATCH', url, headers: j, payload: '{}' });
  const GET = (url: string) => app.inject({ method: 'GET', url });
  const V = 'VENUE_SCHEMA_GHOST_CONTAINED';
  const W = 'WORK_INSTANT_SCHEMA_GHOST_CONTAINED';
  const P = 'POLICY_ENGINE_SCHEMA_GHOST_CONTAINED';
  const R = 'RESIDENCE_SCHEMA_GHOST_CONTAINED';

  try {
    console.log('\n— venue contido (501, admin + public) —');
    rec('V1 POST /venue/menus → 501', is501(await POST('/venue/menus'), V));
    rec('V2 POST /venue/menus/:id/items → 501', is501(await POST(`/venue/menus/${id}/items`), V));
    rec('V3 PATCH /venue/menus/items/:itemId/availability → 501', is501(await PATCH(`/venue/menus/items/${id}/availability`), V));
    rec('V4 GET /venue/menus/active → 501', is501(await GET('/venue/menus/active'), V));
    rec('V5 POST /venue/tabs/open → 501', is501(await POST('/venue/tabs/open'), V));
    rec('V6 GET /venue/tabs → 501', is501(await GET('/venue/tabs'), V));
    rec('V7 POST /venue/tabs/:id/close → 501', is501(await POST(`/venue/tabs/${id}/close`), V));
    rec('V8 POST /venue/tabs/:id/orders → 501', is501(await POST(`/venue/tabs/${id}/orders`), V));
    rec('V9 GET /venue/v/:slug/menu (público) → 501', is501(await GET('/venue/v/some-slug/menu'), V));
    rec('V10 POST /venue/v/:slug/tabs/open (público) → 501', is501(await POST('/venue/v/some-slug/tabs/open'), V));
    rec('V11 GET /venue/t/:qrToken (público) → 501', is501(await GET('/venue/t/some-token'), V));
    rec('V12 POST /venue/t/:qrToken/orders (público) → 501', is501(await POST('/venue/t/some-token/orders'), V));
    rec('V13 POST /venue/t/:qrToken/orders/:orderId/items → 501', is501(await POST(`/venue/t/some-token/orders/${id}/items`), V));
    rec('V14 POST /venue/t/:qrToken/orders/:orderId/submit → 501', is501(await POST(`/venue/t/some-token/orders/${id}/submit`), V));
    rec('V15 POST /venue/t/:qrToken/orders/:orderId/pay → 501 (dinheiro NÃO alcançado)', is501(await POST(`/venue/t/some-token/orders/${id}/pay`), V));

    console.log('\n— work-instant contido (501) —');
    rec('W1 POST /work/instant/request → 501', is501(await POST('/work/instant/request'), W));
    rec('W2 GET /work/instant/:requestId → 501', is501(await GET(`/work/instant/${id}`), W));
    rec('W3 POST /work/instant/:requestId/accept → 501', is501(await POST(`/work/instant/${id}/accept`), W));
    rec('W4 POST /work/instant/:requestId/cancel → 501', is501(await POST(`/work/instant/${id}/cancel`), W));
    rec('W5 POST /work/instant/online → 501', is501(await POST('/work/instant/online'), W));
    rec('W6 POST /work/instant/offline → 501', is501(await POST('/work/instant/offline'), W));
    rec('W7 POST /work/instant/location → 501', is501(await POST('/work/instant/location'), W));
    rec('W8 GET /work/instant/presence/:userId → 501', is501(await GET(`/work/instant/presence/${id}`), W));
    rec('W9 POST /work/instant/:requestId/en-route → 501', is501(await POST(`/work/instant/${id}/en-route`), W));
    rec('W10 POST /work/instant/:requestId/arrived → 501', is501(await POST(`/work/instant/${id}/arrived`), W));
    rec('W11 POST /work/instant/:requestId/start → 501', is501(await POST(`/work/instant/${id}/start`), W));
    rec('W12 POST /work/instant/:requestId/finish → 501', is501(await POST(`/work/instant/${id}/finish`), W));

    console.log('\n— policy-engine contido (501) —');
    rec('P1 GET /policy/policies → 501', is501(await GET('/policy/policies'), P));
    rec('P2 POST /policy/policies → 501', is501(await POST('/policy/policies'), P));
    rec('P3 GET /policy/policies/:policyId → 501', is501(await GET(`/policy/policies/${id}`), P));
    rec('P4 POST /policy/policies/:policyId/activate → 501', is501(await POST(`/policy/policies/${id}/activate`), P));
    rec('P5 POST /policy/policies/:policyId/deactivate → 501', is501(await POST(`/policy/policies/${id}/deactivate`), P));
    rec('P6 GET /policy/policies/evaluate/:actorId → 501', is501(await GET(`/policy/policies/evaluate/${id}`), P));
    rec('P7 GET /policy/policy-decisions → 501', is501(await GET('/policy/policy-decisions'), P));
    rec('P8 POST /policy/policy-decisions → 501', is501(await POST('/policy/policy-decisions'), P));
    rec('P9 GET /policy/policy-decisions/:decisionId → 501', is501(await GET(`/policy/policy-decisions/${id}`), P));
    rec('P10 POST /policy/policy-decisions/:decisionId/revoke → 501', is501(await POST(`/policy/policy-decisions/${id}/revoke`), P));
    rec('P11 GET /policy/policy-decisions/actor/:actorId/active → 501', is501(await GET(`/policy/policy-decisions/actor/${id}/active`), P));

    console.log('\n— residence contido (501) —');
    rec('R1 GET /identity/residence → 501 (side-effect auto-criação NÃO ocorre)', is501(await GET('/identity/residence'), R));
    rec('R2 POST /identity/residence/set → 501', is501(await POST('/identity/residence/set'), R));
    rec('R3 POST /identity/residence/set-preferences → 501', is501(await POST('/identity/residence/set-preferences'), R));

    console.log('\n— spoof + guard —');
    rec('S1 spoof x-test-spoof no POST /venue/t/../pay → ainda 501', is501(await POST(`/venue/t/some-token/orders/${id}/pay`, { ...j, 'x-test-spoof': randomUUID() }), V));
    rec('S2 spoof x-test-spoof no POST /policy/policies → ainda 501', is501(await POST('/policy/policies', { ...j, 'x-test-spoof': randomUUID() }), P));
    let g = 0; try { execSync('node scripts/audit-l5-frozen-modules-ghost-containment.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
    rec('S3 guard l5-frozen-modules-ghost-containment verde', g === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('💥 erro fatal:', e?.message ?? e); process.exit(1); });
