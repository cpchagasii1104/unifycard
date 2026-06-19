/**
 * E2E — F-AUTHORITY-Z2-R8L-BUSINESS-AUTHORIZATION-READ-SENSITIVE (DECISION-0113 / Z2).
 * 🔒 DB-FREE: o subject ausente é barrado (401) ANTES de qualquer service/DB; com subject presente, a checagem é
 *    stubada (sem banco). NÃO toca unificard_dev. Modo: npx tsx <este arquivo>.
 *
 * Prova:
 *   A GET /business-permissions/check sem req.user → 401 BUSINESS_AUTHORIZATION_ACTOR_AUTHORITY_REQUIRED
 *   B com req.user mas sem action/actorId → 400
 *   C com req.user + action + actorId → checkPermission recebe SUBJECT = req.user.id (NÃO actionContext.actorId)
 *   D spoof actionContext.actorId/x-actor-id NÃO altera o subject (continua req.user.id)
 *   E guard business-authorization-read-authority verde · F baseline verde
 */
import 'tsconfig-paths/register';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const rec = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();

async function main(): Promise<void> {
  // Stub do service: captura o subject recebido por checkPermission (prova que é req.user, não client-declared).
  const captured: { subject?: string; org?: string } = {};
  const svcMod = await import('../core/authorization/business-authorization.service');
  (svcMod.businessAuthorizationService as any).checkPermission = async (_tenant: string, userId: string, actorId: string) => {
    captured.subject = userId; captured.org = actorId;
    return { allowed: true, reason: 'stub', role: 'owner' };
  };

  const Fastify = (await import('fastify')).default;
  const { default: routes } = await import('../core/authorization/business-authorization.routes');
  const app = Fastify({ logger: false });
  const realUserId = randomUUID();
  let attachUser = true;
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = attachUser ? { userId: realUserId, id: realUserId } : undefined;
    r.actionContext = { actorId: req.headers['x-test-spoof'] ? String(req.headers['x-test-spoof']) : randomUUID() };
  });
  await app.register(routes);
  await app.ready();

  const org = randomUUID();
  try {
    console.log('\n— subject server-side —');
    attachUser = false;
    const noUser = await app.inject({ method: 'GET', url: `/business-permissions/check?action=event:create&actorId=${org}` });
    let nb: any = {}; try { nb = JSON.parse(noUser.body); } catch { /* noop */ }
    rec('A sem req.user → 401 BUSINESS_AUTHORIZATION_ACTOR_AUTHORITY_REQUIRED', noUser.statusCode === 401 && nb?.error === 'BUSINESS_AUTHORIZATION_ACTOR_AUTHORITY_REQUIRED');

    attachUser = true;
    const noArgs = await app.inject({ method: 'GET', url: `/business-permissions/check?action=event:create` });
    rec('B com req.user, sem actorId → 400', noArgs.statusCode === 400);

    captured.subject = undefined;
    const ok = await app.inject({ method: 'GET', url: `/business-permissions/check?action=event:create&actorId=${org}` });
    rec('C subject recebido por checkPermission === req.user.id (não actionContext)', ok.statusCode === 200 && captured.subject === realUserId && captured.org === org, `subject=${captured.subject} esperado=${realUserId}`);

    captured.subject = undefined;
    const spoof = await app.inject({ method: 'GET', url: `/business-permissions/check?action=event:create&actorId=${org}`, headers: { 'x-test-spoof': randomUUID() } });
    rec('D spoof actionContext não altera subject (continua req.user.id)', spoof.statusCode === 200 && captured.subject === realUserId);

    console.log('\n— guards + baseline —');
    let g1 = 0; try { execSync('node scripts/audit-business-authorization-read-authority.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
    rec('E guard business-authorization-read-authority verde', g1 === 0);
    let g2 = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { g2 = 1; }
    rec('F baseline canal-1 verde (business-authorization recognized safe-subject)', g2 === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ R8L: business-permissions/check subject=req.user server-side; spoof não muda; zero money.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
