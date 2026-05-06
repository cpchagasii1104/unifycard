# ActionContext — enforcement no apiFetch (anti-regressão)

**Data:** 2026-03-20  
**Objetivo:** evitar chamadas a rotas protegidas com token mas sem `actorId` (sem inferência, sem JWT como actor).

## Comportamento

- **Rotas isentas** (não exigem actor): `/auth/*`, `/health`, `GET /social/actors/available` (e variantes com query).
- **Demais rotas** com token: se após `waitForActorContext` não houver actor em `localStorage`, em **DEV** lança `Error` com mensagem explícita; em **PROD** faz `console.error` com log estruturado e **não** lança (UX).
- Log estruturado: `{ path, hasToken, hasActor }`.

## Ficheiro

- `frontend/src/api/client.ts` — `isPathExemptFromActorRequirement`, `enforceActorContextForProtectedRoute`, integração em `apiFetch`.

## Respostas ao checklist

1. **Bloqueia chamadas inválidas?** Em DEV sim (throw). Em PROD não bloqueia fetch; apenas log (conforme especificação).
2. **Exceções respeitadas?** Sim (`/auth/*`, `/health`, actors available).
3. **Risco de regressão eliminado?** Reduzido no cliente; regressão total exige também testes/CI e revisão de novas rotas públicas.
