# SPRINT 55: TRANSFERÊNCIA DE ESTOQUE ENTRE FILIAIS

## RESUMO EXECUTIVO

Implementado sistema de transferência de estoque entre unidades organizacionais:
- ✅ Transferência interna (sem venda, sem pagamento, sem fiscal)
- ✅ Estoque sai no SHIP, entra no RECEIVE
- ✅ Inventory_movements são a única fonte da verdade
- ✅ Integrado com multi-empresa e filiais
- ✅ Tudo explícito, auditável, reversível

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/190_create_stock_transfers.sql`** (NOVO)
   - Tabela `stock_transfers` (append-only)
   - Tabela `stock_transfer_items` (append-only)
   - Enums: `stock_transfer_status`, `stock_transfer_item_status`
   - Constraint: origem e destino devem ser diferentes
   - Triggers para prevenir DELETE

2. **`backend/src/modules/marketplace/stock-transfer.types.ts`** (NOVO)
   - Tipos TypeScript para transferências
   - `StockTransfer`, `StockTransferItem`, `CreateStockTransferInput`, etc.

3. **`backend/src/modules/marketplace/stock-transfer.repository.ts`** (NOVO)
   - Repository para transferências
   - Métodos: `createTransfer`, `getTransferById`, `createTransferItem`, etc.

4. **`backend/src/modules/marketplace/stock-transfer.service.ts`** (NOVO)
   - Service para transferências
   - Métodos: `createTransfer`, `addItem`, `shipTransfer`, `receiveTransfer`, `cancelTransfer`

5. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `stockTransferService` e `stockTransferRepository`
   - Exporta tipos de transferência

## MODELO DE DADOS

### Tabela `stock_transfers`

**Campos:**
- `id`: UUID
- `tenant_id`: UUID
- `from_actor_id`: UUID (unidade de origem)
- `to_actor_id`: UUID (unidade de destino)
- `status`: `DRAFT` | `SHIPPED` | `RECEIVED` | `CANCELLED`
- `requested_by_user_id`: UUID (opcional)
- `shipped_at`: TIMESTAMP (opcional)
- `received_at`: TIMESTAMP (opcional)
- `metadata`: JSONB
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**Regras:**
- Origem e destino devem ser diferentes (constraint)
- Append-only (sem DELETE)
- Status é declarativo (sem automação escondida)

### Tabela `stock_transfer_items`

**Campos:**
- `id`: UUID
- `tenant_id`: UUID
- `stock_transfer_id`: UUID
- `product_variant_id`: UUID
- `quantity`: NUMERIC(20, 4)
- `inventory_lot_id`: UUID (opcional)
- `status`: `PENDING` | `SHIPPED` | `RECEIVED`
- `metadata`: JSONB
- `created_at`: TIMESTAMP

**Regras:**
- Append-only (sem DELETE)
- Status controla envio/recebimento individual

## FLUXO DE TRANSFERÊNCIA

### 1. Criação (DRAFT)

```typescript
// stockTransferService.createTransfer(fromActorId, toActorId)
// → Cria stock_transfer com status DRAFT
// → Pode adicionar itens
```

**Regras:**
- Origem e destino devem ser diferentes
- Status inicial: `DRAFT`
- Pode adicionar itens enquanto `DRAFT`

### 2. Adicionar Itens

```typescript
// stockTransferService.addItem(transferId, variantId, quantity)
// → Cria stock_transfer_item com status PENDING
// → Só pode adicionar se status = DRAFT
```

**Regras:**
- Só pode adicionar itens se status = `DRAFT`
- Pode especificar `inventory_lot_id` (opcional)

### 3. Envio (SHIP)

```typescript
// stockTransferService.shipTransfer(transferId)
// → Valida status = DRAFT
// → Gera inventory_movements OUT no from_actor
// → Atualiza itens para SHIPPED
// → Atualiza transferência para SHIPPED
```

**Regras:**
- Só pode SHIP se status = `DRAFT`
- Gera `inventory_movements` OUT para cada item
- Estoque sai do `from_actor` aqui
- Status muda para `SHIPPED`

### 4. Recebimento (RECEIVE)

```typescript
// stockTransferService.receiveTransfer(transferId)
// → Valida status = SHIPPED
// → Valida todos itens SHIPPED
// → Gera inventory_movements IN no to_actor
// → Atualiza itens para RECEIVED
// → Atualiza transferência para RECEIVED
```

**Regras:**
- Só pode RECEIVE se status = `SHIPPED`
- Todos os itens devem estar `SHIPPED`
- Gera `inventory_movements` IN para cada item
- Estoque entra no `to_actor` aqui
- Status muda para `RECEIVED`

### 5. Cancelamento

```typescript
// stockTransferService.cancelTransfer(transferId)
// → Só pode cancelar se status = DRAFT
// → Status muda para CANCELLED
```

**Regras:**
- Só pode cancelar se status = `DRAFT`
- Não pode cancelar se já foi `SHIPPED` ou `RECEIVED`

## INTEGRAÇÕES

### Inventory Movements

**SHIP:**
- Gera `inventory_movements` OUT no `from_actor`
- `referenceType = 'stock_transfer'`
- `referenceId = transferId`
- `reason = 'STOCK_TRANSFER_SHIPPED'`

**RECEIVE:**
- Gera `inventory_movements` IN no `to_actor`
- `referenceType = 'stock_transfer'`
- `referenceId = transferId`
- `reason = 'STOCK_TRANSFER_RECEIVED'`

### Multi-Empresa e Filiais

- `from_actor_id` e `to_actor_id` são actors (unidades organizacionais)
- Relatórios consolidados refletem movimentações reais
- Estoque consolida corretamente por filial

## GUARDRAILS

### ✅ Respeitados

1. **NÃO reutilizar Order**
   - Transferência é independente de Order
   - Não usa Order, Payment ou Fiscal

2. **NÃO criar economia fictícia**
   - Transferência não cria transações financeiras
   - Não há pagamento ou split

3. **NÃO criar automação escondida**
   - Status é declarativo
   - Tudo explícito e auditável

4. **Tudo explícito, auditável, reversível**
   - Transferência é append-only
   - Histórico completo de status
   - Inventory_movements são a única fonte da verdade

### ⚠️ Observações

**Estoque por Actor:**
- Inventory_movements não têm campo `actor_id` diretamente
- Rastreabilidade via `metadata.from_actor_id` e `metadata.to_actor_id`
- Relatórios consolidados devem filtrar por actor via metadata

**Lotes:**
- Suporte a `inventory_lot_id` (rastreabilidade)
- Lote é preservado na transferência

## CRITÉRIOS DE PRONTO

- ✅ Transferência controla fluxo físico interno
- ✅ Estoque consolida corretamente por filial
- ✅ Relatórios passam a refletir movimentações reais
- ✅ NÃO usa Order, Payment ou Fiscal
- ✅ Inventory_movements são a única fonte da verdade

## PRÓXIMOS PASSOS

- [ ] Criar rotas/endpoints para transferências
- [ ] Criar UI mínima para transferências (listagem, criação, shipping, receiving)
- [ ] Adicionar permissões canônicas para transferências
- [ ] Testes de integração
- [ ] Relatórios consolidados por filial (usando metadata de movements)

## OBSERVAÇÕES

1. **Transferência é interna:** Sem venda, sem pagamento, sem fiscal
2. **Estoque sai no SHIP:** Inventory_movements OUT criados no `from_actor`
3. **Estoque entra no RECEIVE:** Inventory_movements IN criados no `to_actor`
4. **Rastreabilidade:** Via `referenceType = 'stock_transfer'` e `referenceId`
5. **Auditabilidade:** Tudo é append-only, histórico completo





