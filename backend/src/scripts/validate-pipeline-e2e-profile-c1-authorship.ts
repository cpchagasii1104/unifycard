/**
 * E2E F-PROFILE-C1-AUTHORSHIP-GATE (DECISION-0113 fatia 5.2)
 *
 * Profile-C1 (professional/learning/interest) escreve/lê autodeclarações keyed em `actionContext.actorId`.
 * Antes, o `resolveActorGuarded` era existence-only → qualquer um escrevia/lia C1 de OUTRO actor.
 * Fix: `resolveActorGuarded(tenantId, actorId, userId)` prova `canRepresentActor(userId, actorId)` ANTES
 * de read/write (uniforme → 403 sem vazar existência). `userId` threadado das rotas via `requireContext`.
 *
 * Casos (por módulo professional/learning/interest):
 *   ALLOW read: get*(tenant, devActor, devUserId) → ok (dev representa o próprio actor).
 *   BLOCK read: get*(tenant, devActor, STRANGER) → 403 (principal estranho não representa).
 *   BLOCK mutation: declareConcept(tenant, devActor, {...}, STRANGER) → 403 ANTES do repo (sem escrita).
 *   Estrutural: resolveActorGuarded chama canRepresentActor; requireContext threada userId de req.user.
 *
 * Base: tenant DEV + PF canônica. Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-profile-c1-authorship.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { learningC1Service } from '../core/profile/learning-c1/learning-c1.service';
import { interestC1Service } from '../core/profile/interest-c1/interest-c1.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const RAND_CONCEPT = '00000000-0000-4000-8000-0000000000c1';

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
    try { await fn(); return true; } catch (e) { return `falhou status=${statusOf(e)}` === ''; }
  }

  try {
    console.log('\n— professional —');
    record('P ALLOW read: dev representa o próprio actor',
      await allowed(() => professionalC1Service.getProfessionalC1(TENANT_ID, devActor, devUserId)));
    record('P BLOCK read: estranho → 403',
      await blocked(() => professionalC1Service.getProfessionalC1(TENANT_ID, devActor, STRANGER_USER_ID)));
    record('P BLOCK mutation (declareConcept estranho) → 403 antes do repo',
      await blocked(() => professionalC1Service.declareConcept(TENANT_ID, devActor, { conceptId: RAND_CONCEPT, skillLevel: 3 }, STRANGER_USER_ID)));

    console.log('\n— learning —');
    record('L ALLOW read', await allowed(() => learningC1Service.getLearningC1(TENANT_ID, devActor, devUserId)));
    record('L BLOCK read: estranho → 403',
      await blocked(() => learningC1Service.getLearningC1(TENANT_ID, devActor, STRANGER_USER_ID)));
    record('L BLOCK mutation → 403',
      await blocked(() => learningC1Service.declareConcept(TENANT_ID, devActor, { conceptId: RAND_CONCEPT }, STRANGER_USER_ID)));

    console.log('\n— interest —');
    record('I ALLOW read', await allowed(() => interestC1Service.getInterestC1(TENANT_ID, devActor, devUserId)));
    record('I BLOCK read: estranho → 403',
      await blocked(() => interestC1Service.getInterestC1(TENANT_ID, devActor, STRANGER_USER_ID)));
    record('I BLOCK mutation → 403',
      await blocked(() => interestC1Service.declareConcept(TENANT_ID, devActor, { conceptId: RAND_CONCEPT }, STRANGER_USER_ID)));

    console.log('\n— estrutural —');
    const dir = (m: string) => join(process.cwd(), `src/core/profile/${m}`);
    for (const m of ['professional-c1', 'learning-c1', 'interest-c1']) {
      const svc = readFileSync(join(dir(m), `${m}.service.ts`), 'utf8');
      const rt = readFileSync(join(dir(m), `${m}.routes.ts`), 'utf8');
      record(`E ${m}: resolveActorGuarded(tenantId, actorId, userId) chama canRepresentActor`,
        /resolveActorGuarded\(tenantId: string, actorId: string, userId: string\)/.test(svc)
        && /authorizationService\.canRepresentActor\(tenantId, userId, actorId\)/.test(svc));
      record(`E ${m}: requireContext threada userId de req.user`,
        /const userId = req\.user\?\.userId/.test(rt) && /actorId: req\.actionContext\.actorId, userId/.test(rt));
    }

    // não-leak: actor inexistente → 403 (não 404)
    record('non-leak: actor inexistente → 403 (uniforme, não 404)',
      await blocked(() => professionalC1Service.getProfessionalC1(TENANT_ID, '11111111-1111-4111-8111-111111111111', devUserId)));
  } finally {
    // leitura-only + mutações bloqueadas → nada a limpar (gate 403 antes de qualquer escrita).
    console.log('\n— cleanup — (sem escrita: allow=read; block=403 antes do repo)');
  }

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
  console.log('✨ Profile-C1 authorship gate (canRepresentActor no resolveActorGuarded) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
