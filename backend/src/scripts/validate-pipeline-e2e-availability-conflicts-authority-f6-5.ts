/**
 * E2E DECISION-0113 canal-5 (params) · availability conflicts actorId gate
 *
 * GET /availability/:availabilityId/participants/:actorId/conflicts retornava os conflitos/slots de agenda
 * (PII operacional) do actor declarado em `req.params.actorId` validando só presença de actionContext/tenant —
 * IDOR: qualquer caller lia a agenda alheia por params. Agora gateia canRepresentActor(tenantId, req.user.userId,
 * req.params.actorId) ANTES de detectConflicts; 401 sem user; 403 não-representável (fail-closed). O gate bate no
 * MESMO actorId que dirige a leitura, não no actor do caller. detectConflicts é read-only, zero Bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor decide (próprio=true / alheio=false / estranho=false).
 *   B estrutural — gate sobre req.params.actorId ANTES de detectConflicts; 401/403; catch fail-closed; sem
 *     getActiveActor/ensureUserActor; denominador do arquivo declarado (7 GETs — esta fatia fecha 1 rota).
 *   C service — detectConflicts read-only, zero Bank/write.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-availability-conflicts-authority-f6-5.ts
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
const MARKER = 'E2E-AVCONF';

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
    console.log('\n— A behavioral REAL: canRepresentActor sobre o req.params.actorId (sujeito da leitura) —');
    record('A1 dev representa o PRÓPRIO actor → true (conflitos da própria agenda passam)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o actor O → false (conflitos de agenda alheia → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
  } finally {
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: gate sobre params.actorId ANTES de detectConflicts —');
  const route = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.routes.ts'), 'utf8');
  const getCount = (route.match(/fastify\.get/g) || []).length;
  record('B0 denominador: 7 GETs no arquivo; esta fatia fecha SÓ a rota /conflicts', getCount === 7, `#GET=${getCount}`);

  const cStart = route.indexOf("'/:availabilityId/participants/:actorId/conflicts'");
  const conf = cStart >= 0 ? route.slice(cStart, route.indexOf('fastify.', cStart + 50) > cStart ? route.indexOf('fastify.', cStart + 50) : route.length) : '';
  record('B1 gate canRepresentActor sobre req.params.actorId (sujeito da leitura), NÃO o actor do caller',
    /canRepresentActor\(req\.tenant\.id, userId, req\.params\.actorId\)/.test(conf));
  record('B2 gate roda ANTES de detectConflicts',
    conf.indexOf('canRepresentActor(') >= 0 && conf.indexOf('canRepresentActor(') < conf.indexOf('detectConflicts('));
  record('B3 401 sem user + 403 não-representável (AVAILABILITY_CONFLICTS_ACTOR_NOT_REPRESENTABLE)',
    /status\(401\)/.test(conf) && /status\(403\)/.test(conf) && /AVAILABILITY_CONFLICTS_ACTOR_NOT_REPRESENTABLE/.test(conf));
  record('B4 catch fail-closed (canRep=false em erro do primitivo)',
    /catch \{\s*canRep = false;/.test(conf));
  record('B5 usa .user?.userId (idioma do arquivo); NÃO getActiveActor/ensureUserActor (sem side-effect em GET)',
    /\.user\?\.userId/.test(conf) && !/getActiveActor\(/.test(conf) && !/ensureUserActor\(/.test(conf));
  record('B6 conflicts read-only no handler (sem bank_ledger/INSERT/UPDATE/DELETE)',
    !/bank_ledger|bank_transactions|INSERT INTO|UPDATE |DELETE FROM/.test(conf));

  console.log('\n— C service/repo: detectConflicts read-only —');
  const svc = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.service.ts'), 'utf8');
  const repo = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.repository.ts'), 'utf8');
  const repoConf = repo.slice(repo.indexOf('async detectConflicts'));
  const repoConfBlock = repoConf.slice(0, repoConf.indexOf('async ', 10) > 0 ? repoConf.indexOf('async ', 10) : 1200);
  record('C1 detectConflicts (service) read-only — sem Bank/escrita',
    /detectConflicts/.test(svc) && !/bank_ledger|INSERT INTO|UPDATE availability|DELETE FROM availability/.test(svc));
  record('C2 detectConflicts (repo) = SELECT detect_availability_conflicts; sem INSERT/UPDATE/DELETE/Bank',
    /SELECT \* FROM detect_availability_conflicts/.test(repoConfBlock)
    && !/INSERT INTO|UPDATE |DELETE FROM|bank_ledger/.test(repoConfBlock));
  note('Denominador: 7 GETs no arquivo. Esta fatia fecha SÓ /:availabilityId/participants/:actorId/conflicts (o A vivo classificado). Os outros 6 GETs (availability list/by-id, bookings, participants) NÃO foram tocados — resíduo do mesmo eixo agenda, fora deste escopo, registrado honestamente.');

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
  console.log('✨ availability conflicts gateado (canRepresentActor sobre req.params.actorId, antes de detectConflicts) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
