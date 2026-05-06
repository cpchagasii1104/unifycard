# Diagnóstico: ActionContext ausente no fluxo “salvar perfil”

**Modo:** EXECUTOR (somente diagnóstico; sem alteração de código)

## PASSO 1 — Rota e chamada

| Camada | Local |
|--------|--------|
| Backend | `PUT /profile` (prefixo `protectedScope` + `/profile`, rota interna `'/'` e alias `'/profile'`) — `backend/src/core/profile/profile.routes.ts` (`updateProfileHandler`, `fastify.put('/')`) |
| Frontend API | `updateProfile()` — `frontend/src/api/profile.ts` → `apiFetch('/profile', { method: 'PUT', body: JSON.stringify(input) })` |
| UI | `frontend/src/components/Profile.tsx` (~linha 927) chama `updateProfile(profileUpdate)` |

## PASSO 2 — Request efetiva (cliente)

Montada por `frontend/src/api/client.ts` → `apiFetch`:

**Headers (sempre que há token + tenant):**

- `Content-Type: application/json`
- `Authorization: Bearer <token>`
- `x-tenant-id: <tenantId>` (obrigatório após auth)
- `x-acting-actor-id` — **opcional**, só se vier em `options.headers` ou `localStorage['unificard_active_actor_id']`

**Body (`updateProfile`):** apenas campos de perfil (`fullName`, `phone`, `metadata`, etc.) — **sem** `actionContext`.

**Ausente:**

- Header `x-action-context`
- Propriedade `body.actionContext`
- Campos planos `actorId` / `intent` / `source` / `scope` no body (o middleware aceita esses como alternativa; não são enviados)

## PASSO 3 — Formato

Não aplicável: **não há** payload ActionContext para validar.

## PASSO 4 — Onde deveria ser montado (sem implementar)

- **Ponto central de HTTP:** `apiFetch` em `frontend/src/api/client.ts` (único lugar que define headers globais).
- **Chamada específica:** `updateProfile` em `frontend/src/api/profile.ts` poderia passar headers extra para `apiFetch`, ou o corpo poderia incluir `actionContext` (canal aceito pelo middleware).

**Desalinhamento documentado no próprio client:** comentário em `client.ts` sugere que `x-acting-actor-id` satisfaz “action context” para o backend; o middleware real (`action-context.middleware.ts`) **não** lê esse header — só `x-action-context` (JSON), `body.actionContext`, `query.actionContext` ou campos planos no body.

## PASSO 5 — Respostas objetivas

1. ActionContext não está sendo enviado? **SIM** (para `PUT /profile` via `apiFetch` atual).
2. Está sendo enviado no lugar errado? **SIM**, no sentido de que existe **outro** header (`x-acting-actor-id`) que **não** substitui o contrato V2; o canal correto não é usado.
3. Está com formato inválido? **NÃO** — não há objeto ActionContext; o erro esperado é “ausente”, não “malformado”.
4. Ponto exato no código: **`frontend/src/api/client.ts`** (montagem de headers) + **`frontend/src/api/profile.ts`** (`updateProfile` sem contexto) + chamada em **`frontend/src/components/Profile.tsx`**.

## Referência backend

`protectedScope` registra `actionContextPlugin` antes dos módulos (`BOOT.ts`); `PUT /profile` está no escopo protegido, logo o `preHandler` exige ActionContext completo quando `req.user` e `req.tenant` existem.
