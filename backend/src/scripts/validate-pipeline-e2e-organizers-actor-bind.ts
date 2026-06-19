/**
 * E2E — F-AUTHORITY-Z2-R8O (organizers remainder event-organizer authority bind).
 * 🔒 DB-FREE: o fail-closed (sem req.user → 401) ocorre ANTES de resolveGlobalUserId/service/DB; o billing contido
 *    retorna 501 antes de service. NÃO toca unificard_dev. Modo: npx tsx <este arquivo>.
 *
 * Prova (fail-closed do bind — actionContext.actorId NÃO é autoridade):
 *   A POST /create sem req.user (só actionContext spoofado) → 401 ORGANIZER_ACTOR_AUTHORITY_REQUIRED
 *   B POST /:id/add-member sem req.user → 401
 *   C POST /link-event/:id sem req.user → 401
 *   D billing R8K segue contido: POST /:id/subscribe → 501 ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED
 *   E webhook segue no-op 200 {contained}
 *   F guard organizers-actor-authority-bind verde · G baseline verde
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
  // SEM req.user (simula caller que só declara actionContext.actorId — não é autoridade); tenant presente.
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = undefined;
    r.actionContext = { actorId: randomUUID() }; // spoof: não pode autorizar nada
  });
  await app.register(organizersRoutes);
  await app.ready();

  const code = (r: { body: string }): string | null => { try { return JSON.parse(r.body)?.error ?? JSON.parse(r.body)?.code ?? null; } catch { return null; } };
  const id = randomUUID();
  const j = { 'content-type': 'application/json' };
  // bodies schema-VÁLIDOS (a validação de schema roda ANTES do handler; com body inválido daria 400, não o 401 do bind)
  const POST = (url: string, payload: unknown) => app.inject({ method: 'POST', url, headers: j, payload: JSON.stringify(payload) });

  try {
    console.log('\n— bind fail-closed (actionContext NÃO autoriza) —');
    const a = await POST('/create', { name: 'Org Teste' });
    rec('A POST /create sem req.user → 401 ORGANIZER_ACTOR_AUTHORITY_REQUIRED', a.statusCode === 401 && code(a) === 'ORGANIZER_ACTOR_AUTHORITY_REQUIRED', `status=${a.statusCode} code=${code(a)}`);
    const b = await POST(`/${id}/add-member`, { globalUserId: randomUUID(), role: 'viewer' });
    rec('B POST /:id/add-member sem req.user → 401', b.statusCode === 401 && code(b) === 'ORGANIZER_ACTOR_AUTHORITY_REQUIRED', `status=${b.statusCode} code=${code(b)}`);
    const c = await POST(`/link-event/${id}`, { organizerId: randomUUID() });
    rec('C POST /link-event/:id sem req.user → 401', c.statusCode === 401 && code(c) === 'ORGANIZER_ACTOR_AUTHORITY_REQUIRED', `status=${c.statusCode} code=${code(c)}`);

    console.log('\n— billing R8K preservado —');
    const d = await POST(`/${id}/subscribe`, {});
    rec('D POST /:id/subscribe → 501 ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED', d.statusCode === 501 && code(d) === 'ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED');
    const e = await POST('/webhooks/stripe', {});
    let eb: any = {}; try { eb = JSON.parse(e.body); } catch { /* noop */ }
    rec('E webhook → 200 {contained} (no-op preservado)', e.statusCode === 200 && eb?.contained === 'ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED');

    console.log('\n— guards + baseline —');
    let g1 = 0; try { execSync('node scripts/audit-organizers-actor-authority-bind.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
    rec('F guard organizers-actor-authority-bind verde', g1 === 0);
    let g2 = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { g2 = 1; }
    rec('G baseline canal-1 verde (organizers removido)', g2 === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ R8O: organizers create/add-member/link-event fail-closed sem req.user (actionContext não autoriza); billing R8K preservado; zero money.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
