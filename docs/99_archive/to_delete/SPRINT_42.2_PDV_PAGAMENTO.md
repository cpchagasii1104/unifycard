# SPRINT 42.2: PDV — PAGAMENTO + BALANÇA (OPCIONAL)

## RESUMO EXECUTIVO

Implementado pagamento direto no PDV:
- ✅ Fluxo completo de pagamento (PaymentIntent → Authorize → Execute)
- ✅ Reutiliza serviços existentes do marketplace
- ✅ Idempotência via header `Idempotency-Key`
- ✅ UI com campo de valor e botão "Receber Pagamento"
- ✅ Abstração para balança (placeholder para futura integração)

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/pdv/pdv.types.ts`** (ALTERADO)
   - Adicionado `PayOrderFromPdvInput` e `PayOrderFromPdvResult`

2. **`backend/src/modules/pdv/pdv.service.ts`** (ALTERADO)
   - Novo método `payOrderFromPdv()`:
     - Valida sessão OPEN
     - Submete pedido se DRAFT
     - Cria PaymentIntent
     - Autoriza PaymentIntent
     - Executa pagamento
     - Retorna resultado completo

3. **`backend/src/modules/pdv/pdv.routes.ts`** (ALTERADO)
   - Nova rota `POST /pdv/orders/:orderId/pay`
   - Aceita header `Idempotency-Key` (opcional)
   - Registra auditoria `PDV_PAYMENT_EXECUTED`

### Frontend

1. **`frontend/src/api/pdv.ts`** (ALTERADO)
   - Adicionado `payOrderFromPdv()` com suporte a `Idempotency-Key`

2. **`frontend/src/pages/PdvPage.tsx`** (ALTERADO)
   - Campo "Valor a pagar" (R$)
   - Botão "Receber Pagamento"
   - Exibição de status do pagamento (sucesso/falha)
   - Confirmação antes de processar

3. **`frontend/src/utils/weight-provider.ts`** (NOVO)
   - Interface `WeightProvider` para abstrair entrada de peso
   - Implementação `ManualWeightProvider` (padrão)
   - Placeholder para futura integração (WebSerial/WebUSB)

## FLUXO DE PAGAMENTO

### 1. Operador informa valor

```
Campo: "Valor (R$): 25.50"
Botão: "Receber Pagamento"
```

### 2. Backend processa

```typescript
// pdv.service.ts - payOrderFromPdv()
1. Validar sessão OPEN
2. Buscar pedido
3. Submeter pedido (se DRAFT) → SUBMITTED
4. Criar PaymentIntent (orderId, amount, currency)
5. Autorizar PaymentIntent → AUTHORIZED
6. Executar pagamento → PaymentTransaction (SUCCESS/FAILED)
7. Retornar resultado
```

### 3. UI exibe resultado

- ✅ Sucesso: "Pagamento realizado com sucesso"
- ❌ Falha: Mensagem de erro específica
- Status da transação (SUCCESS/PENDING/FAILED)

## REGRAS ARQUITETURAIS

### ✅ Reutilização de Serviços

PDV **NÃO** cria lógica nova:
- Usa `paymentIntentService.createPaymentIntent()`
- Usa `paymentIntentService.authorizePaymentIntent()`
- Usa `paymentExecutionService.executePayment()`
- Usa `orderService.submitOrder()` (se necessário)

### ✅ PDV não calcula preço

- `amount` vem do operador (manual)
- PDV não tem lógica de cálculo
- PDV não tem tabela de preços

### ✅ Idempotência

- Header `Idempotency-Key` opcional
- Reutiliza idempotência existente em `paymentExecutionService`
- Previne pagamentos duplicados

### ✅ Validações

- Sessão deve estar OPEN
- Pedido deve estar SUBMITTED (ou será submetido automaticamente)
- Amount > 0
- Buyer/Seller actors válidos

## INTEGRAÇÃO COM BALANÇA (OPCIONAL)

### Abstração Criada

```typescript
// frontend/src/utils/weight-provider.ts

interface WeightProvider {
  getCurrentWeight(): Promise<number | null>;
  isAvailable(): Promise<boolean>;
  startReading?(callback: (weight: number) => void): Promise<void>;
  stopReading?(): Promise<void>;
}
```

### Implementação Atual

- `ManualWeightProvider`: Input manual (padrão)
- Placeholder para futura integração:
  - `WebSerialWeightProvider` (Web Serial API)
  - `WebUSBWeightProvider` (Web USB API)
  - `BluetoothWeightProvider` (Web Bluetooth API)

### Uso Futuro

```typescript
// Exemplo futuro (não implementado agora)
const provider = createWeightProvider();
if (await provider.isAvailable()) {
  const weight = await provider.getCurrentWeight();
  setWeightInput(weight?.toString() || '');
}
```

## TESTES MANUAIS

### 1. Criar Pedido e Adicionar Itens

```bash
# Criar pedido
POST /pdv/orders
{
  "sessionId": "...",
  "buyerActorId": "...",
  "sellerActorId": "..."
}

# Adicionar item
POST /pdv/orders/:orderId/items/unit
{
  "sessionId": "...",
  "variantId": "...",
  "quantity": 2
}
```

### 2. Processar Pagamento

```bash
POST /pdv/orders/:orderId/pay
Headers:
  Idempotency-Key: optional-uuid
Body:
{
  "sessionId": "...",
  "amount": 25.50,
  "currency": "BRL",
  "buyerActorId": "...",
  "sellerActorId": "..."
}
```

**Resposta:**
```json
{
  "order": { ... },
  "paymentIntent": { "id": "...", "status": "AUTHORIZED" },
  "transaction": { "id": "...", "status": "SUCCESS" }
}
```

### 3. Teste no Frontend

1. Abrir `/pdv`
2. Abrir caixa
3. Criar pedido
4. Adicionar itens
5. Informar valor (ex: 25.50)
6. Clicar "Receber Pagamento"
7. Verificar resultado (sucesso/falha)

## VALIDAÇÕES

### ✅ Sessão deve estar OPEN

```typescript
if (session.status !== 'OPEN') {
  throw new Error('Sessão PDV não está aberta');
}
```

### ✅ Pedido deve estar SUBMITTED

```typescript
if (order.status === 'DRAFT') {
  order = await orderService.submitOrder(...);
}
if (order.status !== 'SUBMITTED') {
  throw new Error('Pedido deve estar SUBMITTED');
}
```

### ✅ Amount > 0

```typescript
if (input.amount <= 0) {
  throw new Error('Amount deve ser maior que zero');
}
```

## OBSERVAÇÕES

1. **PDV não calcula preço**: Operador informa valor manualmente
2. **Submissão automática**: Se pedido estiver DRAFT, é submetido antes do pagamento
3. **Idempotência**: Header `Idempotency-Key` previne duplicatas
4. **Balança**: Abstração criada, mas apenas input manual por enquanto
5. **Auditoria**: Todos os pagamentos são registrados em `audit_events`

## PRÓXIMOS PASSOS

- [ ] Integrar balança física (WebSerial/WebUSB)
- [ ] Adicionar cálculo automático de preço (se necessário)
- [ ] Adicionar múltiplos métodos de pagamento (se necessário)
- [ ] Adicionar impressão de cupom (se necessário)





