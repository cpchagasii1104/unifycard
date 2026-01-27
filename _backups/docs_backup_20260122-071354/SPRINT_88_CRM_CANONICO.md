# SPRINT 88 — CRM CANÔNICO (CONTACT TIMELINE + SEGMENTAÇÃO + ORIGEM)

## OBJETIVO

Criar um CRM mínimo e canônico baseado na entidade `Contact`, consolidando dados existentes de:
- Orders (PDV/Marketplace)
- TicketSales (Eventos)
- PaymentLinks (Payments)
- AccountsReceivable
- FiscalDocuments (quando existir)

**Regra fundamental**: READ/WRITE apenas em entidades CRM. Não altera dados do core econômico (Order/Payment/Fiscal).

---

## 1. MIGRATIONS

### 1.1 `228_create_crm_notes.sql`
Tabela `crm_notes` para armazenar notas internas ou compartilhadas relacionadas a contatos.

**Campos:**
- `id` (UUID)
- `tenant_id` (UUID)
- `contact_id` (UUID, FK para contacts)
- `author_actor_id` (UUID, FK para actors)
- `author_user_id` (UUID, nullable, FK para users)
- `note` (TEXT)
- `visibility` (ENUM: INTERNAL | SHARED)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)

**RLS:** Habilitado com política de isolamento por tenant.

**Índices:**
- `tenant_id`
- `(tenant_id, contact_id)`
- `(tenant_id, author_actor_id)`
- `created_at DESC`

### 1.2 `229_create_crm_tags.sql`
Tabela `crm_tags` para definir tags do CRM.

**Campos:**
- `id` (UUID)
- `tenant_id` (UUID)
- `name` (VARCHAR(100))
- `color` (VARCHAR(7), opcional, formato #RRGGBB)
- `created_at` (TIMESTAMP)

**Constraints:**
- `UNIQUE (tenant_id, name)` — Nome único por tenant

**RLS:** Habilitado com política de isolamento por tenant.

**Índices:**
- `tenant_id`
- `(tenant_id, name)`

### 1.3 `230_create_crm_contact_tags.sql`
Tabela `crm_contact_tags` para vincular contatos com tags.

**Campos:**
- `id` (UUID)
- `tenant_id` (UUID)
- `contact_id` (UUID, FK para contacts)
- `tag_id` (UUID, FK para crm_tags)
- `created_at` (TIMESTAMP)

**Constraints:**
- `UNIQUE (tenant_id, contact_id, tag_id)` — Evita duplicação

**RLS:** Habilitado com política de isolamento por tenant.

**Índices:**
- `tenant_id`
- `(tenant_id, contact_id)`
- `(tenant_id, tag_id)`

### 1.4 `231_create_crm_consents.sql`
Tabela `crm_consents` para gerenciar consentimentos de comunicação.

**Campos:**
- `id` (UUID)
- `tenant_id` (UUID)
- `contact_id` (UUID, FK para contacts)
- `channel` (ENUM: EMAIL | SMS | WHATSAPP | PUSH)
- `status` (ENUM: GRANTED | REVOKED)
- `updated_by_actor_id` (UUID, FK para actors)
- `updated_by_user_id` (UUID, nullable, FK para users)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Constraints:**
- `UNIQUE (tenant_id, contact_id, channel)` — Um consentimento por canal por contato

**RLS:** Habilitado com política de isolamento por tenant.

**Índices:**
- `tenant_id`
- `(tenant_id, contact_id)`
- `(tenant_id, channel)`
- `(tenant_id, status)`

**Trigger:** `updated_at` atualizado automaticamente em UPDATE.

---

## 2. SERVICES

### 2.1 `crm.types.ts`
Define tipos TypeScript para:
- `CrmNote`
- `CrmTag`
- `CrmContactTag`
- `CrmConsent`
- `CrmTimelineEvent`
- `CrmTimelineEventType`
- `CrmTimelineFilters`
- Inputs para criação/atualização

### 2.2 `crm.repository.ts`
Repository para operações CRUD nas tabelas:
- `crm_notes`
- `crm_tags`
- `crm_contact_tags`
- `crm_consents`

**Métodos principais:**
- `createNote()`
- `listNotesByContact()`
- `createTag()`
- `listTags()`
- `assignTag()`
- `removeTag()`
- `setConsent()`
- `getConsentsByContact()`

### 2.3 `crm.service.ts`
Service principal com lógica de negócio.

**Métodos:**
- `addNote(tenantId, authorActorId, authorUserId, input)`
- `listNotes(tenantId, contactId)`
- `createTag(tenantId, input)`
- `listTags(tenantId)`
- `assignTag(tenantId, contactId, tagId, actorId, userId)`
- `removeTag(tenantId, contactId, tagId, actorId, userId)`
- `setConsent(tenantId, actorId, userId, input)`
- `getConsents(tenantId, contactId)`
- **`getTimeline(tenantId, contactId, filters)`** — Método principal de consolidação

### 2.4 `getTimeline()` — Consolidação de Dados

Este método consolida dados de múltiplas fontes sem criar novos registros:

1. **Orders** (via `orderRepository.listOrdersByContact()`)
   - Eventos: `ORDER_CREATED`, `ORDER_PAID`
   - Busca por `metadata->>'contact_id'`

2. **TicketSales** (via `ticketSaleRepository.listSalesByContact()`)
   - Eventos: `TICKET_PURCHASED`, `CHECKIN`
   - Busca por `metadata->>'contact_id'`

3. **PaymentLinks** (via `paymentLinkRepository.listPaymentsByContact()`)
   - Evento: `PAYMENT_LINK_USED`
   - Busca por `metadata->>'contact_id'`

4. **AccountsReceivable** (via `accountsReceivableRepository.listReceivablesByContact()`)
   - Evento: `RECEIVABLE_CREATED`
   - Busca por `metadata->>'contact_id'`

5. **FiscalDocuments** (via `fiscalDocumentRepository.listDocumentsByContact()`)
   - Eventos: `FISCAL_DRAFT`, `FISCAL_ISSUED`
   - Busca por `metadata->>'contact_id'`

**Filtros suportados:**
- `eventTypes`: Array de tipos de eventos
- `startDate`: Data inicial
- `endDate`: Data final
- `limit`: Limite de resultados (padrão: 50)
- `offset`: Offset para paginação

**Ordenação:** Por data (mais recente primeiro)

---

## 3. ENDPOINTS REST

Todas as rotas estão prefixadas com `/crm` e registradas em `marketplace.routes.ts`.

### 3.1 Timeline
- **GET** `/crm/contacts/:id/timeline`
  - Query params: `eventTypes`, `startDate`, `endDate`, `limit`, `offset`
  - Retorna: `{ timeline: CrmTimelineEvent[] }`

### 3.2 Notes
- **POST** `/crm/contacts/:id/notes`
  - Body: `{ note: string, visibility?: 'INTERNAL' | 'SHARED', metadata?: object }`
  - Retorna: `CrmNote`

- **GET** `/crm/contacts/:id/notes`
  - Retorna: `{ notes: CrmNote[] }`

### 3.3 Tags
- **POST** `/crm/tags`
  - Body: `{ name: string, color?: string }`
  - Retorna: `CrmTag`

- **GET** `/crm/tags`
  - Retorna: `{ tags: CrmTag[] }`

- **POST** `/crm/contacts/:id/tags/:tagId`
  - Atribui tag ao contato
  - Retorna: `{ success: true }`

- **DELETE** `/crm/contacts/:id/tags/:tagId`
  - Remove tag do contato
  - Retorna: `{ success: true }`

### 3.4 Consents
- **POST** `/crm/contacts/:id/consents`
  - Body: `{ channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH', status: 'GRANTED' | 'REVOKED', metadata?: object }`
  - Retorna: `CrmConsent`

- **GET** `/crm/contacts/:id/consents`
  - Retorna: `{ consents: CrmConsent[] }`

---

## 4. FRONTEND

### 4.1 Páginas

#### `CrmPage.tsx`
Lista de contatos com busca:
- Busca por nome, email, telefone ou CPF/CNPJ
- Cards clicáveis que navegam para detalhe
- Estilo simples, reutilizando padrões existentes

#### `CrmContactDetailPage.tsx`
Detalhe do contato com abas:
- **Timeline**: Eventos consolidados ordenados por data
- **Notas**: Lista de notas + formulário para adicionar
- **Tags**: Lista de tags disponíveis + criar nova + atribuir/remover
- **Consentimentos**: Gerenciar consentimentos por canal (EMAIL, SMS, WHATSAPP, PUSH)

### 4.2 API Client

#### `api/crm.ts`
Funções para comunicação com backend:
- `getContactTimeline()`
- `addContactNote()`
- `listContactNotes()`
- `createTag()`
- `listTags()`
- `assignTag()`
- `removeTag()`
- `setConsent()`
- `getConsents()`

### 4.3 Rotas

Registradas em `App.tsx`:
- `/crm` → `CrmPage`
- `/crm/contacts/:id` → `CrmContactDetailPage`

---

## 5. INTEGRAÇÕES COM REPOSITORIES EXISTENTES

Para suportar `getTimeline()`, foram adicionados métodos auxiliares nos repositories:

### 5.1 `order.repository.ts`
- `listOrdersByContact(tenantId, contactId)`: Busca orders por `metadata->>'contact_id'`

### 5.2 `ticket-sale.repository.ts`
- `listSalesByContact(tenantId, contactId)`: Busca ticket sales por `metadata->>'contact_id'`

### 5.3 `payment-link.repository.ts`
- `listPaymentsByContact(tenantId, contactId)`: Busca payment link payments por `metadata->>'contact_id'`

### 5.4 `accounts-receivable.repository.ts`
- `listReceivablesByContact(tenantId, contactId)`: Busca receivables por `metadata->>'contact_id'`

### 5.5 `fiscal-document.repository.ts`
- `listDocumentsByContact(tenantId, contactId)`: Busca fiscal documents por `metadata->>'contact_id'`

---

## 6. GUARDRAILS

✅ **READ/WRITE apenas em entidades CRM**
- Não altera Order/Payment/Fiscal
- Timeline é READ-ONLY (consolida dados existentes)

✅ **Tudo auditável**
- Todas as ações registram `author_actor_id` e `author_user_id`
- Metadata preservado para auditoria

✅ **Multi-tenancy**
- RLS habilitado em todas as tabelas
- Isolamento por `tenant_id`

✅ **Sem automação invisível**
- Nenhuma ação automática sem ação explícita do usuário
- Timeline apenas consolida, não cria dados

---

## 7. CRITÉRIOS DE PRONTO

- ✅ Timeline funciona e puxa dados reais de Orders, Tickets, Payments, Receivables, Fiscal
- ✅ Tags/Notas/Consentimentos funcionam (CRUD completo)
- ✅ Frontend mínimo funcional (lista + detalhe)
- ✅ Não altera Order/Payment/Fiscal
- ✅ RLS e índices corretos
- ✅ Documentação completa

---

## 8. ARQUIVOS CRIADOS/MODIFICADOS

### Backend
- `backend/migrations/228_create_crm_notes.sql`
- `backend/migrations/229_create_crm_tags.sql`
- `backend/migrations/230_create_crm_contact_tags.sql`
- `backend/migrations/231_create_crm_consents.sql`
- `backend/src/modules/crm/crm.types.ts`
- `backend/src/modules/crm/crm.repository.ts`
- `backend/src/modules/crm/crm.service.ts`
- `backend/src/modules/crm/crm.routes.ts`
- `backend/src/modules/marketplace/marketplace.routes.ts` (registro das rotas)
- `backend/src/modules/marketplace/order.repository.ts` (método auxiliar)
- `backend/src/modules/events/ticket-sale.repository.ts` (método auxiliar)
- `backend/src/modules/payments/payment-link.repository.ts` (método auxiliar)
- `backend/src/modules/marketplace/accounts-receivable.repository.ts` (método auxiliar)
- `backend/src/modules/marketplace/fiscal-document.repository.ts` (método auxiliar)

### Frontend
- `frontend/src/api/crm.ts`
- `frontend/src/pages/CrmPage.tsx`
- `frontend/src/pages/CrmPage.css`
- `frontend/src/pages/CrmContactDetailPage.tsx`
- `frontend/src/pages/CrmContactDetailPage.css`
- `frontend/src/App.tsx` (rotas)

### Documentação
- `SPRINT_88_CRM_CANONICO.md` (este arquivo)

---

## 9. PRÓXIMOS PASSOS (FUTURO)

- Segmentação avançada (queries declarativas)
- Relatórios (LTV, recorrência)
- Automações de comunicação (com consentimentos)
- Integração com campanhas (SPRINT 90.x)

---

**Status:** ✅ CONCLUÍDO



