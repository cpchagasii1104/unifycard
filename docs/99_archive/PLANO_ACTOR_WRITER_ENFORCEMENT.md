# PLANO_ACTOR_WRITER_ENFORCEMENT

**Norma:** `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.8 — criação de `actors` em runtime via `backend/src/modules/identity/actor-writer.service.ts` (`ensureUserActor`, `ensurePageActor`). Implementação SQL: `backend/src/modules/social/actor.repository.ts`.

**Estado:** Sessões 1–4 concluídas. P2 (`actor.helpers` / `actor.utils`) fora deste plano.

---

## Sessão 1 — Mapeamento (read-only)

**Critério de grep:** chamadas `actorRepository.findOrCreateUserActor(` ou `actorRepository.findOrCreatePageActor(` em `backend/**/*.ts` (e `.tsx` se existir).

**Excluídos do inventário de “bypass” (não são violação de disciplina de chamada):**

| Ficheiro | Motivo |
|----------|--------|
| `backend/src/modules/identity/actor-writer.service.ts` | API canónica (`ensureUserActor` / `ensurePageActor`) |
| `backend/src/modules/social/actor.repository.ts` | Implementação persistida do writer |
| `backend/src/modules/social/adapters/actor-repository.adapter.ts` | Delegação `realRepository.findOrCreate*` |

### Inventário — ficheiros com bypass (22)

Ordem alfabética por caminho relativo à raiz do repo:

1. `backend/src/core/actors/actor.helpers.ts`
2. `backend/src/core/core.service.ts`
3. `backend/src/core/events/__tests__/event-economy.service.test.ts`
4. `backend/src/core/events/__tests__/event.service.test.ts`
5. `backend/src/core/reputation/trust.routes.ts`
6. `backend/src/core/unifybank/bank-http.routes.ts`
7. `backend/src/core/unifybank/bank-p2p-transfer.service.ts`
8. `backend/src/core/unifybank/donation.service.ts`
9. `backend/src/modules/bank/bank-integration.service.ts`
10. `backend/src/modules/events/events.service.ts`
11. `backend/src/modules/groups/groups.service.ts`
12. `backend/src/modules/marketplace/marketplace-categories.routes.ts`
13. `backend/src/modules/marketplace/store-onboarding.routes.ts`
14. `backend/src/modules/rides/shared/ride-authority.ts`
15. `backend/src/modules/services/services-discovery.service.ts`
16. `backend/src/modules/social/actor.utils.ts`
17. `backend/src/modules/social/social-2.0.routes.ts`
18. `backend/src/modules/social/social-2.0.service.ts`
19. `backend/src/scripts/seed-dev-actor.ts`
20. `backend/src/scripts/seed-dev-complete.ts`
21. `backend/src/scripts/seed-dev-groups.ts`
22. `backend/src/scripts/seed-minimal-social.ts`

### Testes de integração (fora de `src/`, mesmo critério de bypass)

23. `backend/tests/integration/actor-delegation.test.ts`
24. `backend/tests/integration/bank-ledger.test.ts`
25. `backend/tests/integration/events.routes.test.ts`

**Nota:** itens 23–25 são **testes**; Sessão 2 pode tratá-los à parte (mocks vs. writer real).

### Contagem de chamadas (linhas com `actorRepository.findOrCreateUserActor` / `Page`)

**Total de linhas encontradas pelo grep:** **44** (inclui testes e scripts listados acima).

**Por ficheiro (linhas):**

| Linhas | Ficheiro |
|--------|----------|
| 1 | `actor.helpers.ts` |
| 1 | `ride-authority.ts` |
| 2 | `events.service.ts` |
| 1 | `store-onboarding.routes.ts` |
| 1 | `groups.service.ts` |
| 1 | `core.service.ts` |
| 1 | `bank-p2p-transfer.service.ts` |
| 2 | `bank-http.routes.ts` |
| 4 | `social-2.0.service.ts` |
| 4 | `social-2.0.routes.ts` |
| 1 | `services-discovery.service.ts` |
| 1 | `donation.service.ts` |
| 2 | `seed-minimal-social.ts` |
| 1 | `seed-dev-complete.ts` |
| 6 | `bank-integration.service.ts` |
| 1 | `marketplace-categories.routes.ts` |
| 1 | `seed-dev-groups.ts` |
| 1 | `actor.utils.ts` |
| 2 | `trust.routes.ts` |
| 1 | `seed-dev-actor.ts` |
| 1 | `event.service.test.ts` |
| 1 | `event-economy.service.test.ts` |
| 5 | `actor-delegation.test.ts` |
| 1 | `bank-ledger.test.ts` |
| 1 | `events.routes.test.ts` |

*(Soma = 44.)*

### Divergência vs. número “38”

No estado actual do repositório, o grep acima produz **22 ficheiros** em `backend/src` + **3** em `backend/tests/integration` com bypass directo, e **44** linhas de chamada. O número **38** citado externamente **não coincide** com esta contagem — usar sempre este documento / re-grep como SSOT para Sessão 2.

---

## Sessão 2 — Corrigir acessos (Grupo A concluído)

**Regra:** só produto autorizado; **não** alterados: `actor.helpers.ts`, `actor.utils.ts`, `backend/src/scripts/**`, `**/__tests__/**`, `backend/tests/**`.

**Ficheiros migrados para `ensureUserActor` (import `@modules/identity/actor-writer.service`):**

| # | Ficheiro |
|---|----------|
| 1 | `backend/src/core/core.service.ts` |
| 2 | `backend/src/core/reputation/trust.routes.ts` |
| 3 | `backend/src/core/unifybank/bank-http.routes.ts` |
| 4 | `backend/src/core/unifybank/bank-p2p-transfer.service.ts` |
| 5 | `backend/src/core/unifybank/donation.service.ts` |
| 6 | `backend/src/modules/bank/bank-integration.service.ts` |
| 7 | `backend/src/modules/events/events.service.ts` |
| 8 | `backend/src/modules/groups/groups.service.ts` |
| 9 | `backend/src/modules/marketplace/marketplace-categories.routes.ts` |
| 10 | `backend/src/modules/marketplace/store-onboarding.routes.ts` |
| 11 | `backend/src/modules/rides/shared/ride-authority.ts` |
| 12 | `backend/src/modules/services/services-discovery.service.ts` |
| 13 | `backend/src/modules/social/social-2.0.routes.ts` |
| 14 | `backend/src/modules/social/social-2.0.service.ts` |

**Preservado:** `findById` / `findAvailableActors` via `actorRepository` onde já existia; `bank-integration.resolveBankAccountForServiceActor` mantém `import('@modules/social/actor.repository')` só para `findById`.

**`npx tsc --noEmit --project backend/tsconfig.json`:** continua a falhar por erros **externos** ao Grupo A; filtro por nomes dos ficheiros acima → **sem linhas** (sem novos erros nesses paths).

**Ainda com bypass (fora do escopo desta leva):** `actor.helpers.ts`, `actor.utils.ts`, scripts `seed-*`, testes, `actor.repository` / adapter / writer.

---

## Sessão 3 — Travar via CI (concluída)

**Gate:** `pnpm run validate:actor-writer-boundaries` (implementação: `backend/scripts/audit-actor-writer-boundaries.mjs`; wrapper POSIX: `backend/scripts/audit-actor-writer-boundaries.sh` → `exec node …mjs`).

**Allowlist** (mesma intenção que Sessão 2): `actor.repository.ts`, `actor-writer.service.ts`, `actor-repository.adapter.ts`, `backend/src/scripts/**`, `actor.helpers.ts`, `actor.utils.ts`, `__tests__` / `*.spec.ts` / `*.test.ts`, `ports-registry`.

**CI:** `.github/workflows/backend-ci.yml` — job `typecheck-and-arch`, passo após `validate:regression-guards`.

---

## Sessão 4 — Registar violação (concluída)

- **SSOT forense:** `docs/ssot/FALSIFICATION_LOG.md` — **Entrada #4** (2026-04-17).
- **Índice normativo:** `docs/01_normative/FALSIFICATION_LOG.md` (tabela espelho + ponte ao SSOT).

Novas ocorrências pós-gate: nova entrada append-only nos mesmos ficheiros (não editar retroativamente).
