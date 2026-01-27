# Auditoria Completa: Modelo de Actors

**Data**: 2024-12-19  
**Escopo**: Backend + Frontend + Integrações

---

## 1. TIPOS DE ACTOR EXISTENTES

### Tipos Definidos no Sistema

| Tipo | Descrição | Vinculação | Status |
|------|-----------|------------|--------|
| `user` | Pessoa Física | `user_id` | ✅ **IMPLEMENTADO** |
| `page` | Pessoa Jurídica (Empresa) | `company_id` | ✅ **IMPLEMENTADO** |
| `group` | Grupo/Comunidade | `group_id` | ✅ **IMPLEMENTADO** |
| `channel` | Canal (futuro) | Nenhuma | ⚠️ **DEFINIDO MAS NÃO IMPLEMENTADO** |

### Definições no Código

**Backend - Tabela** (`migrations/050_social_2_0.sql`):
```sql
actor_type VARCHAR(20) NOT NULL
  CHECK (actor_type IN ('user', 'page', 'group', 'channel'))
```

**Backend - TypeScript** (`src/modules/social/actor.repository.ts`):
```typescript
actor_type: 'user' | 'page' | 'group' | 'channel';
```

**Backend - Event Types** (`src/core/events/event.types.ts`):
```typescript
export type ActorType = 'user' | 'page'; // ⚠️ LIMITADO - não inclui 'group' ou 'channel'
```

**Frontend - SessionProvider** (`c:/unificard/frontend/src/contexts/SessionProvider.tsx`):
- Usa `AvailableActor` que suporta todos os tipos
- Persistência em `localStorage` com chave `unificard_active_actor_id`

---

## 2. ONDE ACTORS SÃO DEFINIDOS

### Backend

| Arquivo | Função | Localização |
|---------|--------|-------------|
| `migrations/050_social_2_0.sql` | Schema da tabela `actors` | Linhas 61-122 |
| `src/modules/social/actor.repository.ts` | Interface `ActorRow`, métodos CRUD | Linhas 4-356 |
| `src/core/events/event.types.ts` | Tipo `ActorType` (limitado) | Linha 40 |
| `src/modules/social/social-2.0.service.ts` | Uso de actors em feed/posts | Múltiplas linhas |
| `src/modules/social/social-2.0.routes.ts` | Resolução de actor ativo | Linhas 840-878 |

### Frontend

| Arquivo | Função | Localização |
|---------|--------|-------------|
| `c:/unificard/frontend/src/contexts/SessionProvider.tsx` | Resolução de actor ativo na sessão | Linhas 1-414 |
| `c:/unificard/frontend/src/api/social.ts` | Cliente API para `getAvailableActors` | (não lido) |
| `c:/unificard/frontend/src/components/social/ActorSelector.tsx` | UI de seleção de actor | (não lido) |

---

## 3. RESOLUÇÃO DE ACTOR ATIVO NA SESSÃO

### Backend

**Resolução em Rotas** (`src/modules/social/social-2.0.routes.ts`):
- Linha 843: `actorId` e `actorType` vêm de `req.query`
- Linha 847-858: Se `actorId` fornecido, busca via `actorRepository.findById()`
- Linha 854-857: **Fallback**: Se não fornecido, usa `findOrCreateUserActor()` (sempre PF)

**Padrão Identificado**:
```typescript
// Padrão comum em rotas:
const actorId = req.query.actor_id;
const actorType = req.query.actor_type as 'user' | 'page' | undefined;

let currentActor;
if (actorId && actorType) {
  currentActor = await actorRepository.findById(req.tenant.id, actorId);
} else {
  // Fallback: sempre PF
  currentActor = await actorRepository.findOrCreateUserActor(req.tenant.id, user.user_id);
}
```

**Risco**: ⚠️ **FALLBACK SEMPRE PF** - Se `actorId` não for fornecido, sistema assume PF, mesmo que usuário esteja atuando como PJ.

---

### Frontend

**SessionProvider** (`c:/unificard/frontend/src/contexts/SessionProvider.tsx`):
- Linha 20: Chave de persistência: `unificard_active_actor_id`
- Linha 94: Carrega actors via `getAvailableActors()`
- Linha 138-152: Lógica de seleção:
  1. Se 1 actor → seleciona automaticamente
  2. Se múltiplos → restaura de `localStorage` OU seleciona PF primeiro
- Linha 157: Salva em `localStorage` após seleção

**Fluxo de Bootstrap**:
1. FASE 1: Validação de autenticação (token + tenantId)
2. FASE 2: Carregamento de actors disponíveis
3. FASE 3: Decisão de `activeActor` (obrigatório para `sessionReady = true`)

**Risco**: ⚠️ **sessionReady pode ser true sem activeActor** - Linha 124-131: Se não houver actors, `sessionReady = true` mas `activeActor = null`.

---

## 4. VALIDAÇÃO DO CONTRATO DO ACTOR

### ✅ Actor é Entidade Soberana?

**Evidência**:
- ✅ Tabela `actors` é independente (não é coluna de `users` ou `companies`)
- ✅ Actor tem `actor_id` próprio (UUID primário)
- ✅ Actor pode existir sem referência direta a `user_id` (ex: `channel`)

**Status**: ✅ **SIM** - Actor é entidade soberana

---

### ✅ Actor Pode Trocar Durante a Sessão?

**Evidência**:
- ✅ Frontend: `setActiveActor()` permite mudança (linha 196 de `SessionProvider.tsx`)
- ✅ Frontend: Mudança dispara evento `active-actor-changed` (linha 162)
- ✅ Frontend: Persistência atualizada em `localStorage` (linha 157)
- ⚠️ Backend: Rotas recebem `actorId` via query, mas não há validação de "troca durante sessão"

**Status**: ✅ **SIM** - Actor pode trocar durante a sessão (frontend suporta, backend aceita)

---

### ✅ Um Mesmo Usuário Pode Postar como PF e PJ?

**Evidência**:
- ✅ `findAvailableActors()` retorna array com múltiplos actors (linha 225-289 de `actor.repository.ts`)
- ✅ Array inclui: 1 actor `user` + N actors `page` (empresas com permissão)
- ✅ Frontend: `SessionProvider` gerencia múltiplos actors (linha 13: `actors: AvailableActor[]`)
- ✅ Backend: `createPost()` aceita `actorId` opcional (linha 611 de `social-2.0.service.ts`)

**Status**: ✅ **SIM** - Um usuário pode postar como PF e PJ (múltiplos actors disponíveis)

---

### ⚠️ Ambiguidades Identificadas

#### 1. Fallback Sempre PF
**Problema**: Se `actorId` não for fornecido, backend sempre assume PF
**Localização**: `src/modules/social/social-2.0.routes.ts` linha 854-857
**Risco**: Usuário pode estar atuando como PJ no frontend, mas backend assume PF

#### 2. Tipo Limitado em Event Types
**Problema**: `event.types.ts` define `ActorType = 'user' | 'page'` (não inclui `group` ou `channel`)
**Localização**: `src/core/events/event.types.ts` linha 40
**Risco**: Inconsistência com definição completa em `actor.repository.ts`

#### 3. sessionReady sem activeActor
**Problema**: `sessionReady = true` pode ocorrer sem `activeActor` (linha 124-131)
**Localização**: `c:/unificard/frontend/src/contexts/SessionProvider.tsx`
**Risco**: Componentes podem assumir que `activeActor` existe quando `sessionReady = true`

---

## 5. FEED & ACTOR (AUDITORIA)

### Feed é Filtrado por Actor Ativo?

**Evidência** (`src/modules/social/social-2.0.service.ts`):
- Linha 105: **REGRA**: `actor_type` é OBRIGATÓRIO - não existe feed genérico
- Linha 115: Parâmetro `actorType: 'user' | 'page'` (obrigatório, sem default)
- Linha 129: `currentActorId` é usado para seguir (opcional)
- Linha 324-460: Função `calculateContentWeight()` usa `mode: 'user' | 'page'` para priorizar conteúdo

**Status**: ✅ **SIM** - Feed é filtrado por `actorType` (obrigatório)

---

### Um Actor PJ Vê o Mesmo Feed de PF?

**Evidência** (`src/modules/social/social-2.0.service.ts` linha 394-460):
- **MODO PF** (`mode === 'user'`):
  - Post de Pessoa = 100 (prioridade máxima)
  - Post em Grupo = 90
  - Evento = 80
  - Post de Empresa = 40
  - Conteúdo Institucional = 30

- **MODO PJ** (`mode === 'page'`):
  - Projeto/Iniciativa = 100 (prioridade máxima)
  - Post Institucional = 90
  - Grupo Institucional = 80
  - Resultado/Impacto = 70
  - Post de Pessoa = 30

**Status**: ❌ **NÃO** - Feed é diferente para PF vs PJ (priorização diferente)

---

### Onde o Tipo de Actor Influencia Comportamento

#### 1. Feed (Priorização)
- **Localização**: `src/modules/social/social-2.0.service.ts` linha 324-460
- **Influência**: Priorização de posts baseada em `actorType`
- **Risco**: ⚠️ **BAIXO** - É sugestivo, não bloqueante

#### 2. Tipos de Post/Intent
- **Localização**: `src/core/events/event.types.ts` linha 45-54
- **Influência**: Matriz `ACTOR_EVENT_TYPE_MATRIX` define quais eventos cada actor pode criar
- **Exemplo**: `social: { user: true, page: false }` - apenas PF pode criar eventos sociais
- **Risco**: ✅ **BAIXO** - Validação explícita e documentada

#### 3. Permissões de Post
- **Localização**: `src/modules/social/actor.repository.ts` linha 228-289
- **Influência**: `can_post` é calculado baseado em permissões
- **Regras**:
  - Actor `user`: Sempre `can_post: true` (linha 252)
  - Actor `page`: `can_post: true` (linha 284) - **⚠️ SEMPRE TRUE, não valida permissões reais**
- **Risco**: ⚠️ **MÉDIO** - `can_post` sempre `true` para empresas, não valida permissões reais

#### 4. Votações
- **Localização**: `src/modules/social/social-2.0.routes.ts` linha 670
- **Influência**: Empresas `PROVISIONAL` não podem votar
- **Código**: `if (intent === 'vote' && actor.actor_type === 'page' && companyStatus === 'PROVISIONAL')`
- **Risco**: ✅ **BAIXO** - Validação explícita

#### 5. Reputação e Permissões
- **Localização**: `src/modules/social/social-2.0.service.ts` linha 660-667
- **Influência**: `reputationService.getPermissions()` valida permissões baseadas em reputação
- **Risco**: ✅ **BAIXO** - Validação explícita

---

## 6. PROFILE & ACTOR (AUDITORIA)

### Profile é Vinculado a Actor?

**Evidência** (`src/core/core.service.ts`):
- Linha 91: `CompleteProfile` inclui campo `actor: null`
- Linha 105-121: Busca actor via `findOrCreateUserActor()` (sempre PF)
- Linha 109-116: Retorna dados do actor no profile completo

**Status**: ⚠️ **PARCIAL** - Profile inclui actor, mas sempre busca actor PF (não usa actor ativo)

**Risco**: ⚠️ **MÉDIO** - Profile não reflete actor ativo, sempre mostra actor PF

---

## 7. RISCOS IDENTIFICADOS

### ❌ RISCO 1: Fallback Sempre PF (ALTA SEVERIDADE)

**Problema**: Se `actorId` não for fornecido, backend sempre assume PF
**Localização**: `src/modules/social/social-2.0.routes.ts` linha 854-857
**Impacto**: Usuário pode estar atuando como PJ no frontend, mas backend assume PF
**Mitigação necessária**: Validar `actorId` obrigatório OU usar header/session para actor ativo

---

### ⚠️ RISCO 2: sessionReady sem activeActor (MÉDIA SEVERIDADE)

**Problema**: `sessionReady = true` pode ocorrer sem `activeActor` (linha 124-131)
**Localização**: `c:/unificard/frontend/src/contexts/SessionProvider.tsx`
**Impacto**: Componentes podem assumir que `activeActor` existe quando `sessionReady = true`
**Mitigação necessária**: Documentar que `activeActor` pode ser `null` mesmo com `sessionReady = true`

---

### ⚠️ RISCO 3: can_post Sempre True para Empresas (MÉDIA SEVERIDADE)

**Problema**: `can_post` sempre `true` para empresas, não valida permissões reais
**Localização**: `src/modules/social/actor.repository.ts` linha 284
**Impacto**: Usuários podem ver empresas onde não têm permissão para postar
**Mitigação necessária**: Validar permissões reais de `company_users` antes de definir `can_post`

---

### ⚠️ RISCO 4: Tipo Limitado em Event Types (BAIXA SEVERIDADE)

**Problema**: `event.types.ts` define `ActorType = 'user' | 'page'` (não inclui `group` ou `channel`)
**Localização**: `src/core/events/event.types.ts` linha 40
**Impacto**: Inconsistência com definição completa em `actor.repository.ts`
**Mitigação necessária**: Alinhar tipos ou documentar limitação

---

### ⚠️ RISCO 5: Profile Não Reflete Actor Ativo (MÉDIA SEVERIDADE)

**Problema**: Profile sempre busca actor PF, não usa actor ativo
**Localização**: `src/core/core.service.ts` linha 105-121
**Impacto**: Profile não reflete contexto de atuação (PF vs PJ)
**Mitigação necessária**: Profile deve aceitar `actorId` opcional para buscar actor específico

---

## 8. LACUNAS IDENTIFICADAS

### ❌ Lacuna 1: Validação de Permissões em Tempo Real

**Problema**: `can_post` é calculado uma vez, não valida em tempo real
**Lacuna**: Falta validação de permissões antes de cada ação (post, voto, etc.)
**Sugestão**: Validar permissões em cada rota que usa actor

---

### ❌ Lacuna 2: Actor Ativo no Backend

**Problema**: Backend não mantém estado de "actor ativo" da sessão
**Lacuna**: Cada rota precisa receber `actorId` via query/body
**Sugestão**: Usar header ou session para manter actor ativo no backend

---

### ❌ Lacuna 3: Profile Vinculado a Actor Específico

**Problema**: Profile sempre busca actor PF, não reflete actor ativo
**Lacuna**: Falta opção de buscar profile de actor específico (PF ou PJ)
**Sugestão**: Profile deve aceitar `actorId` opcional

---

### ❌ Lacuna 4: Auditoria de Mudanças de Actor

**Problema**: Não há log/auditoria de mudanças de actor durante sessão
**Lacuna**: Falta rastreamento de quando usuário troca de actor
**Sugestão**: Adicionar log de mudanças de actor

---

## 9. RESUMO EXECUTIVO

### ✅ Pontos Fortes

1. **Actor é entidade soberana** - Tabela independente, UUID próprio
2. **Múltiplos actors por usuário** - Suporta PF + múltiplas PJs
3. **Feed filtrado por actor** - Priorização diferente para PF vs PJ
4. **Frontend gerencia actor ativo** - SessionProvider com persistência

### ❌ Problemas Críticos

1. **Fallback sempre PF** (ALTA) - Backend assume PF se `actorId` não fornecido
2. **can_post sempre true** (MÉDIA) - Não valida permissões reais para empresas
3. **Profile não reflete actor ativo** (MÉDIA) - Sempre busca actor PF

### ⚠️ Riscos

1. Inconsistência entre frontend (PJ ativo) e backend (assume PF)
2. Usuários podem ver empresas onde não têm permissão
3. Profile não reflete contexto de atuação

### 📋 Lacunas

1. Validação de permissões em tempo real
2. Actor ativo no backend (session/header)
3. Profile vinculado a actor específico
4. Auditoria de mudanças de actor

---

## 10. ARQUIVOS AUDITADOS

### Backend
- `migrations/050_social_2_0.sql` - Schema da tabela
- `src/modules/social/actor.repository.ts` - Repository e tipos
- `src/modules/social/social-2.0.service.ts` - Uso em feed/posts
- `src/modules/social/social-2.0.routes.ts` - Resolução de actor ativo
- `src/core/events/event.types.ts` - Tipos limitados
- `src/core/core.service.ts` - Profile e actor

### Frontend
- `c:/unificard/frontend/src/contexts/SessionProvider.tsx` - Resolução de actor ativo
- `c:/unificard/frontend/src/components/Dashboard.tsx` - Uso de `activeActor`
- `c:/unificard/frontend/src/components/Profile.tsx` - Uso de `refreshActors`

---

**Status Final**: ⚠️ **REQUER ATENÇÃO** - Actor é entidade soberana e funciona, mas há riscos de inconsistência entre frontend e backend, e lacunas em validação de permissões e profile vinculado a actor.

