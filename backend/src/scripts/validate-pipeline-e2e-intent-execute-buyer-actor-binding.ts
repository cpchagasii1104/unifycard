/**
 * E2E — F-AUTHORITY-Z2-R5-INTENT-EXECUTE-BUYER-ACTOR-BINDING (DECISION-0113 / DECISION-0131 §B7 / Z2).
 *
 * Prova que POST /intent/execute NÃO aceita o `buyerActorId` declarado via `actionContext.actorId`
 * (canal-1 client-declared) como autoridade: o principal autenticado (req.user.userId) DEVE provar
 * representação via canRepresentActor (fail-closed → 403 BUYER_ACTOR_NOT_REPRESENTABLE) ANTES de
 * criar order/itens/reserva/saga. Declarar o ator de outro → 403 sem nenhum write.
 *
 * (A) ESTRUTURAL (data-flow do intent-execute.routes.ts):
 *     A1 gate canRepresentActor(tenantId, authUserId, buyerActorId) presente.
 *     A2 subject = req.user.userId server-side (não actionContext/declarado).
 *     A3 403 BUYER_ACTOR_NOT_REPRESENTABLE fail-closed.
 *     A4 gate ANTES de createOrderWithItemsAndReservations.
 * (B) RUNTIME-PRIMITIVO (a decisão exata que o gate faz):
 *     B1 canRepresentActor(A.userId, A.actor) === true.
 *     B2 canRepresentActor(B.userId, A.actor) === false  (spoof → 403).
 * (C) RUNTIME-HTTP (inject no handler real contra DB efêmera):
 *     C1 user B declara actionContext.actorId = A.actor → 403 BUYER_ACTOR_NOT_REPRESENTABLE.
 *     C2 no 403: orders/order_items/inventory_reservations/order_sagas/event_outbox NÃO crescem.
 *     C3 no 403: bank_ledger/bank_transactions/bank_splits NÃO crescem (e nunca estão no caminho).
 *     C4 user A (representa A.actor) PASSA do gate (falha adiante por refs dummy, nunca 403-repr).
 *     C5 sem actionContext.actorId → 400 ACTOR_REQUIRED preservado.
 *     C6 repeat_last_order com actor alheio → 403 BUYER_ACTOR_NOT_REPRESENTABLE (idempotência não burla).
 * (D) NÃO-REGRESSÃO R1/R2/R3:
 *     D1 groups.routes.ts mantém canRepresentActor(tenantId, userIdForCheck, group.ownerActorId).
 *     D2 reports.routes.ts mantém resolveReportActorId (≥8). D3 dashboard.routes.ts mantém resolveReportActorId.
 *
 * 🔒 DB EFÊMERA (run-intent-execute-buyer-actor-binding-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/intent|actor|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3::uuid,$4,'x',0,true,NOW(),NOW())`, [userId, tenantId, gu, `${name}-${seq}@e2e.test`]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
}

async function tableCount(table: string, tenantId: string): Promise<number> {
  const reg = (await pool.query<{ t: string | null }>(`SELECT to_regclass($1) AS t`, [table])).rows[0].t;
  if (!reg) return -1; // tabela ausente
  try {
    const r = await pool.query<{ c: number }>(`SELECT count(*)::int AS c FROM ${table} WHERE tenant_id = $1`, [tenantId]);
    return r.rows[0].c;
  } catch {
    const r = await pool.query<{ c: number }>(`SELECT count(*)::int AS c FROM ${table}`);
    return r.rows[0].c;
  }
}

const MATERIAL_TABLES = ['orders', 'order_items', 'inventory_reservations', 'order_sagas', 'event_outbox'];
const BANK_TABLES = ['bank_ledger', 'bank_transactions', 'bank_splits'];

async function snapshot(tenantId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of [...MATERIAL_TABLES, ...BANK_TABLES]) out[t] = await tableCount(t, tenantId);
  return out;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // ── (A) Estrutural ──────────────────────────────────────────────────────────────────────
  const src = readFileSync(join(process.cwd(), 'src/core/intent/intent-execute.routes.ts'), 'utf8');
  record('A1 gate canRepresentActor(tenantId, authUserId, buyerActorId) presente',
    /canRepresentActor\(\s*tenantId\s*,\s*authUserId\s*,\s*buyerActorId\s*\)/.test(src));
  record('A2 subject = req.user.userId server-side (const authUserId)',
    /const\s+authUserId\s*=\s*\(?[^\n;]*req[^\n;]*\.user\??\.userId/.test(src));
  record('A3 403 BUYER_ACTOR_NOT_REPRESENTABLE fail-closed',
    /status\(\s*403\s*\)[\s\S]{0,160}BUYER_ACTOR_NOT_REPRESENTABLE/.test(src));
  const idxGate = src.search(/canRepresentActor\(\s*tenantId\s*,\s*authUserId\s*,\s*buyerActorId\s*\)/);
  const idxSink = src.search(/createOrderWithItemsAndReservations\s*\(/);
  record('A4 gate ANTES de createOrderWithItemsAndReservations', idxGate !== -1 && idxSink !== -1 && idxGate < idxSink, `gate=${idxGate} sink=${idxSink}`);

  // ── Bootstrap social ports (canRepresentActor deps) ───────────────────────────────────────
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { authorizationService } = await import('../core/authorization/authorization.service');

  const tenantId = (await pool.query<{ id: string }>(`INSERT INTO tenants (name, slug) VALUES ('Intent Execute E2E', $1) RETURNING id::text AS id`, [`intent-execute-e2e-${Date.now()}`])).rows[0].id;
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
  const A = await mkUserActor(tenantId, 'alice');
  const B = await mkUserActor(tenantId, 'bob');

  // ── (B) Runtime-primitivo ────────────────────────────────────────────────────────────────
  const aReprA = await authorizationService.canRepresentActor(tenantId, A.userId, A.actorId);
  const bReprA = await authorizationService.canRepresentActor(tenantId, B.userId, A.actorId);
  record('B1 canRepresentActor(A.userId, A.actor) === true', aReprA === true, `got=${aReprA}`);
  record('B2 canRepresentActor(B.userId, A.actor) === false (spoof → 403)', bReprA === false, `got=${bReprA}`);

  // ── (C) Runtime-HTTP (handler real via fastify.inject) ────────────────────────────────────
  const Fastify = (await import('fastify')).default;
  const { default: intentExecuteRoutes } = await import('../core/intent/intent-execute.routes');
  const app = Fastify();
  // Simula auth-plugin + tenant-plugin + action-context-plugin (server-side decoram req; o actorId
  // do action-context é HINT client-declared — injetado por header de teste, como o cliente faria).
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    const uid = req.headers['x-test-user-id'];
    const tid = req.headers['x-test-tenant-id'];
    const aid = req.headers['x-test-actor-id'];
    r.tenant = tid ? { id: String(tid) } : null;
    r.user = uid ? { userId: String(uid), id: String(uid), tenantId: tid ? String(tid) : '' } : null;
    r.actionContext = aid ? { actorId: String(aid) } : undefined;
  });
  await app.register(intentExecuteRoutes, { prefix: '/intent' });
  await app.ready();

  const baseHeaders = (actorId: string | null, userId: string): Record<string, string> => {
    const h: Record<string, string> = {
      'x-test-user-id': userId,
      'x-test-tenant-id': tenantId,
      'x-idempotency-key': randomUUID(),
      'content-type': 'application/json',
    };
    if (actorId) h['x-test-actor-id'] = actorId;
    return h;
  };
  const dummyItems = [{ concept_ref: randomUUID(), offer_ref: randomUUID(), quantity: 1 }];

  // C1/C2/C3 — user B declara o actor de A (spoof) → 403, sem write.
  const before = await snapshot(tenantId);
  const r1 = await app.inject({
    method: 'POST', url: '/intent/execute', headers: baseHeaders(A.actorId, B.userId),
    payload: { intent_type: 'food.order_place', items: dummyItems },
  });
  const b1 = r1.json() as { code?: string };
  record('C1 spoof (B declara actor de A) → 403 BUYER_ACTOR_NOT_REPRESENTABLE', r1.statusCode === 403 && b1.code === 'BUYER_ACTOR_NOT_REPRESENTABLE', `status=${r1.statusCode} code=${b1.code}`);
  const after = await snapshot(tenantId);
  const grew = MATERIAL_TABLES.filter((t) => after[t] > before[t]);
  record('C2 no 403: orders/items/reservations/sagas/outbox NÃO crescem', grew.length === 0, `cresceram: ${grew.join(',')} (${MATERIAL_TABLES.map((t) => `${t}:${before[t]}→${after[t]}`).join(' ')})`);
  const bankGrew = BANK_TABLES.filter((t) => after[t] > before[t] && before[t] >= 0);
  record('C3 no 403: bank_ledger/bank_transactions/bank_splits NÃO crescem', bankGrew.length === 0, `cresceram: ${bankGrew.join(',')} (${BANK_TABLES.map((t) => `${t}:${before[t]}→${after[t]}`).join(' ')})`);

  // C4 — user A representa A.actor → PASSA do gate (falha adiante por refs dummy, nunca 403-repr).
  const r2 = await app.inject({
    method: 'POST', url: '/intent/execute', headers: baseHeaders(A.actorId, A.userId),
    payload: { intent_type: 'food.order_place', items: dummyItems },
  });
  const b2 = r2.json() as { code?: string };
  record('C4 self (A representa A.actor) PASSA do gate (code != *_NOT_REPRESENTABLE/AUTH_REQUIRED)',
    b2.code !== 'BUYER_ACTOR_NOT_REPRESENTABLE' && b2.code !== 'AUTH_REQUIRED' && b2.code !== 'ACTOR_REQUIRED', `status=${r2.statusCode} code=${b2.code}`);

  // C5 — sem actionContext.actorId → 400 ACTOR_REQUIRED preservado.
  const r3 = await app.inject({
    method: 'POST', url: '/intent/execute', headers: baseHeaders(null, A.userId),
    payload: { intent_type: 'food.order_place', items: dummyItems },
  });
  const b3 = r3.json() as { code?: string };
  record('C5 sem actor → 400 ACTOR_REQUIRED preservado', r3.statusCode === 400 && b3.code === 'ACTOR_REQUIRED', `status=${r3.statusCode} code=${b3.code}`);

  // C6 — repeat_last_order com actor alheio → 403 (idempotência/repeat não burla a representação).
  const beforeRepeat = await snapshot(tenantId);
  const r4 = await app.inject({
    method: 'POST', url: '/intent/execute', headers: baseHeaders(A.actorId, B.userId),
    payload: { intent_type: 'food.repeat_last_order', source_order_id: randomUUID() },
  });
  const b4 = r4.json() as { code?: string };
  const afterRepeat = await snapshot(tenantId);
  const grewRepeat = MATERIAL_TABLES.filter((t) => afterRepeat[t] > beforeRepeat[t]);
  record('C6 repeat com actor alheio → 403 BUYER_ACTOR_NOT_REPRESENTABLE + sem write', r4.statusCode === 403 && b4.code === 'BUYER_ACTOR_NOT_REPRESENTABLE' && grewRepeat.length === 0, `status=${r4.statusCode} code=${b4.code} grew=${grewRepeat.join(',')}`);

  await app.close();

  // ── (D) Não-regressão R1/R2/R3 ────────────────────────────────────────────────────────────
  const groupsSrc = readFileSync(join(process.cwd(), 'src/modules/groups/groups.routes.ts'), 'utf8');
  record('D1 groups (R1) mantém canRepresentActor(tenantId, userIdForCheck, group.ownerActorId)',
    /canRepresentActor\(\s*tenantId\s*,\s*userIdForCheck\s*,\s*group\.ownerActorId\s*\)/.test(groupsSrc));
  const reportsSrc = readFileSync(join(process.cwd(), 'src/modules/reports/reports.routes.ts'), 'utf8');
  record('D2 reports (R3) mantém resolveReportActorId (≥8)', (reportsSrc.match(/resolveReportActorId\(req, reply\)/g) || []).length >= 8);
  const dashboardSrc = readFileSync(join(process.cwd(), 'src/modules/dashboard/dashboard.routes.ts'), 'utf8');
  record('D3 dashboard (R2) mantém resolveReportActorId', /resolveReportActorId\(req, reply\)/.test(dashboardSrc));

  console.log('\n════════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed !== total) {
    console.log('❌ FALHAS:');
    for (const r of results.filter((x) => !x.ok)) console.log(`   - ${r.label}: ${r.reason}`);
    process.exitCode = 1;
  } else {
    console.log('✨ intent-execute: buyerActorId declarado é HINT; só cria order/itens/reserva/saga após canRepresentActor; spoof → 403 sem write; bank intocado.');
  }
}

main()
  .catch((e) => { console.error('💥', e); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
