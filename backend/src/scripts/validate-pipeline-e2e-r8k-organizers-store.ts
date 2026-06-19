/**
 * E2E — F-AUTHORITY-Z2-R8K (organizers billing containment + store-onboarding bind).
 * 🔒 DB-FREE: as rotas de billing contidas retornam 501/200 ANTES de qualquer service/DB; o registro do plugin não
 *    conecta a banco (pg Pool é lazy). NÃO toca unificard_dev. Modo: npx tsx <este arquivo>.
 *
 * Prova (organizers):
 *   A POST /:id/subscribe → 501 ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED
 *   B POST /:id/subscription/cancel → 501 (a rota sem-autoridade morreu)
 *   C POST /:id/subscribe/stripe → 501 · D GET /:id/plan → 501 · E GET /:id/subscription → 501
 *   F POST /webhooks/stripe → 200 {contained} (no-op ACK; sem retry storm; zero escrita)
 *   G spoof actionContext/body não muda nada (continua 501)
 *   H guard organizer-billing-ghost verde · I guard store-onboarding-actor-bind verde · J baseline verde
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
  const { default: organizersRoutes } = await import('../modules/events/organizers/organizers.routes');
  const app = Fastify({ logger: false });
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = { userId: randomUUID(), id: randomUUID() };
    r.actionContext = { actorId: req.headers['x-test-actor-id'] ? String(req.headers['x-test-actor-id']) : randomUUID() };
  });
  await app.register(organizersRoutes);
  await app.ready();

  const isGhost = (r: { statusCode: number; body: string }): boolean => { if (r.statusCode !== 501) return false; try { return JSON.parse(r.body)?.code === 'ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED'; } catch { return false; } };
  const id = randomUUID();
  const j = { 'content-type': 'application/json' };
  const POST = (url: string, hdr: Record<string, string> = j) => app.inject({ method: 'POST', url, headers: hdr, payload: '{}' });
  const GET = (url: string) => app.inject({ method: 'GET', url });

  try {
    console.log('\n— organizers billing contido —');
    rec('A POST /:id/subscribe → 501 ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED', isGhost(await POST(`/${id}/subscribe`)));
    rec('B POST /:id/subscription/cancel → 501 (no-auth route killed)', isGhost(await POST(`/${id}/subscription/cancel`)));
    rec('C POST /:id/subscribe/stripe → 501', isGhost(await POST(`/${id}/subscribe/stripe`)));
    rec('D GET /:id/plan → 501', isGhost(await GET(`/${id}/plan`)));
    rec('E GET /:id/subscription → 501', isGhost(await GET(`/${id}/subscription`)));

    console.log('\n— webhook no-op ACK + spoof —');
    const wh = await POST('/webhooks/stripe');
    let whBody: any = {}; try { whBody = JSON.parse(wh.body); } catch { /* noop */ }
    rec('F POST /webhooks/stripe → 200 contained (no-op, sem retry storm)', wh.statusCode === 200 && whBody?.contained === 'ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED');
    rec('G spoof x-test-actor-id no cancel → ainda 501', isGhost(await POST(`/${id}/subscription/cancel`, { ...j, 'x-test-actor-id': randomUUID() })));

    console.log('\n— guards + baseline —');
    let g1 = 0; try { execSync('node scripts/audit-organizer-billing-ghost-containment.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
    rec('H guard organizer-billing-ghost-containment verde', g1 === 0);
    let g2 = 0; try { execSync('node scripts/audit-store-onboarding-actor-bind.mjs', { cwd, encoding: 'utf8' }); } catch { g2 = 1; }
    rec('I guard store-onboarding-actor-bind verde', g2 === 0);
    let g3 = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { g3 = 1; }
    rec('J baseline canal-1 verde (store-onboarding removido, organizers PARTIAL)', g3 === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ R8K: organizers billing contido (501) + webhook no-op ACK; store-onboarding bound; zero money.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
