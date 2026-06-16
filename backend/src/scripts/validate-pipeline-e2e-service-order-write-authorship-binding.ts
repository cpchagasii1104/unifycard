/**
 * E2E — F-SERVICE-ORDER-WRITE-AUTHORSHIP-BINDING (DECISION-0113 / DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF).
 * NÃO MOVE DINHEIRO.
 *
 * Prova adversarial do fix do WRITE-AUTHORSHIP-SPOOF das transições de estado de service_order:
 * confirm / start / complete / cancel / buyer-confirm gravavam a AUTORIA a partir do
 * `actionContext.actorId` cru (HINT cliente-declarado) — um atacante declarava o actor da vítima e
 * confirmava/iniciava/cancelava a ordem em nome dela. Fix: `bindOrderWriteActor` (route layer) exige
 * `req.user.userId` REAL + actor declarado PARTE da ordem (customer|worker) + `canRepresentActor`
 * ANTES do write → 403 honesto, sem write parcial. A autoria persiste o actor BINDADO e o gate de
 * serviço passa a rodar contra o userId REAL.
 *
 * 🔒 DB EFÊMERA (run-service-order-write-authorship-binding-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import serviceOrderRoutes from '../modules/services/service-order.routes';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const statusOf = async (orderId: string): Promise<string> =>
  (await pool.query<{ s: string }>(`SELECT status::text AS s FROM service_orders WHERE id=$1`, [orderId])).rows[0]?.s;

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/service|order|write|authorship|binding|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
       VALUES ($1::uuid,$2,'cpf','approved','basic')`,
    [gu, tax]
  );
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, created_at, updated_at)
       VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,NOW(),NOW())`,
    [userId, tenantId, `${name}-${seq}@e2e.test`]
  );
  const actorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id)
       VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, userId, gu]
  )).rows[0].id;
  return { userId, actorId };
}

async function mkService(tenantId: string, ownerActorId: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, service_type, status, currency)
       VALUES ($1::uuid,$2::uuid,$3,$4,'service','active','BRL') RETURNING service_id::text AS id`,
    [tenantId, ownerActorId, `Servico${seq}`, `servico-${seq}-${Date.now()}`]
  )).rows[0].id;
}

/** Semeia uma service_order REAL no status pedido. NÃO usa booking (booking_id NULL → sem detecção de conflito). */
async function mkOrder(
  tenantId: string,
  serviceId: string,
  workerActorId: string,
  customerActorId: string,
  status: string,
  settlementFlow: 'none' | 'fixed_price_escrow'
): Promise<string> {
  const sellerPending = status === 'seller_pending';
  return (await pool.query<{ id: string }>(
    `INSERT INTO service_orders
       (tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, status, settlement_flow,
        scheduled_start, created_by_actor_id, release_eligible_at, buyer_confirmation_deadline_at, metadata, created_at, updated_at)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,NULL,$5,$6,
        NOW() + interval '1 day',$3::uuid,
        ${sellerPending ? `NOW() - interval '1 hour'` : 'NULL'},
        ${sellerPending ? `NOW() - interval '1 hour'` : 'NULL'},
        '{}'::jsonb,NOW(),NOW())
       RETURNING id::text AS id`,
    [tenantId, serviceId, workerActorId, customerActorId, status, settlementFlow]
  )).rows[0].id;
}

let CURRENT_USER = '';
let CURRENT_AC: Record<string, unknown> = {};

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Service Order Write Authorship', slug: `sowa-${Date.now()}` });

  const worker = await mkUserActor(TENANT, 'Worker');     // prestador (parte: workerActorId)
  const customer = await mkUserActor(TENANT, 'Customer'); // comprador (parte: customerActorId)
  const attacker = await mkUserActor(TENANT, 'Attacker'); // terceiro do mesmo tenant (NÃO é parte)
  const serviceId = await mkService(TENANT, worker.actorId);

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = CURRENT_USER ? { id: CURRENT_USER, userId: CURRENT_USER } : undefined;
    req.tenant = { id: TENANT };
    req.actionContext = CURRENT_AC;
  });
  await app.register(serviceOrderRoutes);
  await app.ready();

  const as = (userId: string, actorId: string | null): void => {
    CURRENT_USER = userId;
    CURRENT_AC = actorId ? { actorId, actingUserId: userId } : {};
  };
  const post = (url: string, body: unknown = {}) =>
    app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(body) });
  const st = (r: any) => r.statusCode;

  try {
    // ───────────────────────── CONFIRM (draft → confirmed) ─────────────────────────
    // T1 — LEGÍTIMO: worker representa o próprio actor (parte) → 201/200 + status confirmed + autoria bindada.
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'draft', 'none');
      as(worker.userId, worker.actorId);
      const r = await post(`/service-orders/${o}/confirm`);
      const persisted = (await pool.query<{ a: string | null }>(
        `SELECT confirmed_by_actor_id::text AS a FROM service_orders WHERE id=$1`, [o]
      )).rows[0]?.a;
      record('T1 confirm legítimo (worker representa próprio actor) → 200 + status confirmed + confirmed_by_actor_id=worker',
        st(r) < 300 && (await statusOf(o)) === 'confirmed' && persisted === worker.actorId,
        `status=${st(r)} order=${await statusOf(o)} confirmed_by=${persisted}`);
    }

    // T2 — SPOOF: atacante DECLARA o actor do worker (não representável) → 403 + ordem inalterada (draft).
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'draft', 'none');
      as(attacker.userId, worker.actorId); // declara actor da vítima
      const r = await post(`/service-orders/${o}/confirm`);
      record('T2 confirm SPOOF (atacante declara actor do worker) → 403 + ordem segue draft (sem write)',
        st(r) === 403 && (await statusOf(o)) === 'draft', `status=${st(r)} order=${await statusOf(o)}`);
    }

    // T3 — NÃO-PARTE: atacante declara o PRÓPRIO actor (representável, mas não é parte) → 403 não-leak.
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'draft', 'none');
      as(attacker.userId, attacker.actorId);
      const r = await post(`/service-orders/${o}/confirm`);
      record('T3 confirm NÃO-PARTE (atacante representável mas fora da ordem) → 403 não-leak + draft',
        st(r) === 403 && (await statusOf(o)) === 'draft', `status=${st(r)} order=${await statusOf(o)}`);
    }

    // T4 — customer (a outra parte) também pode confirmar (predicado = customer OU worker, espelha o read).
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'draft', 'none');
      as(customer.userId, customer.actorId);
      const r = await post(`/service-orders/${o}/confirm`);
      record('T4 confirm como customer (parte) → 200 + confirmed (predicado parte = customer OU worker)',
        st(r) < 300 && (await statusOf(o)) === 'confirmed', `status=${st(r)} order=${await statusOf(o)}`);
    }

    // ───────────────────────── START (confirmed → in_progress) ─────────────────────────
    // T5 — LEGÍTIMO worker.
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'confirmed', 'none');
      as(worker.userId, worker.actorId);
      const r = await post(`/service-orders/${o}/start`, { workerNotes: 'indo' });
      record('T5 start legítimo (worker) → 200 + in_progress',
        st(r) < 300 && (await statusOf(o)) === 'in_progress', `status=${st(r)} order=${await statusOf(o)}`);
    }
    // T6 — SPOOF.
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'confirmed', 'none');
      as(attacker.userId, worker.actorId);
      const r = await post(`/service-orders/${o}/start`);
      record('T6 start SPOOF (atacante declara worker) → 403 + segue confirmed',
        st(r) === 403 && (await statusOf(o)) === 'confirmed', `status=${st(r)} order=${await statusOf(o)}`);
    }

    // ───────────────────────── COMPLETE (in_progress → completed, flow none) ─────────────────────────
    // T7 — LEGÍTIMO worker.
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'in_progress', 'none');
      as(worker.userId, worker.actorId);
      const r = await post(`/service-orders/${o}/complete`, { workerNotes: 'feito' });
      record('T7 complete legítimo (worker, flow none) → 200 + completed',
        st(r) < 300 && (await statusOf(o)) === 'completed', `status=${st(r)} order=${await statusOf(o)}`);
    }
    // T8 — SPOOF.
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'in_progress', 'none');
      as(attacker.userId, worker.actorId);
      const r = await post(`/service-orders/${o}/complete`);
      record('T8 complete SPOOF (atacante declara worker) → 403 + segue in_progress',
        st(r) === 403 && (await statusOf(o)) === 'in_progress', `status=${st(r)} order=${await statusOf(o)}`);
    }

    // ───────────────────────── CANCEL (confirmed → cancelled) ─────────────────────────
    // T9 — LEGÍTIMO customer (parte).
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'confirmed', 'none');
      as(customer.userId, customer.actorId);
      const r = await post(`/service-orders/${o}/cancel`, { cancellationReason: 'e2e' });
      record('T9 cancel legítimo (customer parte) → 200 + cancelled',
        st(r) < 300 && (await statusOf(o)) === 'cancelled', `status=${st(r)} order=${await statusOf(o)}`);
    }
    // T10 — SPOOF (atacante declara actor do customer).
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'confirmed', 'none');
      as(attacker.userId, customer.actorId);
      const r = await post(`/service-orders/${o}/cancel`, { cancellationReason: 'hack' });
      record('T10 cancel SPOOF (atacante declara customer) → 403 + segue confirmed',
        st(r) === 403 && (await statusOf(o)) === 'confirmed', `status=${st(r)} order=${await statusOf(o)}`);
    }

    // ───────────────────────── BUYER-CONFIRM (seller_pending → release_approved) ─────────────────────────
    // T11 — LEGÍTIMO customer.
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'seller_pending', 'fixed_price_escrow');
      as(customer.userId, customer.actorId);
      const r = await post(`/service-orders/${o}/buyer-confirm`);
      record('T11 buyer-confirm legítimo (customer) → 200 + release_approved',
        st(r) < 300 && (await statusOf(o)) === 'release_approved', `status=${st(r)} order=${await statusOf(o)}`);
    }
    // T12 — SPOOF (atacante declara customer).
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'seller_pending', 'fixed_price_escrow');
      as(attacker.userId, customer.actorId);
      const r = await post(`/service-orders/${o}/buyer-confirm`);
      record('T12 buyer-confirm SPOOF (atacante declara customer) → 403 + segue seller_pending',
        st(r) === 403 && (await statusOf(o)) === 'seller_pending', `status=${st(r)} order=${await statusOf(o)}`);
    }
    // T13 — DEFESA EM PROFUNDIDADE: worker é PARTE (passa o route binding) mas o service exige customer → 403.
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'seller_pending', 'fixed_price_escrow');
      as(worker.userId, worker.actorId);
      const r = await post(`/service-orders/${o}/buyer-confirm`);
      record('T13 buyer-confirm como worker (parte, mas só customer confirma) → 403 + segue seller_pending',
        st(r) === 403 && (await statusOf(o)) === 'seller_pending', `status=${st(r)} order=${await statusOf(o)}`);
    }

    // ───────────────────────── VALIDAÇÃO DE ENTRADA ─────────────────────────
    // T14 — sem actionContext.actorId → 400.
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'draft', 'none');
      as(worker.userId, null); // user presente, sem actorId
      const r = await post(`/service-orders/${o}/confirm`);
      record('T14 confirm sem actionContext.actorId → 400 + draft',
        st(r) === 400 && (await statusOf(o)) === 'draft', `status=${st(r)} order=${await statusOf(o)}`);
    }
    // T15 — não autenticado → 401.
    {
      const o = await mkOrder(TENANT, serviceId, worker.actorId, customer.actorId, 'draft', 'none');
      as('', worker.actorId); // sem user
      const r = await post(`/service-orders/${o}/confirm`);
      record('T15 confirm não autenticado → 401 + draft',
        st(r) === 401 && (await statusOf(o)) === 'draft', `status=${st(r)} order=${await statusOf(o)}`);
    }

    // ───────────────────────── BANK INTOCADO ─────────────────────────
    {
      const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
      record('T-bank Bank intocado (bank_ledger + bank_transactions inalterados)',
        bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
    }

    // ───────────────────────── ESTRUTURAL ─────────────────────────
    {
      const src = readFileSync(join(process.cwd(), 'src/modules/services/service-order.routes.ts'), 'utf8');
      record('C1 helper bindOrderWriteActor: req.user.userId + party (customer|worker) + canRepresentActor',
        /const bindOrderWriteActor = async/.test(src)
        && /req\.user\?\.userId/.test(src)
        && /order\.customerActorId !== actorId && order\.workerActorId !== actorId/.test(src)
        && /canRepresentActor\(tenantId, userId, actorId\)/.test(src));
      // os 5 writes não-financeiros: autoria a partir de bound.*, NUNCA actionContext.actorId.
      record('C2 os 5 writes gravam bound.actorId/bound.userId (não actionContext.actorId)',
        /confirmedByActorId: bound\.actorId/.test(src)
        && /startedByActorId: bound\.actorId/.test(src)
        && /completedByActorId: bound\.actorId/.test(src)
        && /cancelledByActorId: bound\.actorId/.test(src)
        && /buyerActorId: bound\.actorId/.test(src));
      record('C3 confirmedByUserId/startedByUserId/... = bound.userId REAL (não actionContext.actorId)',
        /confirmedByUserId: bound\.userId/.test(src)
        && /startedByUserId: bound\.userId/.test(src)
        && /completedByUserId: bound\.userId/.test(src)
        && /cancelledByUserId: bound\.userId/.test(src)
        && /buyerUserId: bound\.userId/.test(src));
      // nenhuma autoria de transição de estado NÃO-FINANCEIRA vem mais de actionContext.actorId cru.
      // (confirmedBy* é compartilhado com confirm-financial-terms, resíduo financeiro documentado — coberto por C5;
      //  os campos abaixo só existem nos writes não-financeiros, então provam a ausência do spoof aqui.)
      record('C4 ZERO autoria spoofável nos writes não-financeiros (start/complete/cancel/buyer não usam actionContext.actorId)',
        !/(startedByActorId|completedByActorId|cancelledByActorId|buyerActorId|startedByUserId|completedByUserId|cancelledByUserId|buyerUserId): actionContext\.actorId/.test(src));
      // confirm-financial-terms (financeiro/split, 503) permanece resíduo consciente e documentado.
      record('C5 confirm-financial-terms permanece resíduo financeiro DOCUMENTADO (fora de escopo desta fatia)',
        /RESÍDUO CONSCIENTE \(DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF\)/.test(src)
        && /confirmFinancialTerms\(/.test(src));
      record('C6 bind ANTES do write: getOrderById → bindOrderWriteActor → service write em cada handler',
        (src.match(/const bound = await bindOrderWriteActor\(req, reply, tenantId, existing\)/g) || []).length === 5);
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${'═'.repeat(64)}`);
    console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
    if (failed.length > 0) {
      console.log('FALHAS:');
      failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
      await app.close();
      await pool.end();
      process.exit(1);
    }
    await app.close();
    await pool.end();
    console.log('✨ service-order write-authorship bindada ao actor representável e parte — spoof contido.');
  } catch (e) {
    console.error('💥 Erro no corpo do teste:', e);
    try { await app.close(); } catch { /* noop */ }
    try { await pool.end(); } catch { /* noop */ }
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
