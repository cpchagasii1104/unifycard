# Execução — F-MONEY-LIVE-AUTHORSHIP-GATE-F3_1 (DECISION-0113 fatia 3/6 — money LIVE)

**Data:** 2026-06-07 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `f92f7ff1`
**Decisor:** Clayton · **Esteira:** eu (escritora); par verifica.

## Objetivo
Gatear, com autoria/autoridade derivada de `req.user`, as **3 únicas rotas money vivas** confirmadas pelo `F-MONEY-LIVE-AUTHORSHIP-MAP` — sem tocar Proxies latentes, Bank, AP/AR, Fundo Regional ou migration.

## READ-FIRST + respostas ao pré-edit
- As 3 rotas **não tocam `bank_*`** (confirmado grep). Demais services marketplace seguem Proxy dead ("migrated to Bank").
- **event-settlement settle** (`event-settlement.routes.ts`) → `markAsSettled` em `event_settlements`. Autoridade = **organizer do evento = `events.actor_id`** (link canônico usado por `checkOwnership('events')`). **Modelo materialmente claro → SEM STOP.**
- **payment-method create** (`payment-method.routes.ts`) → dono = `CreatePaymentMethodInput.actorId` (body). `createMethod` chama `unsetDefaultForActor(input.actorId)` (side-effect cross-actor).
- **unifycard-method create** (`unifycard-method.routes.ts`) → config de adquirência tenant (fees/settlement_days) = **tenant/admin-level**.

## Implementação (backend, só 3 arquivos de rota; sem service-logic/migration/Bank)
1. **event-settlement** — gate antes de `settleEvent`: `req.user.id` (401 se ausente) → resolve `events.actor_id` (403 se sem organizer) → `canRepresentActor(tenantId, req.user.id, organizerActorId)` (403 se não). Autoria passada ao service = `(organizerActorId, req.user.id)` — **não** o `actionContext.actorId` cru. `canRepresentActor` envolto fail-closed.
2. **payment-method** — gate antes de `createMethod` (logo antes do `unsetDefaultForActor`): `req.user.id` (401) → `ownerActorId = req.body.actorId` (400 se ausente) → `canRepresentActor(req.user.id, ownerActorId)` (403). Autoria = `(ownerActorId, req.user.id)`.
3. **unifycard-method** — `preHandler: [fastify.requireRole(['admin'])]` no POST (gate admin canônico; `requireRole` já binda `req.user` via `canRepresentActor` desde a fatia 1).

## Prova
- **e2e** `validate-pipeline-e2e-money-live-authorship-f3-1` **12/12**: A1/A2 payment-method `canRepresentActor` dono→true/estranho→false · A3/A4 event-organizer (page-actor) dono→true/estranho→false · B1 event-settlement resolve `events.actor_id`+gate antes de `settleEvent` + autoria `(organizerActorId, userId)` · B2 payment-method gate antes de `createMethod` + autoria `(ownerActorId, userId)` · B3 unifycard-method `preHandler requireRole(['admin'])` · C1 zero `bank_*` nas 3 rotas · C2 Proxies latentes seguem dead.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`bank-ledger` verde = nenhum SQL `bank_*` novo; `arch --strict` `critical_new=0`). **dev 365**.
- **Regressões:** fatia 1 `rbac-actor-binding` **13/13**, fatia 2 `authority-escalation-gate` **16/16**; DEV-safe PJ: admin-review 13/13, release-gate 10/10, vocab 7/7, projection 4/4, cnpj 6/6, lifecycle 7/7, user-submit 19/19.
- **Suite financeira (reportada, não-regressão):** `verify:simple-tx-double-entry` falha `reserve missing` (DEV não tem system account `reserve` seeded; bank tables = 0 em DEV); `test:financial-integrity:ci`/`test:financial-db-structural:ci` dão "No tests found" (patterns jest stale). **Mecanismo de exoneração:** o diff (3 rotas marketplace) **não está no grafo** desses testes (usam `bankAccountService`/jest), e o gate `bank-ledger` está verde → **artefato de ambiente, não divergência de double-entry** (as 3 rotas não escrevem em `bank_ledger`).

## O que NÃO foi tocado
Services de event-settlement/payment-method/unifycard-method (lógica intocada; autoria feita na borda) · **nenhum Proxy religado** · unifycard txn/settlement/region/AP-AR/payment-split/payout (latentes) · Fundo Regional · Bank/`bank_*` · middleware central · company-members/organization · KYB/fiscal/lifecycle · migration · frontend · `docs/memorias/`/autorais.

## DTs
- `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` → **fatia 3/6 (F3.1) DONE**, OPEN (fatias 4–6).
- `DT-MONEY-LATENT-REACTIVATION-TRAP` / `DT-REGION-FUND-DELEGATION-MODEL-PENDING` / `DT-AP-AR-FINANCE-AUTHORITY-MODEL-PENDING` → seguem OPEN (DECISION-0114).

## Próximo passo
Fatia 4/6 — money LATENTE (re-activation guard, não código de gate; region/AP-AR atrás de `DECISION-0114`) **ou** fatia 5 (plan/identity-config/profile-C1/lifestyle). Depois leitura cross-user.
