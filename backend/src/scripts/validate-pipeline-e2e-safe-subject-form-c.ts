/**
 * E2E — F-AUTHORITY-Z3-SAFE-SUBJECT-FORM-C-DEDICATED-GUARDS (higiene W3).
 * 🔒 DB-FREE: o fail-closed (sem req.user → 401) ocorre no preHandler ANTES de companiesService/DB. Sem montar
 *    capability/DB, prova-se o invariante central: actionContext.actorId SOZINHO (sem req.user) NÃO autoriza
 *    nenhuma das 3 superfícies Forma C/D. NÃO toca unificard_dev. Modo: npx tsx <este arquivo>.
 *
 * Prova (subject server-side obrigatório; actionContext não substitui):
 *   business-audit:  GET /business-audit-logs (e /:logId) sem req.user → 401
 *   policy-engine:   GET /policies, GET /policies/evaluate/:actorId sem req.user → 401
 *   risk-command:    GET /risk/dashboard/overview, /actors/:actorId sem req.user → 401
 *   + spoof actionContext.actorId/x-actor-id NÃO converte 401 em 200 (não autoriza)
 *   + guard Forma C verde · baseline canal-1 = 0
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
  const { default: businessAudit } = await import('../modules/business-audit/business-audit.routes');
  const { default: policy } = await import('../modules/policy-engine/policy.routes');
  const { default: risk } = await import('../modules/risk-command-center/risk-dashboard.routes');
  const app = Fastify({ logger: false });
  // tenant presente + actionContext spoofado, SEM req.user → preHandler deve fechar 401 (antes de companiesService/DB).
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = undefined;
    r.actionContext = { actorId: req.headers['x-test-spoof'] ? String(req.headers['x-test-spoof']) : randomUUID() };
  });
  await app.register(businessAudit);
  await app.register(policy);
  await app.register(risk);
  await app.ready();

  const id = randomUUID();
  const is401 = (r: { statusCode: number }) => r.statusCode === 401;
  const GET = (url: string, hdr: Record<string, string> = {}) => app.inject({ method: 'GET', url, headers: hdr });

  try {
    console.log('\n— business-audit fail-closed sem req.user —');
    rec('A GET /business-audit-logs sem req.user → 401', is401(await GET('/business-audit-logs')));
    rec('B GET /business-audit-logs/:logId sem req.user → 401', is401(await GET(`/business-audit-logs/${id}`)));

    console.log('\n— policy-engine fail-closed sem req.user —');
    rec('C GET /policies sem req.user → 401', is401(await GET('/policies')));
    rec('D GET /policies/evaluate/:actorId sem req.user → 401', is401(await GET(`/policies/evaluate/${id}`)));

    console.log('\n— risk-command-center fail-closed sem req.user —');
    rec('E GET /risk/dashboard/overview sem req.user → 401', is401(await GET('/risk/dashboard/overview')));
    rec('F GET /risk/dashboard/actors/:actorId sem req.user → 401', is401(await GET(`/risk/dashboard/actors/${id}`)));

    console.log('\n— spoof actionContext não autoriza —');
    rec('G spoof x-test-spoof em /business-audit-logs → ainda 401', is401(await GET('/business-audit-logs', { 'x-test-spoof': randomUUID() })));
    rec('H spoof x-test-spoof em /risk/dashboard/overview → ainda 401', is401(await GET('/risk/dashboard/overview', { 'x-test-spoof': randomUUID() })));

    console.log('\n— guard + baseline —');
    let g1 = 0; try { execSync('node scripts/audit-safe-subject-form-c-dedicated-guards.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
    rec('I guard safe-subject-form-c-dedicated-guards verde', g1 === 0);
    let baselineZero = false;
    try { const out = execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); baselineZero = /baseline=0\b/.test(out) && /new=0\b/.test(out); } catch { baselineZero = false; }
    rec('J baseline canal-1 = 0 / new = 0 (inalterado)', baselineZero);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Z3: business-audit/policy-engine/risk-command-center fail-closed sem req.user (actionContext não autoriza); guard Forma C verde; baseline 0.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
