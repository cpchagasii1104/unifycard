# Execução — F-PLAN-IDENTITY-CONFIG-AUTHORSHIP-GATE-F5_1 (DECISION-0113 fatia 5.1, self-only) — backend

**Data:** 2026-06-07 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `0e649e46`
**Decisor:** Clayton (abordagem self-only confirmada antes de codar) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar `DT-PLAN-PUT-PRIVILEGE-SPOOF` + `DT-IDENTITY-CONFIG-ACTOR-SPOOF`: `PUT /plan` e `PUT /identity/configurations` devem derivar o sujeito de `req.user`, não do `actionContext.actorId` declarado.

## READ-FIRST (confirmado)
- `req.user` = `{ userId, id (alias de userId), globalUserId? }` (`types/fastify.d.ts`). `actors.user_id = req.user.userId`; `resolveGlobalUserId(userId)` → `WHERE id=userId`.
- `plan PUT`: resolvia `is_test`/`role`/`user_id` de `actors WHERE actor_id = actionContext.actorId` e dava `UPDATE users.plan` no user do actor declarado → **duplo-spoof** (privilégio E sujeito do actor declarado).
- `identity-config PUT`: resolvia o `globalUserId` (em dobro) via `findById(actionContext.actorId) → user_id → resolveGlobalUserId` → escrevia `userType` no user declarado.
- Ambas são **self** (o caller age sobre o próprio user) → **self-only**, NÃO `canRepresentActor` (não é agir-como-outro). Padrão de referência: `POST /confirm-first-access` (usa `req.user.id`).

## Implementação (backend, 2 rotas; sem migration/service-logic)
1. **`plan.routes.ts`** — `actorId` deixa de vir de `req.actionContext.actorId`; passa a ser o actor do caller: `findByUserId(req.tenant.id, req.user.userId).actor_id` (via `socialPortsRegistry`); sem actor → 403. A query de privilégio + o `UPDATE users.plan` (existentes, inalterados) operam sobre o caller. Presence-check de actionContext mantido (V2, inerte para autoridade).
2. **`identity.routes.ts` `/configurations`** — sujeito resolvido de `req.user`: `callerGlobalUserId = req.user.globalUserId ?? resolveGlobalUserId(req.user.userId, tenant)`; `getGlobalIdentity`/`updateGlobalIdentity` sobre ele. **Removida** a dupla resolução spoofável `findById(actionContext.actorId)`.

## Decisão de desenho (confirmada por Clayton)
**self-only**, não `canRepresentActor` — plano e `userType` são **per-user** (entitlement/identidade do próprio caller). `canRepresentActor` é para representar **outro** actor (será o padrão da F5.2 profile-C1).

## Prova
- **e2e** `validate-pipeline-e2e-pj-plan-identity-config-authorship` **9/9**: A1 `findByUserId(req.user.userId)`→actor do dev · A2 `resolveGlobalUserId(req.user.userId)`→global do dev · A3 contraste (page-actor alheio ≠ actor do caller → spoof neutralizado) · B1 plan estrutural (actorId de `findByUserId(req.user.userId)`, não de `actionContext.actorId`) · B2 identity estrutural (callerGlobalUserId de `req.user`; `findById(actionContext.actorId)` removido) · B3 nenhum handler usa `actionContext.actorId` como sujeito.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`critical_new=0`). **dev 365**.
- **Sem regressão:** creator 9/9 · rbac 13/13 · escalation 16/16 · money 12/12 · vocab 7/7 · projection 4/4 · cnpj 6/6 · lifecycle 7/7 · user-submit 19/19.

## O que NÃO foi tocado
Services de plan/identity (lógica intocada; sujeito resolvido na borda) · `canActAs`/`checkOwnership` · profile-C1/lifestyle (próximas fatias) · Bank · migration · frontend · middleware central · `docs/memorias/`/autorais.

## DTs
- `DT-PLAN-PUT-PRIVILEGE-SPOOF` → **CLOSED** · `DT-IDENTITY-CONFIG-ACTOR-SPOOF` → **CLOSED**.

## Próximo passo
`F5.2 — profile-C1` (gate `canRepresentActor` no `resolveActorGuarded` — `DT-PROFILE-C1-EXISTENCE-ONLY-RESOLVER`); depois `F5.3 — lifestyle` (LGPD, por último); depois fatia 6 (leitura cross-user) → fecha a DT-mãe.
