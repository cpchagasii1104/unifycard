# SPRINT 85 — PIX INTEGRATION (REAL, SEGURA, CANÔNICA)

## OBJETIVO

Criar infraestrutura canônica de PIX sem depender de provider específico agora, mas já com webhook e conciliação.

---

## 1. PROVIDER PIX (ABSTRAÇÃO)

### 1.1. Interface `PixProvider`

**Arquivo:** `backend/src/modules/payments/pix-provider.interface.ts`

**Métodos:**
- `createCharge(input): PixChargeResult` - Cria charge PIX
- `getChargeStatus(chargeId): PixChargeData` - Busca status do charge
- `parseWebhook(payload): PixWebhookEvent` - Parse webhook payload
- `isAvailable(): boolean` - Verifica se provider está disponível

**Regras:**
- ✅ Provider é plugável (mock, Asaas, MercadoPago, etc.)
- ✅ Nenhuma lógica de negócio no provider
- ✅ Provider apenas comunica com serviço externo
- ✅ Falhas do provider não quebram o sistema

### 1.2. MockPixProvider

**Arquivo:** `backend/src/modules/payments/pix-provider.mock.ts`

**Comportamento:**
- Simula criação de charge
- Gera QR Code mock (base64)
- Gera código copia-e-cola mock
- Simula webhook events

---

## 2. MODELO CANÔNICO PIX

### 2.1. Migration `224_create_pix_charges.sql`

**Tabela `pix_charges`:**
- `id` - UUID
- `tenant_id` - UUID
- `payment_intent_id` - UUID (FK)
- `provider` - VARCHAR(50) (MOCK, ASAAS, MERCADOPAGO, etc.)
- `provider_charge_id` - VARCHAR(255) (ID no provider)
- `amount` - BIGINT (em centavos)
- `currency` - VARCHAR(10)
- `status` - ENUM (CREATED, PAID, EXPIRED, CANCELLED)
- `expires_at` - TIMESTAMP
- `paid_at` - TIMESTAMP (nullable)
- `payload_snapshot` - JSONB (QR Code, copia-e-cola, etc.)
- `metadata` - JSONB
- `created_at`, `updated_at` - TIMESTAMP

**Constraints:**
- `UNIQUE (tenant_id, payment_intent_id)` - 1 PixCharge por PaymentIntent
- `check_amount_positive` - amount > 0
- `check_expires_at_future` - expires_at > created_at

**Índices:**
- `idx_pix_charges_tenant_id`
- `idx_pix_charges_payment_intent`
- `idx_pix_charges_provider_charge`
- `idx_pix_charges_status`
- `idx_pix_charges_expired`

### 2.2. Migration `225_create_pix_webhook_events.sql`

**Tabela `pix_webhook_events`:**
- `id` - UUID
- `tenant_id` - UUID
- `provider` - VARCHAR(50)
- `provider_event_id` - VARCHAR(255) (para idempotência)
- `pix_charge_id` - UUID (FK, nullable)
- `status` - ENUM (RECEIVED, PROCESSED, FAILED, DUPLICATE)
- `raw_payload` - JSONB (preservado para auditoria)
- `received_at` - TIMESTAMP
- `processed_at` - TIMESTAMP (nullable)
- `error_message` - TEXT (nullable)
- `metadata` - JSONB
- `created_at` - TIMESTAMP

**Constraints:**
- `UNIQUE (tenant_id, provider, provider_event_id)` - Idempotência

**Índices:**
- `idx_pix_webhook_events_tenant_id`
- `idx_pix_webhook_events_provider`
- `idx_pix_webhook_events_charge`
- `idx_pix_webhook_events_status`
- `idx_pix_webhook_events_provider_event`

---

## 3. PixService

### 3.1. Métodos

**Arquivo:** `backend/src/modules/payments/pix.service.ts`

- `createPixCharge(paymentIntentId)` - Cria charge PIX (idempotente)
- `markAsPaid(chargeId, paidAt)` - Marca charge como pago
- `expireCharge(chargeId)` - Expira charge
- `getChargeByIntent(paymentIntentId)` - Busca charge por intent
- `getChargeByProviderChargeId(provider, providerChargeId)` - Busca charge por provider ID

**Regras:**
- ✅ 1 PixCharge por PaymentIntent (idempotência)
- ✅ NÃO marca pagamento como SUCCESS aqui
- ✅ Provider é plugável (mock, Asaas, MercadoPago, etc.)

---

## 4. INTEGRAÇÃO COM PAYMENTEXECUTION

### 4.1. Fluxo PIX

**Quando `payment_method.type === PIX`:**

1. `PaymentExecutionService.executePayment()` detecta PIX
2. Cria `PixCharge` via `PixService.createPixCharge()`
3. Salva QR Code + payload no metadata da transaction
4. Retorna transaction com status `PENDING` (não executa pagamento)
5. Frontend exibe QR Code para pagamento

**Quando webhook confirma pagamento:**

1. Webhook recebe evento `charge.paid`
2. `PixService.markAsPaid()` marca charge como pago
3. `PaymentExecutionService.markPixPaymentAsSuccess()`:
   - Marca transaction como SUCCESS
   - Cria bank transaction (simulado)
   - Cria AccountsReceivable
   - Dispara Settlement

### 4.2. Código

```typescript
// PaymentExecutionService.executePayment()
if (isPix) {
  // Criar PixCharge
  const pixCharge = await pixService.createPixCharge(tenantId, {
    paymentIntentId,
    amount: Math.round(intent.amount * 100),
    currency: intent.currency,
    expiresInMinutes: 30,
  });

  // Salvar QR Code no metadata
  await paymentTransactionRepository.updateMetadata(tenantId, transaction.id, {
    pix_charge_id: pixCharge.id,
    pix_qr_code: pixCharge.payloadSnapshot.qrCode,
    pix_qr_code_text: pixCharge.payloadSnapshot.qrCodeText,
    pix_expires_at: pixCharge.expiresAt.toISOString(),
  });

  // Retornar (não executa pagamento ainda)
  return transaction;
}
```

---

## 5. WEBHOOK PIX (EXPLÍCITO)

### 5.1. Rota Pública

**POST /webhooks/pix/:provider**

**Fluxo:**
1. Validar assinatura (mock inicialmente)
2. Parse webhook via `provider.parseWebhook()`
3. Criar webhook event (idempotência por `provider_event_id`)
4. Localizar `pix_charge` via `provider_charge_id`
5. Se evento é `charge.paid`:
   - Chamar `PixService.markAsPaid()`
   - Chamar `PaymentExecutionService.markPixPaymentAsSuccess()`
6. Marcar webhook event como PROCESSED

**Idempotência:**
- ✅ `UNIQUE (tenant_id, provider, provider_event_id)`
- ✅ Se evento já processado, retorna sucesso

**Segurança:**
- ✅ Validação de assinatura (mock inicialmente)
- ✅ Raw payload preservado para auditoria
- ✅ Tudo auditável

---

## 6. ENDPOINT DE CONSULTA

### 6.1. GET /marketplace/payments/pix/:paymentIntentId

**Resposta:**
```json
{
  "status": "CREATED",
  "qrCode": "data:image/png;base64,...",
  "qrCodeText": "00020126580014BR.GOV.BCB.PIX...",
  "expiresAt": "2024-01-01T12:00:00Z",
  "paidAt": null,
  "amount": 10000,
  "currency": "BRL"
}
```

**Status possíveis:**
- `CREATED` - Charge criado, aguardando pagamento
- `PAID` - Charge pago
- `EXPIRED` - Charge expirado
- `CANCELLED` - Charge cancelado

---

## 7. FLUXO COMPLETO PIX

### 7.1. Criação de Charge

1. Cliente escolhe PIX como método de pagamento
2. `PaymentIntent` criado com `payment_method.type = PIX`
3. `PaymentExecutionService.executePayment()` detecta PIX
4. `PixService.createPixCharge()` cria charge no provider
5. QR Code + payload salvo no metadata
6. Transaction retornada com status `PENDING`

### 7.2. Pagamento

1. Cliente escaneia QR Code ou copia código
2. Pagamento realizado no banco
3. Provider envia webhook `charge.paid`
4. Webhook processa evento:
   - Marca charge como pago
   - Marca transaction como SUCCESS
   - Cria AccountsReceivable
   - Dispara Settlement

### 7.3. Conciliação

1. Webhook events são armazenados (append-only)
2. Raw payload preservado para auditoria
3. Idempotência por `provider_event_id`
4. Status rastreável (RECEIVED, PROCESSED, FAILED, DUPLICATE)

---

## 8. GUARDRAILS

- ✅ **NÃO acoplar lógica ao provider** - Provider é plugável
- ✅ **NÃO criar heurística automática** - Tudo explícito
- ✅ **NÃO executar economia invisível** - Tudo auditável
- ✅ **Webhook explícito** - Rota pública dedicada
- ✅ **Conciliação auditável** - Raw payload preservado
- ✅ **Idempotência total** - Por `provider_event_id` e `payment_intent_id`

---

## 9. ARQUIVOS CRIADOS/ALTERADOS

### Backend
- `backend/src/modules/payments/pix-provider.interface.ts` (NOVO)
- `backend/src/modules/payments/pix-provider.mock.ts` (NOVO)
- `backend/migrations/224_create_pix_charges.sql` (NOVO)
- `backend/migrations/225_create_pix_webhook_events.sql` (NOVO)
- `backend/src/modules/payments/pix.types.ts` (NOVO)
- `backend/src/modules/payments/pix.repository.ts` (NOVO)
- `backend/src/modules/payments/pix.service.ts` (NOVO)
- `backend/src/modules/payments/pix-webhook.repository.ts` (NOVO)
- `backend/src/modules/payments/pix.routes.ts` (NOVO)
- `backend/src/modules/marketplace/payment-execution.service.ts` (ALTERADO - integração PIX)
- `backend/src/modules/marketplace/marketplace.routes.ts` (ALTERADO - registro de pix.routes)
- `backend/src/server.ts` (ALTERADO - registro de webhook público)

### Documentação
- `SPRINT_85_PIX_INTEGRATION.md` (NOVO)

---

## 10. CRITÉRIO DE PRONTO

✅ PixCharge criado corretamente
✅ Webhook altera status
✅ Pagamento só é SUCCESS após webhook
✅ AccountsReceivable criado corretamente
✅ Settlement disparado corretamente
✅ Nenhuma automação invisível
✅ Código pronto para trocar Mock → Provider real

---

## 11. NOTAS

- Provider é plugável (mock, Asaas, MercadoPago, etc.)
- Mock provider funcional para desenvolvimento
- Webhook sempre auditável e idempotente
- Nenhuma lógica de negócio no provider
- Tudo explícito e declarativo
- Código preparado para trocar Mock → Provider real



