# SPRINT 43: ESTOQUE COM RESERVA (SOFT HOLD)

## RESUMO EXECUTIVO

Implementado sistema de reserva de estoque (soft hold) para evitar dupla venda:
- ✅ Tabela `inventory_reservations` (append-only)
- ✅ Service para reservar/liberar/consumir estoque
- ✅ Integração no OrderService e PDV
- ✅ Consumo automático quando pagamento SUCCESS
- ✅ Liberação automática quando pedido CANCELLED/EXPIRED ou pagamento FAILED
- ✅ Endpoint para consultar estoque disponível

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/180_create_inventory_reservations.sql`** (NOVO)
   - Tabela `inventory_reservations` (append-only)
   - Enums: `inventory_reservation_status` (ACTIVE, RELEASED, CONSUMED)
   - Enums: `inventory_reservation_source` (MARKETPLACE, PDV)
   - Triggers para prevenir DELETE
   - Índices para performance

2. **`backend/src/modules/marketplace/inventory-reservation.types.ts`** (NOVO)
   - Tipos TypeScript para reservas
   - `InventoryReservation`, `ReserveStockInput`, `AvailableStock`

3. **`backend/src/modules/marketplace/inventory-reservation.repository.ts`** (NOVO)
   - Repository para reservas
   - Métodos: `createReservation`, `getActiveReservationsByVariant`, `getReservedQuantityByVariant`, `releaseReservationsByOrder`, `consumeReservationsByOrder`

4. **`backend/src/modules/marketplace/inventory-reservation.service.ts`** (NOVO)
   - Service principal para reservas
   - Métodos: `reserveStock`, `getAvailableStock`, `releaseReservation`, `consumeReservation`

5. **`backend/src/modules/marketplace/order.service.ts`** (ALTERADO)
   - `addItem()` agora reserva estoque antes de adicionar item
   - `cancelOrder()` libera reservas
   - `expireOrder()` libera reservas
   - Parâmetro `source` ('MARKETPLACE' | 'PDV') para identificar origem

6. **`backend/src/modules/pdv/pdv.service.ts`** (ALTERADO)
   - `addItemByVariant()` e `addItemByWeight()` passam `source='PDV'` para `orderService.addItem()`

7. **`backend/src/modules/marketplace/payment-execution.service.ts`** (ALTERADO)
   - `executePayment()` consome reservas quando pagamento SUCCESS
   - `executePayment()` libera reservas quando pagamento FAILED

8. **`backend/src/modules/marketplace/marketplace.routes.ts`** (ALTERADO)
   - Nova rota `GET /marketplace/inventory/available` para consultar estoque disponível

9. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `inventoryReservationService`

### Frontend

1. **`frontend/src/api/marketplace.ts`** (ALTERADO)
   - Adicionado `getAvailableStock()` para consultar estoque disponível

## FLUXO DE RESERVA

### 1. Adicionar Item ao Pedido

```typescript
// OrderService.addItem() ou PDV
1. Verificar estoque disponível:
   disponível = saldo_real - reservas_ativas
2. Se insuficiente → erro claro
3. Criar reserva (status = ACTIVE)
4. Adicionar item ao pedido
```

### 2. Consumir Reserva (Pagamento SUCCESS)

```typescript
// PaymentExecutionService.executePayment()
1. Pagamento executado com sucesso
2. Consumir reservas do pedido (status = CONSUMED)
3. Estoque pode ser baixado (movement OUT)
```

### 3. Liberar Reserva (Cancelamento/Falha)

```typescript
// OrderService.cancelOrder() / expireOrder()
// PaymentExecutionService.executePayment() (falha)
1. Pedido cancelado/expirado OU pagamento falhou
2. Liberar reservas do pedido (status = RELEASED)
3. Estoque volta a ficar disponível
```

## CÁLCULO DE ESTOQUE DISPONÍVEL

```typescript
// inventory-reservation.service.ts
availableQuantity = totalBalance - reservedQuantity

onde:
- totalBalance: saldo real (derivado de inventory_movements)
- reservedQuantity: soma de reservas ACTIVE (não expiradas)
```

## REGRAS ARQUITETURAIS

### ✅ Append-Only

- `inventory_reservations` é append-only
- Status muda (ACTIVE → RELEASED/CONSUMED), mas histórico não
- DELETE bloqueado por trigger

### ✅ Não Altera Movements

- Reserva **NÃO** altera `inventory_movements`
- Reserva é lógica, não física
- Estoque continua sendo derivado de movements

### ✅ Mesmo Serviço para PDV e Marketplace

- PDV e Marketplace usam `inventoryReservationService`
- Diferenciação apenas por `source` (MARKETPLACE | PDV)
- Mesma lógica, mesma verdade

### ✅ Validação Antes de Reservar

- Verifica estoque disponível antes de criar reserva
- Erro claro se insuficiente
- Não permite reservar mais do que disponível

## INTEGRAÇÃO COM EVENTOS

### Adicionar Item

```typescript
// OrderService.addItem()
await inventoryReservationService.reserveStock(tenantId, {
  productVariantId: input.productVariantId,
  quantity: input.quantity,
  orderId,
  source: 'MARKETPLACE' | 'PDV',
});
```

### Pagamento SUCCESS

```typescript
// PaymentExecutionService.executePayment()
if (success) {
  await inventoryReservationService.consumeReservation(tenantId, orderId);
  // Estoque pode ser baixado agora
}
```

### Pagamento FAILED

```typescript
// PaymentExecutionService.executePayment()
if (failed) {
  await inventoryReservationService.releaseReservation(tenantId, orderId);
  // Estoque volta a ficar disponível
}
```

### Pedido CANCELLED/EXPIRED

```typescript
// OrderService.cancelOrder() / expireOrder()
await inventoryReservationService.releaseReservation(tenantId, orderId);
```

## TESTES MANUAIS

### 1. Reservar Estoque

```bash
# Criar pedido e adicionar item (reserva automática)
POST /marketplace/orders
POST /marketplace/orders/:orderId/items
```

### 2. Consultar Estoque Disponível

```bash
GET /marketplace/inventory/available?variantId=<variant-id>
```

**Resposta:**
```json
{
  "available": {
    "productVariantId": "...",
    "totalBalance": 100,
    "reservedQuantity": 10,
    "availableQuantity": 90
  }
}
```

### 3. Teste de Dupla Venda

1. Criar pedido A com 50 unidades
2. Tentar criar pedido B com 60 unidades (se só há 50 disponíveis)
3. Deve falhar com erro "Estoque insuficiente"

### 4. Teste de Liberação

1. Criar pedido e adicionar item (reserva criada)
2. Cancelar pedido
3. Verificar que estoque disponível aumentou

### 5. Teste de Consumo

1. Criar pedido e adicionar item (reserva criada)
2. Processar pagamento SUCCESS
3. Verificar que reserva foi consumida (status = CONSUMED)

## VALIDAÇÕES

### ✅ Estoque Insuficiente

```typescript
if (available.availableQuantity < input.quantity) {
  throw new Error(
    `Estoque insuficiente. Disponível: ${available.availableQuantity}, Solicitado: ${input.quantity}`
  );
}
```

### ✅ Reserva por Pedido

- Uma reserva pertence a um pedido
- Múltiplas reservas podem existir para o mesmo pedido (diferentes variantes)
- Liberar/consumir afeta todas as reservas do pedido

### ✅ Expiração

- Reservas podem ter `expires_at` (opcional)
- Reservas expiradas não contam como ativas
- Método `releaseExpiredReservations()` para limpeza

## OBSERVAÇÕES

1. **Reserva é lógica**: Não altera `inventory_movements`, apenas bloqueia quantidade
2. **Mesma verdade**: PDV e Marketplace compartilham o mesmo serviço
3. **Liberação automática**: Cancelamento e falha liberam reservas automaticamente
4. **Consumo automático**: Pagamento SUCCESS consome reservas automaticamente
5. **Append-only**: Histórico de reservas nunca é deletado

## PRÓXIMOS PASSOS

- [ ] Adicionar UI para mostrar disponibilidade no Marketplace
- [ ] Adicionar bloqueio visual no PDV se estoque insuficiente
- [ ] Adicionar job para liberar reservas expiradas (opcional)
- [ ] Adicionar notificações quando estoque ficar baixo





