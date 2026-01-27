# SPRINT 93 — LOYALTY / FIDELIDADE (CANÔNICA, AUDITÁVEL, SEM ECONOMIA PARALELA)

## OBJETIVO

Criar um sistema de fidelidade simples:
- Regras declarativas (por canal/segmento/produto/evento)
- Pontos acumulados por transação SUCCESS
- Ledger de pontos append-only (auditável)
- Resgate vira "voucher interno" (desconto) OU "benefit flag" — mas NUNCA mexe em bank/ledger
- UI mínima para ver saldo e histórico
- Integração com Venue Tabs (SPRINT 92): mostrar "você ganhou X pontos"

---

## 1. MIGRATIONS

### `236_create_loyalty_accounts.sql`
Tabela `loyalty_accounts`:
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `contact_id` (UUID, FK contacts)
- `status` (ENUM: ACTIVE, SUSPENDED)
- `points_balance` (BIGINT, default 0)
- `lifetime_earned` (BIGINT, default 0)
- `lifetime_redeemed` (BIGINT, default 0)
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMP)
- Constraint UNIQUE (tenant_id, contact_id)
- Índices: (tenant_id, contact_id), (tenant_id, status)

### `237_create_loyalty_ledger.sql`
Tabela `loyalty_ledger` (append-only):
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `contact_id` (UUID, FK contacts)
- `entry_type` (ENUM: EARN, REDEEM, ADJUST)
- `points` (BIGINT, signed)
- `reference_type` (TEXT: payment_transaction | order | ticket_sale | tab | manual)
- `reference_id` (UUID, nullable)
- `reason_code` (TEXT, nullable)
- `description` (TEXT, nullable)
- `created_by_actor_id` (UUID, nullable)
- `created_by_user_id` (UUID, nullable)
- `created_at` (TIMESTAMP)
- Constraint UNIQUE (tenant_id, reference_type, reference_id, entry_type) — **Idempotência**
- Índices: (tenant_id, contact_id, created_at DESC), (tenant_id, reference_type, reference_id)

### `238_create_loyalty_rules.sql`
Tabela `loyalty_rules`:
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `name` (VARCHAR(255))
- `status` (ENUM: ACTIVE, INACTIVE)
- `rule_type` (ENUM: PERCENT_OF_AMOUNT, FIXED_POINTS)
- `value` (NUMERIC(14,2))
- `applies_to` (ENUM: CHANNEL, SEGMENT, ACTOR, EVENT, VARIANT, CATEGORY)
- `applies_id` (UUID, nullable)
- `min_amount` (NUMERIC(14,2), nullable)
- `max_points_per_day` (BIGINT, nullable)
- `valid_from`, `valid_to` (TIMESTAMP, nullable)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)
- Índices: (tenant_id, status), (tenant_id, applies_to, applies_id), (tenant_id, valid_from, valid_to)

### `239_create_loyalty_vouchers.sql`
Tabela `loyalty_vouchers`:
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `contact_id` (UUID, FK contacts)
- `status` (ENUM: ACTIVE, USED, EXPIRED, CANCELLED)
- `voucher_type` (ENUM: DISCOUNT_FIXED, DISCOUNT_PERCENT, BENEFIT_FLAG)
- `value` (NUMERIC(14,2), nullable)
- `benefit_code` (TEXT, nullable)
- `expires_at` (TIMESTAMP, nullable)
- `created_from_ledger_id` (UUID, FK loyalty_ledger, nullable)
- `used_reference_type` (TEXT, nullable)
- `used_reference_id` (UUID, nullable)
- `metadata` (JSONB)
- `created_at`, `used_at` (TIMESTAMP, nullable)
- Índices: (tenant_id, contact_id), (tenant_id, status), (tenant_id, created_from_ledger_id)

---

## 2. BACKEND MODULE

### 2.1 Types
- `loyalty.types.ts`: LoyaltyAccount, LoyaltyLedgerEntry, LoyaltyRule, LoyaltyVoucher, inputs e filters

### 2.2 Repositories
- `loyalty.repository.ts`: CRUD de accounts, ledger (append-only com idempotência)
- `loyalty-rule.repository.ts`: CRUD de rules, busca de regras aplicáveis
- `loyalty-voucher.repository.ts`: CRUD de vouchers

### 2.3 Service

#### `LoyaltyService`
**Métodos principais:**

##### `getOrCreateAccount(contactId)`
- Busca ou cria conta de fidelidade

##### `getBalance(contactId)`
- Retorna saldo de pontos

##### `listLedger(contactId, pagination)`
- Lista histórico de pontos (append-only)

##### `listRules(filters)`
- Lista regras de fidelidade

##### `createRule(input)`
- Cria regra declarativa
- Audit: `LOYALTY_RULE_CREATED`

##### `setRuleStatus(ruleId, status)`
- Ativa/desativa regra
- Audit: `LOYALTY_RULE_STATUS_CHANGED`

##### `earnFromPaymentSuccess(input)`
- Resolve regras aplicáveis
- Calcula pontos (PERCENT_OF_AMOUNT ou FIXED_POINTS)
- Aplica caps (policy: `loyalty.max_points_per_day`, default 5000)
- Cria ledger entry EARN (idempotente)
- Atualiza `loyalty_accounts` counters (transação atômica)
- Audit: `LOYALTY_EARNED`

**Fórmula:**
- `PERCENT_OF_AMOUNT`: `points = amount * (value / 100)`
- `FIXED_POINTS`: `points = value`
- Aplica `min_amount` se fornecido
- Aplica `max_points_per_day` (policy ou regra)
- Calcula pontos já ganhos hoje e aplica cap

##### `redeemPoints(input)`
- Valida saldo suficiente
- Cria ledger entry REDEEM
- Cria voucher (ACTIVE)
- Decrementa `points_balance` (transação atômica)
- Audit: `LOYALTY_REDEEMED`

---

## 3. INTEGRAÇÕES

### 3.1 PaymentExecutionService
**Integração em `executePayment()` (status SUCCESS):**
- Verifica `intent.metadata.payerContactId` ou `intent.metadata.contact_id`
- Se existir, chama `loyaltyService.earnFromPaymentSuccess()`
- Determina channel:
  - `PDV`: se `order.metadata.pdv_session_id`
  - `VENUE`: se `order.metadata.tab_id` ou `source === 'VENUE'`
  - `EVENT`: se `order.metadata.is_ticket_order`
  - `MARKETPLACE`: default

**Integração em `markPixPaymentAsSuccess()` (PIX webhook):**
- Similar ao `executePayment()`, mas para pagamentos PIX

### 3.2 Venue/Tab
**Integração em `/t/:qrToken/orders/:orderId/pay`:**
- Após pagamento SUCCESS, busca pontos ganhos
- Retorna `earnedPoints` no response
- Frontend mostra "Você ganhou X pontos"

---

## 4. POLICY REGISTRY

Adicionadas chaves em `policy-registry.ts`:
- `loyalty.max_points_per_day` (default: 5000)
- `loyalty.earn_enabled` (default: true)
- `loyalty.redeem_enabled` (default: true)

---

## 5. ROTAS REST

Todas as rotas estão prefixadas com `/loyalty` e registradas em `marketplace.routes.ts`.

### 5.1 Account
- **GET** `/loyalty/account?contactId=...` — Busca conta de fidelidade

### 5.2 Ledger
- **GET** `/loyalty/ledger?contactId=...&limit=...&offset=...` — Lista histórico

### 5.3 Redeem
- **POST** `/loyalty/redeem` — Resgata pontos criando voucher
  ```json
  {
    "contactId": "...",
    "points": 100,
    "voucherType": "DISCOUNT_FIXED",
    "value": 10.00,
    "expiresAt": "2024-12-31T23:59:59Z"
  }
  ```

### 5.4 Rules
- **GET** `/loyalty/rules?status=...&appliesTo=...` — Lista regras
- **POST** `/loyalty/rules` — Cria regra
- **PATCH** `/loyalty/rules/:id/status` — Altera status

### 5.5 Vouchers
- **GET** `/loyalty/vouchers?contactId=...&status=...` — Lista vouchers

---

## 6. FRONTEND

### 6.1 Páginas

#### `LoyaltyPage.tsx` (`/loyalty`)
- Busca contact (input de busca)
- Mostra saldo, lifetime earned/redeemed
- Lista ledger paginado (últimos 50)
- Ação "Resgatar" (modal) → cria voucher
- Lista vouchers

### 6.2 API Client

#### `api/loyalty.ts`
Funções para comunicação com backend:
- `getLoyaltyAccount()`
- `listLoyaltyLedger()`
- `redeemPoints()`
- `listLoyaltyVouchers()`

### 6.3 Integração UX

#### `TabPage.tsx`
- Após pagamento SUCCESS, mostra "Você ganhou X pontos"
- Usa campo `earnedPoints` retornado pelo backend

---

## 7. REGRAS E FÓRMULA

### 7.1 Cálculo de Pontos
- **PERCENT_OF_AMOUNT**: `points = Math.round(amount * (value / 100))`
- **FIXED_POINTS**: `points = Math.round(value)`
- Aplica `min_amount` se fornecido
- Aplica `max_points_per_day` (policy ou regra)

### 7.2 Caps
- **Cap diário**: Calcula pontos já ganhos hoje e aplica `max_points_per_day`
- **Cap por regra**: Se regra tem `max_points_per_day`, aplica também

### 7.3 Validações
- `min_amount`: Transação deve ter valor >= `min_amount`
- `valid_from/valid_to`: Regra só aplica dentro do período
- `status`: Apenas regras ACTIVE são consideradas

---

## 8. IDEMPOTÊNCIA

### 8.1 Constraint UNIQUE
- `loyalty_ledger`: `(tenant_id, reference_type, reference_id, entry_type)`
- Evita duplicar earn em retries

### 8.2 Fluxo
1. Tentar inserir ledger entry
2. Se conflito (já existe), buscar existente
3. Retornar existente sem atualizar balance (idempotente)

---

## 9. POR QUE NÃO É DINHEIRO

✅ **Loyalty ≠ dinheiro**
- Pontos NÃO são saldo bancário
- Pontos NÃO podem ser transferidos
- Pontos NÃO geram juros
- Pontos são apenas "crédito interno" para vouchers

✅ **Resgate não executa pagamento**
- Resgate cria voucher (desconto ou benefit flag)
- Voucher pode ser aplicado no pricing (futuro)
- Nenhuma ação automática no bank/ledger

✅ **Tudo auditável**
- Ledger append-only
- Todas as ações registram eventos
- Metadata preservado

---

## 10. GUARDRAILS

✅ **Loyalty ≠ dinheiro**
- Pontos não são saldo bancário
- Sem transferências
- Sem juros

✅ **Sem ações automáticas irreversíveis**
- Resgate cria voucher, não executa pagamento
- Voucher pode ser cancelado/expirar

✅ **Sem ranking/score social**
- Pontos são privados por contact
- Não há leaderboard

✅ **Regras explícitas e explicáveis**
- Regras declarativas
- Fórmula clara
- Caps explícitos

✅ **Append-only no ledger**
- Histórico não pode ser alterado
- Apenas novos registros

✅ **Tudo auditável**
- Todas as ações registram eventos
- Metadata preservado

---

## 11. ENDPOINTS E EXEMPLOS

### Criar regra
```bash
curl -X POST http://localhost:3000/loyalty/rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "1% em compras no Marketplace",
    "ruleType": "PERCENT_OF_AMOUNT",
    "value": 1.0,
    "appliesTo": "CHANNEL",
    "appliesId": "MARKETPLACE",
    "minAmount": 10.00
  }'
```

### Resgatar pontos
```bash
curl -X POST http://localhost:3000/loyalty/redeem \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "contactId": "uuid",
    "points": 100,
    "voucherType": "DISCOUNT_FIXED",
    "value": 10.00
  }'
```

### Listar ledger
```bash
curl http://localhost:3000/loyalty/ledger?contactId=uuid&limit=50
```

---

## 12. COMO CONECTAR COM PRICING NO FUTURO (VOUCHER)

### 12.1 Aplicação de Voucher
- `PricingService` pode verificar vouchers ativos do contact
- Aplicar desconto no cálculo de preço
- Marcar voucher como USED após aplicação

### 12.2 Tipos de Voucher
- **DISCOUNT_FIXED**: Desconto fixo em R$
- **DISCOUNT_PERCENT**: Desconto percentual
- **BENEFIT_FLAG**: Flag de benefício (ex: "frete grátis", "brinde")

---

## 13. ARQUIVOS CRIADOS/MODIFICADOS

### Backend
- `backend/migrations/236_create_loyalty_accounts.sql`
- `backend/migrations/237_create_loyalty_ledger.sql`
- `backend/migrations/238_create_loyalty_rules.sql`
- `backend/migrations/239_create_loyalty_vouchers.sql`
- `backend/src/modules/loyalty/loyalty.types.ts`
- `backend/src/modules/loyalty/loyalty.repository.ts`
- `backend/src/modules/loyalty/loyalty-rule.repository.ts`
- `backend/src/modules/loyalty/loyalty-voucher.repository.ts`
- `backend/src/modules/loyalty/loyalty.service.ts`
- `backend/src/modules/loyalty/loyalty.routes.ts`
- `backend/src/modules/marketplace/marketplace.routes.ts` (registro das rotas)
- `backend/src/modules/marketplace/payment-execution.service.ts` (integração)
- `backend/src/modules/venue/venue.routes.ts` (integração UX)
- `backend/src/core/policy/policy-registry.ts` (políticas)

### Frontend
- `frontend/src/api/loyalty.ts`
- `frontend/src/pages/LoyaltyPage.tsx`
- `frontend/src/pages/LoyaltyPage.css`
- `frontend/src/pages/TabPage.tsx` (integração UX)
- `frontend/src/pages/TabPage.css` (integração UX)
- `frontend/src/App.tsx` (rotas)

### Documentação
- `SPRINT_93_LOYALTY.md` (este arquivo)

---

## 14. CRITÉRIOS DE PRONTO

- ✅ Consigo criar regra e acumular pontos por pagamento SUCCESS
- ✅ Não duplica pontos com retry (idempotência)
- ✅ Saldo e ledger batem (transação atômica)
- ✅ Resgate cria voucher sem tocar bank/ledger
- ✅ UI mínima funciona
- ✅ Tudo auditável
- ✅ Integração com Venue Tabs mostra pontos ganhos
- ✅ Policy registry configurado
- ✅ Documentação completa

---

**Status:** ✅ CONCLUÍDO



