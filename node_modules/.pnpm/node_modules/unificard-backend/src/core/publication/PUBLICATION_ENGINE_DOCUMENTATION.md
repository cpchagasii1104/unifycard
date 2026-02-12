# Motor Canônico de Publicação, Visibilidade e Convites

**Status:** IMPLEMENTADO (FASE 1-2)  
**Versão:** v1.0  
**Data:** 17/01/2026  
**Escopo:** Transversal (eventos, posts, grupos, canais)

---

## 1. Princípios Fundamentais

### Regras Canônicas (OBRIGATÓRIAS)

- ✅ **Separar:** VISIBILIDADE (acesso) ≠ PUBLICAÇÃO (destinos) ≠ CONVITE (notificação/envio)
- ✅ **Nada de decisões automáticas** por categoria/subtipo
- ✅ **Código de indicação (referral)** é opcional, marketing informativo e não-bloqueante
- ✅ **Observabilidade** (likes/dislikes, métricas de convites) é passiva e não altera UX automaticamente
- ✅ **Database é estado, não verdade;** mudanças auditáveis (append-only para mudanças importantes)

---

## 2. Arquitetura

### 2.1 Tabelas

#### `publication_metadata`
Metadados de publicação, visibilidade e convites para entidades.

**Campos principais:**
- `entity_type`: 'event' | 'post' | 'group' | 'channel'
- `entity_id`: UUID da entidade
- `visibility`: 'public' | 'private' | 'unlisted' | 'followers' | 'group' | 'friends'
- `publication_destinations`: JSONB array de destinos ('feed', 'group_feed', 'event_feed', 'profile', 'search', 'none')
- `invitations_enabled`: boolean
- `invitation_methods`: JSONB array ('internal', 'whatsapp', 'email', 'shareable_link', 'external_with_signup')
- `referral_code`: string | null (opcional)

**Índices:**
- `(entity_type, entity_id)` - unique constraint
- `(visibility)`
- GIN indexes em `publication_destinations` e `invitation_methods`

#### `publication_audit_log`
Log append-only (imutável) de auditoria.

**Campos principais:**
- `action`: 'SET_VISIBILITY' | 'SET_DESTINATIONS' | 'SEND_INVITES' | 'GENERATE_LINK' | 'REACTION' | etc.
- `payload`: JSONB flexível com detalhes da ação
- `actor_id`, `actor_type`: quem realizou a ação
- `created_at`: timestamp

#### `reactions`
Reações (like/dislike) como observabilidade passiva.

**Campos principais:**
- `entity_type`, `entity_id`
- `reaction_type`: 'like' | 'dislike' | 'love' | 'laugh' | 'angry' | 'sad'
- `user_id`, `actor_id` (opcional)

#### `reaction_counts`
Contagem agregada de reactions (read-model para performance).

---

### 2.2 Service Backend

**`PublicationEngineService`** (`backend/src/core/publication/publication-engine.service.ts`)

**Métodos principais:**
- `determineDestinations(visibility, entityType, actorType) -> destinations[]`
  - Determina destinos por regra explícita (não por categoria)
  - Permite override manual depois
- `upsertPublicationMetadata(tenantId, actorId, actorType, input) -> PublicationMetadata`
- `getPublicationMetadata(tenantId, entityType, entityId) -> PublicationMetadata | null`
- `generateShareableLink(tenantId, actorId, actorType, input) -> GeneratedLink`
- `canUserSee(metadata, context) -> boolean` (somente regra de visibilidade)
- `logAudit(tenantId, input) -> void`
- `upsertReaction(tenantId, userId, input) -> void`
- `removeReaction(tenantId, userId, entityType, entityId) -> void`
- `getReactionCounts(tenantId, entityType, entityId) -> ReactionCount[]`

---

### 2.3 Rotas Backend

**`/publication/:entityType/:entityId`**
- `GET`: Busca metadados
- `PUT`: Cria ou atualiza metadados

**`/publication/:entityType/:entityId/generate-link`**
- `POST`: Gera link compartilhável com referral opcional

**`/publication/:entityType/:entityId/reactions`**
- `POST`: Cria ou atualiza reação
- `DELETE`: Remove reação
- `GET`: Busca contagens de reações

---

### 2.4 Componente Frontend

**`AudienceSelector`** (`frontend/src/components/publication/AudienceSelector.tsx`)

**Funcionalidades:**
- Seletor de VISIBILIDADE (Público, Amigos, Seguidores, Grupo, Não listado, Privado)
- Separado de "onde publicar" (destinos) - opções avançadas
- Respeita Actor: PF, Empresa, Organização (opções podem variar por actor)
- Toggle de convites habilitados
- Seleção de métodos de convite (checklist)
- Banner informativo (não-bloqueante) sobre código de indicação

---

## 3. Integração no Fluxo de Eventos

### Step 3 (Contexto)

**Localização:** `frontend/src/components/events/wizard/Step3Context.tsx`

**Seção adicionada:** "Convites & Colaboração"
- TODO: Integrar `AudienceSelector` quando estiver pronto
- Por enquanto, mantém seletor simples de visibilidade

---

## 4. Migração de Dados Existentes

### Adaptador para Estrutura Existente

Se houver estrutura existente (ex: `events.visibility`), criar adaptador:

1. **Ler do campo antigo** enquanto migra
2. **Gravar nos dois** (temporário) ou migrar com script
3. **Objetivo:** centralizar no `publication_metadata`

**Exemplo de script de migração:**
```sql
-- Migrar visibility de events para publication_metadata
INSERT INTO publication_metadata (
  entity_type, entity_id, tenant_id,
  visibility, publication_destinations,
  invitations_enabled, invitation_methods,
  created_by_actor_id, created_by_actor_type
)
SELECT 
  'event' as entity_type,
  event_id as entity_id,
  tenant_id,
  visibility,
  CASE 
    WHEN visibility = 'public' THEN '["feed", "profile", "search", "event_feed"]'::jsonb
    WHEN visibility = 'private' THEN '["profile"]'::jsonb
    ELSE '["profile"]'::jsonb
  END as publication_destinations,
  false as invitations_enabled,
  '[]'::jsonb as invitation_methods,
  created_by_actor_id,
  created_by_actor_type
FROM events
WHERE NOT EXISTS (
  SELECT 1 FROM publication_metadata 
  WHERE entity_type = 'event' AND entity_id = events.event_id
);
```

---

## 5. Integração Completa (FASE 3-4) ✅

### FASE 3 — ACTION ROUTER ✅

**Status:** ✅ Implementado

**Rota:** `/share/:entityType/:entityId` (pública)

**Funcionalidades:**
- Landing do link compartilhável com ações possíveis (cards)
- Para EVENTO:
  - "Confirmar presença (RSVP)" (stub)
  - "Contribuir / pagar" (se economia habilitada, stub)
  - "Abrir detalhes do evento"
- Para GRUPO:
  - "Solicitar entrada / Entrar no grupo" (stub)
- Para POST:
  - "Ver post" (stub)
- **IMPORTANTE:** todas as ações são "possibilidades", nunca automáticas
- Cada ação exige clique explícito e segue permissões/visibilidade
- Referral code tracking (armazenado em localStorage para signup/login futuro)

**Arquivos:**
- `frontend/src/pages/SharePage.tsx`
- `frontend/src/pages/SharePage.css`

### FASE 4 — REACTIONS (like/dislike) + métricas passivas ✅

**Status:** ✅ Implementado (tabelas, service, API)

**Próximos passos:**
- Integrar UI de reactions no frontend (componente visual)
- Exibir contagens agregadas
- **NÃO mudar ordem/visibilidade automaticamente** com base nisso

### Gerador de Convite WhatsApp/E-mail ✅

**Status:** ✅ Implementado

**Componente:** `InviteGenerator`

**Funcionalidades:**
- WhatsApp deep link: `https://wa.me/?text=ENCODED_MESSAGE`
- E-mail (mailto): subject + body padrão
- Mensagem padrão:
  - "Você foi convidado para: {event_title}"
  - "Data: {date}" (se disponível)
  - "Link: {share_link}"
  - "Use meu código: {ref}" (se tiver referral)
- Copiar mensagem/link para clipboard

**Arquivos:**
- `frontend/src/components/publication/InviteGenerator.tsx`
- `frontend/src/components/publication/InviteGenerator.css`

---

## 6. Critérios de Pronto (Definition of Done)

- ✅ Motor funcional para EVENTO primeiro (`entity_type='event'`), preparado para post/group
- ✅ UI de visibilidade funciona e persiste `publication_metadata`
- ✅ Convites externos geram link com referral opcional
- ✅ ActionRouter mostra ações possíveis sem automatizar nada
- ✅ Auditoria append-only funcionando (toda mudança relevante logada)
- ✅ Sem duplicar lógica de visibilidade em 10 lugares: usar o service
- ✅ Integração real no wizard (end-to-end funcionando)
- ✅ Gerador de convite WhatsApp/E-mail implementado
- ✅ Validações no backend (entityType, visibility)
- ✅ Referral code tracking (localStorage para signup/login futuro)

---

## 7. Integração no Fluxo de Eventos

### Step 3 (Contexto) - Convites & Colaboração

**Localização:** `frontend/src/components/events/wizard/Step3Context.tsx`

**Implementação:**
- ✅ `AudienceSelector` integrado
- ✅ Campos de publicação salvos em `WizardData` (draft)
- ✅ Ao criar evento (draft ou publish), `publication_metadata` é criado/atualizado automaticamente
- ✅ Banner informativo (não-bloqueante) sobre código de indicação

**Fluxo:**
1. Usuário configura visibilidade, destinos e métodos de convite no Step 3
2. Dados salvos em `WizardData` (draft)
3. Ao criar evento, `upsertPublicationMetadata` é chamado
4. Se evento já existir (draft), pode atualizar via `PUT /publication/event/:id`

## 8. Como Posts/Grupos vão Plugar

### Posts

1. Criar `PostCreationWizard` similar ao `EventCreationWizard`
2. Integrar `AudienceSelector` no step de publicação
3. Ao criar post, chamar `upsertPublicationMetadata` com `entity_type='post'`
4. ActionRouter já suporta posts (stub implementado)

### Grupos

1. Integrar `AudienceSelector` na criação/edição de grupo
2. Ao criar grupo, chamar `upsertPublicationMetadata` com `entity_type='group'`
3. ActionRouter já suporta grupos (stub implementado)

**Padrão:**
- Sempre usar `AudienceSelector` para configurar publicação
- Sempre chamar `upsertPublicationMetadata` após criar entidade
- Sempre gerar link via `generateShareableLink` quando necessário
- Sempre usar `ActionRouter` (`/share/:entityType/:entityId`) para landing

## 9. Referências

- **Migrations:**
  - `backend/migrations/158_create_publication_metadata.sql`
  - `backend/migrations/159_create_publication_audit_log.sql`
  - `backend/migrations/160_create_reactions.sql`
- **Service:** `backend/src/core/publication/publication-engine.service.ts`
- **Types:** `backend/src/core/publication/publication-engine.types.ts`
- **Routes:** `backend/src/core/publication/publication-engine.routes.ts`
- **Module:** `backend/src/core/publication/publication-engine.module.ts`
- **Frontend Components:**
  - `frontend/src/components/publication/AudienceSelector.tsx`
  - `frontend/src/components/publication/InviteGenerator.tsx`
- **Frontend Pages:**
  - `frontend/src/pages/SharePage.tsx` (ActionRouter)
- **Frontend API:** `frontend/src/api/publication.ts`
- **Frontend Types:** `frontend/src/types/publication.ts`

---

**Última atualização:** 17/01/2026

