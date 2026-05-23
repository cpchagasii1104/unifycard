// Script CIRURGICO de smoke da cadeia supply (PASSO 6b do trilho Codex/Clayton).
// Atravessa 8 elos (seed supplier -> seed product -> seed variant -> createPO ->
// addItem -> submitPO -> receivePO -> verificações via getCurrentBalance/byActor).
//
// PATTERN: service-direct (precedente: energize-circuit-2026-05-17.ts).
// SEM HTTP, SEM JWT, SEM mock, SEM disable trigger, SEM cleanup magico.
// APPEND-ONLY: nenhum DELETE no script.
//
// REVERSIBILIDADE: todas rows criadas tem metadata.test_smoke = 'smoke_supply_chain_2026_05_17'.
// Cleanup futuro (se autorizado): DELETE FROM <tabela> WHERE metadata->>'test_smoke' = 'smoke_supply_chain_2026_05_17'.
//
// IDEMPOTENCIA: cada seed (supplier/product/variant) faz SELECT por marker antes de criar; reusa se existir.

import 'dotenv/config';
import { pool } from '../src/core/database/pool';
import { socialPortsRegistry } from '../src/core/social/ports-registry';
import { supplierService } from '../src/modules/marketplace/supplier.service';
import { productCatalogService } from '../src/modules/marketplace/product-catalog.service';
import { purchaseOrderService } from '../src/modules/marketplace/purchase-order.service';
import { inventoryService } from '../src/modules/marketplace/inventory.service';

async function bootstrap() {
  const {
    actorRepositoryAdapter,
    actorUtilsAdapter,
    socialRepositoryAdapter,
    socialServiceAdapter,
    eventFeedHandlersAdapter,
  } = await import('../src/modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);
}

const TENANT = 'fbe13b78-4516-493d-905a-363796aea1d1'; // Clínica Sorrisos tenant (já energizado em commit 0c710b47)
const ACTOR_CD = 'ad5a60b7-7ea1-4d79-a7f4-4c86438ea73a'; // page actor Clínica Sorrisos
const OWNER_USER = 'a733e66f-b8bd-4bd2-a888-bec820f55339'; // admin (reuso do energize prévio)
const CATEGORY_SAUDE = '11100000-0000-0000-0000-000000000002'; // marketplace-saude-beleza (scope=global)

const TEST_MARKER = 'smoke_supply_chain_2026_05_17';

async function findOrCreateSupplier(): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM suppliers WHERE tenant_id = $1 AND metadata->>'test_smoke' = $2 LIMIT 1`,
    [TENANT, TEST_MARKER]
  );
  if (existing.rows.length > 0) {
    console.log(`  REUSO supplierId=${existing.rows[0].id}`);
    return existing.rows[0].id;
  }
  // Workaround DT-DRIFT-STATUS-CASE-SYSTEMIC (PASSO 6b descobriu, Clayton autorizou Opção A):
  // supplier.service.ts:48 usa 'ACTIVE' (UPPERCASE) mas DB CHECK exige 'active'|'inactive' (lowercase).
  // Cast intencional 'active' as SupplierStatus para sobrepor o default UPPERCASE do service.
  // Bug raiz fica documentado em REMEDIATION_DT_LOG (frente própria, não fix de oportunidade).
  const supplier = await supplierService.createSupplier(
    TENANT,
    {
      name: 'Fornecedor Smoke Material Clínico',
      status: 'active' as any, // DT-DRIFT-STATUS-CASE-SYSTEMIC: workaround temporário
      metadata: { test_smoke: TEST_MARKER, scenario: 'supply_chain_minimo' },
    },
    ACTOR_CD,
    OWNER_USER
  );
  console.log(`  CRIADO supplierId=${supplier.id} name="${supplier.name}"`);
  return supplier.id;
}

async function findOrCreateProduct(): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM products WHERE tenant_id = $1 AND metadata->>'test_smoke' = $2 LIMIT 1`,
    [TENANT, TEST_MARKER]
  );
  if (existing.rows.length > 0) {
    console.log(`  REUSO productId=${existing.rows[0].id}`);
    return existing.rows[0].id;
  }
  // Workaround DT-DRIFT-SCHEMA-CODE-MISMATCH-CATEGORIES (ELO 2 descobriu, Clayton autorizou Opção A):
  // categories.repository.ts:110 faz SELECT incluindo coluna 'domain_type' que NÃO existe na
  // tabela categories (21 colunas reais, sem domain_type). productCatalogService.createProduct
  // chama esse repository quando categoryId é fornecido (guard linha 301). Omitir categoryId
  // pula o guard. Interface CreateProductInput confirma categoryId como opcional.
  // Bug raiz fica documentado em REMEDIATION_DT_LOG (frente própria).
  const product = await productCatalogService.createProduct(TENANT, {
    name: 'Caneta dental',
    description: 'Caneta odontológica — smoke supply chain',
    // categoryId omitido: DT-DRIFT-SCHEMA-CODE-MISMATCH-CATEGORIES (workaround temporário)
    productType: 'UNIT',
    isActive: true,
    metadata: { test_smoke: TEST_MARKER, scenario: 'supply_chain_minimo', category_skipped: 'DT-DRIFT-SCHEMA' },
  });
  console.log(`  CRIADO productId=${product.id} name="${product.name}" type=${product.productType}`);
  return product.id;
}

async function findOrCreateVariant(productId: string): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM product_variants WHERE tenant_id = $1 AND metadata->>'test_smoke' = $2 LIMIT 1`,
    [TENANT, TEST_MARKER]
  );
  if (existing.rows.length > 0) {
    console.log(`  REUSO variantId=${existing.rows[0].id}`);
    return existing.rows[0].id;
  }
  const variant = await productCatalogService.createVariant(TENANT, {
    productId,
    sku: 'CANETA-DENTAL-SMOKE-001',
    attributes: {},
    isActive: true,
    metadata: { test_smoke: TEST_MARKER, scenario: 'supply_chain_minimo' },
  });
  console.log(`  CRIADO variantId=${variant.id} sku=${variant.sku}`);
  return variant.id;
}

async function main() {
  await bootstrap();
  console.log('=== SMOKE SUPPLY CHAIN ===');
  console.log(`Tenant:    ${TENANT}`);
  console.log(`Actor CD:  ${ACTOR_CD} (Clínica Sorrisos)`);
  console.log(`User:      ${OWNER_USER}`);
  console.log(`Category:  ${CATEGORY_SAUDE} (Saúde e Beleza)`);
  console.log(`Marker:    ${TEST_MARKER}`);
  console.log('');

  // ELO 1: SEED supplier
  console.log('[ELO 1] supplier (seed idempotente)');
  const supplierId = await findOrCreateSupplier();

  // ELO 2: SEED product
  console.log('[ELO 2] product (seed idempotente)');
  const productId = await findOrCreateProduct();

  // ELO 3: SEED variant
  console.log('[ELO 3] product_variant (seed idempotente)');
  const variantId = await findOrCreateVariant(productId);

  // ELO 4: createPO
  console.log('[ELO 4] createPO');
  const po = await purchaseOrderService.createPO(
    TENANT,
    {
      supplierId,
      orderNumber: `PO-SMOKE-${Date.now()}`,
      metadata: { test_smoke: TEST_MARKER, scenario: 'supply_chain_minimo' },
    },
    ACTOR_CD,
    OWNER_USER
  );
  console.log(`  OK poId=${po.id} status=${po.status} orderNumber=${po.orderNumber}`);

  // ELO 5: addItem
  console.log('[ELO 5] addItem(qty=100, unit=un)');
  const item = await purchaseOrderService.addItem(
    TENANT,
    po.id,
    {
      productVariantId: variantId,
      quantityOrdered: 100,
      unit: 'un',
      unitPriceCents: 500, // R$ 5,00/un
      currency: 'BRL',
      metadata: { test_smoke: TEST_MARKER },
    },
    ACTOR_CD,
    OWNER_USER
  );
  console.log(`  OK itemId=${item.id} qty=${item.quantityOrdered} unitPriceCents=${item.unitPriceCents}`);

  // ELO 6: submitPO
  console.log('[ELO 6] submitPO (DRAFT -> SUBMITTED)');
  const submitted = await purchaseOrderService.submitPO(TENANT, po.id, ACTOR_CD, OWNER_USER);
  console.log(`  OK status=${submitted.status}`);

  // ELO 7: receivePO (gera inventory_movements IN)
  console.log('[ELO 7] receivePO(qty=100) — gera inventory_movements IN');
  const result = await purchaseOrderService.receivePO(
    TENANT,
    po.id,
    {
      items: [
        {
          itemId: item.id,
          quantityReceived: 100,
          notes: 'smoke supply chain — recebimento integral',
        },
      ],
      notes: 'Recebimento smoke 2026-05-17',
    },
    OWNER_USER
  );
  console.log(`  OK status=${result.order.status} movements=${result.movements.length}`);
  for (const m of result.movements) {
    console.log(`     movementId=${m.movementId} itemId=${m.itemId}`);
  }

  // ELO 8: VERIFICAÇÕES DE LEITURA
  console.log('[ELO 8] verificações de leitura (PASSO 3 + PASSO 4)');
  const balanceMatrix = await inventoryService.getCurrentBalance(TENANT, variantId);
  console.log(
    `  matriz tenant-wide:    quantity=${balanceMatrix.quantity} unit=${balanceMatrix.unit}  (esperado: 100 un)`
  );
  const balanceActor = await inventoryService.getCurrentBalanceByActor(
    TENANT,
    ACTOR_CD,
    variantId
  );
  console.log(
    `  operacional (Clínica): quantity=${balanceActor.quantity} unit=${balanceActor.unit}  (esperado: 100 un)`
  );

  // Verificação cruzada com SQL direto na SSOT física (inventory_movements)
  const ssotCheck = await pool.query<{ total: string; movement_count: string }>(
    `SELECT
       COALESCE(SUM(CASE movement_type WHEN 'IN' THEN quantity WHEN 'OUT' THEN -quantity ELSE quantity END), 0)::text AS total,
       COUNT(*)::text AS movement_count
     FROM inventory_movements
     WHERE tenant_id = $1 AND actor_id = $2 AND product_variant_id = $3`,
    [TENANT, ACTOR_CD, variantId]
  );
  const ssotTotal = parseFloat(ssotCheck.rows[0].total);
  const ssotCount = parseInt(ssotCheck.rows[0].movement_count, 10);
  console.log(
    `  SSOT inventory_movements: rows=${ssotCount} sum(IN-OUT)=${ssotTotal}  (esperado: rows≥1, sum=100)`
  );

  const ok =
    balanceMatrix.quantity === 100 &&
    balanceActor.quantity === 100 &&
    ssotTotal === 100 &&
    ssotCount >= 1 &&
    result.order.status === 'COMPLETED';

  console.log('');
  if (ok) {
    console.log('=== SMOKE OK — CIRCUITO SUPPLY CHAIN FECHADO ===');
    console.log(`Fluxo materializado: supplier -> product -> variant -> PO(DRAFT) -> SUBMITTED -> COMPLETED`);
    console.log(`Causalidade fisica: 1 row em inventory_movements (IN, qty=100, actor=Clinica)`);
    console.log(`Leitura consistente: matriz=100 == operacional=100 == SSOT=100`);
  } else {
    console.error('=== SMOKE FALHOU NA VERIFICAÇÃO FINAL ===');
    console.error(
      `Detalhes: matriz=${balanceMatrix.quantity} actor=${balanceActor.quantity} ssotSum=${ssotTotal} ssotCount=${ssotCount} poStatus=${result.order.status}`
    );
    throw new Error('Verificação final falhou — ver detalhes acima');
  }

  console.log('');
  console.log(
    `Reverter (se autorizado): DELETE FROM <tabela> WHERE metadata->>'test_smoke'='${TEST_MARKER}'`
  );
  console.log(
    `Tabelas tocadas: suppliers, products, product_variants, purchase_orders, purchase_order_items, inventory_movements, inventory_balances`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('');
    console.error('=== FALHA ===');
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    pool.end().catch(() => {});
  });
