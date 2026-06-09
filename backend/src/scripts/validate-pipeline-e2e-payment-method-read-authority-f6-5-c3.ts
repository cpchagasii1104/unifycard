/**
 * E2E DECISION-0113 · payment-method READS (arquivo inteiro: list + by-id + default)
 *
 * Default já estava gateado (5c3e1108). Esta fatia fecha os outros 2 reads do MESMO arquivo (mesma PII):
 *   GET /payment-methods?actorId   → com actorId: canRepresentActor(query.actorId); SEM actorId (lista cross-actor
 *                                     do tenant): financial:view_all_ledger (admin) ou fail-closed.
 *   GET /payment-methods/:id       → :id é paymentMethodId (recurso), NÃO actor → resolve method.actorId (owner) e
 *                                     canRepresentActor(owner). 404 inexistente.
 * Read-only, sem Bank. POST /payment-methods (F3.1) intacto.
 *
 * Prova:
 *   A behavioral — canRepresentActor (primitivo) decide; financial:view_all_ledger nega o usuário comum (list cross-actor).
 *   B estrutural — denominador do arquivo (3 GETs TODOS gateados); by-id usa method.actorId; default/POST intactos.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-payment-method-read-authority-f6-5-c3.ts
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
const MARKER = 'E2E-PMR';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }

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
  const O = randomUUID();
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`,
      [O, TENANT_ID, `${MARKER}-other`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    const { businessAuthorizationService } = await import('../core/authorization/business-authorization.service');
    const { getActiveActor } = await import('../core/actors/actor.helpers');

    console.log('\n— A behavioral REAL: primitivos que os gates usam —');
    record('A1 dev representa o PRÓPRIO actor → true (list?actorId / by-id do próprio passam)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa O → false (list?actorId=O / by-id de O alheio → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
    // list SEM actorId → admin financeiro
    const callerActor = await getActiveActor(TENANT_ID, devUserId);
    let adminDenied = false;
    try {
      if (callerActor) await businessAuthorizationService.requirePermission(TENANT_ID, devUserId, callerActor.actor_id, 'financial:view_all_ledger', 'payment_method_list');
      else adminDenied = true;
    } catch { adminDenied = true; }
    record('A4 list SEM actorId: dev (comum) NÃO tem financial:view_all_ledger → 403 (sem disclosure em massa)', adminDenied);
    note('admin-pass (caller COM view_all_ledger) = N/A — DEV sem fixture admin com a permissão.');
  } finally {
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: denominador do arquivo (3 GETs) TODOS gateados —');
  const route = readFileSync(join(process.cwd(), 'src/modules/marketplace/payment-method.routes.ts'), 'utf8');
  const getCount = (route.match(/fastify\.get/g) || []).length;
  record('B1 denominador: 3 GETs (list · /:id · /default)', getCount === 3, `#GET=${getCount}`);

  const slice = (a: string, b: string) => { const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length; return i >= 0 ? route.slice(i, j > i ? j : route.length) : ''; };
  const listBlock = slice("fastify.get('/payment-methods',", "'/payment-methods/:id'");
  const byIdBlock = slice("'/payment-methods/:id'", "'/payment-methods/default'");
  const defBlock = slice("'/payment-methods/default'", "");

  record('B2 list ?actorId → canRepresentActor(query.actorId); SEM actorId → financial:view_all_ledger; ANTES de listMethods',
    /canRepresentActor\(tenantId, userId, query\.actorId\)/.test(listBlock)
    && /'financial:view_all_ledger', 'payment_method_list'/.test(listBlock)
    && listBlock.indexOf('canRepresentActor(') < listBlock.indexOf('listMethods('));
  record('B3 by-id resolve OWNER real (method.actorId) → canRepresentActor; NÃO params.id como actor',
    /canRepresentActor\(tenantId, userId, method\.actorId\)/.test(byIdBlock)
    && byIdBlock.indexOf('getMethodById(') < byIdBlock.indexOf('canRepresentActor(')
    && !/canRepresentActor\([^)]*params\.id/.test(byIdBlock));
  record('B4 by-id: 404 inexistente + 403 não-representável + 401 sem user',
    /Método não encontrado/.test(byIdBlock) && /status\(403\)/.test(byIdBlock) && /status\(401\)/.test(byIdBlock));
  record('B5 default continua gateado (canRepresentActor query.actorId) — 5c3e1108 preservado',
    /canRepresentActor\(tenantId, userId, actorId\)/.test(defBlock));
  record('B6 POST /payment-methods (F3.1) intacto (canRepresentActor ownerActorId do body)',
    /canRepresentActor\(tenantId, userId, ownerActorId\)/.test(route));
  record('B7 NENHUM GET de payment-method nu (cada GET tem canRepresentActor ou financial:view_all_ledger)',
    [listBlock, byIdBlock, defBlock].every(b => /canRepresentActor\(|financial:view_all_ledger/.test(b)));
  record('B8 reads read-only (sem bank_ledger/INSERT/UPDATE nos blocos GET)',
    [listBlock, byIdBlock, defBlock].every(b => !/bank_ledger|bank_transactions|INSERT INTO|UPDATE /.test(b)));

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
  console.log('✨ payment-method READS fechados (list/by-id/default; nenhum GET nu; default+POST intactos) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
