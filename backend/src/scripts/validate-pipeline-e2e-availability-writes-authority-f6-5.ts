/**
 * E2E DECISION-0113 (WRITE) · availability writes owner-scoped (POST / + PUT /:id)
 *
 * POST /availability gravava ownerId = body.ownerId (client-declared) e PUT /availability/:id alterava por
 * availabilityId — ambos só com presença de actionContext, sem prova → WRITE SPOOF/IDOR: usuário criava agenda
 * para owner alheio ou alterava availability alheia. Agora OWNER-SCOPED:
 *   POST  → req.user obrigatório; actionContext.actorId DEVE === body.ownerId (autoria coincide); E
 *           canRepresentActor(userId, body.ownerId) ANTES de createAvailability.
 *   PUT   → req.user obrigatório; resolve availability (404 preservado); actionContext DEVE === ownerId real; E
 *           canRepresentActor(userId, availability.ownerId) ANTES de updateAvailability; params.id nunca como actor.
 * Sem admin escape, sem ensureUserActor/getActiveActor, zero Bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor + fixtures reais (availability do devActor): owner atualiza; estranho
 *     não; owner alheio no create não passa; inexistente 404.
 *   B estrutural — POST gateia body.ownerId (mismatch + representável) antes de createAvailability; PUT resolve
 *     owner real antes de updateAvailability; 401/403/404; sem params.id-as-actor; sem writer-atalho; intocados.
 *   C service — create/update gravam availability, sem Bank.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-availability-writes-authority-f6-5.ts
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
const MARKER = 'E2E-AVW';

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
  const O = randomUUID(); // owner alheio — dev NÃO representa
  const availDev = randomUUID();
  let availExists = false;
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [O, TENANT_ID, `${MARKER}-other`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor sobre o owner (body.ownerId / availability.ownerId) —');
    record('A1 dev representa o PRÓPRIO actor → true (cria/atualiza availability própria)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o owner alheio O → false (criar/atualizar p/ O → 403)',
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
      record('A4 PUT: owner real da availability = devActor → canRepresentActor(ownerId)=true (atualiza)',
        (await authorizationService.canRepresentActor(TENANT_ID, devUserId, av.ownerId)) === true);
      record('A5 PUT: estranho NÃO representa o owner real → false (→ 403)',
        (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, av.ownerId)) === false);
      let threw404 = false;
      try { await unifiedAvailabilityService.getAvailability(TENANT_ID, randomUUID()); } catch (e: any) { threw404 = (e?.statusCode === 404) || /não encontrada/i.test(e?.message ?? ''); }
      record('A6 PUT: availability inexistente → getAvailability lança 404 (preservado no handler)', threw404);
    } else {
      note('fixtures REAIS = N/A — tabela availability ausente em DEV; gate coberto estruturalmente (B).');
    }
  } finally {
    if (availExists) await pool.query(`DELETE FROM availability WHERE availability_id=$1`, [availDev]).catch(() => {});
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: POST gateia body.ownerId; PUT resolve owner real; intocados —');
  const route = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.routes.ts'), 'utf8');
  const sliceBetween = (a: string, b: string) => { const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length; return i >= 0 ? route.slice(i, j > i ? j : route.length) : ''; };
  const post = sliceBetween("Criar nova disponibilidade", "Listar disponibilidades com filtros");
  const put = sliceBetween("Atualizar disponibilidade", "materializa a grade semanal declarativa");

  record('B1 POST: gate canRepresentActor(req.tenant.id, userId, parsed.data.ownerId) ANTES de createAvailability',
    /canRepresentActor\(req\.tenant\.id, userId, parsed\.data\.ownerId\)/.test(post)
    && post.indexOf('canRepresentActor(') < post.indexOf('createAvailability('));
  record('B2 POST: mismatch actionContext.actorId !== body.ownerId → 403 (OWNER_MISMATCH); 401/403',
    /req\.actionContext\.actorId !== parsed\.data\.ownerId/.test(post)
    && /AVAILABILITY_WRITE_OWNER_MISMATCH/.test(post) && /status\(401\)/.test(post) && /AVAILABILITY_WRITE_NOT_REPRESENTABLE/.test(post));
  record('B3 PUT: resolve owner real (getAvailability) ANTES de updateAvailability; canRepresentActor(existing.ownerId)',
    put.indexOf('getAvailability(') >= 0 && put.indexOf('getAvailability(') < put.indexOf('updateAvailability(')
    && /canRepresentActor\(req\.tenant\.id, userId, existing\.ownerId\)/.test(put)
    && put.indexOf('canRepresentActor(') < put.indexOf('updateAvailability('));
  record('B4 PUT: mismatch actionContext !== existing.ownerId → 403; 401/403; NÃO params.id como actor',
    /req\.actionContext\.actorId !== existing\.ownerId/.test(put)
    && /AVAILABILITY_WRITE_OWNER_MISMATCH/.test(put) && /status\(401\)/.test(put)
    && !/canRepresentActor\([^)]*params\.id/.test(put));
  record('B5 NÃO usa ensureUserActor/getActiveActor nos dois handlers',
    !/ensureUserActor\(/.test(post + put) && !/getActiveActor\(/.test(post + put));
  record('B6 writes sem Bank no handler',
    !/bank_ledger|bank_transactions|payment|amount_cents|payout|settlement/.test(post + put));
  // intocados
  record('B7 weekly-template selado intocado (canRepresentActor sobre actionContext.actorId)',
    /canRepresentActor\(req\.tenant\.id, userId, req\.actionContext\.actorId\)/.test(route));
  record('B8 7 GETs selados intocados (conflicts/bookings/participants/availability reads)',
    /canRepresentActor\(req\.tenant\.id, userId, req\.params\.actorId\)/.test(route)
    && /canReadBookingAsParty\(/.test(route) && /canReadParticipantAsParty\(/.test(route)
    && /AVAILABILITY_NOT_REPRESENTABLE/.test(route));
  record('B9 booking writes e participant writes NÃO ganharam gate de parte nesta fatia (resíduo declarado)',
    !/canReadBookingAsParty/.test(sliceBetween("Criar novo booking", "Listar bookings com filtros"))
    && !/canReadParticipantAsParty/.test(sliceBetween("Adicionar participante", "Listar participantes de uma availability")));

  console.log('\n— C service: create/update gravam availability, sem Bank —');
  const svc = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.service.ts'), 'utf8');
  record('C1 service availability sem Bank/money', !/bank_ledger|bank_transactions|bank_accounts|payment|amount_cents|payout|settlement/i.test(svc));
  record('C2 createAvailability/updateAvailability existem (writers confirmados)',
    /async createAvailability\(/.test(svc) && /async updateAvailability\(/.test(svc));
  note('Denominador: esta fatia fecha POST / e PUT /:id. Resíduos do arquivo: booking writes (4) + participant writes (3) — eixo write-authorship, nuance de produto. Os 7 GETs + weekly-template seguem selados.');

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
  console.log('✨ availability writes (create/update) gateados owner-scoped — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
