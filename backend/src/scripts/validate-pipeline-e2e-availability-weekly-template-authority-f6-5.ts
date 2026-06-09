/**
 * E2E DECISION-0113 canal-1 (WRITE) · availability weekly-template authorship
 *
 * PUT /availability/weekly-template materializava slots em `availability` usando
 * ownerId = req.actionContext.actorId (client-declared) SEM provar autoridade → WRITE SPOOF: usuário
 * autenticado podia criar/alterar/soft-remover a grade de agenda de um actor alheio declarando o actorId no
 * actionContext. Agora: req.user.userId obrigatório (401) → canRepresentActor(tenantId, userId,
 * actionContext.actorId) ANTES de materialize → 403 fail-closed (WEEKLY_TEMPLATE_ACTOR_NOT_REPRESENTABLE).
 * ownerId continua = actionContext.actorId, mas PROVADO. Não toca Bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor decide (próprio=true / alheio=false / estranho=false).
 *   B estrutural — gate sobre actionContext.actorId ANTES de materialize; 401/403; actionContext é alvo, não
 *     autoridade; sem ensureUserActor/getActiveActor; sem Bank; os 7 GETs selados intocados.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-availability-weekly-template-authority-f6-5.ts
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
const MARKER = 'E2E-WT';

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
  const O = randomUUID(); // actor alheio (page) — dev NÃO representa
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [O, TENANT_ID, `${MARKER}-other`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor sobre o actionContext.actorId (alvo da escrita) —');
    record('A1 dev representa o PRÓPRIO actor → true (materializa a própria grade)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o actor O → false (declarar O no actionContext → 403, sem escrever agenda alheia)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
  } finally {
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: gate sobre actionContext.actorId ANTES de materialize —');
  const route = readFileSync(join(process.cwd(), 'src/core/availability/unified-availability.routes.ts'), 'utf8');
  const wt = route.slice(route.indexOf("'/weekly-template'"), route.indexOf("POST /availability/bookings") > 0 ? route.indexOf("POST /availability/bookings") : route.length);

  record('B1 gate canRepresentActor(req.tenant.id, userId, req.actionContext.actorId) ANTES de materialize',
    /canRepresentActor\(req\.tenant\.id, userId, req\.actionContext\.actorId\)/.test(wt)
    && wt.indexOf('canRepresentActor(') < wt.indexOf('materialize('));
  record('B2 actionContext.actorId é ALVO declarado (ownerId), provado pelo gate — não autoridade crua',
    /ownerId: req\.actionContext\.actorId/.test(wt) && /canRepresentActor\(/.test(wt));
  record('B3 401 sem user + 403 fail-closed (WEEKLY_TEMPLATE_ACTOR_NOT_REPRESENTABLE)',
    /status\(401\)/.test(wt) && /status\(403\)/.test(wt) && /WEEKLY_TEMPLATE_ACTOR_NOT_REPRESENTABLE/.test(wt));
  record('B4 materialize só roda depois do gate (gate antes da chamada do writer)',
    wt.indexOf('canRep') >= 0 && wt.indexOf('canRep') < wt.indexOf('materialize('));
  record('B5 NÃO usa ensureUserActor/getActiveActor neste handler (sem atalho writer)',
    !/ensureUserActor\(/.test(wt) && !/getActiveActor\(/.test(wt));
  record('B6 handler sem Bank/ledger',
    !/bank_ledger|bank_transactions|payment|amount_cents|payout|settlement/.test(wt));

  console.log('\n— C intocados: os 7 GETs selados permanecem —');
  record('C1 /conflicts selado (canRepresentActor sobre req.params.actorId)',
    /canRepresentActor\(req\.tenant\.id, userId, req\.params\.actorId\)/.test(route));
  record('C2 /bookings selado (canReadBookingAsParty + BOOKING_LIST_SCOPE_REQUIRED)',
    /canReadBookingAsParty\(/.test(route) && /BOOKING_LIST_SCOPE_REQUIRED/.test(route));
  record('C3 /participants selado (canReadParticipantAsParty + PARTICIPANTS_NOT_REPRESENTABLE)',
    /canReadParticipantAsParty\(/.test(route) && /PARTICIPANTS_NOT_REPRESENTABLE/.test(route));
  record('C4 availability list/by-id selado (AVAILABILITY_NOT_REPRESENTABLE)',
    /AVAILABILITY_NOT_REPRESENTABLE/.test(route));

  console.log('\n— D service: materialize escreve availability, sem Bank —');
  const svc = readFileSync(join(process.cwd(), 'src/core/availability/weekly-template-materializer.service.ts'), 'utf8');
  record('D1 materialize grava availability (createAvailability/updateAvailability) — confirmado writer',
    /createAvailability\(|updateAvailability\(/.test(svc));
  record('D2 materialize sem Bank/money',
    !/bank_ledger|bank_transactions|bank_accounts|payment|amount_cents|payout|settlement/i.test(svc));
  note('Denominador: PUT weekly-template gateado. Com os 7 GETs já selados, unified-availability.routes.ts fica FECHADO no eixo DECISION-0113 conhecido (nenhum read/write keyed em actorId declarado sem prova server-side).');

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
  console.log('✨ weekly-template writer gateado (canRepresentActor sobre actionContext.actorId, antes de materialize) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
