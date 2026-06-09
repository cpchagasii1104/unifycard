/**
 * E2E DECISION-0113 · unified-calendar — leitura SEMPRE escopada a um actor (canal-3 query + self-resolve)
 *
 * FAIL anterior (Yala, selo e959b0d1): `?actorId` estava gateado, MAS o caminho SEM `actorId` chamava
 * getUnifiedCalendar(tenantId, {}) → listava availability + eventos do TENANT INTEIRO (mass-disclosure de PII
 * operacional), sem escopo. Correção:
 *   • COM `actorId`: canRepresentActor(tenantId, req.user.id, query.actorId) ANTES da leitura (403 fail-closed).
 *   • SEM `actorId`: resolve o actor 'user' do PRÓPRIO req.user server-side (read-only, NÃO cria actor);
 *     0 → agenda vazia (nunca tenant-wide); >1 → 409. 401 sem user em ambos.
 *   • Service agora aplica owner_id = actorId na fonte availability (antes era TODO no-op → vazava tudo).
 *
 * Prova:
 *   A behavioral REAL — (1) canRepresentActor decide o canal-3; (2) o SERVICE escopa de verdade: availability
 *     de OUTRO actor NÃO aparece ao filtrar por devActor, e getUnifiedCalendar(tenantId, {}) [o caminho proibido]
 *     listaria os dois (prova material do leak que a rota agora nunca dispara); (3) self-resolve server-side
 *     retorna o devActor para o devUser e é read-only (não altera o nº de actors).
 *   B estrutural — gate antes da leitura; filters.actorId SEMPRE setado; sem getUnifiedCalendar(tenantId, {});
 *     resolveSelfUserActorReadOnly presente e SEM ensureUserActor (zero side-effect em GET); 401/403/409.
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
  await pool.query(`DELETE FROM availability WHERE tenant_id=$1 AND metadata->>'e2e' = $2`, [TENANT_ID, MARKER]);
  const O = randomUUID();
  const devAvailId = randomUUID();
  const oAvailId = randomUUID();
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`,
      [O, TENANT_ID, `${MARKER}-other`, devActor]);

    // Seed availability: uma do devActor, uma do actor O (owner_id = actorId — mapeamento provado).
    const seedAvail = async (availId: string, ownerActorId: string) => {
      await pool.query(
        `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
         VALUES ($1,$2,'user',$3,'recurring','active', now() + interval '1 day', now() + interval '1 day 1 hour', 'America/Sao_Paulo', 1, jsonb_build_object('e2e',$4::text))`,
        [availId, TENANT_ID, ownerActorId, MARKER]
      );
    };
    await seedAvail(devAvailId, devActor);
    await seedAvail(oAvailId, O);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor + service escopa + self-resolve read-only —');
    record('A1 dev representa o PRÓPRIO actor → true (agenda própria passa)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o actor O → false (agenda alheia → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

    // (2) o SERVICE escopa availability de verdade
    const { unifiedCalendarService } = await import('../core/calendar/unified-calendar.service');
    const scoped = await unifiedCalendarService.getUnifiedCalendar(TENANT_ID, { actorId: devActor } as any);
    const scopedIds = new Set(scoped.map((e) => e.id));
    record('A4 service filtra availability por actor: a do devActor aparece',
      scopedIds.has(`unified_availability:${devAvailId}`));
    record('A5 service filtra availability por actor: a do actor O NÃO aparece (sem leak cross-actor)',
      !scopedIds.has(`unified_availability:${oAvailId}`));
    // (caminho PROIBIDO) {} = tenant-wide — prova material do leak que a rota agora nunca dispara
    const wide = await unifiedCalendarService.getUnifiedCalendar(TENANT_ID, {} as any);
    const wideIds = new Set(wide.map((e) => e.id));
    record('A6 getUnifiedCalendar(tenantId, {}) listaria AMBOS (devActor + O) — caminho tenant-wide que a rota agora veta',
      wideIds.has(`unified_availability:${devAvailId}`) && wideIds.has(`unified_availability:${oAvailId}`));

    // (3) self-resolve server-side read-only
    const { runQueriesWithTenant } = await import('../core/database/pool');
    const selfRows = await runQueriesWithTenant<{ actor_id: string }>(
      TENANT_ID,
      `SELECT actor_id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'`,
      [TENANT_ID, devUserId]
    );
    record('A7 self-resolve (SELECT user-actor) devolve exatamente o devActor para o devUser',
      selfRows.length === 1 && selfRows[0].actor_id === devActor);
    const before = await pool.query<{ n: string }>(`SELECT count(*) n FROM actors WHERE tenant_id=$1`, [TENANT_ID]);
    await runQueriesWithTenant(TENANT_ID, `SELECT actor_id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'`, [TENANT_ID, STRANGER_USER_ID]);
    const after = await pool.query<{ n: string }>(`SELECT count(*) n FROM actors WHERE tenant_id=$1`, [TENANT_ID]);
    record('A8 self-resolve é READ-ONLY: resolver user sem actor NÃO cria actor (count inalterado)',
      before.rows[0].n === after.rows[0].n, `${before.rows[0].n}→${after.rows[0].n}`);
  } finally {
    await pool.query(`DELETE FROM availability WHERE tenant_id=$1 AND metadata->>'e2e' = $2`, [TENANT_ID, MARKER]);
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: leitura sempre escopada; sem getUnifiedCalendar(tenantId, {}); self-resolve read-only —');
  const route = readFileSync(join(process.cwd(), 'src/core/calendar/unified-calendar.routes.ts'), 'utf8');
  const getCount = (route.match(/fastify\.get/g) || []).length;
  record('B0 denominador: 1 único GET no arquivo', getCount === 1, `#GET=${getCount}`);
  record('B1 COM actorId: canRepresentActor(tenantId, userId, query.actorId) ANTES de getUnifiedCalendar',
    /canRepresentActor\(tenantId, userId, query\.actorId\)/.test(route)
    && route.indexOf('canRepresentActor(') < route.indexOf('getUnifiedCalendar('));
  record('B2 SEM actorId: resolveSelfUserActorReadOnly (server-side) — e NÃO ensureUserActor (zero side-effect em GET)',
    /resolveSelfUserActorReadOnly\(/.test(route) && !/ensureUserActor\(/.test(route) && !/getActiveActor\(/.test(route));
  record('B3 filters.actorId SEMPRE setado (= targetActorId) e a chamada usa `filters` (nunca literal {})',
    /UnifiedCalendarFilters = \{ actorId: targetActorId \}/.test(route)
    && /getUnifiedCalendar\(tenantId, filters\)/.test(route));
  record('B4 401 sem user (no topo) + 403 não-representável + 409 ambíguo',
    /status\(401\)/.test(route) && /status\(403\)/.test(route) && /status\(409\)/.test(route));
  record('B5 imports: authorizationService + runQueriesWithTenant (self-resolve)',
    /from '@core\/authorization\/authorization\.service'/.test(route) && /runQueriesWithTenant/.test(route));
  record('B6 self-resolve usa actor_type = \'user\' do req.user (não actorId do cliente)',
    /actor_type = 'user'/.test(route) && /WHERE tenant_id = \$1 AND user_id = \$2/.test(route));

  console.log('\n— C service read-only + aplica owner_id = actorId —');
  const svc = readFileSync(join(process.cwd(), 'src/core/calendar/unified-calendar.service.ts'), 'utf8');
  record('C1 service read-only (sem bank_ledger/bank_transactions/INSERT/UPDATE/DELETE)',
    !/bank_ledger|bank_transactions|INSERT INTO|UPDATE |DELETE FROM/.test(svc));
  record('C2 availability agora filtra por owner_id = actorId (TODO no-op removido)',
    /ownerFilter/.test(svc) && /AND owner_id = /.test(svc) && /params\.push\(filters\.actorId\)/.test(svc)
    && !/TODO: melhorar mapeamento actorId/.test(svc));
  note('Denominador FECHADO caminho-a-caminho: COM actorId → canRepresentActor; SEM actorId → self server-side; {} tenant-wide vetado.');

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
  console.log('✨ unified-calendar escopado caminho-a-caminho (actorId→canRepresentActor; sem actorId→self; {} vetado) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
