# SPRINT 94 — PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

## OBJETIVO

Implementar presença em eventos/venues com:
1. RSVP/Presença (CONFIRMED / CANCELLED / ATTENDED / NO_SHOW)
2. Check-in no local (QR / token)
3. Benefícios promocionais condicionados a check-in (ex: voucher, loyalty boost)
4. Consentimento explícito para "mostrar que confirmou presença" (privacy by default)
5. Sem penalty service. Nada de score oculto. Nada de bloqueio automático.

---

## 1. MIGRATIONS

### `240_create_presence_rsvps.sql`
Tabela `presence_rsvps`:
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `context_type` (ENUM: EVENT, VENUE)
- `context_id` (UUID)
- `contact_id` (UUID, FK contacts)
- `status` (ENUM: CONFIRMED, CANCELLED, ATTENDED, NO_SHOW)
- `visibility` (ENUM: PRIVATE, PUBLIC) — **default PRIVATE**
- `confirmed_at`, `cancelled_at`, `attended_at` (TIMESTAMP, nullable)
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMP)
- Constraint UNIQUE (tenant_id, context_type, context_id, contact_id)
- Índices: (tenant_id, context_type, context_id, status), (tenant_id, contact_id), (tenant_id, context_type, context_id, visibility) WHERE visibility = 'PUBLIC'

### `241_create_checkin_tokens.sql`
Tabela `checkin_tokens`:
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `context_type` (ENUM: EVENT, VENUE)
- `context_id` (UUID)
- `token` (TEXT UNIQUE) — token único gerado
- `status` (ENUM: ACTIVE, REVOKED, EXPIRED)
- `valid_from`, `valid_to` (TIMESTAMP, nullable)
- `created_by_actor_id`, `created_by_user_id` (UUID, nullable)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)
- Índices: (tenant_id, context_type, context_id), (token)

### `242_create_checkins.sql`
Tabela `checkins` (append-only):
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `context_type` (ENUM: EVENT, VENUE)
- `context_id` (UUID)
- `contact_id` (UUID, FK contacts)
- `token_id` (UUID, FK checkin_tokens, nullable)
- `checkin_type` (ENUM: QR, MANUAL)
- `status` (ENUM: CHECKED_IN, CHECKED_OUT)
- `reference_event_id` (TEXT, nullable) — idempotência opcional (device event id)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)
- **Idempotência**: 
  - UNIQUE (tenant_id, context_type, context_id, contact_id, status) WHERE status = 'CHECKED_IN'
  - UNIQUE (tenant_id, reference_event_id) WHERE reference_event_id IS NOT NULL
- Índices: (tenant_id, context_type, context_id, created_at DESC), (tenant_id, contact_id), (tenant_id, token_id)

### `243_create_promo_benefits.sql`
Tabela `promo_benefits`:
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `context_type` (ENUM: EVENT, VENUE)
- `context_id` (UUID)
- `benefit_type` (ENUM: LOYALTY_POINTS, LOYALTY_MULTIPLIER, VOUCHER)
- `benefit_value` (NUMERIC(14,2))
- `status` (ENUM: ACTIVE, INACTIVE)
- `requires_checkin` (BOOLEAN, default true)
- `max_redemptions` (INT, nullable)
- `per_contact_limit` (INT, default 1)
- `valid_from`, `valid_to` (TIMESTAMP, nullable)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)

Tabela `promo_benefit_redemptions` (append-only, idempotência):
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `benefit_id` (UUID, FK promo_benefits)
- `contact_id` (UUID, FK contacts)
- `checkin_id` (UUID, FK checkins, nullable)
- `loyalty_ledger_id` (UUID, FK loyalty_ledger, nullable)
- `voucher_id` (UUID, FK loyalty_vouchers, nullable)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)
- **Idempotência**: UNIQUE (tenant_id, benefit_id, contact_id)

---

## 2. BACKEND MODULE

### 2.1 Types
- `presence.types.ts`: PresenceRsvp, CheckinToken, Checkin, PromoBenefit, inputs e filters

### 2.2 Repositories
- `presence.repository.ts`: CRUD de RSVPs, stats
- `checkin-token.repository.ts`: CRUD de tokens
- `checkin.repository.ts`: CRUD de check-ins (append-only, idempotente)
- `promo-benefit.repository.ts`: CRUD de benefícios e resgates

### 2.3 Services

#### `PresenceService`
- `confirmPresence()` — Confirma presença (visibility default PRIVATE)
- `cancelPresence()` — Cancela presença
- `setVisibility()` — Altera visibilidade (PRIVATE/PUBLIC)
- `listPresence()` — Lista presenças (por default, apenas PUBLIC)
- `listMyPresence()` — Lista minhas presenças (auth)
- `getAttendanceStats()` — Estatísticas (confirmed, attended, no_show, rate)

#### `CheckinService`
- `createToken()` — Cria token de check-in (staff/admin)
- `revokeToken()` — Revoga token
- `checkInByToken()` — Check-in por token (público, idempotente)
- `manualCheckIn()` — Check-in manual (staff/admin)
- `checkOut()` — Check-out (append-only)
- `getAttendanceStats()` — Estatísticas

#### `PromoBenefitService`
- `createBenefit()` — Cria benefício promocional
- `listBenefits()` — Lista benefícios ativos
- `applyBenefitOnCheckIn()` — Aplica benefício quando check-in é feito
  - SOMENTE se `requires_checkin = true`
  - Dentro da validade (valid_from/valid_to)
  - Respeita `per_contact_limit`
  - Respeita `max_redemptions` (global)
  - Idempotente (não aplica duas vezes)
  - Ações permitidas:
    - `LOYALTY_POINTS`: Acumula pontos adicionais (via LoyaltyService)
    - `VOUCHER`: Cria voucher direto (sem debitar pontos)
    - `LOYALTY_MULTIPLIER`: Futuro (aplicar multiplicador na próxima compra)

---

## 3. INTEGRAÇÕES

### 3.1 Ticket Checkout
- Quando ticket sale existe, usuário pode CONFIRM presence no evento (não automático)
- Integração futura: sugerir confirmar presença após compra de ticket

### 3.2 Event Check-in
- `CheckinService.checkInByToken()` chama `PromoBenefitService.applyBenefitOnCheckIn()`
- Check-in marca presença como ATTENDED automaticamente

### 3.3 Loyalty
- Policy key: `presence.promo_enabled` (default: true)
- Benefícios podem acumular pontos ou criar vouchers

---

## 4. POLICY REGISTRY

Adicionada chave em `policy-registry.ts`:
- `presence.promo_enabled` (default: true)

---

## 5. ROTAS REST

Todas as rotas estão prefixadas com `/presence` e registradas em `marketplace.routes.ts`.

### 5.1 RSVP
- **POST** `/presence/rsvp/confirm` — Confirma presença
- **POST** `/presence/rsvp/cancel` — Cancela presença
- **POST** `/presence/rsvp/:id/visibility` — Altera visibilidade
- **GET** `/presence/my?contactId=...` — Lista minhas presenças (auth)

### 5.2 Public
- **GET** `/presence/:contextType/:contextId/public` — Lista presenças públicas (read-only)

### 5.3 Check-in (Staff/Admin)
- **POST** `/presence/:contextType/:contextId/tokens` — Cria token
- **POST** `/presence/tokens/:id/revoke` — Revoga token
- **POST** `/presence/checkin/by-token` — Check-in por token (público)
- **POST** `/presence/:contextType/:contextId/checkin/manual` — Check-in manual
- **POST** `/presence/:contextType/:contextId/checkout` — Check-out
- **GET** `/presence/:contextType/:contextId/stats` — Estatísticas

### 5.4 Promo Benefits
- **POST** `/presence/:contextType/:contextId/benefits` — Cria benefício
- **GET** `/presence/:contextType/:contextId/benefits` — Lista benefícios

---

## 6. FRONTEND

### 6.1 API Client
- `api/presence.ts` — Funções para comunicação com backend

### 6.2 Páginas (mínimo)
- Integração futura em Event/Ticket pages:
  - Botão "Confirmar presença"
  - Toggle "Mostrar minha presença publicamente" (default OFF)
  - Lista "Quem confirmou" (somente PUBLIC)
  - Área staff: gerar QR/token + botão check-in manual
  - Stats básicos (confirmed/attended/no_show)

---

## 7. GUARDRAILS

✅ **Nada automático irreversível**
- RSVP é ação explícita
- Check-in requer token ou ação manual
- Benefícios aplicados apenas uma vez (idempotência)

✅ **Nenhuma penalidade invisível**
- "No-show" é dado informativo, não castigo
- Não bloqueia nada automaticamente
- Não afeta score/reputação

✅ **Compartilhar presença é OPT-IN**
- Visibility default: PRIVATE
- Lista pública mostra apenas PUBLIC
- Usuário controla visibilidade

✅ **Check-in precisa de prova local**
- Token QR gerado por staff
- Validação de token antes de check-in
- Idempotência para evitar duplicação

✅ **Tudo auditável**
- Todas as ações registram eventos
- Check-ins são append-only
- Metadata preservado

---

## 8. IDEMPOTÊNCIA

### 8.1 Check-in
- Constraint UNIQUE: `(tenant_id, context_type, context_id, contact_id, status)` WHERE status = 'CHECKED_IN'
- Constraint UNIQUE: `(tenant_id, reference_event_id)` WHERE reference_event_id IS NOT NULL
- Evita duplicar check-in em retries

### 8.2 Promo Benefits
- Constraint UNIQUE: `(tenant_id, benefit_id, contact_id)`
- Evita aplicar benefício duas vezes para o mesmo contact

---

## 9. POR QUE NÃO HÁ PUNIÇÃO AUTOMÁTICA

✅ **No-show é informativo**
- Métrica operável (read-only)
- Não bloqueia nada
- Não afeta score/reputação

✅ **Sem penalty service**
- Nenhum sistema de penalidades
- Nenhum bloqueio automático
- Tudo explícito e auditável

✅ **Privacy by default**
- Visibility default: PRIVATE
- Usuário controla o que compartilha
- Lista pública mostra apenas PUBLIC

---

## 10. COMO HABILITA CHAT/MATCH DEPOIS

### 10.1 Base de Dados
- RSVPs com visibility PUBLIC podem ser usados para:
  - Ver quem confirmou presença
  - Sugerir matches (futuro)
  - Habilitar chat do local (futuro)

### 10.2 Consentimento Explícito
- Usuário deve optar por tornar presença pública
- Privacy by default garante controle

---

## 11. ARQUIVOS CRIADOS/MODIFICADOS

### Backend
- `backend/migrations/240_create_presence_rsvps.sql`
- `backend/migrations/241_create_checkin_tokens.sql`
- `backend/migrations/242_create_checkins.sql`
- `backend/migrations/243_create_promo_benefits.sql`
- `backend/src/modules/presence/presence.types.ts`
- `backend/src/modules/presence/presence.repository.ts`
- `backend/src/modules/presence/checkin-token.repository.ts`
- `backend/src/modules/presence/checkin.repository.ts`
- `backend/src/modules/presence/promo-benefit.repository.ts`
- `backend/src/modules/presence/presence.service.ts`
- `backend/src/modules/presence/checkin.service.ts`
- `backend/src/modules/presence/promo-benefit.service.ts`
- `backend/src/modules/presence/presence.routes.ts`
- `backend/src/modules/marketplace/marketplace.routes.ts` (registro das rotas)
- `backend/src/core/policy/policy-registry.ts` (política)
- `backend/src/core/policy/policy.types.ts` (domínio 'presence')

### Frontend
- `frontend/src/api/presence.ts`

### Documentação
- `SPRINT_94_PRESENCA_CHECKIN_PROMO.md` (este arquivo)

---

## 12. CRITÉRIOS DE PRONTO

- ✅ RSVP com visibilidade PRIVATE por default
- ✅ Lista pública mostra só PUBLIC
- ✅ Staff gera token; usuário faz check-in por token; idempotente
- ✅ Promo benefit opcional: check-in aplica points/voucher uma vez
- ✅ Stats funcionam
- ✅ Nada toca bank/ledger
- ✅ Tudo auditável
- ✅ Sem punição automática
- ✅ Privacy by default

---

**Status:** ✅ CONCLUÍDO



