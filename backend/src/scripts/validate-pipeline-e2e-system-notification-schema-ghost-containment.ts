/**
 * E2E — F-AUTHORITY-Z2-R8C-SYSTEM-NOTIFICATION-READ-STATE-AUTHORITY (DECISION-0113 / DECISION-0131 §B7 / Z2).
 * NÃO MOVE DINHEIRO. NÃO toca DB. Prova a CONTENÇÃO fail-closed do módulo SCHEMA-GHOST de notificações.
 *
 * A tabela `system_notifications` é SCHEMA-GHOST (migration 257 arquivada; ausente do schema canônico e de
 * unificard_dev). Todas as rotas eram dead-at-db (INSERT/UPDATE/SELECT numa tabela inexistente → 42P01/500) e
 * ungated-authority (recipientActorId client-declared / nenhum dono). DECISÃO: CONTER (501 nomeado).
 *
 *   A GET /system-notifications                         → 501 SYSTEM_NOTIFICATION_SCHEMA_GHOST_CONTAINED
 *   B GET /system-notifications/unread-count            → 501
 *   C GET /system-notifications/:notificationId         → 501
 *   D POST /system-notifications/:notificationId/read   → 501 (W1)
 *   E POST /system-notifications/mark-all-read           → 501 (W2)
 *   F guard schema-ghost-containment verde · G baseline canal-1 verde
 *
 * 🔒 SEM DB: a rota contida não importa pool/service/repository — `fastify.inject` não conecta a banco algum.
 * Modo: npx tsx src/scripts/validate-pipeline-e2e-system-notification-schema-ghost-containment.ts
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
  const { default: systemNotificationRoutes } = await import('../modules/system-notifications/system-notification.routes');
  const app = Fastify();
  // decora req.tenant/user/actionContext só para garantir que, mesmo populados, a contenção precede tudo.
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = { userId: randomUUID() };
    r.actionContext = { actorId: randomUUID() };
  });
  await app.register(systemNotificationRoutes);
  await app.ready();

  const isContained = (r: { statusCode: number; body: string }): boolean => {
    if (r.statusCode !== 501) return false;
    try { return JSON.parse(r.body)?.code === 'SYSTEM_NOTIFICATION_SCHEMA_GHOST_CONTAINED'; } catch { return false; }
  };
  const nid = randomUUID();

  try {
    console.log('\n— Rotas SCHEMA-GHOST contidas (501) —');
    const a = await app.inject({ method: 'GET', url: '/system-notifications' });
    record('A GET list → 501 SYSTEM_NOTIFICATION_SCHEMA_GHOST_CONTAINED', isContained(a), `status=${a.statusCode}: ${a.body.slice(0,120)}`);
    const b = await app.inject({ method: 'GET', url: '/system-notifications/unread-count' });
    record('B GET unread-count → 501', isContained(b), `status=${b.statusCode}`);
    const c = await app.inject({ method: 'GET', url: `/system-notifications/${nid}` });
    record('C GET :id → 501', isContained(c), `status=${c.statusCode}`);
    const d = await app.inject({ method: 'POST', url: `/system-notifications/${nid}/read`, headers: { 'content-type': 'application/json' }, payload: '{}' });
    record('D POST :id/read (W1) → 501', isContained(d), `status=${d.statusCode}`);
    const e = await app.inject({ method: 'POST', url: '/system-notifications/mark-all-read', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ recipientActorId: randomUUID() }) });
    record('E POST mark-all-read (W2) → 501 (recipient client-declared IGNORADO)', isContained(e), `status=${e.statusCode}`);

    console.log('\n— Guards —');
    let gGhost = 0; try { execSync('node scripts/audit-system-notification-schema-ghost-containment.mjs', { cwd, encoding: 'utf8' }); } catch { gGhost = 1; }
    record('F guard schema-ghost-containment verde', gGhost === 0);
    let gBaseline = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { gBaseline = 1; }
    record('G baseline canal-1 verde (system-notification removido honestamente)', gBaseline === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ system-notification: 5 rotas SCHEMA-GHOST contidas fail-closed (501); zero DB/service; canal-1 client-declared eliminado do arquivo.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
