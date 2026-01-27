# SPRINT 0 — CONTACTS / CLIENTES UNIFICADOS

## OBJETIVO

Criar entidade canônica "contacts" para representar cliente/pagador/comprador (pessoa ou empresa), independente de ser usuário do sistema.

Isso desbloqueia: payment links, CRM, fiscal completo, assinaturas, eventos.

---

## 1. MIGRATION

### 1.1. `222_create_contacts.sql`

Tabela `contacts`:
- `id`, `tenant_id`, `type` (PERSON | COMPANY)
- `name`, `tax_id` (CPF/CNPJ normalizado), `email`, `phone`
- `address` (JSONB)
- `user_id` (nullable, sem FK para flexibilidade)
- `metadata`, `created_at`, `updated_at`
- Unique parcial: `(tenant_id, tax_id)` onde `tax_id` não nulo
- Índices: `tenant_id`, `tax_id`, `email`, `phone`, `user_id`, `type`
- RLS habilitado
- Trigger `updated_at`

---

## 2. SERVICE + REPOSITORY

### 2.1. ContactRepository

**Arquivo:** `backend/src/modules/marketplace/contact.repository.ts`

**Métodos:**
- `createContact()` - Cria contato
- `getContactById()` - Busca por ID
- `getContactByTaxId()` - Busca por tax_id (idempotência)
- `updateContact()` - Atualiza contato
- `linkUserToContact()` - Vincula usuário a contato
- `listContacts()` - Lista com filtros

### 2.2. ContactService

**Arquivo:** `backend/src/modules/marketplace/contact.service.ts`

**Métodos:**
- `createContact()` - Cria contato (com idempotência por tax_id)
- `updateContact()` - Atualiza contato
- `getContactById()` - Busca por ID
- `getContactByTaxId()` - Busca por tax_id
- `listContacts()` - Lista com filtros
- `linkUserToContact()` - Vincula usuário a contato

**Validações:**
- ✅ CPF/CNPJ: formato básico (sem Receita)
- ✅ Tax_id normalizado (só dígitos)
- ✅ Email: formato básico
- ✅ Telefone: formato básico
- ✅ Idempotência: se tax_id já existe, retorna existente

---

## 3. INTEGRAÇÕES

### 3.1. TicketService

**Arquivo:** `backend/src/modules/events/ticket.service.ts`

**Mudança:**
- `reserveTicket()` salva `contact_id` no metadata do `ticket_sale` se `payerContactId` fornecido no input metadata

**Código:**
```typescript
// Se payerContactId fornecido no metadata do input, salvar
if (input.metadata?.payerContactId) {
  saleMetadata.contact_id = input.metadata.payerContactId;
}
```

### 3.2. PaymentExecution / AccountsReceivable

**Arquivo:** `backend/src/modules/marketplace/payment-execution.service.ts`

**Mudança:**
- Ao criar `AccountsReceivable`, extrai `payerContactId` do `PaymentIntent.metadata` e salva no metadata do receivable

**Código:**
```typescript
// SPRINT 0: Extrair contact_id do intent metadata se fornecido
const payerContactId = intent.metadata?.payerContactId;

await accountsReceivableService.createFromPaymentIntent(tenantId, {
  // ...
  metadata: {
    // ...
    contact_id: payerContactId,
  },
});
```

### 3.3. FiscalDocument

**Arquivo:** `backend/src/modules/marketplace/fiscal-document.service.ts`

**Mudança:**
- Ao criar documento fiscal, extrai `payerContactId` do `PaymentIntent.metadata` e salva no metadata do documento
- Preparado para puxar dados do contact (sem emitir nada ainda)

**Código:**
```typescript
// SPRINT 0: Extrair contact_id do intent metadata se fornecido
let payerContactId: string | undefined;
if (paymentIntentId) {
  const intent = await paymentIntentService.getIntentById(tenantId, paymentIntentId);
  if (intent?.metadata?.payerContactId) {
    payerContactId = intent.metadata.payerContactId;
  }
}

await fiscalDocumentRepository.createDocument(tenantId, {
  // ...
  metadata: {
    // ...
    contact_id: payerContactId,
  },
});
```

---

## 4. ROTAS REST

### 4.1. `POST /marketplace/contacts`

Cria novo contato.

**Body:**
```json
{
  "type": "PERSON",
  "name": "João Silva",
  "taxId": "12345678901",
  "email": "joao@example.com",
  "phone": "(11) 99999-9999",
  "address": {
    "street": "Rua Exemplo",
    "number": "123",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234-567"
  }
}
```

**Resposta:**
```json
{
  "contact": {
    "id": "...",
    "type": "PERSON",
    "name": "João Silva",
    "taxId": "12345678901",
    "email": "joao@example.com",
    "phone": "(11) 99999-9999",
    "address": {...},
    "createdAt": "..."
  }
}
```

### 4.2. `PATCH /marketplace/contacts/:id`

Atualiza contato.

**Body:**
```json
{
  "name": "João Silva Santos",
  "email": "joao.santos@example.com"
}
```

### 4.3. `GET /marketplace/contacts`

Lista contatos com filtros.

**Query params:**
- `type` (PERSON | COMPANY)
- `taxId`
- `email`
- `phone`
- `userId`
- `search` (busca por nome, email, phone, taxId)
- `limit`, `offset`

### 4.4. `GET /marketplace/contacts/:id`

Busca contato por ID.

### 4.5. `GET /marketplace/contacts/search`

Busca contatos por taxId, email ou phone.

**Query params:**
- `taxId`
- `email`
- `phone`

---

## 5. FRONTEND

### 5.1. Página `/contacts`

**Arquivo:** `frontend/src/pages/ContactsPage.tsx`

**Funcionalidades:**
- Lista contatos
- Busca por nome, email, telefone ou CPF/CNPJ
- Criar novo contato
- Editar contato existente
- Formulário simples (sem firula)

**Componentes:**
- Tabela de contatos
- Formulário de criação/edição
- Campo de busca

---

## 6. GUARDRAILS

- ✅ Contact ≠ User
- ✅ Contact ≠ Actor
- ✅ Contact pode estar vinculado a User (opcional)
- ✅ Tax_id normalizado (só dígitos)
- ✅ Idempotência por tax_id (se já existe, retorna existente)
- ✅ Validação básica de CPF/CNPJ (formato, sem Receita)
- ✅ Nada quebra PDV/marketplace/eventos

---

## 7. EXEMPLOS DE USO

### 7.1. Criar contato

```typescript
const contact = await contactService.createContact(tenantId, {
  type: 'PERSON',
  name: 'João Silva',
  taxId: '123.456.789-01',
  email: 'joao@example.com',
  phone: '(11) 99999-9999',
}, actorId, userId);
```

### 7.2. Vincular contato a pagamento

```typescript
// Ao criar PaymentIntent, incluir payerContactId no metadata
const paymentIntent = await paymentIntentService.createPaymentIntent(tenantId, {
  orderId: '...',
  amount: 100.00,
  currency: 'BRL',
  metadata: {
    payerContactId: contact.id, // SPRINT 0
  },
});
```

### 7.3. Buscar contato por CPF/CNPJ

```typescript
const contact = await contactService.getContactByTaxId(tenantId, '12345678901');
if (contact) {
  // Contato já existe (idempotência)
}
```

---

## 8. NOTAS

- Tax_id é normalizado automaticamente (remove formatação)
- Idempotência: se tentar criar contato com tax_id existente, retorna o existente
- Validação de CPF/CNPJ é básica (formato e dígitos verificadores), sem integração com Receita
- Contact pode estar vinculado a User, mas não é obrigatório
- Address é JSONB flexível (não tem schema rígido)
- Nenhuma quebra de funcionalidade existente (PDV, marketplace, eventos continuam funcionando)

---

## 9. ARQUIVOS CRIADOS/ALTERADOS

### Backend
- `backend/migrations/222_create_contacts.sql` (NOVO)
- `backend/src/modules/marketplace/contact.types.ts` (NOVO)
- `backend/src/modules/marketplace/contact.repository.ts` (NOVO)
- `backend/src/modules/marketplace/contact.service.ts` (NOVO)
- `backend/src/modules/marketplace/contact.routes.ts` (NOVO)
- `backend/src/modules/marketplace/marketplace.routes.ts` (ALTERADO)
- `backend/src/modules/events/ticket.service.ts` (ALTERADO)
- `backend/src/modules/marketplace/payment-execution.service.ts` (ALTERADO)
- `backend/src/modules/marketplace/fiscal-document.service.ts` (ALTERADO)

### Frontend
- `frontend/src/api/contacts.ts` (NOVO)
- `frontend/src/pages/ContactsPage.tsx` (NOVO)
- `frontend/src/pages/ContactsPage.css` (NOVO)
- `frontend/src/App.tsx` (ALTERADO)

### Documentação
- `SPRINT_00_CONTACTS.md` (NOVO)

---

## 10. CRITÉRIO DE PRONTO

✅ Consigo criar/consultar contact
✅ Consigo vincular um pagamento/recebível a um contact (via metadata no intent)
✅ Nada quebra PDV/marketplace/eventos
✅ Frontend básico funcional
✅ Documentação completa



