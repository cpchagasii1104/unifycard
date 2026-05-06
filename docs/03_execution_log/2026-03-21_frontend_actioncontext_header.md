# Frontend: header `x-action-context` centralizado em `apiFetch`

**Modo:** EXECUTOR

## Alterações

- **`frontend/src/api/client.ts`**
  - Após validar `tenantId` e definir `x-tenant-id`, se existirem `localStorage['unificard_active_actor_id']` (trim não vazio) e tenant válido, define `x-action-context` com JSON `{ actorId, intent: "user_action", source: "frontend", scope: "tenant:<tenantId>" }`.
  - Não sobrescreve se o chamador já enviou `x-action-context` nos headers.
  - Remove envio de `x-acting-actor-id` e `x-actor-id` (delete após merge + não adicionar mais).
- **`frontend/src/api/events-v2.ts`**: comentário alinhado ao novo contrato (apenas doc).

## Backend

Não alterado.

## Validação automática

- `pnpm exec tsc --noEmit` no pacote `frontend`: OK.

## Validação manual sugerida

Com sessão autenticada e `unificard_active_actor_id` preenchido: `PUT /profile` não deve retornar `ActionContext is required`; inspecionar rede → header `x-action-context` presente.

## Nota operacional

Se o actor ainda não estiver no `localStorage` no momento da primeira chamada protegida, o header não é enviado (comportamento conservador no cliente); garantir bootstrap que persiste o actor ativo antes de rotas que exigem ActionContext.
