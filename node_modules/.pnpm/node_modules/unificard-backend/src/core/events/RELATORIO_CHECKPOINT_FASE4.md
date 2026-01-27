# 📊 RELATÓRIO DE CHECKPOINT — FASE 4
## BACKEND DOMAIN (EVENTS CORE)

**Data:** 28/12/2025  
**Fase:** FASE 4 — BACKEND DOMAIN (EVENTS CORE)  
**Status:** ✅ IMPLEMENTAÇÃO CONCLUÍDA  
**Tipo:** Backend Domain (sem UI, sem Feed, sem Split Engine)

---

## 🎯 OBJETIVO

Implementar o domínio de eventos no backend conforme CONTRATO DE EVENTOS v1, incluindo:
- EventService com operações CRUD
- Validação Actor × EventType
- Moderação (IA + blocklist)
- Endpoints REST

---

## 📋 ARQUIVOS CRIADOS

### 1. `event.types.ts`
**Localização:** `backend/src/core/events/event.types.ts`

**Conteúdo:**
- Tipos TypeScript conforme CONTRATO v1
- `EventType` (taxonomia oficial)
- `EventStatus` (lowercase, sem CONFIRMED)
- `EventVisibility` (valores do contrato)
- `ActorType` ('user' | 'page')
- `ACTOR_EVENT_TYPE_MATRIX` (matriz de permissões)
- Interfaces: `Event`, `CreateEventInput`, `UpdateEventInput`
- Interfaces: `ModerationResult`, `ActorEventTypeValidation`

---

### 2. `event-moderator.service.ts`
**Localização:** `backend/src/core/events/event-moderator.service.ts`

**Conteúdo:**
- Moderação conforme CONTRATO v1 Seção 7
- Blocklist determinística (crime, sexo, drogas, spam, fraude)
- Padrões de bloqueio (regex)
- Análise semântica com IA (se disponível)
- Pipeline completo: blocklist → análise semântica → decisão

**Métodos:**
- `moderate(title, description)` - Pipeline completo de moderação

---

### 3. `event.service.ts`
**Localização:** `backend/src/core/events/event.service.ts`

**Conteúdo:**
- Service principal de eventos
- Validações conforme CONTRATO v1
- Integração com moderação

**Métodos:**
- `createEvent(tenantId, input)` - Cria novo evento
- `updateEvent(tenantId, eventId, input, actorId)` - Atualiza evento
- `publishEvent(tenantId, eventId, actorId)` - Publica evento
- `cancelEvent(tenantId, eventId, actorId)` - Cancela evento
- `getEvent(tenantId, eventId)` - Busca evento por ID
- `validateActorEventType(actorType, eventType)` - Valida Actor × EventType

**Validações implementadas:**
- ✅ Actor × EventType (CONTRATO v1 Seção 4)
- ✅ event_type (taxonomia oficial)
- ✅ status (lowercase, sem CONFIRMED)
- ✅ visibility (valores do contrato)
- ✅ Datas (datetime_end > datetime_start)
- ✅ ticket_price_cents (>= 0)
- ✅ max_attendees (> 0)
- ✅ Moderação (blocklist + IA)
- ✅ Permissões (apenas criador pode atualizar/publicar/cancelar)

---

### 4. `event.routes.ts`
**Localização:** `backend/src/core/events/event.routes.ts`

**Endpoints REST:**
- `POST /events` - Cria novo evento
- `PATCH /events/:id` - Atualiza evento existente
- `POST /events/:id/publish` - Publica evento
- `POST /events/:id/cancel` - Cancela evento
- `GET /events/:id` - Busca evento por ID

**Características:**
- Schemas de validação (Fastify)
- Tratamento de erros (BadRequestError, NotFoundError, ForbiddenError)
- Autenticação obrigatória
- Tenant obrigatório

---

### 5. `event.module.ts`
**Localização:** `backend/src/core/events/event.module.ts`

**Conteúdo:**
- Módulo Fastify para registrar rotas
- Exporta default para registro no servidor

---

## 📝 ARQUIVOS MODIFICADOS

**Nenhum arquivo foi modificado.**

**Nota:** O módulo precisa ser registrado no `server.ts` (não feito propositalmente - ver seção "O que NÃO foi feito").

---

## ✅ O QUE FOI FEITO

### 1. EventService Completo

✅ **createEvent()**
- Valida Actor × EventType
- Valida event_type
- Valida datas
- Valida ticket_price_cents e max_attendees
- Moderação (blocklist + IA)
- Valida existência de actor
- Cria evento com status 'draft'

✅ **updateEvent()**
- Valida permissão (apenas criador)
- Valida status (restrições para eventos publicados)
- Valida campos atualizados
- Moderação (se título/descrição mudaram)
- UPDATE dinâmico

✅ **publishEvent()**
- Valida permissão (apenas criador)
- Valida status (apenas 'draft' pode ser publicado)
- Atualiza status para 'published'

✅ **cancelEvent()**
- Valida permissão (apenas criador)
- Valida status (não pode cancelar se já cancelado/completado/arquivado)
- Atualiza status para 'cancelled'

✅ **getEvent()**
- Busca evento por ID
- Retorna null se não encontrado

---

### 2. Validação Actor × EventType

✅ **Matriz de Permissões Implementada**
```typescript
ACTOR_EVENT_TYPE_MATRIX = {
  cultural: { user: true, page: true },
  gastronomic: { user: true, page: true },
  social: { user: true, page: false },
  professional: { user: true, page: true },
  community: { user: true, page: true },
  spiritual: { user: true, page: true },
  sports: { user: true, page: true },
  private: { user: true, page: false },
}
```

✅ **Método validateActorEventType()**
- Valida se actor_type pode criar event_type
- Retorna `ActorEventTypeValidation` com reason

---

### 3. EventModerator (IA + Blocklist)

✅ **Blocklist Determinística**
- Termos bloqueados: crime, sexo, drogas, spam, fraude
- Padrões regex para detecção
- Normalização de texto (lowercase, sem acentos)

✅ **Análise Semântica (IA)**
- Integração com AIKernel (se disponível)
- Análise de legitimidade e intenção
- Decisão: approved | flagged | rejected

✅ **Pipeline Completo**
1. Blocklist determinística
2. Análise semântica (IA)
3. Decisão final

---

### 4. Endpoints REST

✅ **POST /events**
- Schema de validação completo
- Autenticação obrigatória
- Cria evento com validações

✅ **PATCH /events/:id**
- Schema de validação
- Autenticação obrigatória
- Atualiza evento com validações

✅ **POST /events/:id/publish**
- Autenticação obrigatória
- Publica evento (draft → published)

✅ **POST /events/:id/cancel**
- Autenticação obrigatória
- Cancela evento (→ cancelled)

✅ **GET /events/:id**
- Busca evento por ID
- Retorna 404 se não encontrado

---

### 5. Validações Conforme Contrato

✅ **Status válido**
- Valores: draft, published, cancelled, completed, archived
- Lowercase (sem CONFIRMED)

✅ **Visibility válida**
- Valores: public, group, followers, private, unlisted

✅ **Economia conforme contrato**
- ticket_price_cents >= 0
- Se > 0, evento deve passar pelo Split Engine (validação futura)

✅ **Metadata preservada**
- JSONB armazenado corretamente
- Preservado em create/update

---

## 🚫 O QUE NÃO FOI FEITO (PROPOSITALMENTE)

### 1. Integração com Feed

**Razão:** Regra absoluta - não tocar em feed nesta fase

**Ação futura:** Integração será feita em fase posterior

---

### 2. Integração com Split Engine

**Razão:** Regra absoluta - não tocar em Split Engine nesta fase

**Ação futura:** Validação de economia será feita quando evento for publicado com ticket_price_cents > 0

---

### 3. Integração com UI

**Razão:** Regra absoluta - não criar UI nesta fase

**Ação futura:** UI será criada em fase posterior

---

### 4. Registro no server.ts

**Razão:** Não modificar arquivos existentes sem necessidade explícita

**Ação necessária:**
```typescript
// Em server.ts, adicionar:
import eventModule from './core/events/event.module';
await protectedScope.register(eventModule.default, { prefix: '/events' });
```

**Nota:** Isso deve ser feito manualmente ou em fase de integração.

---

### 5. Integração com Identity (Actor)

**Razão:** Placeholder usado para actor_id do usuário autenticado

**Ação necessária:**
- Integrar com `identityService` ou `actorRepository`
- Obter `actor_id` real do usuário autenticado
- Validar que `actor_id` pertence ao usuário

**Código atual:**
```typescript
const actorId = req.user.globalUserId || ''; // Placeholder
```

---

### 6. Wizard de Criação

**Razão:** Wizard é obrigatório conforme CONTRATO v1 Seção 9, mas é responsabilidade do frontend

**Ação futura:** Frontend deve implementar wizard (Actor → EventType → Contexto → Economia → Revisão → Publicar)

---

### 7. Subtypes Dinâmicos

**Razão:** Sistema de subtypes (provisional → official) será implementado em fase futura

**Ação futura:** Implementar validação e governança de subtypes

---

## 📊 ESTRUTURA DE ARQUIVOS

```
backend/src/core/events/
├── event.types.ts              ✅ Criado
├── event-moderator.service.ts  ✅ Criado
├── event.service.ts            ✅ Criado
├── event.routes.ts             ✅ Criado
├── event.module.ts             ✅ Criado
└── RELATORIO_CHECKPOINT_FASE4.md ✅ Criado
```

---

## 🔗 DEPENDÊNCIAS

### Dependências do Core
- `@core/database/pool` - Queries com tenant
- `@core/errors` - BadRequestError, NotFoundError, ForbiddenError
- `@core/ai/ai-kernel` - Moderação com IA (opcional)

### Dependências Externas
- `fastify` - Framework web
- PostgreSQL - Banco de dados

---

## ⚠️ PENDÊNCIAS

### 1. Registro no server.ts

**Ação necessária:**
```typescript
// Adicionar em server.ts (linha ~161):
import eventModule from './core/events/event.module';

// Adicionar em server.ts (linha ~200+):
await protectedScope.register(eventModule.default, { prefix: '/events' });
```

---

### 2. Integração com Identity

**Ação necessária:**
- Criar helper para obter `actor_id` do usuário autenticado
- Validar que `actor_id` pertence ao usuário
- Substituir placeholder em `event.routes.ts`

---

### 3. Testes

**Ação futura:**
- Criar testes unitários para `EventService`
- Criar testes de integração para endpoints
- Validar moderação

---

## 📌 CONCLUSÃO

✅ **FASE 4 concluída**

- EventService implementado com todos os métodos
- Validação Actor × EventType implementada
- EventModerator (IA + blocklist) implementado
- Endpoints REST criados
- Validações conforme CONTRATO v1

**Próximos passos:**
1. Registrar módulo no `server.ts`
2. Integrar com Identity (obter actor_id real)
3. Testes
4. FASE 5: Integração com Feed (futuro)

---

*Relatório gerado em 28/12/2025*  
*FASE 4 — BACKEND DOMAIN (EVENTS CORE)*














