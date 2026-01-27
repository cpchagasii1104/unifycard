# SPRINT 86 — PAYMENT LINKS (LINK DE PAGAMENTO)

## OBJETIVO

Criar link público de pagamento que funciona sem login, suporta PIX e UNIFYCARD, e respeita split, fiscal e auditoria.

---

## 1. MODELO PAYMENT LINK

### 1.1. Migration `226_create_payment_links.sql`

**Tabela `payment_links`:**
- `id` - UUID
- `tenant_id` - UUID
- `created_by_actor_id` - UUID (quem criou o link)
- `slug` - VARCHAR(255) (único, usado na URL `/pay/:slug`)
- `title` - VARCHAR(255)
- `description` - TEXT
- `amount` - DECIMAL(15, 2)
- `currency` - VARCHAR(10) (default: BRL)
- `expires_at` - TIMESTAMP (nullable)
- `max_uses` - INTEGER (nullable, NULL = sem limite)
- `uses_count` - INTEGER (default: 0)
- `status` - ENUM (ACTIVE, EXPIRED, DISABLED)
- `contact_id` - UUID (nullable, contact vinculado)
- `metadata` - JSONB
- `created_at`, `updated_at` - TIMESTAMP

**Constraints:**
- `UNIQUE (tenant_id, slug)` - Slug único por tenant
- `check_amount_positive` - amount > 0
- `check_uses_count_non_negative` - uses_count >= 0
- `check_max_uses_positive` - max_uses > 0 se não NULL

**Índices:**
- `idx_payment_links_tenant_id`
- `idx_payment_links_slug` (onde status = ACTIVE)
- `idx_payment_links_created_by`
- `idx_payment_links_expired`

### 1.2. Migration `227_create_payment_link_payments.sql`

**Tabela `payment_link_payments` (append-only):**
- `id` - UUID
- `tenant_id` - UUID
- `payment_link_id` - UUID (FK)
- `payment_intent_id` - UUID (FK, UNIQUE)
- `payment_transaction_id` - UUID (nullable)
- `contact_id` - UUID (nullable)
- `status` - ENUM (PENDING, SUCCESS, FAILED, CANCELLED)
- `metadata` - JSONB
- `created_at`, `updated_at` - TIMESTAMP

**Constraints:**
- `UNIQUE (tenant_id, payment_intent_id)` - 1 registro por PaymentIntent

---

## 2. PaymentLinkService

### 2.1. Métodos

**Arquivo:** `backend/src/modules/payments/payment-link.service.ts`

- `createLink(input)` - Cria payment link
- `getBySlug(slug)` - Busca link por slug (público)
- `getById(linkId)` - Busca link por ID
- `validateLink(link)` - Valida se link pode ser usado
- `registerUse(linkId)` - Incrementa contador de usos
- `expireIfNeeded(linkId)` - Expira link se necessário
- `disable(linkId)` - Desabilita link

**Regras:**
- ✅ Link pode ser usado sem login
- ✅ Valida expiração e limite de uso
- ✅ Não cria PaymentIntent automaticamente
- ✅ Tudo auditável

---

## 3. INTEGRAÇÃO COM PAYMENTINTENT

### 3.1. Endpoint Público

**POST /pay/:slug/intent**

**Fluxo:**
1. Busca PaymentLink por slug
2. Valida status (ACTIVE, não expirado, não atingiu limite)
3. Cria Contact se fornecido (opcional)
4. Cria order temporário (PaymentIntent requer orderId)
5. Cria PaymentIntent:
   - `amount` = `link.amount`
   - `metadata.payment_link_id` = link.id
   - `metadata.source` = `PAYMENT_LINK`
   - `metadata.payerContactId` = contact.id (se criado)
6. Autoriza PaymentIntent
7. Registra pagamento via link (append-only)
8. Retorna:
   - `paymentIntentId`
   - `availableMethods` (PIX, UNIFYCARD)

**Código:**
```typescript
// Criar order temporário
const tempOrder = await orderService.createOrder(tenantId, {
  buyerActorId: link.createdByActorId,
  sellerActorId: link.createdByActorId,
  metadata: {
    is_payment_link: true,
    payment_link_id: link.id,
    payment_link_slug: slug,
  },
});

// Criar PaymentIntent
const intent = await paymentIntentService.createPaymentIntent(tenantId, {
  orderId: submittedOrder.id,
  amount: link.amount,
  currency: link.currency,
  metadata: {
    payment_link_id: link.id,
    source: 'PAYMENT_LINK',
    payerContactId: contactId,
  },
});
```

---

## 4. EXECUÇÃO DE PAGAMENTO

### 4.1. Fluxo

**Reutiliza PaymentExecutionService:**

1. Cliente escolhe método (PIX ou UNIFYCARD)
2. Chama `PaymentExecutionService.executePayment()`
3. Se PIX:
   - Cria PixCharge
   - Retorna QR Code + payload
   - Status PENDING até webhook
4. Se UNIFYCARD:
   - Fluxo normal (autorização + captura)
   - Status SUCCESS imediato
5. Após SUCCESS:
   - `registerUse()` incrementa contador
   - AccountsReceivable criado
   - Settlement criado
   - Fiscal respeita KYC

### 4.2. Integração com PaymentExecution

**PaymentExecutionService.executePayment() detecta payment link:**
```typescript
const orderMetadata = order.metadata || {};
if (orderMetadata.is_payment_link) {
  // Registrar uso após SUCCESS
  await paymentLinkService.registerUse(tenantId, orderMetadata.payment_link_id);
  
  // Atualizar status do payment_link_payment
  await paymentLinkRepository.updatePaymentStatus(
    tenantId,
    paymentIntentId,
    'SUCCESS',
    successTransaction.id
  );
}
```

---

## 5. ENDPOINTS PÚBLICOS

### 5.1. GET /pay/:slug

**Retorna dados do link (read-only, público)**

**Resposta:**
```json
{
  "id": "...",
  "title": "Pagamento de Serviço",
  "description": "Descrição do pagamento",
  "amount": 100.00,
  "currency": "BRL",
  "expiresAt": "2024-01-01T12:00:00Z",
  "maxUses": 10,
  "usesCount": 3,
  "status": "ACTIVE"
}
```

### 5.2. POST /pay/:slug/intent

**Cria PaymentIntent a partir do link**

**Body:**
```json
{
  "tenantId": "...",
  "contact": {
    "name": "João Silva",
    "email": "joao@example.com",
    "phone": "+5511999999999",
    "taxId": "12345678901"
  },
  "paymentMethodId": "..."
}
```

**Resposta:**
```json
{
  "paymentIntentId": "...",
  "availableMethods": ["PIX", "UNIFYCARD"],
  "amount": 100.00,
  "currency": "BRL"
}
```

### 5.3. GET /pay/:slug/status

**Consulta status do pagamento**

**Query params:**
- `tenantId` (obrigatório)
- `paymentIntentId` (opcional)

**Resposta:**
```json
{
  "paymentIntent": {
    "id": "...",
    "status": "AUTHORIZED",
    "amount": 100.00,
    "currency": "BRL"
  },
  "transaction": {
    "id": "...",
    "status": "PENDING",
    "amount": 100.00
  },
  "link": {
    "id": "...",
    "title": "Pagamento de Serviço",
    "amount": 100.00,
    "usesCount": 1
  }
}
```

**Segurança:**
- ✅ Sem auth (público)
- ✅ Rate limit aplicado
- ✅ Sem acesso a dados internos
- ✅ Apenas dados do link e status do pagamento

---

## 6. FRONTEND MÍNIMO

### 6.1. Página `/pay/:slug`

**Arquivo:** `frontend/src/pages/PaymentLinkPage.tsx`

**Funcionalidades:**
- Mostrar título, descrição, valor
- Formulário de contato (opcional)
- Escolher método (PIX / UNIFYCARD)
- Exibir QR Code PIX
- Atualizar status em tempo real (polling simples)

**Fluxo:**
1. Carrega dados do link
2. Cliente preenche dados (opcional)
3. Escolhe método de pagamento
4. Cria PaymentIntent
5. Se PIX: exibe QR Code
6. Se UNIFYCARD: fluxo normal
7. Polling para atualizar status

---

## 7. FLUXO COMPLETO

### 7.1. Criação de Link

1. Usuário cria payment link via API protegida
2. Link recebe slug único
3. Link fica ACTIVE

### 7.2. Uso do Link (Público)

1. Cliente acessa `/pay/:slug`
2. Vê título, descrição, valor
3. Preenche dados (opcional)
4. Escolhe método (PIX / UNIFYCARD)
5. Cria PaymentIntent
6. Executa pagamento
7. Após SUCCESS:
   - Contador incrementado
   - AccountsReceivable criado
   - Settlement criado
   - Fiscal respeita KYC

---

## 8. GUARDRAILS

- ✅ **Link acessível sem login** - Rota pública
- ✅ **PIX funcional** - Integração com PixService
- ✅ **UnifyCard funcional** - Fluxo normal
- ✅ **Split e settlement corretos** - Reutiliza fluxo existente
- ✅ **Fiscal respeita KYC** - Validação KYC antes de emitir
- ✅ **Auditoria completa** - Todas as ações registradas
- ✅ **Nenhuma automação invisível** - Tudo explícito

---

## 9. ARQUIVOS CRIADOS/ALTERADOS

### Backend
- `backend/migrations/226_create_payment_links.sql` (NOVO)
- `backend/migrations/227_create_payment_link_payments.sql` (NOVO)
- `backend/src/modules/payments/payment-link.types.ts` (NOVO)
- `backend/src/modules/payments/payment-link.repository.ts` (NOVO)
- `backend/src/modules/payments/payment-link.service.ts` (NOVO)
- `backend/src/modules/payments/payment-link.routes.ts` (NOVO)
- `backend/src/modules/marketplace/payment-execution.service.ts` (ALTERADO - detecta payment link)
- `backend/src/server.ts` (ALTERADO - registro de rotas públicas)

### Frontend
- `frontend/src/pages/PaymentLinkPage.tsx` (NOVO)
- `frontend/src/pages/PaymentLinkPage.css` (NOVO)
- `frontend/src/App.tsx` (ALTERADO - rota pública `/pay/:slug`)

### Documentação
- `SPRINT_86_PAYMENT_LINKS.md` (NOVO)

---

## 10. CRITÉRIO DE PRONTO

✅ Link acessível sem login
✅ PIX funcional
✅ UnifyCard funcional
✅ Split e settlement corretos
✅ Fiscal respeita KYC
✅ Auditoria completa
✅ Nenhuma automação invisível

---

## 11. NOTAS

- Link funciona sem login (rota pública)
- Order temporário criado apenas para PaymentIntent (metadata indica payment_link)
- Contact opcional (criado se fornecido)
- Métodos disponíveis: PIX e UNIFYCARD
- Polling simples para atualizar status (futuro: WebSocket)
- Rate limit aplicado em rotas públicas
- Tudo auditável e explícito



