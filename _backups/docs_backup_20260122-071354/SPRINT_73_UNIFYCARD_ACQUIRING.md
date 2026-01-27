# SPRINT 73: UNIFYCARD ACQUIRING (SIMULADO, CANÔNICO)

**Data:** 2024-12-19  
**Objetivo:** Criar camada de adquirência UnifyCard, simulando autorização, captura, liquidação e taxas regionais, sem integração externa real.

**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO DAS MUDANÇAS

### 1.1. Migration Criada

**Arquivo:**
- `backend/migrations/202_create_unifycard_transactions.sql` - Tabela `unifycard_transactions`

**Estrutura:**

**unifycard_transactions:**
- Status: `AUTHORIZED`, `CAPTURED`, `SETTLED`, `FAILED`
- Types: `CREDIT`, `DEBIT`, `PIX`, `VOUCHER`
- Campos: actor_id, payment_intent_id, payment_method_id, gross_amount_cents, fee_amount_cents, net_amount_cents, regional_account_id, etc.
- RLS habilitado
- Índices para performance

### 1.2. Service Criado

**UnifyCardService:**
- `authorize()` - Autoriza transação (calcula taxa, cria registro)
- `capture()` - Captura transação (muda status)
- `settle()` - Liquida transação (marca como SETTLED, futuramente cria ledger entry)
- `listTransactions()` - Lista transações com filtros
- `getTransactionById()` - Busca transação por ID

### 1.3. Integrações

**PaymentExecution:**
- Se `payment_method.provider = UNIFYCARD`, cria transação UnifyCard
- Autoriza e captura automaticamente
- Cria bank transaction simulado

**AccountsReceivable:**
- Referencia `unifycard_transaction_id` no metadata

### 1.4. Rotas REST

**UnifyCard:**
- `POST /unifycard/authorize` - Autoriza transação
- `POST /unifycard/capture` - Captura transação
- `POST /unifycard/settle` - Liquida transação
- `GET /unifycard/transactions` - Lista transações
- `GET /unifycard/transactions/:id` - Busca transação

---

## 2. ESTRUTURA DE DADOS

### 2.1. unifycard_transactions

```sql
CREATE TABLE unifycard_transactions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    payment_intent_id UUID NOT NULL,
    payment_method_id UUID,
    transaction_type unifycard_transaction_type NOT NULL, -- CREDIT, DEBIT, PIX, VOUCHER
    status unifycard_transaction_status NOT NULL DEFAULT 'AUTHORIZED',
    gross_amount_cents BIGINT NOT NULL,
    fee_amount_cents BIGINT NOT NULL DEFAULT 0,
    net_amount_cents BIGINT NOT NULL,
    regional_account_id UUID,
    authorized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    captured_at TIMESTAMP WITH TIME ZONE,
    settled_at TIMESTAMP WITH TIME ZONE,
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

## 3. LIFECYCLE DE TRANSAÇÃO

### 3.1. Transições de Status

```
AUTHORIZED → CAPTURED → SETTLED
     ↓
  FAILED
```

**Regras:**
- AUTHORIZED: Transação autorizada (aguardando captura)
- CAPTURED: Transação capturada (aguardando liquidação)
- SETTLED: Transação liquidada (valor creditado na conta regional)
- FAILED: Transação falhou

### 3.2. Cálculo de Taxas

**Lógica:**
- Busca `fee_percentage` do payment method
- Calcula: `fee_amount_cents = gross_amount_cents * fee_percentage`
- Calcula: `net_amount_cents = gross_amount_cents - fee_amount_cents`

---

## 4. INTEGRAÇÃO COM PAYMENT EXECUTION

### 4.1. Detecção de UnifyCard

**Quando:** `executePayment()` é chamado

**O que é verificado:**
- Se `payment_method.provider = UNIFYCARD`
- Se sim, cria transação UnifyCard em vez de transfer direto

**Exemplo:**
```typescript
const paymentMethodSnapshot = intent.metadata?.payment_method_snapshot;
const isUnifyCard = paymentMethodSnapshot?.provider === 'UNIFYCARD';

if (isUnifyCard) {
  // Criar transação UnifyCard
  const unifyCardTransaction = await unifyCardService.authorize(...);
  const capturedTransaction = await unifyCardService.capture(...);
}
```

### 4.2. Fluxo Automático

**Autorização:**
- Cria transação com status AUTHORIZED
- Calcula taxa baseada no payment method
- Salva valores (gross, fee, net)

**Captura:**
- Marca como CAPTURED imediatamente (simulação)
- Atualiza `captured_at`

**Liquidação:**
- Futuro: criar ledger entry no UnifyBank
- Por enquanto, apenas marca como SETTLED

---

## 5. GUARDRAILS RESPEITADOS

### 5.1. UnifyCard ≠ Banco externo

- ✅ UnifyCard é camada de adquirência simulada
- ✅ Não integra com bancos externos
- ✅ Não move dinheiro real

### 5.2. UnifyCard ≠ Visa/Mastercard

- ✅ Não integra com bandeiras
- ✅ Simulação determinística
- ✅ Apenas modelagem

### 5.3. Nenhuma Liquidação Automática

- ✅ Liquidação requer ação explícita
- ✅ `settle()` deve ser chamado manualmente
- ✅ Nenhuma automação escondida

### 5.4. Liquidação Auditável

- ✅ Todas as liquidações geram audit event
- ✅ Contexto completo registrado
- ✅ Reversível (futuro)

---

## 6. AUDITORIA

### 6.1. Eventos Registrados

**UnifyCard:**
- `UNIFYCARD_TRANSACTION_AUTHORIZED` - Quando transação é autorizada
- `UNIFYCARD_TRANSACTION_CAPTURED` - Quando transação é capturada
- `UNIFYCARD_TRANSACTION_SETTLED` - Quando transação é liquidada

### 6.2. Contexto de Auditoria

Cada evento inclui:
- `transaction_id`
- `payment_intent_id`
- `status`
- `regional_account_id` (se liquidada)
- `created_by_user_id` / `captured_by_user_id` / `settled_by_user_id`

---

## 7. ARQUIVOS CRIADOS

### 7.1. Migration

1. `backend/migrations/202_create_unifycard_transactions.sql`

### 7.2. Types

2. `backend/src/modules/marketplace/unifycard.types.ts`

### 7.3. Repository

3. `backend/src/modules/marketplace/unifycard.repository.ts`

### 7.4. Service

4. `backend/src/modules/marketplace/unifycard.service.ts`

### 7.5. Routes

5. `backend/src/modules/marketplace/unifycard.routes.ts`

### 7.6. Integrações

6. `backend/src/modules/marketplace/payment-execution.service.ts` (atualizado - detecta UNIFYCARD)
7. `backend/src/modules/marketplace/accounts-receivable.service.ts` (atualizado - referencia unifycard_transaction_id)
8. `backend/src/modules/marketplace/marketplace.routes.ts` (atualizado - registra rotas)

---

## 8. EXEMPLOS DE USO

### 8.1. Fluxo Automático: Payment Execution → UnifyCard

```typescript
// 1. Payment execution detecta UNIFYCARD
const intent = await paymentIntentService.createPaymentIntent(tenantId, {
  orderId: 'order-123',
  amount: 100.00,
  currency: 'BRL',
  paymentMethodId: 'unifycard-method-123', // Provider: UNIFYCARD
});

// 2. Execute payment
const transaction = await paymentExecutionService.executePayment(tenantId, {
  paymentIntentId: intent.id,
  buyerActorId: 'buyer-123',
  sellerActorId: 'seller-123',
});

// 3. UnifyCard transaction criada automaticamente
// - Status: AUTHORIZED → CAPTURED
// - Taxa calculada
// - Valores salvos
```

### 8.2. Liquidação Manual

```typescript
// Liquidar transação
const settledTransaction = await unifyCardService.settle(tenantId, {
  transactionId: 'transaction-123',
  regionalAccountId: 'account-123',
}, 'actor-123', 'user-123');

// Futuro: cria ledger entry no UnifyBank
```

---

## 9. CRITÉRIO DE PRONTO

### ✅ Todos os Critérios Atendidos

1. **Autorização funcionando:**
   - ✅ `authorize()` cria transação
   - ✅ Calcula taxa automaticamente

2. **Captura funcionando:**
   - ✅ `capture()` muda status
   - ✅ Atualiza `captured_at`

3. **Liquidação funcionando:**
   - ✅ `settle()` marca como SETTLED
   - ✅ Salva `regional_account_id`

4. **Integração com PaymentExecution:**
   - ✅ Detecta UNIFYCARD automaticamente
   - ✅ Cria transação quando necessário

5. **Nenhuma integração externa:**
   - ✅ Nenhuma integração com Visa/Mastercard
   - ✅ Nenhum dinheiro real
   - ✅ Tudo simulado

---

## 10. PRÓXIMOS PASSOS (FUTURO)

### 10.1. Liquidação no UnifyBank (Futuro)

**Quando:** `settle()` é chamado

**O que fazer:**
- Criar ledger entry no UnifyBank
- Creditar `net_amount_cents` na conta regional
- Debitar taxa na conta da UnifyCard

### 10.2. Taxas Regionais (Futuro)

**Quando:** Autorizar transação

**O que fazer:**
- Buscar taxa regional baseada em `actor_id`
- Aplicar taxa regional além da taxa do método
- Calcular `net_amount_cents` considerando ambas

### 10.3. Reembolso (Futuro)

**Quando:** Transação precisa ser revertida

**O que fazer:**
- Criar transação de reembolso
- Reverter ledger entries
- Marcar transação original como revertida

---

**Fim do Relatório**




