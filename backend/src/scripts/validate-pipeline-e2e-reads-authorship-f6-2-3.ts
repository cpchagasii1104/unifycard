/**
 * E2E F6.2 + F6.3 (DECISION-0113 fatia 6 — leitura cross-user: identity-config self + /me/* agregadores)
 *
 * F6.2 — `identity GET /identity/configurations` é SELF (userType PF/PJ do PRÓPRIO caller). Deixou de
 *   resolver o sujeito do `actionContext.actorId` declarado (espelha o PUT da fatia 5.1) → resolve de
 *   `req.user` (globalUserId ?? resolveGlobalUserId(req.user.userId)). Sem leitura cross-user de userType.
 * F6.3 — `/me/active-location` (geo), `/me/impact-overview`, `/me/pending-responsibilities` liam dado do
 *   actor declarado SEM gate → agora provam `canRepresentActor(req.tenant.id, req.user.userId,
 *   req.actionContext.actorId)` ANTES da leitura (fail-closed → 403 não-leak).
 *
 * Prova:
 *   A behavioral — o primitivo nega cross-user (dev→próprio=true; estranho→actor do dev=false).
 *   B estrutural F6.2 — GET /configurations resolve de req.user e NÃO via findById(actionContext.actorId).
 *   C estrutural F6.3 — gate canRepresentActor ANTES da leitura nos 3 handlers /me/*.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-reads-authorship-f6-2-3.ts
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

  console.log('\n— A behavioral: o gate (canRepresentActor) nega cross-user (F6.3) —');
  record('A1 dev representa o próprio actor → true',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o actor do dev → false',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B estrutural F6.2: GET /identity/configurations resolve de req.user (self), não do actor —');
  const identitySrc = readFileSync(join(process.cwd(), 'src/core/identity/identity.routes.ts'), 'utf8');
  const getStart = identitySrc.indexOf("fastify.get('/configurations'");
  const getEnd = identitySrc.indexOf('fastify.put', getStart);
  const getSlice = getStart >= 0 && getEnd > getStart ? identitySrc.slice(getStart, getEnd) : '';
  record('B1 GET /configurations resolve callerGlobalUserId de req.user (globalUserId ?? resolveGlobalUserId(req.user.userId))',
    /callerGlobalUserId = req\.user\.globalUserId \?\? await resolveGlobalUserId3\(req\.user\.userId/.test(getSlice));
  record('B2 GET /configurations NÃO resolve o sujeito via findById(actionContext.actorId)',
    getSlice.length > 0 && !/findById\(req\.tenant\.id, req\.actionContext\.actorId\)/.test(getSlice));

  console.log('\n— C estrutural F6.3: gate canRepresentActor ANTES da leitura nos 3 /me/* —');
  const locSrc = readFileSync(join(process.cwd(), 'src/core/location/me-active-location.routes.ts'), 'utf8');
  const impactSrc = readFileSync(join(process.cwd(), 'src/core/profile/impact-overview.routes.ts'), 'utf8');
  const pendingSrc = readFileSync(join(process.cwd(), 'src/core/profile/pending-responsibilities.routes.ts'), 'utf8');

  record('C1 /me/active-location: gate antes de actorActiveLocationRepository.getActive(',
    gateBeforeRead(locSrc, 'canReadActiveLocation = await authorizationService.canRepresentActor', 'actorActiveLocationRepository.getActive('));
  record('C2 /me/impact-overview: gate antes de actorRepository.findById(',
    gateBeforeRead(impactSrc, 'canReadImpact = await authorizationService.canRepresentActor', 'actorRepository.findById(tenantId, actorId)'));
  record('C3 /me/pending-responsibilities: gate antes de actorRepository.findById(',
    gateBeforeRead(pendingSrc, 'canReadPending = await authorizationService.canRepresentActor', 'actorRepository.findById(tenantId, actorId)'));
  record('C4 assinatura canônica canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId) nos 3',
    /canRepresentActor\(req\.tenant\.id, req\.user\.userId, req\.actionContext\.actorId\)/.test(locSrc)
    && /canRepresentActor\(req\.tenant\.id, req\.user\.userId, req\.actionContext\.actorId\)/.test(impactSrc)
    && /canRepresentActor\(req\.tenant\.id, req\.user\.userId, req\.actionContext\.actorId\)/.test(pendingSrc));

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
  console.log('✨ Reads authorship F6.2 (config self) + F6.3 (/me/* canRepresentActor) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
