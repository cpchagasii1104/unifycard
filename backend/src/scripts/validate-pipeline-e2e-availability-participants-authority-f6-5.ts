/**
 * E2E DECISION-0113 canal-5 · availability participants reads (list + by-id) — OWNER-OR-SELF
 *
 * GET /availability/:availabilityId/participants e /participants/:id retornavam os participantes (actorId,
 * role = PII relacional) validando só presença de actionContext → IDOR: qualquer caller lia participantes
 * alheios. Decisão diretora: participants é PRIVADO por padrão (não vira vitrine social por acidente).
 *   list  → OWNER-ONLY: resolve a availability (params.availabilityId) e exige representar o DONO real antes de listar.
 *   by-id → OWNER-OR-SELF: representar o próprio participant.actorId OU o dono da availability associada.
 * `params.id` (participantId) nunca como actor; actionContext não é autoridade; sem ensureUserActor/getActiveActor.
 * read-only, zero Bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor + fixtures reais (availability do devActor + participantes R/self):
 *     owner lê; self lê o próprio; estranho 403; participante inexistente 404.
 *   B estrutural — list owner-only (getAvailability antes de listParticipants); by-id owner-or-self
 *     (getParticipant antes do gate, canReadParticipantAsParty); 401/403; sem params.id-as-actor; intocados.
 *   C service/repo — getParticipant/listParticipants/getAvailability read-only, zero Bank.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-availability-participants-authority-f6-5.ts
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
const MARKER = 'E2E-PART';

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
  const R = randomUUID();           // participante alheio (page) — dev NÃO representa
  const availId = randomUUID();     // availability cujo dono é devActor
  const partR = randomUUID();       // participant cujo actor é R (alheio)
  const partSelf = randomUUID();    // participant cujo actor é devActor (self)
  let tablesExist = false;
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [R, TENANT_ID, `${MARKER}-other`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor (owner / self / estranho) —');
    record('A1 dev representa o PRÓPRIO actor → true (owner da availability OU self participante)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o actor R alheio → false',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, R)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

    const reg = await pool.query<{ a: string | null; p: string | null }>(`SELECT to_regclass('public.availability') a, to_regclass('public.availability_participants') p`);
    tablesExist = !!reg.rows[0].a && !!reg.rows[0].p;
    if (tablesExist) {
      await pool.query(
        `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
         VALUES ($1,$2,'user',$3,'recurring','active', now()+interval '1 day', now()+interval '1 day 1 hour','America/Sao_Paulo',1, jsonb_build_object('e2e',$4::text))`,
        [availId, TENANT_ID, devActor, MARKER]);
      await pool.query(
        `INSERT INTO availability_participants (participant_id, tenant_id, availability_id, actor_id, role, metadata, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'participante','{}'::jsonb, now(), now())`, [partR, TENANT_ID, availId, R]);
      await pool.query(
        `INSERT INTO availability_participants (participant_id, tenant_id, availability_id, actor_id, role, metadata, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'participante','{}'::jsonb, now(), now())`, [partSelf, TENANT_ID, availId, devActor]);

      const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
      // replica a decisão dos gates de 1ª mão com os dados reais.
      const av = await unifiedAvailabilityService.getAvailability(TENANT_ID, availId);
      const ownerRep = await authorizationService.canRepresentActor(TENANT_ID, devUserId, av.ownerId);
      record('A4 LIST owner-only: dev é DONO da availability → canRepresentActor(owner)=true (lista participantes)',
        ownerRep === true);

      const pR = await unifiedAvailabilityService.getParticipant(TENANT_ID, partR);
      const ownerOnPR = await authorizationService.canRepresentActor(TENANT_ID, devUserId, (await unifiedAvailabilityService.getAvailability(TENANT_ID, pR.availabilityId)).ownerId);
      const selfOnPR = await authorizationService.canRepresentActor(TENANT_ID, devUserId, pR.actorId);
      record('A5 BY-ID participante R (alheio): dev autoriza via OWNER (true), NÃO via self (false) → owner-or-self correto',
        ownerOnPR === true && selfOnPR === false);

      const pSelf = await unifiedAvailabilityService.getParticipant(TENANT_ID, partSelf);
      const selfOnPSelf = await authorizationService.canRepresentActor(TENANT_ID, devUserId, pSelf.actorId);
      record('A6 BY-ID participante self (actor=devActor): dev autoriza via SELF (true)',
        selfOnPSelf === true);

      // estranho não autoriza nem via owner nem via self
      const strOwner = await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, av.ownerId);
      const strSelf = await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, pR.actorId);
      record('A7 estranho NÃO autoriza por owner nem self → 403', strOwner === false && strSelf === false);

      // 404: participante inexistente
      let threw404 = false;
      try { await unifiedAvailabilityService.getParticipant(TENANT_ID, randomUUID()); } catch (e: any) { threw404 = (e?.statusCode === 404) || /não encontrado/i.test(e?.message ?? ''); }
      record('A8 participante inexistente → getParticipant lança 404 (preservado no handler)', threw404);
    } else {
      note('fixtures REAIS = N/A — tabela availability/availability_participants ausente em DEV; helper coberto estruturalmente (B).');
    }
  } finally {
    if (tablesExist) {
      await pool.query(`DELETE FROM availability_participants WHERE participant_id = ANY($1::uuid[])`, [[partR, partSelf]]).catch(() => {});
      await pool.query(`DELETE FROM availability WHERE availability_id=$1`, [availId]).catch(() => {});
    }
    await pool.query(`DELETE FROM actors WHERE id=$1`, [R]);
  }

  console.log('\n— B estrutural: list owner-only; by-id owner-or-self; intocados —');
  const route = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.routes.ts'), 'utf8');
  const sliceBetween = (a: string, b: string) => { const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length; return i >= 0 ? route.slice(i, j > i ? j : route.length) : ''; };
  const list = sliceBetween("'/:availabilityId/participants'", "'/participants/:id'");
  const byId = sliceBetween("'/participants/:id'", "fastify.put<{");

  record('B1 helper canReadParticipantAsParty usa participant.actorId (self) E availability.ownerId (owner)',
    /async function canReadParticipantAsParty/.test(route)
    && /participant\.actorId/.test(route) && /availability\.ownerId/.test(route));
  // DECISION-0118 D2: owner é RECURSO — autoridade via resolver (authority actor).
  record('B2 LIST owner-only: getAvailability + representsAvailabilityOwner ANTES de listParticipants; 401/403',
    list.indexOf('getAvailability(') >= 0 && list.indexOf('getAvailability(') < list.indexOf('listParticipants(')
    && /representsAvailabilityOwner\(req\.tenant\.id, userId, availability\)/.test(list)
    && /status\(401\)/.test(list) && /PARTICIPANTS_NOT_REPRESENTABLE/.test(list)
    && list.indexOf('representsAvailabilityOwner(') < list.indexOf('listParticipants('));
  record('B3 BY-ID: getParticipant ANTES do gate; canReadParticipantAsParty; 401/403; NÃO params.id como actor',
    byId.indexOf('getParticipant(') >= 0 && byId.indexOf('getParticipant(') < byId.indexOf('canReadParticipantAsParty(')
    && /canReadParticipantAsParty\(req\.tenant\.id, userId, participant\)/.test(byId)
    && /status\(401\)/.test(byId) && /PARTICIPANT_NOT_REPRESENTABLE/.test(byId)
    && !/canRepresentActor\([^)]*params\.id/.test(byId));
  record('B4 NÃO usa actionContext.actorId como autoridade; NÃO getActiveActor/ensureUserActor',
    !/canRepresentActor\([^)]*actionContext/.test(list + byId) && !/getActiveActor\(/.test(list + byId) && !/ensureUserActor\(/.test(list + byId));
  record('B5 reads read-only no handler (sem bank_ledger/INSERT/UPDATE/DELETE)',
    !/bank_ledger|bank_transactions|INSERT INTO|UPDATE |DELETE FROM/.test(list + byId));
  // intocados
  record('B6 /conflicts permanece selado (canRepresentActor sobre req.params.actorId)',
    /canRepresentActor\(req\.tenant\.id, userId, req\.params\.actorId\)/.test(sliceBetween("'/:availabilityId/participants/:actorId/conflicts'", "")));
  record('B7 /bookings permanece selado (canReadBookingAsParty + BOOKING_LIST_SCOPE_REQUIRED)',
    /canReadBookingAsParty\(/.test(route) && /BOOKING_LIST_SCOPE_REQUIRED/.test(route));
  record('B8 availability list/by-id NÃO ganharam gate de parte (intocados — resíduo G declarado)',
    !/PARTICIPANTS_NOT_REPRESENTABLE/.test(sliceBetween("}>('/', async", "'/:id'"))
    && !/canReadParticipantAsParty/.test(sliceBetween("}>('/:id'", "fastify.put<{")));

  console.log('\n— C service/repo: participants reads read-only, zero Bank —');
  const svc = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.service.ts'), 'utf8');
  record('C1 service availability sem Bank/money', !/bank_ledger|bank_transactions|bank_accounts|payment|amount_cents|payout|settlement/i.test(svc));
  const repo = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.repository.ts'), 'utf8');
  const findP = repo.slice(repo.indexOf('async findParticipantById'));
  record('C2 findParticipantById = SELECT FROM availability_participants (read-only)',
    /SELECT \* FROM availability_participants/.test(findP.slice(0, 300)));
  note('Denominador: esta fatia fecha SÓ os 2 GETs de participants. Arquivo NÃO fechado — availability list/by-id (G), weekly-template PUT (write). /conflicts + /bookings selados.');

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
  console.log('✨ participants reads gateados (list owner-only; by-id owner-or-self) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
