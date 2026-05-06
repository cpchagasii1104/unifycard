# Remoção do fallback JWT como actorId + bootstrap de actors

**Modo:** EXECUTOR

## Frontend (`frontend/src/api/client.ts`)

- Removido qualquer uso de `userId`/`sub` do JWT como `actorId` no `x-action-context`.
- `actorId` no header vem **apenas** de `localStorage['unificard_active_actor_id']`, com `waitForActorContext(2000)` se ainda vazio.
- Em DEV, se houver token + tenant mas não houver actor após a espera, `console.warn` com mensagem canônica: *ActionContext não disponível: actorId ausente* (path da requisição).

## Frontend (`frontend/src/components/Login.tsx`)

- Após login bem-sucedido, `localStorage.removeItem('unificard_active_actor_id')` para não reutilizar actor de outra sessão/usuário.

## Backend (necessário para cold start sem actor no cliente)

Sem actor no storage, nenhuma chamada enviaria `x-action-context`; o bootstrap chama `GET /social/actors/available` **antes** de persistir o actor.

1. **`backend/src/plugins/action-context.plugin.ts`**  
   - Não executa `actionContextMiddleware` em `GET` cujo path termina em `/social/actors/available`.

2. **`backend/src/modules/social/social-2.0.routes.ts`**  
   - `findAvailableActors` recebe **`users.user_id`**, não `actors.actor_id`.  
   - Resolve: sem ActionContext → `listingUserId = req.user.id`; com ActionContext → `findById(actorId)` e usa `actor.user_id`, ou fallback se `actorId === req.user.id` (legado).

## Validação

- `pnpm run build` (backend): OK  
- `pnpm exec tsc --noEmit` (frontend): OK  

## Risco residual

- Rotas protegidas que não sejam o bootstrap de actors continuam a exigir `x-action-context` no cliente; sem actor no storage, o aviso em DEV aparece e o backend pode responder 400.
