/**
 * E2E F-LIFESTYLE-AUTHORSHIP-GATE (DECISION-0113 fatia 5.3 / LGPD)
 *
 * Lifestyle (`/profile/lifestyle`) escreve atributo SENSÍVEL + registra CONSENTIMENTO + audit, keyed em
 * `actionContext.actorId` spoofável. Antes: `resolveActorGuarded` existence-only + `performedByActorId`
 * defaultado para o subject (= actorId declarado) → forja de atributo sensível, consentimento e autoria.
 * Fix:
 *   (1) `resolveActorGuarded(tenantId, actorId, userId)` prova `canRepresentActor(userId, actorId)` ANTES
 *       de qualquer read/write/consent (uniforme → 403 sem vazar existência). Cobre a LEITURA sensível.
 *   (2) `performedByActorId` = actor REAL do `req.user` resolvido na borda (`findByUserId`); sem performer
 *       resolvível → 403 fail-closed. NUNCA `actionContext.actorId`; NUNCA o subject como fallback.
 *
 * Casos:
 *   ALLOW read: getLifestyle(tenant, devActor, devUserId) → ok (dev representa o próprio actor).
 *   BLOCK read: getLifestyle(tenant, devActor, STRANGER) → 403.
 *   BLOCK declare: declareAttribute(tenant, devActor, {...}, STRANGER, ...) → 403 ANTES de escrever/consentir.
 *   BLOCK retire: retireAttribute(tenant, devActor, key, STRANGER, ...) → 403.
 *   non-leak: actor inexistente → 403 (não 404).
 *   anti-forja: contagem de audit NÃO muda após um declare bloqueado (estranho) — sem consentimento forjado.
 *   estrutural: gate canRepresentActor antes da existência; performedBy real (findByUserId), sem `?? actorId`.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-lifestyle-authorship.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';
import { lifestyleService } from '../core/profile/lifestyle/lifestyle.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const INEXISTENT_ACTOR = '11111111-1111-4111-8111-111111111111';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function statusOf(e: unknown): number | undefined { return (e as { statusCode?: number }).statusCode; }

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

  async function blocked(fn: () => Promise<unknown>): Promise<boolean> {
    try { await fn(); return false; } catch (e) { return statusOf(e) === 403; }
  }
  async function allowed(fn: () => Promise<unknown>): Promise<boolean> {
    try { await fn(); return true; } catch (e) { console.log(`     (allow falhou status=${statusOf(e)})`); return false; }
  }
  async function auditCount(): Promise<number> {
    const r = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM actor_lifestyle_attribute_audit WHERE tenant_id=$1 AND actor_id=$2`,
      [TENANT_ID, devActor]
    );
    return Number(r.rows[0].n);
  }

  console.log('\n— leitura (gate canRepresentActor cobre o read sensível) —');
  record('ALLOW read: dev representa o próprio actor',
    await allowed(() => lifestyleService.getLifestyle(TENANT_ID, devActor, devUserId)));
  record('BLOCK read: estranho → 403',
    await blocked(() => lifestyleService.getLifestyle(TENANT_ID, devActor, STRANGER_USER_ID)));

  console.log('\n— escrita/consentimento (gate antes de qualquer mutação) —');
  const declareInput = {
    attributeKey: 'drinks' as const,
    attributeValue: 'never',
    consent: { granted: true as const, source: 'e2e', version: '1' },
  };
  const before = await auditCount();
  record('BLOCK declare: estranho → 403 (antes de escrever/consentir)',
    await blocked(() => lifestyleService.declareAttribute(
      TENANT_ID, devActor, declareInput, STRANGER_USER_ID, devActor /* performer ignorado: gate falha antes */)));
  record('BLOCK retire: estranho → 403',
    await blocked(() => lifestyleService.retireAttribute(
      TENANT_ID, devActor, 'drinks', STRANGER_USER_ID, devActor)));
  const after = await auditCount();
  record('anti-forja: audit NÃO cresce após declare bloqueado (sem consentimento forjado)',
    after === before, `antes=${before} depois=${after}`);

  console.log('\n— non-leak —');
  record('actor inexistente → 403 (uniforme, não 404)',
    await blocked(() => lifestyleService.getLifestyle(TENANT_ID, INEXISTENT_ACTOR, devUserId)));

  console.log('\n— estrutural —');
  const dir = join(process.cwd(), 'src/core/profile/lifestyle');
  const svc = readFileSync(join(dir, 'lifestyle.service.ts'), 'utf8');
  const rt = readFileSync(join(dir, 'lifestyle.routes.ts'), 'utf8');
  record('E service: resolveActorGuarded(tenantId, actorId, userId) chama canRepresentActor ANTES da existência',
    /resolveActorGuarded\(tenantId: string, actorId: string, userId: string\)/.test(svc)
    && /authorizationService\.canRepresentActor\(tenantId, userId, actorId\)/.test(svc));
  record('E service: performedByActorId é obrigatório (sem fallback `?? actorId`)',
    !/performedByActorId \?\? actorId/.test(svc) && /performedByActorId: string\b/.test(svc));
  record('E routes: requireContext threada userId; performer real via findByUserId (403 fail-closed)',
    /const userId = req\.user\?\.userId/.test(rt)
    && /findByUserId\(req\.tenant\.id, userId\)/.test(rt)
    && /Performer não resolvível/.test(rt));
  record('E routes: declare/retire passam userId + performerActorId (não o actionContext.actorId duplicado)',
    /resolvePerformerActorId\(req\)/.test(rt) && /userId,\s*\n\s*performedByActorId/.test(rt));

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
  console.log('✨ Lifestyle authorship gate (canRepresentActor + performedBy server-side + read private-by-authority) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
