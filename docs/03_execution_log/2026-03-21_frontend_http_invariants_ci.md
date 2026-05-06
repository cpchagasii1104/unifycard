# Frontend — invariantes HTTP + CI (PROMPT 6)

**Data:** 2026-03-21

## O que foi feito

1. **`apiFetchPublic`** em `frontend/src/api/client.ts` — único `fetch` além de `apiFetch` (rotas públicas / pré-sessão).
2. **Migração** de `fetch` direto para `apiFetch` ou `apiFetchPublic`: `auth.ts` (registo/login/cpf), `features.ts` (`/plan`), `backend-check.ts`, `webauthn.ts`, `PaymentLinkPage.tsx`.
3. **`error.errorCode`** propagado no JSON de erro de `apiFetch` (WebAuthn).
4. **Script** `scripts/check-frontend-no-direct-fetch.mjs` — falha se existir `fetch(` fora de `frontend/src/api/client.ts`.
5. **Testes** `frontend/tests/invariants/action-context-frontend.test.ts` + `frontend/vitest.config.ts`.
6. **CI** (`.github/workflows/ci.yml`): após typecheck do frontend, executa o script e `vitest` nos invariantes.
7. **Doc** `docs/06_technical/authority/APIFETCH_AND_ACTIONCONTEXT.md`.

## Comandos

- `node scripts/check-frontend-no-direct-fetch.mjs`
- `pnpm run test:invariants` (raiz) ou `cd frontend && npx vitest run tests/invariants`
