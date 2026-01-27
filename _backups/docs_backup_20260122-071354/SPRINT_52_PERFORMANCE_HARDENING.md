# SPRINT 52: PERFORMANCE, ESCALA E HARDENING

## RESUMO EXECUTIVO

Implementado melhorias de performance, escala e hardening:
- ✅ Índices compostos e partial indexes para tabelas grandes
- ✅ Locks em reservas de estoque para concorrência segura
- ✅ Idempotência ampliada em pagamentos e payouts
- ✅ Paginação padronizada (cursor-based e offset-based)
- ✅ Logs estruturados e métricas simples

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/187_performance_indexes_hardening.sql`** (NOVO)
   - Índices compostos para `orders`, `payment_transactions`, `payout_transactions`, `inventory_movements`, `inventory_reservations`, `payment_intents`, `alerts`, `pdv_sessions`
   - Partial indexes para status ACTIVE/PENDING
   - Índices para idempotency_key

2. **`backend/src/core/pagination/pagination.types.ts`** (NOVO)
   - Tipos padronizados para paginação
   - `PaginationOptions`, `PaginatedResult`, `normalizePaginationOptions()`

3. **`backend/src/core/observability/logger.ts`** (NOVO)
   - Logger estruturado
   - Métricas simples (tempo de execução)
   - Contexto rico (tenant, user, actor)

4. **`backend/src/modules/marketplace/inventory-reservation.service.ts`** (ALTERADO)
   - Adicionado `SELECT FOR UPDATE` para locks em reservas
   - Transação explícita para concorrência segura
   - Logs estruturados

5. **`backend/src/modules/marketplace/payment-execution.service.ts`** (ALTERADO)
   - Logs estruturados em pontos críticos
   - Métricas de tempo de execução

6. **`backend/src/modules/marketplace/order.repository.ts`** (ALTERADO)
   - Paginação padronizada (cursor-based e offset-based)
   - Limite normalizado (padrão: 20, máximo: 100)

7. **`backend/src/modules/marketplace/order.types.ts`** (ALTERADO)
   - Adicionado `cursor` em `ListOrdersOptions`

8. **`backend/src/modules/automation/alert.repository.ts`** (ALTERADO)
   - Paginação padronizada
   - Filtros aplicados corretamente

## MELHORIAS DE PERFORMANCE

### Índices Compostos

#### Orders
- `idx_orders_seller_status_created`: Listagem por seller + status + data
- `idx_orders_buyer_status_created`: Listagem por buyer + status + data
- `idx_orders_metadata_pdv_session`: Busca por metadata (pdv_session_id)

#### Payment Transactions
- `idx_payment_transactions_status_created`: Listagem por status + data
- `idx_payment_transactions_intent_status`: Busca por intent + status
- `idx_payment_transactions_idempotency`: Busca por idempotency_key

#### Payout Transactions
- `idx_payout_transactions_status_created`: Listagem por status + data
- `idx_payout_transactions_intent_status`: Busca por intent + status
- `idx_payout_transactions_idempotency`: Busca por idempotency_key

#### Inventory Reservations
- `idx_inventory_reservations_variant_active`: Busca reservas ativas por variante (crítico para concorrência)
- `idx_inventory_reservations_order_status`: Busca reservas por order
- `idx_inventory_reservations_expired`: Busca reservas expiradas

### Partial Indexes

Índices parciais reduzem tamanho e melhoram performance:
- `WHERE status = 'ACTIVE'` para reservas ativas
- `WHERE status IN ('PENDING', 'SUCCESS')` para transações
- `WHERE metadata->>'idempotency_key' IS NOT NULL` para idempotência

## CONCORRÊNCIA

### Locks em Reservas de Estoque

```typescript
// SPRINT 52: SELECT FOR UPDATE para garantir concorrência segura
await client.query('BEGIN');
await client.query(
  `SELECT id FROM product_variants WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
  [tenantId, productVariantId]
);
// ... calcular disponível e criar reserva ...
await client.query('COMMIT');
```

**Benefícios:**
- Evita race conditions
- Garante consistência em alta concorrência
- Locks mínimos (apenas na variante)

## IDEMPOTÊNCIA

### Pagamentos e Payouts

Idempotência já implementada via `idempotency_key`:
- Verificação antes de criar transação
- Retorno de transação existente se key duplicada
- Índices otimizados para busca rápida

## PAGINAÇÃO

### Padronização

**Cursor-based (recomendado para grandes volumes):**
```typescript
{
  cursor?: string; // Data do último item (created_at)
  limit?: number;  // Padrão: 20, máximo: 100
}
```

**Offset-based (para casos específicos):**
```typescript
{
  offset?: number;
  limit?: number;
}
```

**Normalização:**
- Limite padrão: 20
- Limite máximo: 100
- Limite mínimo: 1

## OBSERVABILIDADE

### Logger Estruturado

```typescript
import { logger } from '@core/observability/logger';

// Log simples
logger.info('Payment execution started', {
  tenantId,
  paymentIntentId,
  buyerActorId,
});

// Log com métrica de tempo
await logger.measureTime('Payment execution', async () => {
  // ... operação ...
}, { tenantId, paymentIntentId });
```

**Formato (produção):**
```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Payment execution started",
  "tenantId": "uuid",
  "paymentIntentId": "uuid",
  "durationMs": 150
}
```

**Formato (desenvolvimento):**
```
[INFO] Payment execution started { tenantId: 'uuid', paymentIntentId: 'uuid' }
```

### Pontos Críticos Instrumentados

1. **Reservas de Estoque:**
   - Criação de reserva
   - Cálculo de disponível

2. **Pagamentos:**
   - Início de execução
   - Sucesso
   - Falha

3. **Payouts:**
   - Início de execução
   - Sucesso
   - Falha

## QUERIES OTIMIZADAS

### Antes (sem índices compostos)
```sql
-- Full table scan em orders
SELECT * FROM orders
WHERE tenant_id = $1 AND seller_actor_id = $2 AND status = 'SUBMITTED'
ORDER BY created_at DESC;
```

### Depois (com índices compostos)
```sql
-- Usa idx_orders_seller_status_created
SELECT * FROM orders
WHERE tenant_id = $1 AND seller_actor_id = $2 AND status = 'SUBMITTED'
ORDER BY created_at DESC;
-- Índice cobre toda a query
```

## MÉTRICAS ESPERADAS

### Performance
- **Queries de listagem:** 50-80% mais rápidas (com índices compostos)
- **Reservas de estoque:** Sem race conditions (com locks)
- **Paginação:** Consistente mesmo com milhões de registros

### Escalabilidade
- **Tabelas grandes:** Suportam crescimento sem degradação
- **Concorrência:** Locks mínimos, sem deadlocks
- **Observabilidade:** Logs estruturados facilitam debugging

## PRÓXIMOS PASSOS

- [ ] Adicionar paginação cursor-based em mais endpoints
- [ ] Adicionar métricas de performance (tempo médio de queries)
- [ ] Adicionar alertas automáticos para queries lentas
- [ ] Adicionar cache para queries frequentes (se necessário)

## OBSERVAÇÕES

1. **Não altera regras de negócio:** Apenas otimização e robustez
2. **Não altera contratos externos:** APIs mantêm compatibilidade
3. **Locks mínimos:** Apenas onde necessário (reservas de estoque)
4. **Índices parciais:** Reduzem tamanho e melhoram performance
5. **Logs estruturados:** Facilitam debugging e monitoramento





