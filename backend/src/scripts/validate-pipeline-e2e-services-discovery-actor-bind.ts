/**
 * E2E — F-AUTHORITY-Z2-R8P (services-discovery non-money authority bind).
 * 🔒 DB-FREE: o fail-closed (sem req.user → 401) ocorre ANTES de canRepresentActor/service/DB; /request/pay retired
 *    e firewall retornam antes de service. NÃO toca unificard_dev. Modo: npx tsx <este arquivo>.
 *
 * Prova (bind fail-closed — actionContext.actorId NÃO autoriza sozinho):
 *   A-F as 6 rotas actor-scoped SEM req.user (só actionContext spoofado) → 401 SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED
 *   G /request/pay → 403 SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110 (R8J preservado, firewall OFF)
 *   H guard services-discovery-actor-bind verde · I guard direct-pay-containment (R8J) verde · J baseline verde
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
  const { default: routes } = await import('../modules/services/services-discovery.routes');
  const app = Fastify({ logger: false });
  // tenant + actionContext spoofado, SEM req.user → o bind deve fechar (actionContext não autoriza).
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = undefined;
    r.actionContext = { actorId: randomUUID() };
  });
  await app.register(routes);
  await app.ready();

  const code = (r: { body: string }): string | null => { try { const b = JSON.parse(r.body); return b?.error ?? b?.code ?? null; } catch { return null; } };
  const id = randomUUID();
  const j = { 'content-type': 'application/json' };
  const POST = (url: string, payload: unknown = {}) => app.inject({ method: 'POST', url, headers: j, payload: JSON.stringify(payload) });
  const GET = (url: string) => app.inject({ method: 'GET', url });
  const isAuth401 = (r: { statusCode: number; body: string }) => r.statusCode === 401 && code(r) === 'SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED';

  try {
    console.log('\n— bind fail-closed (actionContext NÃO autoriza sem req.user) —');
    rec('A POST /offers sem req.user → 401', isAuth401(await POST('/offers')));
    rec('B POST /request sem req.user → 401', isAuth401(await POST('/request')));
    rec('C POST /request/respond sem req.user → 401', isAuth401(await POST('/request/respond')));
    rec('D GET /my-requests sem req.user → 401', isAuth401(await GET('/my-requests')));
    rec('E GET /provider-requests sem req.user → 401', isAuth401(await GET('/provider-requests')));
    rec('F GET /request/:id sem req.user → 401', isAuth401(await GET(`/request/${id}`)));

    console.log('\n— /request/pay retired (R8J) preservado —');
    const pay = await POST('/request/pay');
    rec('G POST /request/pay → 403 SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110 (firewall OFF)',
      pay.statusCode === 403 && (code(pay) === 'SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110' || code(pay) === 'SERVICE_FINANCIAL_RUNTIME_DISABLED'),
      `status=${pay.statusCode} code=${code(pay)}`);

    console.log('\n— guards + baseline —');
    let g1 = 0; try { execSync('node scripts/audit-services-discovery-actor-bind.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
    rec('H guard services-discovery-actor-bind verde', g1 === 0);
    let g2 = 0; try { execSync('node scripts/audit-services-discovery-direct-pay-containment.mjs', { cwd, encoding: 'utf8' }); } catch { g2 = 1; }
    rec('I guard direct-pay-containment (R8J) verde', g2 === 0);
    let g3 = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { g3 = 1; }
    rec('J baseline canal-1 verde (services-discovery removido)', g3 === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ R8P: services-discovery 6 rotas non-money fail-closed sem req.user (actionContext não autoriza); /request/pay retired preservado; zero money.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
