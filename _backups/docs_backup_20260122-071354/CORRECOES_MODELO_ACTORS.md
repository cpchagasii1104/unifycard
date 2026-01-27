# Correções Críticas: Modelo de Actors

**Data**: 2024-12-19  
**Escopo**: 3 correções cirúrgicas no modelo de Actor

---

## 1. ELIMINAÇÃO DO FALLBACK SILENCIOSO PARA PF

### Problema
Backend em `social-2.0.routes.ts` fazia fallback para actor PF quando `actorId` não era fornecido, criando inconsistência com frontend (que pode estar com PJ ativo).

### Solução Implementada

**Backend - Função Utilitária** (`src/modules/social/actor.utils.ts`):
- Criada função `resolveActiveActorFromRequest()` com prioridade:
  1. Header `x-actor-id` (e opcionalmente `x-actor-type`)
  2. Querystring `actor_id` e `actor_type`
  3. Se nada foi enviado → retorna erro 400 explícito (sem fallback silencioso)

**Backend - Rotas** (`src/modules/social/social-2.0.routes.ts`):
- Linha 841-858: Removido fallback `findOrCreateUserActor()` silencioso
- Substituído por `resolveActiveActorFromRequest()` com `allowUserFallback: false
- Erro retornado: `"Missing active actor. Provide x-actor-id header or actor_id query parameter."`

**Frontend - Client** (`c:/unificard/frontend/src/api/client.ts`):
- Linha 82-92: Adicionado envio automático de `x-actor-id` header
- Prioridade: header explícito > localStorage > não enviar (não quebra)
- Header enviado em todas as requisições quando `activeActor` disponível

---

## 2. ALINHAMENTO DE TIPOS: ActorType NO CÓDIGO = CHECK DO BANCO

### Problema
Banco permite `'user' | 'page' | 'group' | 'channel'`, mas `event.types.ts` limitava `ActorType` a `'user' | 'page'`.

### Solução Implementada

**Backend - Tipos** (`src/core/events/event.types.ts`):
- Linha 42: `ActorType` atualizado para incluir `'group' | 'channel'`
- Linha 47-56: `ACTOR_EVENT_TYPE_MATRIX` atualizado para incluir `group` e `channel` (ambos `false` por enquanto)
- Comentário 🔴 BLINDAGEM: "group e channel não estão habilitados para emissão de eventos ainda"

**Backend - Validação** (`src/core/events/event.service.ts`):
- Linha 85-88: `validateActorEventType()` atualizado para suportar `group` e `channel`
- Retorna `false` para `group` e `channel` (não habilitados)

---

## 3. PROFILE / RAIO-X: TORNAR ACTOR-AWARE

### Problema
`core.service.ts` montava Profile baseado em PF sempre, não refletindo Actor ativo quando aplicável.

### Solução Implementada

**Backend - Service** (`src/core/core.service.ts`):
- Linha 85-88: `getCompleteProfile()` agora aceita `actorId?: string` opcional
- Linha 108-145: Lógica de resolução de actor:
  - Se `actorId` fornecido: busca actor específico via `findById()`
  - Se não fornecido: usa actor PF do `userId` (compatibilidade)
- Linha 130-144: Para actors não-user (page/group/channel):
  - Retorna estrutura vazia para perfis não suportados (pessoal/profissional/saúde/aprendizado)
  - Apenas `education_profile` é buscado (já é event-based por actor)
  - Comentário 🔴 BLINDAGEM explicando comportamento

**Backend - Rotas** (`src/core/core.routes.ts`):
- Linha 50-53: Endpoint `GET /core/profile` agora aceita `?actorId=<uuid>` opcional
- Se não fornecido: usa actor PF (compatibilidade)

**Frontend - API** (`c:/unificard/frontend/src/api/core.ts`):
- Linha 84-107: `getCoreProfile()` agora aceita `actorId?: string` opcional
- URL construída com query param quando `actorId` fornecido

**Frontend - Component** (`c:/unificard/frontend/src/components/Profile.tsx`):
- Linha 47: Adicionado `activeActor` do `useSession()`
- Linha 567-568: Quando `activeActor.actor_type !== 'user'`, passa `actorId` para `getCoreProfile()`

---

## ARQUIVOS ALTERADOS

### Backend
1. `src/modules/social/actor.utils.ts` (NOVO) - Função utilitária canônica
2. `src/modules/social/social-2.0.routes.ts` - Removido fallback, usa `resolveActiveActorFromRequest()`
3. `src/core/events/event.types.ts` - Alinhado tipos com banco
4. `src/core/events/event.service.ts` - Suporte para `group` e `channel`
5. `src/core/core.service.ts` - Profile actor-aware
6. `src/core/core.routes.ts` - Endpoint aceita `actorId` opcional

### Frontend
1. `c:/unificard/frontend/src/api/client.ts` - Envio automático de `x-actor-id` header
2. `c:/unificard/frontend/src/api/core.ts` - `getCoreProfile()` aceita `actorId` opcional
3. `c:/unificard/frontend/src/components/Profile.tsx` - Usa `activeActor` para buscar profile

---

## VALIDAÇÕES

### Backend
- ✅ `pnpm run build:check` → PASS
- ✅ `pnpm run build` → PASS

### Frontend
- ✅ `pnpm run build` → PASS

---

## COMPORTAMENTO FINAL

### Como o Actor Ativo é Enviado
1. **Prioridade 1**: Header `x-actor-id` (enviado automaticamente pelo `client.ts` quando `activeActor` disponível)
2. **Prioridade 2**: Querystring `actor_id` e `actor_type` (compatibilidade)
3. **Prioridade 3**: Erro 400 explícito se nada fornecido (sem fallback silencioso)

### Onde o Fallback PF Foi Removido
- `src/modules/social/social-2.0.routes.ts` linha 841-858 (rota de voto)
- Outros usos de `findOrCreateUserActor()` são legítimos (follow/unfollow sempre usa PF)

### Como o Profile se Comporta para Page
- Se `actorId` fornecido e `actor_type !== 'user'`:
  - Retorna estrutura vazia para `personal_profile`, `professional_profile`, `physical_profile`, `learning_profile`
  - Apenas `education_profile` é buscado (event-based por actor)
  - `actor` é preenchido com dados do actor específico
- Se `actorId` não fornecido ou `actor_type === 'user'`:
  - Comportamento normal (compatibilidade)

---

**Status Final**: ✅ **TODAS AS CORREÇÕES IMPLEMENTADAS E VALIDADAS**

