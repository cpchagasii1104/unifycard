# SPRINT 69: SUPPLIERS + PURCHASE ORDERS

**Data:** 2024-12-19  
**Objetivo:** Criar núcleo de compras e fornecedores do ERP, sem executar pagamento automático e sem fiscal externo.

**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO DAS MUDANÇAS

### 1.1. Migrations Criadas

**Arquivos:**
- `backend/migrations/196_create_suppliers.sql` - Tabela `suppliers`
- `backend/migrations/197_create_purchase_orders.sql` - Tabela `purchase_orders`
- `backend/migrations/198_create_purchase_order_items.sql` - Tabela `purchase_order_items`

**Estrutura:**

**suppliers:**
- Status: `ACTIVE`, `INACTIVE`, `SUSPENDED`
- Campos: name, code (único), email, phone, contact_name, address, tax_id, etc.
- RLS habilitado
- Índices para performance

**purchase_orders:**
- Status: `DRAFT`, `SUBMITTED`, `RECEIVED`, `COMPLETED`, `CANCELLED`
- Campos: supplier_id, order_number (único), order_date, expected_delivery_date, delivery_address, etc.
- RLS habilitado
- Índices para performance

**purchase_order_items:**
- Campos: purchase_order_id, product_variant_id, quantity_ordered, quantity_received (acumulada), unit_price_cents, etc.
- Constraints: quantity_received <= quantity_ordered
- RLS habilitado
- Índices para performance

### 1.2. Services Criados

**SupplierService:**
- `createSupplier()` - Cria fornecedor
- `listSuppliers()` - Lista fornecedores com filtros
- `getSupplierById()` - Busca fornecedor por ID

**PurchaseOrderService:**
- `createPO()` - Cria ordem (status: DRAFT)
- `addItem()` - Adiciona item à ordem
- `submitPO()` - Submete ordem (DRAFT → SUBMITTED)
- `receivePO()` - Recebe ordem (SUBMITTED/RECEIVED → RECEIVED/COMPLETED) + gera inventory_movements IN
- `cancelPO()` - Cancela ordem
- `listPOs()` - Lista ordens com filtros
- `getPOById()` - Busca ordem por ID
- `getItemsByOrderId()` - Lista itens de uma ordem

### 1.3. Integração com Inventory

**receivePO → inventory_movements:**
- Quando ordem é recebida, cria `inventory_movement` tipo `IN` para cada item recebido
- `reference_type = 'purchase_order'`
- `reference_id = purchase_order_id`
- `reason = 'Recebimento de ordem de compra {order_number}'`
- Metadata inclui: `purchase_order_id`, `purchase_order_item_id`, `supplier_id`, `notes`

**SLA e Aging:**
- Funcionam automaticamente (são derivados de `inventory_movements`)
- Não requer alterações adicionais

### 1.4. Rotas REST

**Suppliers:**
- `POST /suppliers` - Cria fornecedor
- `GET /suppliers` - Lista fornecedores
- `GET /suppliers/:id` - Busca fornecedor

**Purchase Orders:**
- `POST /purchase-orders` - Cria ordem
- `GET /purchase-orders` - Lista ordens
- `GET /purchase-orders/:id` - Busca ordem
- `GET /purchase-orders/:id/items` - Lista itens
- `POST /purchase-orders/:id/items` - Adiciona item
- `POST /purchase-orders/:id/submit` - Submete ordem
- `POST /purchase-orders/:id/receive` - Recebe ordem
- `POST /purchase-orders/:id/cancel` - Cancela ordem

---

## 2. ESTRUTURA DE DADOS

### 2.1. suppliers

```sql
CREATE TABLE suppliers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50), -- Único por tenant
    email VARCHAR(255),
    phone VARCHAR(50),
    contact_name VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100),
    tax_id VARCHAR(50), -- CNPJ/CPF
    registration_number VARCHAR(50), -- Inscrição estadual
    status supplier_status NOT NULL DEFAULT 'ACTIVE',
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 2.2. purchase_orders

```sql
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    order_number VARCHAR(50), -- Único por tenant
    status purchase_order_status NOT NULL DEFAULT 'DRAFT',
    order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expected_delivery_date TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    delivery_address TEXT,
    delivery_city VARCHAR(100),
    delivery_state VARCHAR(100),
    delivery_zip_code VARCHAR(20),
    notes TEXT,
    internal_notes TEXT,
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    submitted_at TIMESTAMP WITH TIME ZONE,
    submitted_by_actor_id UUID,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by_actor_id UUID,
    cancellation_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 2.3. purchase_order_items

```sql
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,
    product_variant_id UUID NOT NULL,
    quantity_ordered NUMERIC(20, 4) NOT NULL,
    quantity_received NUMERIC(20, 4) NOT NULL DEFAULT 0, -- Acumulada
    unit VARCHAR(50) NOT NULL DEFAULT 'un',
    unit_price_cents BIGINT,
    currency VARCHAR(10) DEFAULT 'BRL',
    total_price_cents BIGINT,
    notes TEXT,
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

## 3. LIFECYCLE DE ORDEM DE COMPRA

### 3.1. Transições de Status

```
DRAFT → SUBMITTED → RECEIVED → COMPLETED
  ↓         ↓
CANCELLED CANCELLED
```

**Regras:**
- DRAFT: Ordem criada, pode adicionar itens
- SUBMITTED: Ordem enviada ao fornecedor (não pode mais adicionar itens)
- RECEIVED: Ordem recebida parcialmente ou totalmente
- COMPLETED: Todos os itens foram recebidos completamente
- CANCELLED: Ordem cancelada (apenas DRAFT ou SUBMITTED)

### 3.2. Validações

**Ao Criar:**
- `supplier_id` deve existir
- `order_number` deve ser único por tenant (se fornecido)

**Ao Adicionar Item:**
- Ordem deve estar em DRAFT
- `quantity_ordered > 0`
- `product_variant_id` deve existir

**Ao Submeter:**
- Ordem deve estar em DRAFT
- Ordem deve ter pelo menos um item

**Ao Receber:**
- Ordem deve estar em SUBMITTED ou RECEIVED
- `quantity_received` não pode exceder `quantity_ordered`
- Se todos os itens recebidos completamente, status → COMPLETED
- Se parcial, status → RECEIVED

**Ao Cancelar:**
- Ordem deve estar em DRAFT ou SUBMITTED
- Não pode cancelar se já recebeu itens

---

## 4. INTEGRAÇÃO COM INVENTORY

### 4.1. Criação de Inventory Movements

**Quando:** `receivePO()` é chamado

**O que é criado:**
- Para cada item recebido, cria `inventory_movement` tipo `IN`
- `product_variant_id` = item.product_variant_id
- `quantity` = quantidade recebida
- `unit` = item.unit
- `reason` = `'Recebimento de ordem de compra {order_number}'`
- `reference_type` = `'purchase_order'`
- `reference_id` = `order_id`
- `metadata` = `{ purchase_order_id, purchase_order_item_id, supplier_id, notes }`

**Exemplo:**
```typescript
await inventoryService.addMovement(tenantId, {
  productVariantId: item.productVariantId,
  movementType: 'IN',
  quantity: receiveItem.quantityReceived,
  unit: item.unit,
  reason: `Recebimento de ordem de compra ${order.orderNumber || orderId}`,
  referenceType: 'purchase_order',
  referenceId: orderId,
  metadata: {
    purchase_order_id: orderId,
    purchase_order_item_id: item.id,
    supplier_id: order.supplierId,
    notes: receiveItem.notes || input.notes,
  },
}, receivedByUserId);
```

### 4.2. SLA e Aging Automáticos

**SLA (Stock Aging):**
- Calculado automaticamente a partir de `inventory_movements`
- Não requer alterações

**Aging:**
- Calculado automaticamente a partir de `inventory_movements`
- Não requer alterações

---

## 5. AUDITORIA

### 5.1. Eventos Registrados

**Suppliers:**
- `SUPPLIER_CREATED` - Quando fornecedor é criado

**Purchase Orders:**
- `PURCHASE_ORDER_CREATED` - Quando ordem é criada
- `PURCHASE_ORDER_ITEM_ADDED` - Quando item é adicionado
- `PURCHASE_ORDER_SUBMITTED` - Quando ordem é submetida
- `PURCHASE_ORDER_RECEIVED` - Quando ordem é recebida
- `PURCHASE_ORDER_CANCELLED` - Quando ordem é cancelada

### 5.2. Contexto de Auditoria

Cada evento inclui:
- `order_id` / `supplier_id` / `item_id`
- `status` (quando aplicável)
- `created_by_user_id` / `submitted_by_user_id` / `received_by_user_id` / `cancelled_by_user_id`
- `cancellation_reason` (se cancelado)
- `items_received` (quando recebido)

---

## 6. GUARDRAILS RESPEITADOS

### 6.1. Purchase Order NÃO é Order

- ✅ Purchase Order é domínio de compras (ERP)
- ✅ Order (marketplace) é domínio de vendas
- ✅ Não há confusão entre os dois

### 6.2. Não Executa Pagamento

- ✅ Nenhum pagamento executado automaticamente
- ✅ Nenhuma criação de PaymentIntent
- ✅ Nenhuma criação de PaymentTransaction

### 6.3. Não Emite Fiscal

- ✅ Nenhuma emissão fiscal automática
- ✅ Nenhuma criação de FiscalDocument
- ✅ Nenhuma chamada a FiscalProvider

### 6.4. Inventory Entra Apenas no RECEIVE

- ✅ Inventory movements criados apenas quando `receivePO()` é chamado
- ✅ Não cria movements em DRAFT ou SUBMITTED
- ✅ Movements são do tipo `IN`

### 6.5. Tudo Auditável

- ✅ Todas as mudanças geram audit event
- ✅ Contexto completo registrado
- ✅ Falha de auditoria não bloqueia operação

---

## 7. ARQUIVOS CRIADOS

### 7.1. Migrations

1. `backend/migrations/196_create_suppliers.sql`
2. `backend/migrations/197_create_purchase_orders.sql`
3. `backend/migrations/198_create_purchase_order_items.sql`

### 7.2. Types

4. `backend/src/modules/marketplace/supplier.types.ts`
5. `backend/src/modules/marketplace/purchase-order.types.ts`

### 7.3. Repositories

6. `backend/src/modules/marketplace/supplier.repository.ts`
7. `backend/src/modules/marketplace/purchase-order.repository.ts`

### 7.4. Services

8. `backend/src/modules/marketplace/supplier.service.ts`
9. `backend/src/modules/marketplace/purchase-order.service.ts`

### 7.5. Routes

10. `backend/src/modules/marketplace/supplier.routes.ts`
11. `backend/src/modules/marketplace/purchase-order.routes.ts`
12. `backend/src/modules/marketplace/marketplace.routes.ts` (atualizado)

---

## 8. EXEMPLOS DE USO

### 8.1. Criar Fornecedor e Ordem de Compra

```typescript
// 1. Criar fornecedor
const supplier = await supplierService.createSupplier(tenantId, {
  name: 'Fornecedor ABC',
  code: 'FORN-001',
  email: 'contato@fornecedor.com',
  phone: '+5511999999999',
  taxId: '12.345.678/0001-90',
  status: 'ACTIVE',
}, 'created-by-actor-123', 'user-123');

// 2. Criar ordem de compra
const order = await purchaseOrderService.createPO(tenantId, {
  supplierId: supplier.id,
  orderNumber: 'PO-2024-001',
  orderDate: new Date(),
  expectedDeliveryDate: new Date('2024-12-25'),
  notes: 'Entrega urgente',
}, 'created-by-actor-123', 'user-123');

// 3. Adicionar itens
const item1 = await purchaseOrderService.addItem(tenantId, order.id, {
  productVariantId: 'variant-123',
  quantityOrdered: 100,
  unit: 'un',
  unitPriceCents: 1000, // R$ 10,00
  currency: 'BRL',
}, 'created-by-actor-123', 'user-123');

// 4. Submeter ordem
const submittedOrder = await purchaseOrderService.submitPO(
  tenantId,
  order.id,
  'submitted-by-actor-123',
  'user-123'
);
```

### 8.2. Receber Ordem (Gera Inventory Movements)

```typescript
// Receber ordem (parcial ou total)
const result = await purchaseOrderService.receivePO(tenantId, order.id, {
  items: [
    {
      itemId: item1.id,
      quantityReceived: 100, // Recebido completamente
      notes: 'Recebido em perfeito estado',
    },
  ],
  notes: 'Recebimento confirmado',
}, 'user-123');

// result.order.status = 'COMPLETED' (se todos os itens recebidos)
// result.movements = [{ itemId: 'item-123', movementId: 'movement-456' }]

// Inventory movement foi criado automaticamente:
// - movement_type = 'IN'
// - quantity = 100
// - reference_type = 'purchase_order'
// - reference_id = order.id
```

---

## 9. CRITÉRIO DE PRONTO

### ✅ Todos os Critérios Atendidos

1. **É possível criar fornecedor:**
   - ✅ `POST /suppliers` cria fornecedor

2. **É possível criar ordem de compra:**
   - ✅ `POST /purchase-orders` cria ordem em DRAFT

3. **É possível adicionar itens:**
   - ✅ `POST /purchase-orders/:id/items` adiciona item

4. **É possível submeter ordem:**
   - ✅ `POST /purchase-orders/:id/submit` submete ordem

5. **É possível receber ordem:**
   - ✅ `POST /purchase-orders/:id/receive` recebe ordem
   - ✅ Gera inventory_movements IN automaticamente

6. **Purchase Order NÃO é Order:**
   - ✅ Domínios separados
   - ✅ Nenhuma confusão

7. **Não executa pagamento:**
   - ✅ Nenhum pagamento executado
   - ✅ Nenhuma criação de PaymentIntent

8. **Não emite fiscal:**
   - ✅ Nenhuma emissão fiscal
   - ✅ Nenhuma criação de FiscalDocument

9. **Inventory entra apenas no RECEIVE:**
   - ✅ Movements criados apenas quando recebe ordem
   - ✅ Tipo IN

10. **Tudo auditável:**
    - ✅ Todas as mudanças geram audit event
    - ✅ Contexto completo registrado

---

## 10. PRÓXIMOS PASSOS (FUTURO)

### 10.1. Integração com Pagamento (Futuro)

- Quando ordem completa, pode criar `PaymentIntent` (não executar)
- Pagamento via `ScheduledAction` (SPRINT 67)

### 10.2. Integração com Fiscal (Futuro)

- Quando ordem completa, pode criar `FiscalDocument` (não emitir)
- Emissão fiscal via `ScheduledAction` (SPRINT 67)

### 10.3. Notificações (Futuro)

- Notificar fornecedor quando ordem é submetida
- Notificar comprador quando ordem é recebida

### 10.4. Relatórios (Futuro)

- Relatório de compras por fornecedor
- Relatório de recebimentos pendentes
- Relatório de SLA de recebimento

---

**Fim do Relatório**




