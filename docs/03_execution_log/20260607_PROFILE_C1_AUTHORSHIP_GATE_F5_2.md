# Execução — F-PROFILE-C1-AUTHORSHIP-GATE (DECISION-0113 fatia 5.2, canRepresentActor) — backend

**Data:** 2026-06-07 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `bc103e34`
**Decisor:** Clayton (gate `canRepresentActor` no `resolveActorGuarded`, não self-only) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar `DT-PROFILE-C1-EXISTENCE-ONLY-RESOLVER`: o resolver dos 3 módulos Profile-C1 (`professional`/`learning`/`interest`) era **existence-only** (provava que o actor existe, não que o `req.user` o representa). Provar `canRepresentActor(tenantId, req.user.userId, actorId) === true` **antes** de qualquer read/write actor-keyed.

## READ-FIRST (confirmado)
- Profile-C1 escreve/lê autodeclarações (bio + concepts) keyed em `req.actionContext.actorId` (spoofável). Gate único = `resolveActorGuarded` existence-only (`getActorIdentityCheck` + invariante `id===actor_id`). Nenhuma rota C1 usa os decorators RBAC.
- Profile-C1 é **actor-keyed** e pode legitimamente ser de **terceiro representável** (dono direto/empresa/grupo/delegação) → o gate certo é `canRepresentActor` (≠ self-only da F5.1, onde o sujeito era o próprio caller).
- `canRepresentActor` usa o `ActorRepository` via `socialPortsRegistry` → scripts standalone precisam bootstrapar os 5 social ports.

## Implementação (backend; 3 services + 3 routes; sem migration/Bank/frontend)
1. **`*-c1.routes.ts` (×3)** — `requireContext` passa a extrair `userId = req.user?.userId` (401 se ausente) e a devolver `{ tenantId, actorId, userId }`; os 5 (professional) / 4 (learning/interest) handlers threadam `userId` nas chamadas de service.
2. **`*-c1.service.ts` (×3)** — `resolveActorGuarded(tenantId, actorId, userId)` chama `authorizationService.canRepresentActor(tenantId, userId, actorId)` **ANTES** de `getActorIdentityCheck`/invariante; não-representável → `403` (fail-closed; erro no import/lookup também → 403). `userId` virou **parâmetro obrigatório** em todo método de service (`get*`/`declareConcept`/`updateConcept`/`retireConcept`) — o tsc força que nenhuma rota esqueça o gate. Invariante `id===actor_id` preservada como defesa em profundidade.

## Decisão de desenho
- **`canRepresentActor`, não self-only** — profile-C1 pode ser declarado por um actor que o caller representa (não é necessariamente o próprio user).
- **Param obrigatório, não opcional** — required threading converte o tsc no verificador de cobertura do gate.
- **Gate antes da existência ⇒ não-leak** — `canRepresentActor` é uniforme (false p/ actor inexistente E alheio) → **403 uniforme**, sem revelar a existência de actor de terceiro. (Antes: actor inexistente → 404.)

## Prova
- **e2e novo** `validate-pipeline-e2e-profile-c1-authorship` **16/16**: por módulo — ALLOW read (dev representa o próprio actor → ok) · BLOCK read (estranho → 403) · BLOCK mutation (`declareConcept` estranho → 403 **antes do repo**, sem escrita) · estrutural (`resolveActorGuarded(tenantId, actorId, userId)` + `canRepresentActor(tenantId, userId, actorId)` em cada service; `req.user?.userId` + `actorId: req.actionContext.actorId, userId` em cada routes) · non-leak (actor inexistente → 403).
- **Regressão** `validate-professional-c1-service` **16/16** — threading de `userId` nas 9 chamadas (select `user_id` no fixture), bootstrap dos social ports adicionado, T11 atualizado **404→403** (não-leak intencional, com comentário).
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`critical_new=0`/`warning_new=1`=c3 baseline; `bank-ledger`/`actor-writer` OK; dev **365**).
- **Sem regressão cruzada:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · vocab 7/7 · projection 4/4 · cnpj 6/6 · creator 9/9 · user-submit 19/19.
- **Ruído de ambiente (reportado, não mascarado):** `validate-pipeline-e2e-pj-company-status-lifecycle` **auto-aborta contra DEV** por design (`assertEphemeralDb` — "esta validação NUNCA toca DEV"). Não é regressão e o diff não toca `companies`/lifecycle nem profile-C1.

## O que NÃO foi tocado
Lifestyle (é F5.3, LGPD) · plan/identity-config (F5.1, selado) · `canActAs`/`checkOwnership` · Bank/`bank_*` · migration · frontend · repositories (só services+routes) · `docs/memorias/`/autorais · `CRIACAO_DE_EMPRESAS.md`/`criacao-de-empresa.png`/`fluxo-empresa.png`.

## DTs
- `DT-PROFILE-C1-EXISTENCE-ONLY-RESOLVER` → **CLOSED**.

## Próximo passo
`F5.3 — lifestyle` (LGPD, por último: `canRepresentActor` + `performedByActorId` server-side + leitura private-by-default; `DT-LIFESTYLE-CONSENT-AUTHORSHIP-UNBOUND`); depois fatia 6 (leitura cross-user) → fecha a DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`.
