# Garantia ActionContext antes de APIs protegidas (frontend)

**Modo:** EXECUTOR

## Problema

- `SessionProvider` chamava `getProfile()` **antes** de carregar actors e persistir `unificard_active_actor_id`.
- `apiFetch` só enviava `x-action-context` quando o actor já estava no `localStorage` → primeira chamada protegida falhava ou dependia de ordem frágil.

## Alterações

### `frontend/src/api/client.ts`

- `waitForActorContext(maxMs, pollMs)` exportado — polling do `localStorage` até actor aparecer (default 2s).
- `getUserIdFromAuthToken` — lê `userId` ou `sub` do JWT para cold start (alinhado ao uso em `findAvailableActors` no backend, que recebe user id).
- Resolução de `actorId` para o header: **localStorage → JWT userId → `waitForActorContext`**.

### `frontend/src/contexts/SessionProvider.tsx`

- Bootstrap: **FASE 2** = actors + seleção + `localStorage.setItem(ACTOR_STORAGE_KEY, …)`; **FASE 3** = `getProfile()`.
- Comentários atualizados para refletir a ordem correta.

## Validação

- `pnpm exec tsc --noEmit` (frontend): OK.

## Limitações

- Sistema **não** está “100% protegido” contra JWT sem `userId`/`sub` ou tenant inválido; nesses casos o header pode continuar ausente.
- Rotas RBAC que exigem `actor_id` de empresa continuam a depender do actor persistido após o bootstrap (fluxo normal).
