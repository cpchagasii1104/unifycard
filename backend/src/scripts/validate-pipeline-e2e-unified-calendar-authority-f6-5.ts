/**
 * E2E DECISION-0113 canal 3 (query) · unified-calendar actorId gate
 *
 * GET /unified-calendar?actorId retornava a agenda (availability + eventos = PII operacional) de QUALQUER
 * actor declarado na query (só req.tenant, sem req.user, sem gate). Agora, quando `actorId` é fornecido,
 * gateia canRepresentActor(tenantId, req.user.id, query.actorId) ANTES de getUnifiedCalendar; 401 sem user;
 * 403 não-representável. SEM actorId: comportamento atual preservado (read-model do tenant). read-only, sem Bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor nega cross-actor (dev próprio=true / alheio O=false / estranho=false).
 *   B estrutural — gate sobre query.actorId ANTES de getUnifiedCalendar; 401/403; path sem actorId preservado.
 *   C denominador — 1 único GET no arquivo, gateado; service read-only (sem Bank/escrita).
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-unified-calendar-authority-f6-5.ts
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
const MARKER = 'E2E-UCAL';

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
    console.log('\n— A behavioral REAL: canRepresentActor sobre o query.actorId —');
    record('A1 dev representa o PRÓPRIO actor → true (agenda própria passa)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o actor O → false (agenda alheia → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
  } finally {
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: GET /unified-calendar gateado quando há actorId —');
  const route = readFileSync(join(process.cwd(), 'src/core/calendar/unified-calendar.routes.ts'), 'utf8');
  const getCount = (route.match(/fastify\.get/g) || []).length;
  record('B0 denominador: 1 único GET no arquivo', getCount === 1, `#GET=${getCount}`);
  record('B1 gate canRepresentActor(tenantId, userId, query.actorId) ANTES de getUnifiedCalendar',
    /canRepresentActor\(tenantId, userId, query\.actorId\)/.test(route)
    && route.indexOf('canRepresentActor(') < route.indexOf('getUnifiedCalendar('));
  record('B2 gate só dispara quando há actorId (if (query.actorId) envolve o canRepresentActor)',
    route.indexOf('if (query.actorId) {') >= 0
    && route.indexOf('if (query.actorId) {') < route.indexOf('canRepresentActor('));
  record('B3 403 não-representável + 401 sem user',
    /status\(403\)/.test(route) && /status\(401\)/.test(route));
  record('B4 path SEM actorId preservado (filtros montados após o gate, sem exigir actorId)',
    /if \(query\.actorId\) filters\.actorId = query\.actorId/.test(route));
  record('B5 import do authorizationService presente',
    /from '@core\/authorization\/authorization\.service'/.test(route));

  console.log('\n— C service read-only: sem Bank, sem escrita —');
  const svc = readFileSync(join(process.cwd(), 'src/core/calendar/unified-calendar.service.ts'), 'utf8');
  record('C1 service read-only (sem bank_ledger/bank_transactions/INSERT/UPDATE/DELETE)',
    !/bank_ledger|bank_transactions|INSERT INTO|UPDATE |DELETE FROM/.test(svc));
  note('Denominador do arquivo FECHADO: 1 GET, gateado. Path sem actorId = read-model do tenant (fora do escopo desta fatia, reportado como resíduo).');

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
  console.log('✨ unified-calendar?actorId gateado (canRepresentActor sobre query.actorId); 1 GET fechado — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
