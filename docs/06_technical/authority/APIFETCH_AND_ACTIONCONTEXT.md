# apiFetch, ActionContext e invariantes no repositório

## Regras

1. **Toda chamada HTTP ao backend** deve passar por `frontend/src/api/client.ts`:
   - **`apiFetch`** — sessão autenticada: `x-tenant-id`, `Authorization`, e `x-action-context` quando existir actor em `localStorage` (ver enforcement em DEV/PROD no próprio cliente).
   - **`apiFetchPublic`** — rotas públicas ou pré-sessão (registo, login, health, links de pagamento guest): sem exigência de tenant nem ActionContext.

2. **ActionContext é responsabilidade do cliente** — o backend não deve inferir actor a partir de JWT para rotas protegidas; o cliente envia `x-action-context` apenas quando `unificard_active_actor_id` está definido (exceto rotas isentas).

3. **`fetch(` direto** em `frontend/src` **não é permitido** fora de `api/client.ts`. O script `scripts/check-frontend-no-direct-fetch.mjs` falha no CI se isso for violado.

## Testes

- `frontend/tests/invariants/action-context-frontend.test.ts` — invariantes mínimas (header `x-action-context` com actor; isenções de rota).
- Comandos: `pnpm run test:invariants` (na raiz) ou `pnpm --filter unificard-frontend exec vitest run tests/invariants`.

## CI

O job **Validate Frontend** executa `validate:frontend-fetch-invariant` e `test:invariants` após o typecheck.
