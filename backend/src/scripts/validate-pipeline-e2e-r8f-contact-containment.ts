/**
 * E2E — F-AUTHORITY-Z2-R8F (contact) — CONTACT SCHEMA-GHOST CONTAINMENT (DECISION-0113 / Z2).
 * NÃO MOVE DINHEIRO. NÃO toca DB. Prova a CONTENÇÃO fail-closed (route-level) do módulo contact (schema-ghost).
 *
 *   A POST /contacts                  → 501 CONTACTS_SCHEMA_GHOST_CONTAINED
 *   B PATCH /contacts/:id             → 501
 *   C GET /contacts                   → 501
 *   D GET /contacts/:id               → 501
 *   E GET /contacts/search            → 501
 *   F POST /contacts/:id/kyc/validate → 501
 *   G guard contacts-schema-ghost-containment verde · H guard plan-self-bound verde · I baseline canal-1 verde
 *
 * 🔒 SEM DB: a rota contida não importa pool/service — `fastify.inject` não conecta a banco algum.
 * Modo: npx tsx src/scripts/validate-pipeline-e2e-r8f-contact-containment.ts
 */
import 'tsconfig-paths/register';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();

async function main(): Promise<void> {
  const Fastify = (await import('fastify')).default;
  const { default: contactRoutes } = await import('../modules/marketplace/contact.routes');
  const app = Fastify();
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = { userId: randomUUID() };
    r.actionContext = { actorId: randomUUID() };
  });
  await app.register(contactRoutes);
  await app.ready();

  const C = 'CONTACTS_SCHEMA_GHOST_CONTAINED';
  const contained = (r: { statusCode: number; body: string }): boolean => {
    if (r.statusCode !== 501) return false;
    try { return JSON.parse(r.body)?.code === C; } catch { return false; }
  };
  const id = randomUUID();
  const json = { 'content-type': 'application/json' };

  try {
    console.log('\n— contact (schema-ghost) contido (501) —');
    record('A POST /contacts → 501 ' + C, contained(await app.inject({ method: 'POST', url: '/contacts', headers: json, payload: '{}' })));
    record('B PATCH /contacts/:id → 501', contained(await app.inject({ method: 'PATCH', url: `/contacts/${id}`, headers: json, payload: '{}' })));
    record('C GET /contacts → 501', contained(await app.inject({ method: 'GET', url: '/contacts' })));
    record('D GET /contacts/:id → 501', contained(await app.inject({ method: 'GET', url: `/contacts/${id}` })));
    record('E GET /contacts/search → 501', contained(await app.inject({ method: 'GET', url: '/contacts/search' })));
    record('F POST /contacts/:id/kyc/validate → 501', contained(await app.inject({ method: 'POST', url: `/contacts/${id}/kyc/validate`, headers: json, payload: '{}' })));

    console.log('\n— Guards —');
    let gC = 0; try { execSync('node scripts/audit-contacts-schema-ghost-containment.mjs', { cwd, encoding: 'utf8' }); } catch { gC = 1; }
    record('G guard contacts-schema-ghost-containment verde', gC === 0);
    let gP = 0; try { execSync('node scripts/audit-plan-self-bound.mjs', { cwd, encoding: 'utf8' }); } catch { gP = 1; }
    record('H guard plan-self-bound verde', gP === 0);
    let gB = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { gB = 1; }
    record('I baseline canal-1 verde (plan + contact removidos honestamente)', gB === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ R8F: contact SCHEMA-GHOST contido fail-closed (501); plan self-bound reconhecido; canal-1 reduzido.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
