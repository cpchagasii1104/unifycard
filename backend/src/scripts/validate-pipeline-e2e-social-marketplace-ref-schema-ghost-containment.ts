/**
 * E2E — F-AUTHORITY-Z2-R8D-SOCIAL-MARKETPLACE-REF-BIND-OR-CONTAIN (DECISION-0113 / DECISION-0131 §B7 / Z2).
 * NÃO MOVE DINHEIRO. NÃO toca DB. Prova a CONTENÇÃO fail-closed do módulo SCHEMA-GHOST social-marketplace-ref.
 *
 * A tabela `social_marketplace_refs` é SCHEMA-GHOST (CREATE TABLE só em migrations_archive/0759; ausente do
 * schema canônico e de unificard_dev). As 3 rotas eram dead-at-db (INSERT/SELECT numa tabela inexistente →
 * 42P01/500) e canal-1 (actionContext.actorId — breadcrumb de auditoria; o write nunca recebia o actor).
 * DECISÃO: CONTER (501 nomeado).
 *
 *   A POST /social/marketplace-ref              → 501 SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED
 *   B GET  /social/marketplace-ref/:postId      → 501
 *   C GET  /social/marketplace-ref/details/:refId → 501
 *   D guard schema-ghost-containment verde · E baseline canal-1 verde
 *
 * 🔒 SEM DB: a rota contida não importa pool/service/repository — `fastify.inject` não conecta a banco algum.
 * Modo: npx tsx src/scripts/validate-pipeline-e2e-social-marketplace-ref-schema-ghost-containment.ts
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
  const { default: socialMarketplaceRefRoutes } = await import('../modules/social/social-marketplace-ref.routes');
  const app = Fastify();
  // decora req.tenant/user/actionContext só para garantir que, mesmo populados, a contenção precede tudo.
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = { userId: randomUUID() };
    r.actionContext = { actorId: randomUUID() };
  });
  await app.register(socialMarketplaceRefRoutes, { prefix: '/social' });
  await app.ready();

  const isContained = (r: { statusCode: number; body: string }): boolean => {
    if (r.statusCode !== 501) return false;
    try { return JSON.parse(r.body)?.code === 'SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED'; } catch { return false; }
  };
  const postId = randomUUID();
  const refId = randomUUID();

  try {
    console.log('\n— Rotas SCHEMA-GHOST contidas (501) —');
    const a = await app.inject({ method: 'POST', url: '/social/marketplace-ref', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ postId, refType: 'PRODUCT', refId }) });
    record('A POST /social/marketplace-ref → 501 SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED', isContained(a), `status=${a.statusCode}: ${a.body.slice(0,120)}`);
    const b = await app.inject({ method: 'GET', url: `/social/marketplace-ref/${postId}` });
    record('B GET /social/marketplace-ref/:postId → 501', isContained(b), `status=${b.statusCode}`);
    const c = await app.inject({ method: 'GET', url: `/social/marketplace-ref/details/${refId}` });
    record('C GET /social/marketplace-ref/details/:refId → 501', isContained(c), `status=${c.statusCode}`);

    console.log('\n— Guards —');
    let gGhost = 0; try { execSync('node scripts/audit-social-marketplace-ref-schema-ghost-containment.mjs', { cwd, encoding: 'utf8' }); } catch { gGhost = 1; }
    record('D guard schema-ghost-containment verde', gGhost === 0);
    let gBaseline = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { gBaseline = 1; }
    record('E baseline canal-1 verde (social-marketplace-ref removido honestamente)', gBaseline === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ social-marketplace-ref: 3 rotas SCHEMA-GHOST contidas fail-closed (501); zero DB/service; canal-1 actionContext.actorId eliminado do arquivo.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
