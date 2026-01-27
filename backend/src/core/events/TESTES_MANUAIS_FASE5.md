# 🧪 TESTES MANUAIS — FASE 5
## INTEGRAÇÃO CONTROLADA

**Data:** 28/12/2025  
**Fase:** FASE 5 — INTEGRAÇÃO CONTROLADA  
**Status:** ✅ PRONTO PARA TESTES

---

## 📋 PRÉ-REQUISITOS

### 1. Backend rodando
```bash
cd backend
pnpm run dev
```

### 2. Autenticação configurada
- Token JWT válido
- Header `Authorization: Bearer <token>`
- Header `x-tenant-id: <tenant_id>`

### 3. Banco de dados
- Migrations executadas (090, 091)
- Tabela `events` existe
- Tabela `actors` existe
- Usuário de teste existe

---

## 🧪 TESTE 1: POST /events (Criar evento em draft)

### Request
```http
POST http://localhost:3000/events
Authorization: Bearer <token>
x-tenant-id: <tenant_id>
Content-Type: application/json

{
  "actor_id": "<actor_id_do_usuario>",
  "actor_type": "user",
  "event_type": "cultural",
  "event_subtype": "show",
  "title": "Show de Rock",
  "description": "Show de rock com banda local",
  "datetime_start": "2025-12-30T20:00:00Z",
  "datetime_end": "2025-12-30T23:00:00Z",
  "visibility": "public",
  "ticket_price_cents": 5000,
  "max_attendees": 100
}
```

### Resultado Esperado
- Status: `201 Created`
- Body: `{ "event": { ... } }`
- Evento criado com `status: "draft"`

### Validações
- ✅ Actor × EventType válido (user pode criar cultural)
- ✅ Moderação passou (blocklist + IA)
- ✅ Datas válidas (datetime_end > datetime_start)
- ✅ ticket_price_cents >= 0
- ✅ max_attendees > 0

---

## 🧪 TESTE 2: POST /events/:id/publish (Publicar evento)

### Pré-requisito
- Evento criado no TESTE 1 (status: draft)

### Request
```http
POST http://localhost:3000/events/<event_id>/publish
Authorization: Bearer <token>
x-tenant-id: <tenant_id>
```

### Resultado Esperado
- Status: `200 OK`
- Body: `{ "event": { ... } }`
- Evento com `status: "published"`

### Validações
- ✅ Apenas criador pode publicar
- ✅ Apenas eventos em 'draft' podem ser publicados
- ✅ Status atualizado corretamente

---

## 🧪 TESTE 3: GET /events/:id (Buscar evento)

### Request
```http
GET http://localhost:3000/events/<event_id>
x-tenant-id: <tenant_id>
```

### Resultado Esperado
- Status: `200 OK`
- Body: `{ "event": { ... } }`
- Todos os campos presentes

### Validações
- ✅ Evento retornado corretamente
- ✅ Campos conforme CONTRATO v1
- ✅ Metadata preservada

---

## 🧪 TESTE 4: PATCH /events/:id (Atualizar evento)

### Request
```http
PATCH http://localhost:3000/events/<event_id>
Authorization: Bearer <token>
x-tenant-id: <tenant_id>
Content-Type: application/json

{
  "title": "Show de Rock - Atualizado",
  "description": "Show de rock com banda local - atualizado",
  "max_attendees": 150
}
```

### Resultado Esperado
- Status: `200 OK`
- Body: `{ "event": { ... } }`
- Campos atualizados

### Validações
- ✅ Apenas criador pode atualizar
- ✅ Campos atualizados corretamente
- ✅ Moderação (se título/descrição mudaram)

---

## 🧪 TESTE 5: POST /events/:id/cancel (Cancelar evento)

### Request
```http
POST http://localhost:3000/events/<event_id>/cancel
Authorization: Bearer <token>
x-tenant-id: <tenant_id>
```

### Resultado Esperado
- Status: `200 OK`
- Body: `{ "event": { ... } }`
- Evento com `status: "cancelled"`

### Validações
- ✅ Apenas criador pode cancelar
- ✅ Status atualizado corretamente

---

## 🧪 TESTE 6: Validação Actor × EventType (Erro esperado)

### Request
```http
POST http://localhost:3000/events
Authorization: Bearer <token>
x-tenant-id: <tenant_id>
Content-Type: application/json

{
  "actor_id": "<actor_id_do_usuario>",
  "actor_type": "page",
  "event_type": "social",  // ❌ Page não pode criar 'social'
  "title": "Evento Social",
  "datetime_start": "2025-12-30T20:00:00Z",
  "datetime_end": "2025-12-30T23:00:00Z"
}
```

### Resultado Esperado
- Status: `400 Bad Request`
- Error: `"Actor type 'page' não pode criar eventos do tipo 'social'"`

---

## 🧪 TESTE 7: Moderação (Blocklist)

### Request
```http
POST http://localhost:3000/events
Authorization: Bearer <token>
x-tenant-id: <tenant_id>
Content-Type: application/json

{
  "actor_id": "<actor_id_do_usuario>",
  "actor_type": "user",
  "event_type": "cultural",
  "title": "Evento com termo bloqueado: drogas",  // ❌ Termo bloqueado
  "datetime_start": "2025-12-30T20:00:00Z",
  "datetime_end": "2025-12-30T23:00:00Z"
}
```

### Resultado Esperado
- Status: `400 Bad Request`
- Error: `"Evento rejeitado pela moderação: Termo bloqueado: drogas"`

---

## 📊 CHECKLIST DE TESTES

- [ ] TESTE 1: POST /events (criar draft) - ✅ Sucesso
- [ ] TESTE 2: POST /events/:id/publish - ✅ Sucesso
- [ ] TESTE 3: GET /events/:id - ✅ Sucesso
- [ ] TESTE 4: PATCH /events/:id - ✅ Sucesso
- [ ] TESTE 5: POST /events/:id/cancel - ✅ Sucesso
- [ ] TESTE 6: Validação Actor × EventType - ✅ Erro esperado
- [ ] TESTE 7: Moderação (blocklist) - ✅ Erro esperado

---

## 🔍 VALIDAÇÕES ADICIONAIS

### Autenticação
- [ ] Sem token → 401 Unauthorized
- [ ] Token inválido → 401 Unauthorized
- [ ] Token válido → Acesso permitido

### Tenant
- [ ] Sem tenant → 400 Bad Request
- [ ] Tenant inválido → 400 Bad Request
- [ ] Tenant válido → Acesso permitido

### Permissões
- [ ] Usuário não criador → 403 Forbidden (update/publish/cancel)
- [ ] Usuário criador → Acesso permitido

---

*Documento criado em 28/12/2025*  
*FASE 5 — INTEGRAÇÃO CONTROLADA*














