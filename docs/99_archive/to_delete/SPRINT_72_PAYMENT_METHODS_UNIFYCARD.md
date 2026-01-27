# SPRINT 72: PAYMENT METHODS + UNIFYCARD CORE

**Data:** 2024-12-19  
**Objetivo:** Criar domínio canônico de Payment Methods (Meios de Pagamento), preparando o sistema para UnifyCard, Pix, Crédito, Débito, Dinheiro e Vouchers, sem integração externa real.

**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO DAS MUDANÇAS

### 1.1. Migration Criada

**Arquivo:**
- `backend/migrations/201_create_payment_methods.sql` - Tabela `payment_methods`

**Estrutura:**

**payment_methods:**
- Types: `CASH`, `PIX`, `CREDIT_CARD`, `DEBIT_CARD`, `VOUCHER`, `UNIFYCARD`
- Providers: `INTERNAL`, `UNIFYCARD`, `EXTERNAL`
- Campos: actor_id, type, provider, fee_percentage, settlement_days, is_default, metadata
- RLS habilitado
- Índices para performance
- Trigger: apenas 1 método default por actor

### 1.2. Service Criado

**PaymentMethodService:**
- `createMethod()` - Cria método de pagamento (remove default anterior se is_default = true)
- `listMethods()` - Lista métodos com filtros
- `getMethodById()` - Busca método por ID
- `getDefaultMethod()` - Busca método default do actor

### 1.3. Integrações

**PaymentIntent:**
- `paymentMethodId` opcional no `CreatePaymentIntentInput`
- Snapshot do método salvo no `metadata` quando criar intent
- Estrutura: `payment_method_snapshot` com id, type, provider, fee_percentage, settlement_days

**AccountsReceivable:**
- `paymentMethod` extraído do intent metadata quando criar receivable
- Referência ao método usado no metadata

**PaymentExecution:**
- Extrai payment method do intent metadata ao criar receivable

### 1.4. Rotas REST

**Payment Methods:**
- `POST /payment-methods` - Cria método
- `GET /payment-methods` - Lista métodos
- `GET /payment-methods/:id` - Busca método
- `GET /payment-methods/default` - Busca método default do actor

---

## 2. ESTRUTURA DE DADOS

### 2.1. payment_methods

```sql
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    type payment_method_type NOT NULL, -- CASH, PIX, CREDIT_CARD, DEBIT_CARD, VOUCHER, UNIFYCARD
    provider payment_method_provider NOT NULL DEFAULT 'INTERNAL', -- INTERNAL, UNIFYCARD, EXTERNAL
    fee_percentage NUMERIC(5, 4) NOT NULL DEFAULT 0, -- Ex: 0.0299 = 2.99%
    settlement_days INTEGER NOT NULL DEFAULT 0, -- Dias para liquidação (0 = imediato)
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 2.2. Payment Method Types

**CASH:**
- Dinheiro (PDV)
- Provider: INTERNAL
- Fee: 0%
- Settlement: 0 dias (imediato)

**PIX:**
- Pix
- Provider: INTERNAL
- Fee: 0% (ou configurável)
- Settlement: 0 dias (imediato)

**CREDIT_CARD:**
- Cartão de Crédito
- Provider: UNIFYCARD ou EXTERNAL
- Fee: configurável (ex: 2.99%)
- Settlement: configurável (ex: 30 dias)

**DEBIT_CARD:**
- Cartão de Débito
- Provider: UNIFYCARD ou EXTERNAL
- Fee: configurável (ex: 1.99%)
- Settlement: configurável (ex: 1 dia)

**VOUCHER:**
- Voucher / Vale-alimentação
- Provider: INTERNAL ou EXTERNAL
- Fee: configurável
- Settlement: configurável

**UNIFYCARD:**
- UnifyCard (adquirente própria)
- Provider: UNIFYCARD
- Fee: configurável
- Settlement: configurável

---

## 3. INTEGRAÇÃO COM PAYMENT INTENT

### 3.1. Snapshot do Método

**Quando:** `createPaymentIntent()` é chamado com `paymentMethodId`

**O que é feito:**
- Busca método por ID
- Faz snapshot no metadata do intent
- Estrutura:
  ```json
  {
    "payment_method_id": "method-123",
    "payment_method_snapshot": {
      "id": "method-123",
      "type": "CREDIT_CARD",
      "provider": "UNIFYCARD",
      "fee_percentage": 0.0299,
      "settlement_days": 30
    }
  }
  ```

**Exemplo:**
```typescript
const intent = await paymentIntentService.createPaymentIntent(tenantId, {
  orderId: 'order-123',
  amount: 100.00,
  currency: 'BRL',
  paymentMethodId: 'method-123', // SPRINT 72
});
```

### 3.2. Uso do Snapshot

**AccountsReceivable:**
- Extrai `payment_method_snapshot.type` do intent metadata
- Salva em `payment_method` do receivable
- Salva snapshot completo no metadata

**PaymentExecution:**
- Extrai payment method do intent metadata ao criar receivable

---

## 4. GUARDRAILS RESPEITADOS

### 4.1. Payment Method ≠ Acquirer

- ✅ Payment Method é domínio canônico separado
- ✅ Não representa adquirente específica
- ✅ Provider pode ser INTERNAL, UNIFYCARD ou EXTERNAL

### 4.2. Payment Method ≠ Payment Execution

- ✅ Payment Method não executa pagamento
- ✅ Apenas estrutura e preparação
- ✅ Payment Execution usa método, mas não depende dele

### 4.3. Nenhum Dinheiro Real

- ✅ Nenhuma movimentação financeira
- ✅ Apenas modelagem e preparação

### 4.4. Nenhuma Taxa Aplicada

- ✅ Fee e settlement são declarativos
- ✅ Não executam nada
- ✅ Apenas informação para uso futuro

### 4.5. Apenas Estrutura e Preparação

- ✅ Nenhuma integração externa real
- ✅ Nenhuma adquirente (Cielo, Stone, etc.)
- ✅ Apenas modelagem correta + fluxo canônico

---

## 5. AUDITORIA

### 5.1. Eventos Registrados

**Payment Methods:**
- `PAYMENT_METHOD_CREATED` - Quando método é criado

### 5.2. Contexto de Auditoria

Cada evento inclui:
- `method_id`
- `actor_id`
- `type`
- `provider`
- `created_by_user_id`

---

## 6. ARQUIVOS CRIADOS

### 6.1. Migration

1. `backend/migrations/201_create_payment_methods.sql`

### 6.2. Types

2. `backend/src/modules/marketplace/payment-method.types.ts`

### 6.3. Repository

3. `backend/src/modules/marketplace/payment-method.repository.ts`

### 6.4. Service

4. `backend/src/modules/marketplace/payment-method.service.ts`

### 6.5. Routes

5. `backend/src/modules/marketplace/payment-method.routes.ts`

### 6.6. Integrações

6. `backend/src/modules/marketplace/payment-intent.types.ts` (atualizado - paymentMethodId opcional)
7. `backend/src/modules/marketplace/payment-intent.service.ts` (atualizado - snapshot no metadata)
8. `backend/src/modules/marketplace/accounts-receivable.service.ts` (atualizado - extrai payment method)
9. `backend/src/modules/marketplace/payment-execution.service.ts` (atualizado - extrai payment method)
10. `backend/src/modules/marketplace/marketplace.routes.ts` (atualizado - registra rotas)

---

## 7. EXEMPLOS DE USO

### 7.1. Criar Método de Pagamento

```typescript
// Criar método UnifyCard
const unifyCardMethod = await paymentMethodService.createMethod(tenantId, {
  actorId: 'actor-123',
  type: 'UNIFYCARD',
  provider: 'UNIFYCARD',
  feePercentage: 0.0299, // 2.99%
  settlementDays: 30,
  isDefault: true,
}, 'actor-123', 'user-123');

// Criar método PIX
const pixMethod = await paymentMethodService.createMethod(tenantId, {
  actorId: 'actor-123',
  type: 'PIX',
  provider: 'INTERNAL',
  feePercentage: 0,
  settlementDays: 0,
  isDefault: false,
}, 'actor-123', 'user-123');
```

### 7.2. Usar Método em Payment Intent

```typescript
// Criar payment intent com método
const intent = await paymentIntentService.createPaymentIntent(tenantId, {
  orderId: 'order-123',
  amount: 100.00,
  currency: 'BRL',
  paymentMethodId: unifyCardMethod.id, // SPRINT 72
});

// Snapshot do método é salvo automaticamente no metadata
console.log(intent.metadata?.payment_method_snapshot);
// {
//   id: 'method-123',
//   type: 'UNIFYCARD',
//   provider: 'UNIFYCARD',
//   fee_percentage: 0.0299,
//   settlement_days: 30
// }
```

### 7.3. Buscar Método Default

```typescript
// Buscar método default do actor
const defaultMethod = await paymentMethodService.getDefaultMethod(tenantId, 'actor-123');
```

---

## 8. CRITÉRIO DE PRONTO

### ✅ Todos os Critérios Atendidos

1. **Métodos de pagamento cadastráveis:**
   - ✅ `createMethod()` cria método
   - ✅ Tipos: CASH, PIX, CREDIT_CARD, DEBIT_CARD, VOUCHER, UNIFYCARD

2. **UnifyCard modelado como método interno:**
   - ✅ Type: UNIFYCARD
   - ✅ Provider: UNIFYCARD
   - ✅ Fee e settlement configuráveis

3. **PDV e Marketplace preparados:**
   - ✅ PaymentIntent aceita paymentMethodId
   - ✅ Snapshot salvo no metadata
   - ✅ Estrutura pronta para uso

4. **Accounts Receivable referenciando método:**
   - ✅ Extrai payment method do intent metadata
   - ✅ Salva em payment_method do receivable
   - ✅ Snapshot completo no metadata

5. **Nenhuma execução financeira:**
   - ✅ Nenhuma movimentação financeira
   - ✅ Nenhuma taxa aplicada
   - ✅ Apenas estrutura e preparação

---

## 9. PRÓXIMOS PASSOS (FUTURO)

### 9.1. Integração com PDV (Futuro)

**Quando:** PDV processa pagamento

**O que fazer:**
- Permitir selecionar método de pagamento
- Passar paymentMethodId ao criar PaymentIntent
- Snapshot automático no metadata

### 9.2. Cálculo de Taxas (Futuro)

**Quando:** Payment Execution

**O que fazer:**
- Ler fee_percentage do snapshot
- Calcular taxa (não aplicar ainda)
- Registrar em metadata

### 9.3. Liquidação Automática (Futuro)

**Quando:** Scheduled Actions

**O que fazer:**
- Ler settlement_days do snapshot
- Criar scheduled_action para liquidação futura
- Marcar receivable como recebido quando liquidação ocorrer

### 9.4. UnifyCard Acquiring (Futuro)

**Quando:** SPRINT 73

**O que fazer:**
- Implementar UnifyCardAcquiringService
- Integrar com PaymentExecution
- Usar método UNIFYCARD

---

**Fim do Relatório**




