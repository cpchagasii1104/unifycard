# Implementação: Domínio de SERVIÇOS

**Data**: 2024-12-19  
**Escopo**: Criação do domínio de SERVIÇOS como entidade econômica viva

---

## 1. DEFINIÇÃO CANÔNICA

### Serviço NÃO é:
- ❌ Post
- ❌ Categoria
- ❌ Agenda
- ❌ Decisão automática
- ❌ Matching automático
- ❌ Execução de pagamento direto
- ❌ Score

### Serviço É:
- ✅ Objeto de domínio que pode gerar ações reais
- ✅ Pertence a um Actor (user, page ou group)
- ✅ Pode ser ativado/desativado
- ✅ Pode ter categoria (scope adequado)
- ✅ Nasce de intents específicas (ex: OFFER_SERVICE)

---

## 2. ESTRUTURA CRIADA

### Backend

1. **Migration** (`migrations/136_services_domain.sql`):
   - Tabela `services` com relacionamento obrigatório com `actors`
   - Enums: `service_type` (service, rental, event, job) e `service_status` (draft, active, paused)
   - Relacionamento opcional com `categories`
   - Campos de precificação (não executa pagamento direto)
   - Campos de localização
   - Triggers para `updated_at` e `activated_at`

2. **Tipos** (`src/modules/services/services.types.ts`):
   - `ServiceType` enum
   - `ServiceStatus` enum
   - `PricingType` type
   - `Service` interface
   - `CreateServiceInput` interface
   - `UpdateServiceInput` interface

3. **Repository** (`src/modules/services/services.repository.ts`):
   - `findById()` - Busca serviço por ID
   - `findByActor()` - Lista serviços de um Actor
   - `create()` - Cria novo serviço (valida actorId obrigatório)
   - `update()` - Atualiza serviço

4. **Service** (`src/modules/services/services.service.ts`):
   - `createService()` - Cria serviço com validação de intent
   - `getService()` - Busca serviço por ID
   - `getActorServices()` - Lista serviços de um Actor
   - `updateService()` - Atualiza serviço com validação de permissão

5. **Routes** (`src/modules/services/services.routes.ts`):
   - `POST /services` - Criar novo serviço
   - `GET /services/:id` - Buscar serviço por ID
   - `GET /actors/:id/services` - Listar serviços de um Actor
   - `PUT /services/:id` - Atualizar serviço

6. **Module** (`src/modules/services/services.module.ts`):
   - Módulo Fastify para registrar rotas

---

## 3. EFFECTS IMPLEMENTADOS

### Effects Adicionados

1. **`SERVICE_CREATED`**:
   - Emitido quando serviço é criado
   - Mapeado em `INTENT_EFFECTS_MAP` para `OFFER_SERVICE`
   - Afeta: `SERVICE_READ_MODEL`, `SERVICE_LIST_READ_MODEL`, `FEED_READ_MODEL`, `OPPORTUNITY_READ_MODEL`

2. **`SERVICE_ACTIVATED`**:
   - Emitido quando serviço é ativado (status muda para 'active')
   - Afeta: `SERVICE_READ_MODEL`, `SERVICE_LIST_READ_MODEL`, `FEED_READ_MODEL`, `OPPORTUNITY_READ_MODEL`

3. **`SERVICE_UPDATED`**:
   - Emitido quando serviço é atualizado
   - Afeta: `SERVICE_READ_MODEL`, `SERVICE_LIST_READ_MODEL`

### Mapeamento Intent → Effects

```typescript
[ActorIntent.OFFER_SERVICE]: [
  ActorEffect.FEED_ITEM_CREATED,
  ActorEffect.SERVICE_CREATED, // NOVO
  ActorEffect.IMPACT_RECORDED,
]
```

---

## 4. READ MODELS IMPLEMENTADOS

### Read Models Adicionados

1. **`SERVICE_READ_MODEL`**:
   - Projeção de um serviço individual
   - Atualizado quando: `SERVICE_CREATED`, `SERVICE_ACTIVATED`, `SERVICE_UPDATED`

2. **`SERVICE_LIST_READ_MODEL`**:
   - Projeção de lista de serviços
   - Atualizado quando: `SERVICE_CREATED`, `SERVICE_ACTIVATED`, `SERVICE_UPDATED`

### Mapeamento Effect → Read Models

```typescript
[ActorEffect.SERVICE_CREATED]: [
  ReadModelType.SERVICE_READ_MODEL,
  ReadModelType.SERVICE_LIST_READ_MODEL,
  ReadModelType.FEED_READ_MODEL,
  ReadModelType.OPPORTUNITY_READ_MODEL,
]
```

---

## 5. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`services.types.ts`**:
   - Explica que serviço NÃO é post, categoria ou agenda
   - Explica que tipo é contexto, não decisão
   - Explica que status é estado, não decisão
   - Explica que precificação é informação, não execução de pagamento

2. **`services.repository.ts`**:
   - Valida que `actorId` é obrigatório
   - Comentário: "Nenhum service deve ser criado sem actor"
   - Comentário: "Nenhuma query deve usar serviço como filtro decisório"

3. **`services.service.ts`**:
   - Valida que `actorId` foi fornecido
   - Valida que actor existe
   - Valida intent se fornecido
   - Comentários explicando que serviço NÃO decide nada sozinho
   - Comentários explicando que serviço NÃO faz matching automático
   - Comentários explicando que serviço NÃO executa pagamento direto
   - Comentários explicando que serviço NÃO cria score

4. **`services.routes.ts`**:
   - Comentário: "actorId é OBRIGATÓRIO"
   - Comentário: "Nenhuma query deve usar serviço como filtro decisório"

---

## 6. ENDPOINTS

### Backend

1. **`POST /services`**:
   - Cria novo serviço
   - Requer: `actorId` (obrigatório), `name`
   - Valida intent `OFFER_SERVICE`
   - Emite effects: `SERVICE_CREATED`, `FEED_ITEM_CREATED`, `IMPACT_RECORDED`

2. **`GET /services/:id`**:
   - Busca serviço por ID
   - Retorna: `Service` completo

3. **`GET /actors/:id/services`**:
   - Lista serviços de um Actor
   - Filtros opcionais: `status` (draft, active, paused)
   - Retorna: Array de `Service`

4. **`PUT /services/:id`**:
   - Atualiza serviço
   - Valida permissão (owner do actor)
   - Emite effects se status mudar para 'active': `SERVICE_ACTIVATED`

---

## 7. RELACIONAMENTOS

### Service ↔ Actor

- **Obrigatório**: `actor_id` (FK para `actors`)
- **Cascade**: `ON DELETE CASCADE` (se actor for deletado, serviços são deletados)
- **Validação**: Actor deve existir antes de criar serviço

### Service ↔ Category

- **Opcional**: `category_id` (FK para `categories`)
- **Scope**: Categoria deve ter scope adequado (não validado ainda, pode ser expandido)
- **Uso**: Categoria é contexto, não decisão

---

## 8. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS (implícito)

---

## 9. ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. `migrations/136_services_domain.sql` (NOVO)
   - Migration para criar tabela `services`
   - Enums `service_type` e `service_status`
   - Triggers e índices

2. `src/modules/services/services.types.ts` (NOVO)
   - Tipos do domínio de serviços

3. `src/modules/services/services.repository.ts` (NOVO)
   - Repository para acesso ao banco

4. `src/modules/services/services.service.ts` (NOVO)
   - Service com lógica de negócio

5. `src/modules/services/services.routes.ts` (NOVO)
   - Rotas Fastify

6. `src/modules/services/services.module.ts` (NOVO)
   - Módulo Fastify

7. `src/modules/social/actor-effects.types.ts` (ALTERADO)
   - Adicionado: `SERVICE_CREATED`, `SERVICE_ACTIVATED`, `SERVICE_UPDATED`

8. `src/modules/social/actor-effects.service.ts` (ALTERADO)
   - Adicionado `SERVICE_CREATED` ao mapeamento de `OFFER_SERVICE`

9. `src/core/read-models/read-model.types.ts` (ALTERADO)
   - Adicionado: `SERVICE_READ_MODEL`, `SERVICE_LIST_READ_MODEL`

10. `src/core/read-models/read-model.projector.ts` (ALTERADO)
    - Adicionado mapeamento Effect → Read Models para serviços

11. `src/server.ts` (ALTERADO)
    - Registrado módulo de serviços: `/services`

---

## 10. PRÓXIMOS PASSOS (NÃO IMPLEMENTADOS)

- ❌ Agenda (futuro)
- ❌ Pagamento direto (futuro)
- ❌ Split de receita (futuro)
- ❌ UI (futuro)
- ❌ Matching automático (NÃO será implementado - blindagem)

---

## 11. EXEMPLOS DE USO

### Criar Serviço

```typescript
POST /services
{
  "actorId": "uuid-do-actor",
  "name": "Serviço de Limpeza",
  "description": "Limpeza residencial completa",
  "serviceType": "service",
  "status": "draft",
  "priceCents": 10000, // R$ 100,00
  "currency": "BRL",
  "pricingType": "fixed"
}
```

### Listar Serviços de um Actor

```typescript
GET /actors/{actorId}/services?status=active
```

### Ativar Serviço

```typescript
PUT /services/{serviceId}
{
  "status": "active"
}
```

---

**Status Final**: ✅ **DOMÍNIO DE SERVIÇOS IMPLEMENTADO E VALIDADO**

