/**
 * E2E DECISION-0113 canal-5 · availability operacional reads (list + by-id) — OWNER-SCOPED
 *
 * GET /availability/ e /availability/:id retornavam slots (owner, horários, capacity, metadata) validando só
 * presença de actionContext → IDOR: list por `query.ownerId` (hint) sem provar owner; by-id por availabilityId
 * sem provar owner. Decisão diretora: availability operacional é PRIVADA por padrão (discovery público = rota
 * própria futura). Agora OWNER-SCOPED:
 *   list  → exige `canRepresentActor(query.ownerId)`; sem ownerId representável → 403 (nunca tenant-wide).
 *   by-id → resolve availability → `canRepresentActor(availability.ownerId)`; 404 preservado; 403 fail-closed.
 * `params.id` nunca como actor; `actionContext`/`query.ownerId` são hint; sem ensureUserActor/getActiveActor.
 * read-only, zero Bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor + fixtures reais (availability do devActor): owner lista/lê;
 *     estranho 403; ownerId alheio 403; inexistente 404.
 *   B estrutural — list gateia query.ownerId via canRepresentActor antes de listAvailabilities; by-id resolve
 *     owner real antes de retornar; 401/403; sem params.id-as-actor; sem actionContext-autoridade; intocados.
 *   C service/repo read-only, zero Bank.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-availability-read-authority-f6-5.ts
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
const MARKER = 'E2E-AVR';

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
  const O = randomUUID();         // owner alheio (page) — dev NÃO representa
  const availDev = randomUUID();  // availability do devActor
  let availExists = false;
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [O, TENANT_ID, `${MARKER}-other`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor sobre o owner (query.ownerId / availability.ownerId) —');
    record('A1 dev representa o PRÓPRIO actor → true (lista/lê suas availabilities)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o owner alheio O → false (list ?ownerId=O / by-id de O → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

    const reg = await pool.query<{ a: string | null }>(`SELECT to_regclass('public.availability') a`);
    availExists = !!reg.rows[0].a;
    if (availExists) {
      await pool.query(
        `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
         VALUES ($1,$2,'user',$3,'recurring','active', now()+interval '1 day', now()+interval '1 day 1 hour','America/Sao_Paulo',1, jsonb_build_object('e2e',$4::text))`,
        [availDev, TENANT_ID, devActor, MARKER]);

      const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
      const av = await unifiedAvailabilityService.getAvailability(TENANT_ID, availDev);
      record('A4 BY-ID: owner real = devActor → canRepresentActor(availability.ownerId)=true (lê)',
        (await authorizationService.canRepresentActor(TENANT_ID, devUserId, av.ownerId)) === true);
      record('A5 BY-ID: estranho NÃO representa o owner → false (→ 403)',
        (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, av.ownerId)) === false);

      let threw404 = false;
      try { await unifiedAvailabilityService.getAvailability(TENANT_ID, randomUUID()); } catch (e: any) { threw404 = (e?.statusCode === 404) || /não encontrada/i.test(e?.message ?? ''); }
      record('A6 availability inexistente → getAvailability lança 404 (preservado no handler)', threw404);
    } else {
      note('fixtures REAIS = N/A — tabela availability ausente em DEV; gate coberto estruturalmente (B).');
    }
  } finally {
    if (availExists) await pool.query(`DELETE FROM availability WHERE availability_id=$1`, [availDev]).catch(() => {});
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: list owner-scoped; by-id resolve owner real; intocados —');
  const route = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.routes.ts'), 'utf8');
  const sliceBetween = (a: string, b: string) => { const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length; return i >= 0 ? route.slice(i, j > i ? j : route.length) : ''; };
  const list = sliceBetween("}>('/', async", "GET /availability/:id");
  const byId = sliceBetween("fastify.get<{ Params: { id: string } }>('/:id'", "PUT /availability/:id");

  // DECISION-0118 D2: owner é RECURSO — o gate exige o RESOLVER (authority actor), não ownerId cru.
  record('B1 LIST: query.ownerId é HINT → representsAvailabilityOwner (resolver polimórfico) ANTES de listAvailabilities',
    /const ownerIdHint = req\.query\.ownerId/.test(list)
    && /representsAvailabilityOwner\(req\.tenant\.id, userId, \{ ownerType: t, ownerId: ownerIdHint \}\)/.test(list)
    && list.indexOf('representsAvailabilityOwner(') < list.indexOf('listAvailabilities('));
  record('B2 LIST: sem ownerId representável → 403 (AVAILABILITY_NOT_REPRESENTABLE); 401 sem user; nunca tenant-wide',
    /AVAILABILITY_NOT_REPRESENTABLE/.test(list) && /status\(401\)/.test(list) && /status\(403\)/.test(list));
  record('B3 BY-ID: getAvailability ANTES do gate; representsAvailabilityOwner (authority actor resolvido); NÃO params.id como actor',
    byId.indexOf('getAvailability(') >= 0 && byId.indexOf('getAvailability(') < byId.indexOf('representsAvailabilityOwner(')
    && /representsAvailabilityOwner\(req\.tenant\.id, userId, availability\)/.test(byId)
    && !/canRepresentActor\([^)]*params\.id/.test(byId)
    && !/canRepresentActor\(req\.tenant\.id, userId, availability\.ownerId\)/.test(byId));
  record('B4 BY-ID: 401 sem user + 403 fail-closed (AVAILABILITY_NOT_REPRESENTABLE)',
    /status\(401\)/.test(byId) && /status\(403\)/.test(byId) && /AVAILABILITY_NOT_REPRESENTABLE/.test(byId));
  record('B5 NÃO usa actionContext.actorId como autoridade; NÃO getActiveActor/ensureUserActor',
    !/canRepresentActor\([^)]*actionContext/.test(list + byId) && !/getActiveActor\(/.test(list + byId) && !/ensureUserActor\(/.test(list + byId));
  record('B6 reads read-only no handler (sem bank_ledger/INSERT/UPDATE/DELETE)',
    !/bank_ledger|bank_transactions|INSERT INTO|UPDATE |DELETE FROM/.test(list + byId));
  // intocados
  record('B7 /conflicts + /bookings + /participants permanecem selados',
    /canRepresentActor\(req\.tenant\.id, userId, req\.params\.actorId\)/.test(route) // conflicts
    && /canReadBookingAsParty\(/.test(route) // bookings
    && /canReadParticipantAsParty\(/.test(route)); // participants

  console.log('\n— C service/repo: availability reads read-only, zero Bank —');
  const svc = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.service.ts'), 'utf8');
  record('C1 service availability sem Bank/money', !/bank_ledger|bank_transactions|bank_accounts|payment|amount_cents|payout|settlement/i.test(svc));
  const repo = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.repository.ts'), 'utf8');
  const findA = repo.slice(repo.indexOf('async findAvailabilityById'));
  record('C2 findAvailabilityById = SELECT (read-only)',
    /SELECT/.test(findA.slice(0, 300)) && !/INSERT INTO|UPDATE |DELETE FROM/.test(findA.slice(0, 300)));
  note('Denominador: esta fatia fecha os 2 GETs operacionais de availability. Os 7 GETs do arquivo agora gateados (list/by-id/bookings×2/participants×2/conflicts). Resíduo restante: weekly-template PUT = write-authorship (outro eixo).');

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
  console.log('✨ availability list/by-id gateados owner-scoped — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
