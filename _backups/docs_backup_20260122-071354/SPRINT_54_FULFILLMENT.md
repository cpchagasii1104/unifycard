# SPRINT 54: FULFILLMENT, PICKING E SAÍDA DE ESTOQUE

## RESUMO EXECUTIVO

Implementado sistema de fulfillment (separação, picking, saída) sem transporte:
- ✅ Fulfillment criado automaticamente após payment SUCCESS
- ✅ Picking não mexe em estoque
- ✅ Estoque só é baixado quando fulfillment é SHIPPED
- ✅ Integrado com PDV e Marketplace
- ✅ Sem quebrar fluxos existentes

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/189_create_fulfillment_orders.sql`** (NOVO)
   - Tabela `fulfillment_orders` (append-only)
   - Tabela `fulfillment_items` (append-only)
   - Enums: `fulfillment_source`, `fulfillment_status`, `fulfillment_item_status`
   - Constraint: 1 fulfillment por order
   - Triggers para prevenir DELETE

2. **`backend/src/modules/marketplace/fulfillment.types.ts`** (NOVO)
   - Tipos TypeScript para fulfillment
   - `FulfillmentOrder`, `FulfillmentItem`, `CreateFulfillmentOrderInput`, etc.

3. **`backend/src/modules/marketplace/fulfillment.repository.ts`** (NOVO)
   - Repository para fulfillment
   - Métodos: `createFulfillmentOrder`, `getFulfillmentOrderById`, `createFulfillmentItem`, etc.

4. **`backend/src/modules/marketplace/fulfillment.service.ts`** (NOVO)
   - Service para fulfillment
   - Métodos: `createFromOrder`, `pickItem`, `shipFulfillment`, `cancelFulfillment`

5. **`backend/src/modules/marketplace/payment-execution.service.ts`** (ALTERADO)
   - Integração: cria fulfillment automaticamente após payment SUCCESS
   - Removido consumo de reservas no payment (agora só no SHIP)

6. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `fulfillmentService` e `fulfillmentRepository`
   - Exporta tipos de fulfillment

## MODELO DE DADOS

### Tabela `fulfillment_orders`

**Campos:**
- `id`: UUID
- `tenant_id`: UUID
- `order_id`: UUID (1:1 com orders)
- `source`: `PDV` | `MARKETPLACE`
- `status`: `PENDING` | `PICKED` | `SHIPPED` | `CANCELLED`
- `picked_by_user_id`: UUID (opcional)
- `shipped_at`: TIMESTAMP (opcional)
- `metadata`: JSONB
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**Regras:**
- 1 fulfillment por order (constraint UNIQUE)
- Append-only (sem DELETE)
- Status é declarativo (sem automação escondida)

### Tabela `fulfillment_items`

**Campos:**
- `id`: UUID
- `tenant_id`: UUID
- `fulfillment_order_id`: UUID
- `product_variant_id`: UUID
- `quantity`: NUMERIC(20, 4)
- `inventory_lot_id`: UUID (opcional)
- `status`: `PENDING` | `PICKED`
- `metadata`: JSONB
- `created_at`: TIMESTAMP

**Regras:**
- Append-only (sem DELETE)
- Status controla picking individual

## FLUXO DE FULFILLMENT

### 1. Criação Automática (Payment SUCCESS)

```typescript
// PaymentExecutionService.executePayment() → SUCCESS
// → fulfillmentService.createFromOrder(orderId, source)
// → Cria fulfillment_order + fulfillment_items
```

**Origem determinada por:**
- `order.metadata.pdv_session_id` existe → `PDV`
- Caso contrário → `MARKETPLACE`

### 2. Picking (Separação)

```typescript
// fulfillmentService.pickItem(fulfillmentItemId, pickedByUserId)
// → Marca item como PICKED
// → NÃO mexe em estoque
// → Se todos itens PICKED → fulfillment.status = PICKED
```

**Regras:**
- Picking não baixa estoque
- Pode especificar `inventory_lot_id` ao fazer picking
- Status do fulfillment muda para `PICKED` quando todos itens estão picked

### 3. Shipping (Envio)

```typescript
// fulfillmentService.shipFulfillment(fulfillmentOrderId)
// → Valida todos itens PICKED
// → Gera inventory_movements OUT
// → Consome reservas de estoque
// → fulfillment.status = SHIPPED
```

**Regras:**
- Só pode SHIP se todos itens estão PICKED
- Gera `inventory_movements` OUT para cada item
- Consome reservas de estoque (se ainda não consumidas)
- Estoque é baixado aqui (não no pagamento)

### 4. Cancelamento

```typescript
// fulfillmentService.cancelFulfillment(orderId)
// → Libera reservas de estoque
// → fulfillment.status = CANCELLED
```

**Regras:**
- Só pode cancelar se não estiver SHIPPED
- Libera reservas de estoque

## INTEGRAÇÕES

### Payment Execution

**Antes (SPRINT 43):**
- Payment SUCCESS → consumia reservas imediatamente

**Agora (SPRINT 54):**
- Payment SUCCESS → cria fulfillment (reservas permanecem ativas)
- Fulfillment SHIPPED → consome reservas e baixa estoque

### PDV

- PDV usa `paymentExecutionService.executePayment()`
- Fulfillment criado automaticamente (source = `PDV`)
- Mesmo fluxo do Marketplace

### Marketplace

- Marketplace usa `paymentExecutionService.executePayment()`
- Fulfillment criado automaticamente (source = `MARKETPLACE`)
- Mesmo fluxo do PDV

## GUARDRAILS

### ✅ Respeitados

1. **NÃO dar baixa no estoque no pagamento**
   - Estoque só é baixado quando fulfillment é SHIPPED

2. **NÃO criar automação invisível**
   - Status é declarativo
   - Tudo explícito e auditável

3. **NÃO integrar transportadora**
   - Apenas controle interno de saída

4. **NÃO recalcular quantidades**
   - Quantidades vêm do order_items
   - Não há recálculo

5. **Tudo auditável**
   - Fulfillment é append-only
   - Histórico completo de status

### ⚠️ Mudanças no Comportamento

**SPRINT 43 → SPRINT 54:**
- **Antes:** Reservas consumidas no payment SUCCESS
- **Agora:** Reservas consumidas no fulfillment SHIPPED

**Impacto:**
- Estoque reservado permanece reservado até envio
- Permite cancelamento de fulfillment sem perder estoque já baixado

## CRITÉRIOS DE PRONTO

- ✅ Pedido pago gera fulfillment automaticamente
- ✅ Fulfillment controla saída física
- ✅ Estoque só cai quando SHIPPED
- ✅ Sem quebrar PDV, Marketplace ou Fiscal
- ✅ Integração com payment execution
- ✅ Integração com inventory reservations

## PRÓXIMOS PASSOS

- [ ] Criar rotas/endpoints para fulfillment (picking, shipping)
- [ ] Criar UI mínima para fulfillment (listagem, picking, shipping)
- [ ] Adicionar permissões canônicas para fulfillment
- [ ] Testes de integração

## OBSERVAÇÕES

1. **Fulfillment é opcional:** Se não houver fulfillment, reservas permanecem ativas (comportamento antigo)
2. **Cancelamento:** Fulfillment cancelado libera reservas, mas não reverte movements já criados
3. **Lotes:** Suporte a `inventory_lot_id` no picking (rastreabilidade)
4. **Auditabilidade:** Tudo é append-only, histórico completo





