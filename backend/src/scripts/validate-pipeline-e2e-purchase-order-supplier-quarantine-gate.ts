/**
 * E2E F-PURCHASE-ORDER-SUPPLIER-QUARANTINE-GATE (§4.8.4).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-purchase-order-supplier-quarantine-gate-ephemeral.ps1.
 *
 * Prova que um actor empresarial bloqueado (owner_actor_id = AUTORIDADE; created_by = autoria) não cria/muta
 * supplier nem purchase order DECLARATIVOS; receivePO continua hard-stop; nada de inventory/AP/Bank:
 *   • não-bloqueado cria supplier/PO, addItem, submit, cancel → OK;
 *   • owner bloqueado → 403; acting/createdBy bloqueado (scope ativo) → 403; nenhuma linha nasce;
 *   • receivePO → 403 PURCHASE_ORDER_RECEIVE_CONTAINED (intacto);
 *   • canRepresentActor puro; zero inventory_movements; Δbank=0; schedules vazio.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { supplierService } from '../modules/marketplace/supplier.service';
import { purchaseOrderService } from '../modules/marketplace/purchase-order.service';
import { authorizationService } from '../core/authorization/authorization.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const errOf = (e: any): { code?: string; status?: number; msg: string } => ({ code: e?.code, status: e?.statusCode, msg: e?.message || String(e) });
const isBlocked403 = (err: any): boolean => err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(`${err?.code || ''} ${err?.msg || ''}`);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/purchase|order|supplier|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 97).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id };
}
const block = (tenantId: string, actorId: string) => pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [actorId, tenantId]);

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'PO Supplier Quarantine', slug: `posq-${Date.now()}` });
  const oA = await seedActor(TENANT_ID, 'OwnerA');   // owner empresarial — será bloqueado
  const oB = await seedActor(TENANT_ID, 'OwnerB');   // owner empresarial — permanece ativo
  const x = await seedActor(TENANT_ID, 'ActingX');   // acting/createdBy — será bloqueado

  // product + variant (FK fk_po_items_variant) — substrato test-only p/ addItem.
  const catId = (await pool.query<{ id: string }>(`SELECT category_id::text AS id FROM categories LIMIT 1`)).rows[0]?.id;
  const productId = (await pool.query<{ id: string }>(`INSERT INTO products (tenant_id, name, category_id) VALUES ($1::uuid,'E2E Product',$2::uuid) RETURNING id::text AS id`, [TENANT_ID, catId])).rows[0].id;
  const variantId = (await pool.query<{ id: string }>(`INSERT INTO product_variants (tenant_id, product_id, sku) VALUES ($1::uuid,$2::uuid,$3) RETURNING id::text AS id`, [TENANT_ID, productId, `sku-${Date.now()}`])).rows[0].id;

  const mkSupplier = (owner: string, createdBy: string) =>
    supplierService.createSupplier(TENANT_ID, { name: `Sup-${seq++}`, ownerActorId: owner } as any, createdBy)
      .then((s) => ({ ok: true, id: (s as any).id } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const mkPO = (supplierId: string, owner: string, createdBy: string) =>
    purchaseOrderService.createPO(TENANT_ID, { supplierId, ownerActorId: owner } as any, createdBy)
      .then((o) => ({ ok: true, id: (o as any).id } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const addItem = (orderId: string, createdBy: string) =>
    purchaseOrderService.addItem(TENANT_ID, orderId, { productVariantId: variantId, quantityOrdered: 5 } as any, createdBy)
      .then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const submit = (orderId: string, by: string) => purchaseOrderService.submitPO(TENANT_ID, orderId, by).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const cancel = (orderId: string, by: string) => purchaseOrderService.cancelPO(TENANT_ID, orderId, by).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const invSql = `SELECT COALESCE((SELECT count(*) FROM inventory_movements),0)::int AS n`;
  const bankBefore = await count(bankSql);
  const invBefore = await count(invSql).catch(() => 0);

  // ── FASE OK (ninguém bloqueado) ──
  const s1 = (await mkSupplier(oA.actorId, oA.actorId)); record('T1 owner cria supplier → OK', s1.ok === true && !!s1.id);
  const s2 = (await mkSupplier(oB.actorId, oB.actorId));
  const po1 = (await mkPO(s1.id, oA.actorId, oA.actorId)); record('T2 owner cria purchase order → OK', po1.ok === true && !!po1.id);
  { const r = await addItem(po1.id, oA.actorId); record('T3 owner addItem → OK', r.ok === true, JSON.stringify(r.err)); }
  record('T4 owner submitPO → OK', (await submit(po1.id, oA.actorId)).ok === true);
  const po2 = (await mkPO(s1.id, oA.actorId, oA.actorId));
  record('T5 owner cancelPO → OK', (await cancel(po2.id, oA.actorId)).ok === true);
  const po3 = (await mkPO(s1.id, oA.actorId, oA.actorId)); // DRAFT p/ submit bloqueado — ganha item ANTES do bloqueio
  await addItem(po3.id, oA.actorId);
  const po4 = (await mkPO(s1.id, oA.actorId, oA.actorId)); // DRAFT p/ cancel bloqueado
  const poB = (await mkPO(s2.id, oB.actorId, oB.actorId)); // DRAFT owner ativo, p/ acting bloqueado

  const supBefore = await count(`SELECT count(*)::int AS n FROM suppliers WHERE tenant_id=$1 AND owner_actor_id=$2`, [TENANT_ID, oA.actorId]);
  const poBefore = await count(`SELECT count(*)::int AS n FROM purchase_orders WHERE tenant_id=$1 AND owner_actor_id=$2`, [TENANT_ID, oA.actorId]);
  const itemsPo3Before = await count(`SELECT count(*)::int AS n FROM purchase_order_items WHERE tenant_id=$1 AND purchase_order_id=$2`, [TENANT_ID, po3.id]); // =1 (item legítimo pré-bloqueio)

  await block(TENANT_ID, oA.actorId);
  await block(TENANT_ID, x.actorId);

  // ── SUPPLIER quarentena ──
  record('T6 owner bloqueado cria supplier → 403', isBlocked403((await mkSupplier(oA.actorId, oA.actorId)).err));
  record('T7 acting bloqueado (scope ativo) cria supplier → 403', isBlocked403((await mkSupplier(oB.actorId, x.actorId)).err));
  record('T8 bloqueado → nenhum supplier novo', (await count(`SELECT count(*)::int AS n FROM suppliers WHERE tenant_id=$1 AND owner_actor_id=$2`, [TENANT_ID, oA.actorId])) === supBefore);

  // ── PURCHASE ORDER quarentena ──
  record('T9 owner bloqueado cria PO → 403', isBlocked403((await mkPO(s1.id, oA.actorId, oA.actorId)).err));
  record('T10 acting bloqueado (scope ativo) cria PO → 403', isBlocked403((await mkPO(s2.id, oB.actorId, x.actorId)).err));
  record('T11 bloqueado → nenhuma PO nova', (await count(`SELECT count(*)::int AS n FROM purchase_orders WHERE tenant_id=$1 AND owner_actor_id=$2`, [TENANT_ID, oA.actorId])) === poBefore);
  record('T12 owner bloqueado addItem → 403', isBlocked403((await addItem(po3.id, oA.actorId)).err));
  record('T13 acting bloqueado addItem (PO de owner ativo) → 403', isBlocked403((await addItem(poB.id, x.actorId)).err));
  record('T14 owner bloqueado submitPO → 403', isBlocked403((await submit(po3.id, oA.actorId)).err));
  record('T15 owner bloqueado cancelPO → 403', isBlocked403((await cancel(po4.id, oA.actorId)).err));
  {
    const po3After = await count(`SELECT count(*)::int AS n FROM purchase_order_items WHERE tenant_id=$1 AND purchase_order_id=$2`, [TENANT_ID, po3.id]);
    const po4Items = await count(`SELECT count(*)::int AS n FROM purchase_order_items WHERE tenant_id=$1 AND purchase_order_id=$2`, [TENANT_ID, po4.id]);
    record('T16 addItem bloqueado não criou item novo (po3 mantém o item legítimo pré-bloqueio; po4=0)', po3After === itemsPo3Before && po4Items === 0, `po3=${po3After} (before ${itemsPo3Before}) po4=${po4Items}`);
  }

  // ── RECEIVE PO HARD-STOP (intacto, não reaberto) ──
  {
    const r = await purchaseOrderService.receivePO(TENANT_ID, po1.id, {} as any).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
    record('T17 receivePO → 403 PURCHASE_ORDER_RECEIVE_CONTAINED (hard-stop intacto)', r.ok === false && r.err?.status === 403 && /PURCHASE_ORDER_RECEIVE_CONTAINED/.test(`${r.err?.code || ''} ${r.err?.msg || ''}`), JSON.stringify(r.err));
  }

  // ── NÃO-REGRESSÃO / MONEY-FREE / INVENTORY-FREE ──
  record('T18 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, oA.userId, oA.actorId)) === true);
  record('T19 zero inventory_movements (PO declarativa não toca estoque)', (await count(invSql).catch(() => 0)) === invBefore, `before=${invBefore}`);
  record('T20 Δbank=0 (nenhum bank_* tocado)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);
  record('T21 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ owner/acting bloqueado não cria/muta supplier/PO (owner=autoridade); receivePO hard-stop; zero inventory; canRepresentActor puro; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
