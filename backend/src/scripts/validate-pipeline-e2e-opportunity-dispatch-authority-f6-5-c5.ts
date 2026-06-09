/**
 * E2E DECISION-0113 canal-5 (params) · opportunity-dispatch actor param gate
 *
 * GET /actors/:id/dispatches usava req.params.id como targetActorId sem provar autoridade → IDOR (qualquer
 * autenticado listava dispatches/procurement de qualquer actor). Agora gateia canRepresentActor(req.tenant.id,
 * req.user.userId, req.params.id) ANTES de listDispatches; 401 sem user; 403 não-representável. listDispatches
 * é read-only (repository.find), sem Bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor nega cross-actor (dev representa o próprio; estranho não; alheio não).
 *   B estrutural — gate sobre o req.params.id ANTES de listDispatches; 401/403; NÃO actor do caller; writes intocados.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-opportunity-dispatch-authority-f6-5-c5.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const MARKER = 'E2E-DISP';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

async function main(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const dev = await pool.query<{ id: string }>(`SELECT id::text AS id FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ id: string }>(`SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`, [TENANT_ID, devUserId]);
  const devActor = devActorRow.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  await pool.query(`DELETE FROM actors WHERE tenant_id=$1 AND display_name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  const O = randomUUID(); // page-actor alvo que o dev NÃO representa
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`,
      [O, TENANT_ID, `${MARKER}-target`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor sobre o actor ALVO (req.params.id) —');
    record('A1 dev representa o PRÓPRIO actor → true (lista os próprios dispatches)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o actor alvo O → false (dispatches alheios → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
  } finally {
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural —');
  const route = readFileSync(join(process.cwd(), 'src/modules/dispatch/opportunity-dispatch.routes.ts'), 'utf8');
  const getBlock = route.slice(route.indexOf("'/actors/:id/dispatches'"), route.indexOf("/:dispatchId/respond"));
  record('B1 gate canRepresentActor(... req.params.id) ANTES de listDispatches',
    getBlock.indexOf('canRepresentActor(req.tenant.id, req.user.userId, req.params.id)') >= 0
    && getBlock.indexOf('canRepresentActor(') < getBlock.indexOf('listDispatches('));
  record('B2 403 fail-closed não-representável + 401 sem user', /status\(403\)/.test(getBlock) && /Authentication required/.test(getBlock));
  record('B3 gate usa req.params.id (actor alvo), NÃO actor do caller/getActiveActor',
    /canRepresentActor\(req\.tenant\.id, req\.user\.userId, req\.params\.id\)/.test(route) && !/getActiveActor\(/.test(route));
  record('B4 writes (POST opportunities/:id, /:dispatchId/respond) NÃO ganharam canRepresentActor (intocados)',
    (route.match(/canRepresentActor\(/g) || []).length === 1);
  record('B5 service NÃO toca Bank (listDispatches → repository.find, read-only)',
    !/bank_ledger|bank_transactions|INSERT INTO|UPDATE /.test(getBlock));

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
  console.log('✨ opportunity-dispatch /actors/:id/dispatches gateado (canRepresentActor sobre o param; 401/403) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
