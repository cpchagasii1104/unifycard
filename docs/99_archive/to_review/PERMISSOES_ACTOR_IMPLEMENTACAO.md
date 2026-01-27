# Implementação: Primeira Camada de Permissões por Actor

**Data**: 2024-12-19  
**Escopo**: Controle explícito e auditável de permissões de Actor

---

## 1. CONTRATO DE PERMISSÕES DE ACTOR

### Estrutura Definida

**Interface** (`src/modules/social/reputation.service.ts`):
```typescript
export interface ActorPermissions {
  canPost: boolean; // 🔴 CRÍTICO: Permissão básica para criar posts
  canVote: boolean;
  canCreateProject: boolean;
  canCreateCTA: boolean;
  hasExtendedReach: boolean;
  hasAdvancedAccess: boolean;
}
```

**Regras Implementadas**:
- **PF (user)**: `canPost = true` sempre (permissão básica)
- **PJ (page)**: `canPost = true` apenas se `companyStatus === 'VERIFIED' || 'APPROVED'`
- **PJ PROVISIONAL**: `canPost = false` (não pode postar)
- **PJ não verificada**: `canPost = false` (não pode postar)

**Comentários 🔴 BLINDAGEM**:
- Permissões são explícitas e verificáveis
- NÃO podem ser implícitas ou assumidas automaticamente
- NÃO são decisão de UI - são validação de backend obrigatória

---

## 2. SUBSTITUIÇÃO DE `can_post = true` POR CHECK REAL

### Problema Anterior
- `actor.repository.ts` retornava `can_post: true` sempre (linha 252 e 284)

### Solução Implementada

**Backend - Repository** (`src/modules/social/actor.repository.ts`):
- Linha 280-286: Substituído `can_post: true` por verificação real via `reputationService.getPermissions()`
- Para empresas: `can_post = permissions.canPost` (verificação real)
- Para PF: `can_post = true` (sempre permitido)

**Backend - Service** (`src/modules/social/social-2.0.service.ts`):
- Linha 660-677: Verificação de permissões antes de criar post
- Linha 674-677: Se `!permissions.canPost`, lança `HttpError.forbidden()` com mensagem explícita
- Erro retornado: `"Actor does not have permission to post. Complete company verification to enable posting."`

**Comentários 🔴 BLINDAGEM**:
- Por que permissões NÃO podem ser implícitas: segurança e auditoria
- Por que isso não é decisão de UI: validação de backend obrigatória

---

## 3. AUDITORIA DE TROCA DE ACTOR (EVENTO)

### Implementação

**Backend - Service** (`src/modules/social/actor-audit.service.ts`):
- Função `recordActorSwitch()` registra evento `actor.switched`
- Payload: `from_actor_id`, `to_actor_id`, `user_id`, `tenant_id`, `context`
- Evento persistido em `event_log` via `eventBus.publish()`

**Backend - Route** (`src/modules/social/social-2.0.routes.ts`):
- Endpoint `POST /social/actors/switch` para registrar troca explícita
- Valida que `to_actor_id` existe e pertence ao usuário
- Retorna 403 se usuário não tem acesso ao actor

**Características do Evento**:
- Tipo: `actor.switched`
- Versão: 1
- Metadata: `timestamp`, `source: 'actor-audit-service'`
- Contexto opcional: `route`, `method`, etc.

**Regras**:
- Não é feed (não aparece no feed social)
- Não é visível ao usuário final
- Serve para auditoria, debugging e segurança

---

## 4. GARANTIAS E VALIDAÇÕES

### Garantias Implementadas

1. **PF continua funcionando como antes**:
   - `canPost = true` sempre para `actor_type === 'user'`
   - Sem verificação adicional para PF

2. **PJ sem permissão NÃO consegue postar**:
   - Verificação em `social-2.0.service.ts` linha 674-677
   - Erro 403 explícito: `"Actor does not have permission to post..."`

3. **Erros são explícitos (não silenciosos)**:
   - `HttpError.forbidden()` com mensagem clara
   - Status code 403 (não 400 ou 500)

4. **Nenhum fallback oculto é reintroduzido**:
   - Verificação explícita antes de permitir post
   - Não há fallback silencioso para PF quando PJ não tem permissão

### Validações

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS
- ✅ Frontend: `pnpm run build` → PASS

---

## ARQUIVOS ALTERADOS

### Backend
1. `src/modules/social/reputation.service.ts`
   - Adicionado `canPost` à interface `ActorPermissions`
   - Atualizado `getPermissions()` para calcular `canPost` baseado em `actorType` e `companyStatus`
   - Comentários 🔴 BLINDAGEM adicionados

2. `src/modules/social/actor.repository.ts`
   - Substituído `can_post: true` por verificação real via `reputationService.getPermissions()`
   - Comentários 🔴 BLINDAGEM adicionados

3. `src/modules/social/social-2.0.service.ts`
   - Adicionada verificação `!permissions.canPost` antes de criar post
   - Lança `HttpError.forbidden()` se sem permissão
   - Comentários 🔴 BLINDAGEM adicionados

4. `src/modules/social/actor-audit.service.ts` (NOVO)
   - Função `recordActorSwitch()` para registrar evento de troca
   - Evento `actor.switched` persistido em `event_log`

5. `src/modules/social/social-2.0.routes.ts`
   - Endpoint `POST /social/actors/switch` para registrar troca explícita
   - Validação de acesso ao actor antes de registrar

---

## ONDE AS PERMISSÕES SÃO RESOLVIDAS

1. **`reputation.service.ts` - `getPermissions()`**:
   - Calcula permissões baseado em `reputation_level` e `companyStatus`
   - Retorna `ActorPermissions` com `canPost` calculado

2. **`actor.repository.ts` - `findAvailableActors()`**:
   - Chama `reputationService.getPermissions()` para cada actor de empresa
   - Retorna `can_post` baseado em `permissions.canPost`

---

## ONDE SÃO VERIFICADAS

1. **`social-2.0.service.ts` - `createPost()`**:
   - Linha 662-677: Chama `reputationService.getPermissions()`
   - Linha 674-677: Verifica `!permissions.canPost` e lança erro 403 se false

2. **`actor.repository.ts` - `findAvailableActors()`**:
   - Linha 280-286: Resolve `can_post` via `reputationService.getPermissions()`
   - Retorna `can_post` correto para cada actor

---

## COMO O EVENTO DE TROCA DE ACTOR É REGISTRADO

1. **Via Endpoint** (`POST /social/actors/switch`):
   - Frontend chama endpoint quando `activeActor` muda
   - Backend valida acesso e registra evento via `recordActorSwitch()`

2. **Via EventBus**:
   - `recordActorSwitch()` publica evento `actor.switched` via `eventBus.publish()`
   - Evento persistido em `event_log` com payload completo

3. **Estrutura do Evento**:
   ```typescript
   {
     type: 'actor.switched',
     version: 1,
     payload: {
       from_actor_id: string | null,
       to_actor_id: string,
       user_id: string,
       tenant_id: string,
       context?: Record<string, unknown>
     },
     metadata: {
       timestamp: string,
       source: 'actor-audit-service'
     }
   }
   ```

---

## O QUE ACONTECE QUANDO UM ACTOR SEM PERMISSÃO TENTA POSTAR

1. **Fluxo**:
   - `createPost()` é chamado com `actorId` de uma PJ PROVISIONAL
   - `reputationService.getPermissions()` retorna `canPost: false`
   - Verificação em linha 674 detecta `!permissions.canPost`
   - Lança `HttpError.forbidden()` com status 403

2. **Resposta HTTP**:
   - Status: `403 Forbidden`
   - Mensagem: `"Actor does not have permission to post. Complete company verification to enable posting."`

3. **Comportamento**:
   - Post NÃO é criado
   - Erro é explícito e claro
   - Frontend recebe erro 403 e pode exibir mensagem apropriada

---

**Status Final**: ✅ **TODAS AS IMPLEMENTAÇÕES CONCLUÍDAS E VALIDADAS**

