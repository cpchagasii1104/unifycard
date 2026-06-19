/**
 * E2E — F-AUTHORITY-Z2-R8N (automation + human-mvp schema-ghost containment).
 * 🔒 DB-FREE: as rotas contidas retornam 501/403 ANTES de qualquer service/DB; os arquivos de rota não importam
 *    service algum → registro DB-free. NÃO toca unificard_dev. Modo: npx tsx <este arquivo>.
 *
 * Prova:
 *   automation: GET/POST/PATCH alerts + schedule → 501 AUTOMATION_SCHEMA_GHOST_CONTAINED;
 *               run-due → 403 AUTOMATION_RUN_DUE_HTTP_DISABLED (gate preservado).
 *   human-mvp: 5 POST → 501 HUMAN_MVP_SCHEMA_GHOST_CONTAINED.
 *   spoof actionContext.actorId não altera (continua 501).
 *   guards verdes; baseline verde.
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
  const { default: automationRoutes } = await import('../modules/automation/automation.routes');
  const { default: humanMvpRoutes } = await import('../modules/human-mvp/human-mvp.routes');
  const app = Fastify({ logger: false });
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = { userId: randomUUID(), id: randomUUID() };
    r.actionContext = { actorId: req.headers['x-test-spoof'] ? String(req.headers['x-test-spoof']) : randomUUID() };
  });
  await app.register(automationRoutes, { prefix: '/automation' });
  await app.register(humanMvpRoutes, { prefix: '/n' });
  await app.ready();

  const code = (r: { statusCode: number; body: string }): string | null => { try { return JSON.parse(r.body)?.code ?? null; } catch { return null; } };
  const isAuto = (r: { statusCode: number; body: string }) => r.statusCode === 501 && code(r) === 'AUTOMATION_SCHEMA_GHOST_CONTAINED';
  const isHm = (r: { statusCode: number; body: string }) => r.statusCode === 501 && code(r) === 'HUMAN_MVP_SCHEMA_GHOST_CONTAINED';
  const id = randomUUID();
  const j = { 'content-type': 'application/json' };
  const POST = (url: string, hdr: Record<string, string> = j) => app.inject({ method: 'POST', url, headers: hdr, payload: '{}' });
  const PATCH = (url: string) => app.inject({ method: 'PATCH', url, headers: j, payload: '{}' });
  const GET = (url: string) => app.inject({ method: 'GET', url });

  try {
    console.log('\n— automation contido (501) —');
    rec('A GET /automation/alerts → 501', isAuto(await GET('/automation/alerts')));
    rec('B GET /automation/alerts/count → 501', isAuto(await GET('/automation/alerts/count')));
    rec('C GET /automation/alerts/:id → 501', isAuto(await GET(`/automation/alerts/${id}`)));
    rec('D POST /automation/alerts → 501', isAuto(await POST('/automation/alerts')));
    rec('E PATCH /automation/alerts/:id/status → 501', isAuto(await PATCH(`/automation/alerts/${id}/status`)));
    rec('F POST /automation/schedule → 501', isAuto(await POST('/automation/schedule')));
    rec('G GET /automation/schedule → 501', isAuto(await GET('/automation/schedule')));
    rec('H GET /automation/schedule/:id → 501', isAuto(await GET(`/automation/schedule/${id}`)));
    rec('I POST /automation/schedule/:id/cancel → 501', isAuto(await POST(`/automation/schedule/${id}/cancel`)));
    const rd = await POST('/automation/schedule/run-due');
    rec('J POST /automation/schedule/run-due → 403 AUTOMATION_RUN_DUE_HTTP_DISABLED (gate preservado)', rd.statusCode === 403 && code(rd) === 'AUTOMATION_RUN_DUE_HTTP_DISABLED');

    console.log('\n— human-mvp contido (501) —');
    rec('K POST /n/skills → 501 HUMAN_MVP_SCHEMA_GHOST_CONTAINED', isHm(await POST('/n/skills')));
    rec('L POST /n/service-offers → 501', isHm(await POST('/n/service-offers')));
    rec('M POST /n/opportunities → 501', isHm(await POST('/n/opportunities')));
    rec('N POST /n/event-instances → 501', isHm(await POST('/n/event-instances')));
    rec('O POST /n/activity-executions → 501', isHm(await POST('/n/activity-executions')));

    console.log('\n— spoof + guards —');
    rec('P spoof actionContext no POST /automation/schedule → ainda 501', isAuto(await POST('/automation/schedule', { ...j, 'x-test-spoof': randomUUID() })));
    rec('Q spoof actionContext no POST /n/skills → ainda 501', isHm(await POST('/n/skills', { ...j, 'x-test-spoof': randomUUID() })));
    let g1 = 0; try { execSync('node scripts/audit-automation-human-mvp-ghost-containment.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
    rec('R guard automation-human-mvp-ghost-containment verde', g1 === 0);
    let g2 = 0; try { execSync('node scripts/audit-internal-surfaces-containment.mjs', { cwd, encoding: 'utf8' }); } catch { g2 = 1; }
    rec('S guard internal-surfaces (R18 run-due) verde', g2 === 0);
    let g3 = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { g3 = 1; }
    rec('T baseline canal-1 verde (automation + human-mvp removidos)', g3 === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ R8N: automation (9 rotas) + human-mvp (5 rotas) contidas 501; run-due 403; spoof inócuo; zero money.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
