# SPRINT 41.2: HARDENING OPERACIONAL (BUILD/RUN) + IDEMPOTÊNCIA BÁSICA

## RESUMO EXECUTIVO

Implementado hardening operacional do marketplace:
- ✅ Idempotência nos endpoints execute (payment e payout)
- ✅ Headers x-acting-actor-id e x-tenant-id já funcionam automaticamente via apiFetch
- ✅ Endpoint de referência (/marketplace/refs) implementado
- ✅ Frontend integrado com feed social

## ARQUIVOS ALTERADOS

### Backend

1. **`backend/src/modules/marketplace/payment-transaction.repository.ts`**
   - Adicionado método `getTransactionByIdempotencyKey()`
   - Modificado `createTransaction()` para aceitar `idempotencyKey` opcional
   - Idempotency key armazenada em `metadata.idempotency_key`

2. **`backend/src/modules/marketplace/payout-transaction.repository.ts`**
   - Adicionado método `getTransactionByIdempotencyKey()`
   - Modificado `createTransaction()` para aceitar `idempotencyKey` opcional
   - Idempotency key armazenada em `metadata.idempotency_key`

3. **`backend/src/modules/marketplace/payment-execution.service.ts`**
   - Modificado `executePayment()` para aceitar `idempotencyKey` opcional
   - Verifica transação existente antes de executar (idempotência)
   - Retorna transação existente se encontrada

4. **`backend/src/modules/marketplace/payout.service.ts`**
   - Modificado `executePayout()` para aceitar `idempotencyKey` opcional
   - Verifica payout existente por split antes de executar
   - Retorna payouts existentes se encontrados

5. **`backend/src/modules/marketplace/marketplace.routes.ts`**
   - Endpoint `/payments/execute` aceita header `Idempotency-Key` opcional
   - Endpoint `/payouts/execute` aceita header `Idempotency-Key` opcional
   - Endpoint `/refs/:type/:id` já implementado (read-only)

### Frontend

1. **`frontend/src/api/marketplace.ts`**
   - `executePayment()` aceita `idempotencyKey` opcional e envia via header
   - `executePayout()` aceita `idempotencyKey` opcional e envia via header

## IDEMPOTÊNCIA

### Como Funciona

1. **Payment Execute:**
   - Cliente envia header `Idempotency-Key` (opcional)
   - Backend verifica se existe `payment_transaction` com:
     - Mesmo `payment_intent_id`
     - Mesma `idempotency_key` em `metadata`
     - Status `PENDING` ou `SUCCESS`
   - Se encontrado: retorna transação existente (não executa Bank novamente)
   - Se não encontrado: executa normalmente

2. **Payout Execute:**
   - Cliente envia header `Idempotency-Key` (opcional)
   - Para cada split, backend verifica se existe `payout_transaction` com:
     - Mesmo `payment_intent_id` e `payment_split_id`
     - Mesma `idempotency_key` (com sufixo `-{splitId}`) em `metadata`
     - Status `PENDING` ou `SUCCESS`
   - Se encontrado: retorna payout existente (não executa Bank novamente)
   - Se não encontrado: executa normalmente

### Uso no Frontend

```typescript
// Com idempotência
const idempotencyKey = crypto.randomUUID();
await executePayment({
  paymentIntentId: '...',
  buyerActorId: '...',
  sellerActorId: '...',
  idempotencyKey, // Opcional
});

// Sem idempotência (comportamento normal)
await executePayment({
  paymentIntentId: '...',
  buyerActorId: '...',
  sellerActorId: '...',
});
```

## HEADERS AUTOMÁTICOS

O `apiFetch` já envia automaticamente:
- `x-tenant-id`: do storage ou fallback DEV
- `x-acting-actor-id`: do localStorage (`unificard_active_actor_id`) ou header explícito
- `Authorization`: Bearer token do storage

**Nenhuma alteração necessária** - funciona automaticamente para todas as chamadas do marketplace.

## TESTES MANUAIS

### 1. Smoke Test Backend

```bash
# Rodar migrations (se necessário)
cd backend
npm run migrate

# Iniciar servidor
npm run dev

# Testar endpoints:
curl -H "x-tenant-id: <tenant-id>" \
     -H "Authorization: Bearer <token>" \
     -H "x-acting-actor-id: <actor-id>" \
     http://localhost:3000/marketplace/categories

curl -H "x-tenant-id: <tenant-id>" \
     -H "Authorization: Bearer <token>" \
     -H "x-acting-actor-id: <actor-id>" \
     http://localhost:3000/marketplace/products

curl -H "x-tenant-id: <tenant-id>" \
     -H "Authorization: Bearer <token>" \
     -H "x-acting-actor-id: <actor-id>" \
     http://localhost:3000/marketplace/refs/product_variant/<variant-id>
```

### 2. Smoke Test Frontend

1. Abrir `http://localhost:5173/marketplace`
2. Verificar tabs: Catálogo, Produtos, Estoque, Pedidos, Pagamentos
3. Testar criar categoria/produto
4. Testar criar pedido e executar pagamento

### 3. Teste de Idempotência

```bash
# Primeira chamada (executa)
curl -X POST http://localhost:3000/marketplace/payments/execute \
  -H "x-tenant-id: <tenant-id>" \
  -H "Authorization: Bearer <token>" \
  -H "x-acting-actor-id: <actor-id>" \
  -H "Idempotency-Key: test-key-123" \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId": "...", "buyerActorId": "...", "sellerActorId": "..."}'

# Segunda chamada com mesma key (retorna existente)
curl -X POST http://localhost:3000/marketplace/payments/execute \
  -H "x-tenant-id: <tenant-id>" \
  -H "Authorization: Bearer <token>" \
  -H "x-acting-actor-id: <actor-id>" \
  -H "Idempotency-Key: test-key-123" \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId": "...", "buyerActorId": "...", "sellerActorId": "..."}'
```

## OBSERVAÇÕES

1. **Idempotência é opcional**: Se não enviar `Idempotency-Key`, comportamento normal (pode duplicar)
2. **Idempotência é por intent**: Cada `payment_intent_id` + `idempotency_key` é único
3. **Payout usa sufixo**: Para payouts, a key é `{idempotencyKey}-{splitId}` para garantir unicidade por split
4. **Status considerado**: Apenas `PENDING` ou `SUCCESS` são considerados para idempotência (FAILED pode ser re-executado)

## PRÓXIMOS PASSOS

- [ ] Adicionar testes automatizados para idempotência
- [ ] Documentar idempotência na API docs
- [ ] Considerar TTL para idempotency keys (opcional)





