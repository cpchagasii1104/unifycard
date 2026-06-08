/**
 * E2E F-X-ACTOR-ID-RESOLVER-BIND (DECISION-0113, segundo vetor — x-actor-id)
 *
 * `resolveActiveActorFromRequest` (modules/social/actor.utils.ts) resolvia o actor operante do header
 * `x-actor-id`/`x-acting-actor-id` (prioridade 1) ou query `actor_id` (prioridade 2) via findById SEM
 * `canRepresentActor` → vetor de spoof PARALELO ao actionContext.actorId (5 callers: crm/my-orders/
 * presence/subscriptions/venue). Fix CENTRAL no primitivo: header/query = HINT; só retorna o actor se o
 * `req.user` puder REPRESENTÁ-LO. Sem req.user → 401; não representável/inexistente → 403 não-leak.
 * Fallback self (prioridade 3) deriva de req.user e fica intocado.
 *
 * Prova (BEHAVIORAL REAL — chama o primitivo de verdade com requests mock):
 *   1. sem header/query + allowUserFallback → resolve o próprio actor (self).
 *   2. x-actor-id de actor representável (próprio) → passa.
 *   3. x-actor-id de actor de OUTRO, caller não-representável → ForbiddenError (403).
 *   4. query actor_id spoofável → idem 403.
 *   5. sem req.user + header → UnauthorizedError (401).
 *   6. estrutural: os 5 consumidores continuam chamando o resolver; o gate vive no primitivo.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-x-actor-id-resolver-bind.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const VICTIM_ACTOR_ID = '00000000-0000-4000-8000-0000000000fb';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function statusOf(e: unknown): number | undefined { return (e as { statusCode?: number }).statusCode; }
function mockReq(opts: { headers?: Record<string, string>; query?: any; userId?: string }): any {
  return { headers: opts.headers ?? {}, query: opts.query ?? {}, user: opts.userId ? { userId: opts.userId, id: opts.userId } : undefined };
}

async function main(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const dev = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ actor_id: string }>(
    `SELECT actor_id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]
  );
  const devActor = devActorRow.rows[0]?.actor_id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  const { resolveActiveActorFromRequest } = await import('../modules/social/actor.utils');

  console.log('\n— BEHAVIORAL REAL: chamando o primitivo resolveActiveActorFromRequest —');

  // 1. self fallback (sem header/query) → resolve o próprio actor do dev.
  try {
    const a = await resolveActiveActorFromRequest(mockReq({ userId: devUserId }), TENANT_ID, { allowUserFallback: true, userId: devUserId });
    record('1 self fallback (sem header) → resolve o actor do próprio dev', !!a && !!a.actor_id);
  } catch (e) { record('1 self fallback (sem header) → resolve o actor do próprio dev', false, `lançou status=${statusOf(e)}`); }

  // 2. x-actor-id do PRÓPRIO actor (representável) → passa.
  try {
    const a = await resolveActiveActorFromRequest(mockReq({ headers: { 'x-actor-id': devActor }, userId: devUserId }), TENANT_ID, {});
    record('2 x-actor-id do próprio actor (representável) → retorna o actor', !!a && a.actor_id === devActor);
  } catch (e) { record('2 x-actor-id do próprio actor (representável) → retorna o actor', false, `lançou status=${statusOf(e)}`); }

  // 3. x-actor-id do actor do DEV, mas caller é ESTRANHO (não representa) → 403.
  let blocked3 = false;
  try {
    await resolveActiveActorFromRequest(mockReq({ headers: { 'x-actor-id': devActor }, userId: STRANGER_USER_ID }), TENANT_ID, {});
  } catch (e) { blocked3 = statusOf(e) === 403; }
  record('3 x-actor-id alheio + caller não-representável → 403 (spoof bloqueado)', blocked3);

  // 4. query actor_id spoofável (estranho declara actor do dev) → 403.
  let blocked4 = false;
  try {
    await resolveActiveActorFromRequest(mockReq({ query: { actor_id: devActor, actor_type: 'user' }, userId: STRANGER_USER_ID }), TENANT_ID, {});
  } catch (e) { blocked4 = statusOf(e) === 403; }
  record('4 query actor_id alheio + caller não-representável → 403', blocked4);

  // 5. sem req.user + header → 401 (autenticação obrigatória para resolver actor declarado).
  let blocked5 = false;
  try {
    await resolveActiveActorFromRequest(mockReq({ headers: { 'x-actor-id': devActor } }), TENANT_ID, {});
  } catch (e) { blocked5 = statusOf(e) === 401; }
  record('5 header x-actor-id sem req.user → 401 fail-closed', blocked5);

  // 6. my-orders: simula o caminho real (attacker manda x-actor-id da vítima) → 403 (não vaza orders).
  let blocked6 = false;
  try {
    await resolveActiveActorFromRequest(mockReq({ headers: { 'x-actor-id': VICTIM_ACTOR_ID }, userId: devUserId }), TENANT_ID, { allowUserFallback: true, userId: devUserId });
  } catch (e) { blocked6 = statusOf(e) === 403; }
  record('6 my-orders-like: x-actor-id da vítima + caller não-representa → 403 (orders não vazam)', blocked6);

  console.log('\n— estrutural: gate no primitivo + 5 consumidores ainda o chamam —');
  const src = readFileSync(join(process.cwd(), 'src/modules/social/actor.utils.ts'), 'utf8');
  record('E1 primitivo gateia header e query via assertActorRepresentable → canRepresentActor',
    /assertActorRepresentable\(req, tenantId, headerActorId\)/.test(src)
    && /assertActorRepresentable\(req, tenantId, queryActorId\)/.test(src)
    && /canRepresentActor\(tenantId, callerUserId, declaredActorId\)/.test(src));
  record('E2 sem req.user → 401; não representável → 403',
    /UnauthorizedError\(/.test(src) && /Actor declarado não representável/.test(src));
  const root = process.cwd();
  const consumers = ['crm/crm.routes', 'my-orders/my-orders.routes', 'presence/presence.routes', 'subscriptions/subscription.routes', 'venue/venue.routes'];
  let allCall = true;
  for (const c of consumers) {
    const cs = readFileSync(join(root, `src/modules/${c}.ts`), 'utf8');
    if (!/resolveActiveActorFromRequest\(req/.test(cs)) allCall = false;
  }
  record('E3 os 5 consumidores (crm/my-orders/presence/subscriptions/venue) continuam chamando o resolver (gate central)', allCall);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ x-actor-id resolver bind (canRepresentActor no primitivo) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
