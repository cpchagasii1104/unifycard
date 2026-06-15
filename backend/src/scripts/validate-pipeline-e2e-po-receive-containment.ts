/**
 * E2E — F-C1-MONEY-PO-RECEIVE-EXPLICIT-CONTAINMENT. NÃO MOVE NADA.
 *
 * Prova que o recebimento de purchase_order está CONTIDO fail-closed (decisão Clayton: PO não é creator-owned;
 * só reabilita com owner empresarial material / company-owned). receivePO é hard-stop ANTES de qualquer mutação;
 * a rota POST /purchase-orders/:id/receive é 403 PURCHASE_ORDER_RECEIVE_CONTAINED.
 *
 *   T1 rota /receive → 403 PURCHASE_ORDER_RECEIVE_CONTAINED
 *   T2 service.receivePO direto → lança PURCHASE_ORDER_RECEIVE_CONTAINED (403) ANTES de qualquer leitura/mutação
 *   T2b orderId INEXISTENTE → ainda CONTAINED (não "Ordem não encontrada") ⇒ hard-stop precede getPurchaseOrderById
 *   T3 spoof actingUserId não destrava (403) · T4 spoof actorId não destrava (403)
 *   T5 PO seedada permanece SUBMITTED (status não vira RECEIVED/COMPLETED)
 *   T6 zero inventory_movements · T7 accounts_payable não religado · T8 Bank/ledger/split intocados
 *
 * 🔒 DB EFÊMERA (run-po-receive-containment-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import purchaseOrderRoutes from '../modules/marketplace/purchase-order.routes';
import { purchaseOrderService } from '../modules/marketplace/purchase-order.service';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/po|purchase|receive|containment|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkActor(tenantId: string, name: string): Promise<string> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`]);
  return (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
}
async function mkSupplier(tenantId: string, actorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO suppliers (tenant_id, name, created_by_actor_id) VALUES ($1::uuid,'Fornecedor E2E',$2::uuid) RETURNING id::text AS id`, [tenantId, actorId])).rows[0].id;
}
async function mkPO(tenantId: string, supplierId: string, actorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO purchase_orders (tenant_id, supplier_id, status, order_date, created_by_actor_id, metadata) VALUES ($1::uuid,$2::uuid,'SUBMITTED',NOW()::date,$3::uuid,'{}'::jsonb) RETURNING id::text AS id`, [tenantId, supplierId, actorId])).rows[0].id;
}

let CURRENT_AC: Record<string, unknown> = {};

async function main(): Promise<void> {
  await assertEphemeralDb();
  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'PO Receive Containment', slug: `poc-${Date.now()}` });
  const actor = await mkActor(TENANT, 'Owner');
  const supplier = await mkSupplier(TENANT, actor);
  const po = await mkPO(TENANT, supplier, actor);

  const apExists = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.accounts_payable') AS r`)).rows[0].r;
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  const splitsBefore = await count(`SELECT count(*)::int AS n FROM bank_splits`);
  const movBefore = await count(`SELECT count(*)::int AS n FROM inventory_movements`);

  const app = Fastify();
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => { req.tenant = { id: TENANT }; req.actionContext = CURRENT_AC; });
  await app.register(purchaseOrderRoutes);
  await app.ready();

  const receive = (id: string) => app.inject({ method: 'POST', url: `/purchase-orders/${id}/receive`, headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ items: [{ itemId: randomUUID(), quantityReceived: 5 }] }) });
  const is403 = (r: any) => r.statusCode === 403;
  const code = (r: any) => { try { return JSON.parse(r.body)?.error; } catch { return null; } };

  try {
    // T1 — rota → 403 CONTAINED.
    CURRENT_AC = { actorId: actor, actingUserId: randomUUID() };
    const r1 = await receive(po);
    record('T1 POST /purchase-orders/:id/receive → 403 PURCHASE_ORDER_RECEIVE_CONTAINED', is403(r1) && code(r1) === 'PURCHASE_ORDER_RECEIVE_CONTAINED', `status=${r1.statusCode} code=${code(r1)}`);

    // T2 — service direto lança CONTAINED (403) antes de mutar.
    let t2ok = false; let t2code = '';
    try { await purchaseOrderService.receivePO(TENANT, po, { items: [{ itemId: randomUUID(), quantityReceived: 5 }] } as any, randomUUID()); }
    catch (e) { const err = e as any; t2code = err?.code || err?.message; t2ok = err?.statusCode === 403 && /PURCHASE_ORDER_RECEIVE_CONTAINED/.test(t2code); }
    record('T2 service.receivePO direto → lança PURCHASE_ORDER_RECEIVE_CONTAINED (403)', t2ok, `code=${t2code}`);

    // T2b — orderId INEXISTENTE → ainda CONTAINED (prova hard-stop ANTES de getPurchaseOrderById).
    let t2bok = false; let t2bcode = '';
    try { await purchaseOrderService.receivePO(TENANT, randomUUID(), { items: [] } as any, randomUUID()); }
    catch (e) { const err = e as any; t2bcode = err?.code || err?.message; t2bok = /PURCHASE_ORDER_RECEIVE_CONTAINED/.test(t2bcode) && !/não encontrada/i.test(t2bcode); }
    record('T2b orderId inexistente → CONTAINED (não "Ordem não encontrada") ⇒ hard-stop precede a leitura', t2bok, `code=${t2bcode}`);

    // T3 — spoof actingUserId não destrava.
    CURRENT_AC = { actorId: actor, actingUserId: actor };
    const r3 = await receive(po);
    record('T3 spoof actionContext.actingUserId não destrava → 403', is403(r3), `status=${r3.statusCode}`);

    // T4 — spoof actorId não destrava.
    CURRENT_AC = { actorId: randomUUID(), actingUserId: randomUUID() };
    const r4 = await receive(po);
    record('T4 spoof actionContext.actorId não destrava → 403', is403(r4), `status=${r4.statusCode}`);

    // T5 — PO permanece SUBMITTED.
    const st = (await pool.query<{ status: string }>(`SELECT status::text FROM purchase_orders WHERE id=$1`, [po])).rows[0]?.status;
    record('T5 PO permanece SUBMITTED (não virou RECEIVED/COMPLETED)', st === 'SUBMITTED', `status=${st}`);

    // T6 — zero inventory_movements novos.
    record('T6 zero inventory_movements (sem INSERT)', (await count(`SELECT count(*)::int AS n FROM inventory_movements`)) === movBefore && movBefore === 0);

    // T7 — accounts_payable não religado.
    const apCount = apExists ? await count(`SELECT count(*)::int AS n FROM accounts_payable`) : 0;
    record('T7 accounts_payable não religado (ausente ou 0 linhas)', apCount === 0, `ap_exists=${!!apExists} count=${apCount}`);

    // T8 — Bank/ledger/split intocados.
    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    const splitsAfter = await count(`SELECT count(*)::int AS n FROM bank_splits`);
    record('T8 Bank/ledger/split intocados', bankAfter === bankBefore && splitsAfter === splitsBefore);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Recebimento de purchase_order CONTIDO fail-closed (hard-stop no service + rota 403); zero inventory/status/payable/Bank; created_by_actor_id não autoriza.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
