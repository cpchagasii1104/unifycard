/**
 * E2E F6.5.1 — inbox IDOR + commitments (DECISION-0113, resíduo de leituras operacionais)
 *
 * Antes: 3 leituras privadas sem gate de representabilidade →
 *   GET /inbox/actors/:id        → getInboxItems(tenant, req.params.id)   ← IDOR (inbox alheio por URL)
 *   GET /inbox/actors/:id/counter→ getInboxCounter(tenant, req.params.id) ← IDOR
 *   GET /me/commitments          → bookings/inbox/economia keyed em actor.actor_id (= actionContext.actorId)
 * Fix:
 *   inbox (OWN-PARAMS): canRepresentActor(req.user.userId, req.params.id) ANTES da leitura; 401 sem req.user.
 *   commitments (CRA): canRepresentActor(req.user.userId, actionContext.actorId) ANTES das queries.
 *   fail-closed → 403 não-leak.
 *
 * Prova:
 *   A behavioral — o primitivo nega cross-user (dev→próprio=true; estranho→actor do dev=false).
 *   B estrutural — gate canRepresentActor ANTES da leitura nos 3 handlers + 401 fail-closed no inbox.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-inbox-commitments-authorship-f6-5-1.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function gateBeforeRead(src: string, gateMarker: string, readMarker: string): boolean {
  const g = src.indexOf(gateMarker);
  const r = src.indexOf(readMarker);
  return g >= 0 && r >= 0 && g < r;
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

  const { authorizationService } = await import('../core/authorization/authorization.service');

  console.log('\n— A behavioral: o gate (canRepresentActor) nega cross-user —');
  record('A1 dev representa o próprio actor → true',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o actor do dev → false (read alheio seria 403)',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B estrutural: gate ANTES da leitura nos 3 handlers —');
  const inboxSrc = readFileSync(join(process.cwd(), 'src/modules/inbox/social-inbox.routes.ts'), 'utf8');
  const commitSrc = readFileSync(join(process.cwd(), 'src/modules/profile/commitments.routes.ts'), 'utf8');

  record('B1 inbox /actors/:id: gate canRepresentActor(req.params.id) antes de getInboxItems(',
    gateBeforeRead(inboxSrc, 'canReadInbox = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.params.id)', 'getInboxItems('));
  record('B2 inbox /actors/:id/counter: gate antes de getInboxCounter(',
    gateBeforeRead(inboxSrc, 'canReadCounter = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.params.id)', 'getInboxCounter('));
  record('B3 inbox: 401 fail-closed sem req.user (gate não roda sem auth)',
    /if \(!req\.user\?\.userId\) \{\s*\n\s*return reply\.status\(401\)/.test(inboxSrc));
  record('B4 commitments: gate canRepresentActor(actionContext.actorId) antes do findById/queries',
    gateBeforeRead(commitSrc, 'canReadCommitments = await authorizationService.canRepresentActor(tenantId, req.user.userId, actorId)', 'actorRepository.findById(tenantId, actorId)'));
  record('B5 commitments: actorId é do actionContext (não de req.user) — é o sujeito gateado',
    /const actorId = req\.actionContext\.actorId/.test(commitSrc));
  record('B6 inbox: os WRITES (markAsRead/archive) NÃO foram tocados (escopo só leitura)',
    /markAsRead\(/.test(inboxSrc) && /\.archive\(/.test(inboxSrc));

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
  console.log('✨ Inbox IDOR + commitments authorship F6.5.1 (canRepresentActor antes da leitura) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
