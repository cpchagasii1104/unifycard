# SQL snake_case — `findAvailableActors` e cadeia impact/reputation

**Data:** 2026-03-21

## Alterações

1. **`actor.repository.ts`** — `ORDER BY c.created_at DESC` (antes `c.createdAt`).
2. **`reputation.service.ts`** — `actor_reputation` e `impact_ledger`: colunas `created_at` / `updated_at` nas queries; `updated_at = NOW()` no upsert; mapeamento TS para `ActorReputation.createdAt` / `updatedAt` na fronteira do serviço.
3. **`impact.service.ts`** — `impact_ledger` / `impact_balances`: alinhamento a `created_at` / `updated_at` nas queries SQL.

## Pendência (varredura)

Ainda existem ficheiros no módulo social com `createdAt` em strings SQL (ex.: `social.repository.ts`, `social-2.0.service.ts`, `social-marketplace-ref.repository.ts`) — avaliar numa passagem dedicada.
