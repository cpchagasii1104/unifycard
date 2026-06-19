/**
 * E2E — F-AUTHORITY-Z2-R8Q (unifycard-method M5 money-aware containment).
 * 🔒 DB-FREE: as rotas contidas retornam 501 ANTES de qualquer service/repository/DB; o arquivo de rota não importa
 *    service algum → registro DB-free. NÃO toca unificard_dev. Modo: npx tsx <este arquivo>.
 *
 * Prova:
 *   A POST /unifycard/methods → 501 UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED
 *   B GET  /unifycard/methods → 501
 *   C GET  /unifycard/methods/:type → 501
 *   D spoof actionContext.actorId não muda nada (continua 501)
 *   E sem req.user não ativa fluxo (continua 501 — contenção independe de auth)
 *   F guard unifycard-method-money-containment verde
 *   G baseline canal-1 = 0 (flagged 0 / baseline 0 / new 0)
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
  const { default: routes } = await import('../modules/marketplace/unifycard-method.routes');
  const app = Fastify({ logger: false });
  let attachUser = true;
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = attachUser ? { userId: randomUUID(), id: randomUUID() } : undefined;
    r.actionContext = { actorId: req.headers['x-test-spoof'] ? String(req.headers['x-test-spoof']) : randomUUID() };
  });
  await app.register(routes);
  await app.ready();

  const isGhost = (r: { statusCode: number; body: string }): boolean => { if (r.statusCode !== 501) return false; try { return JSON.parse(r.body)?.code === 'UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED'; } catch { return false; } };
  const j = { 'content-type': 'application/json' };
  const type = 'pix';

  try {
    console.log('\n— unifycard-method contido (501) —');
    rec('A POST /unifycard/methods → 501 UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED', isGhost(await app.inject({ method: 'POST', url: '/unifycard/methods', headers: j, payload: '{}' })));
    rec('B GET /unifycard/methods → 501', isGhost(await app.inject({ method: 'GET', url: '/unifycard/methods' })));
    rec('C GET /unifycard/methods/:type → 501', isGhost(await app.inject({ method: 'GET', url: `/unifycard/methods/${type}` })));

    console.log('\n— spoof / sem req.user —');
    rec('D spoof actionContext.actorId no POST → ainda 501', isGhost(await app.inject({ method: 'POST', url: '/unifycard/methods', headers: { ...j, 'x-test-spoof': randomUUID() }, payload: '{}' })));
    attachUser = false;
    rec('E sem req.user no POST → ainda 501 (contenção independe de auth)', isGhost(await app.inject({ method: 'POST', url: '/unifycard/methods', headers: j, payload: '{}' })));
    attachUser = true;

    console.log('\n— guard + baseline —');
    let g1 = 0; try { execSync('node scripts/audit-unifycard-method-money-containment.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
    rec('F guard unifycard-method-money-containment verde', g1 === 0);
    let baselineZero = false;
    try {
      const out = execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' });
      baselineZero = /baseline=0\b/.test(out) && /flagged=0\b/.test(out) && /new=0\b/.test(out);
    } catch { baselineZero = false; }
    rec('G baseline canal-1 = 0 (flagged 0 / baseline 0 / new 0)', baselineZero);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ R8Q: unifycard-method 3 rotas contidas 501 (money-deferred/schema-ghost); spoof inócuo; baseline canal-1 = 0; zero money.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
