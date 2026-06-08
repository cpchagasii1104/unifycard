# Execução — F-LIFESTYLE-AUTHORSHIP-GATE (DECISION-0113 fatia 5.3 / LGPD) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `9363670e`
**Decisor:** Clayton (3 travas obrigatórias + fail-closed do performer, confirmados antes de codar via envelope READ-FIRST) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar `DT-LIFESTYLE-CONSENT-AUTHORSHIP-UNBOUND`: lifestyle escrevia atributo **sensível (LGPD)** + **consentimento** + audit keyed no `actionContext.actorId` spoofável, com `performedByActorId` defaultado ao subject → forja de valor sensível, consentimento e autoria. Aplicar a autoria/autoridade da DECISION-0113, **sem alterar o conteúdo da DECISION-0071**.

## READ-FIRST (confirmado no código vivo)
- `lifestyle.routes.ts`: `requireContext` devolvia só `{tenantId, actorId}`; PUT/DELETE passavam `actorId` **duas vezes** (a 2ª = `performedByActorId`).
- `lifestyle.service.ts`: `resolveActorGuarded(tenantId, actorId)` **existence-only**; audit gravava `performedByActorId: performedByActorId ?? actorId` (subject como fallback de autoria); `getLifestyle` também só existence-only.
- Substrato em DEV: `actor_lifestyle_attributes` + `actor_lifestyle_attribute_audit` (migration `20260601170000`); dev 365.

## Decisão embutida (envelope → Clayton, antes de codar)
**Trava 2 no edge:** caller sem user-actor resolvível → **fail-closed 403**. Regra cravada: `performedByActorId` sempre derivado server-side do actor real do `req.user`; nunca `actionContext.actorId`; nunca o subject como fallback; sem performer real → sem mutação, sem consentimento, sem linha de audit.

## Implementação (backend; sem migration/Bank/frontend)
1. **`lifestyle.routes.ts`** — `requireContext` extrai `userId = req.user?.userId` (401 se ausente). Novo `resolvePerformerActorId(req)` resolve o actor real do caller via `socialPortsRegistry.getActorRepository().findByUserId(req.tenant.id, req.user.userId)` → **403 fail-closed** se vazio. PUT/DELETE passam `userId` (gate) + `performerActorId` real (autoria), substituindo o `actorId` duplicado.
2. **`lifestyle.service.ts`** — `resolveActorGuarded(tenantId, actorId, userId)` chama `canRepresentActor(tenantId, userId, actorId)` **ANTES** de `getActorIdentityCheck`/invariante (403 uniforme não-leak). `getLifestyle`/`declareAttribute`/`retireAttribute` recebem `userId`; `performedByActorId` virou **obrigatório** (sem `?? actorId`).
3. **`core/core.service.ts`** (1 call-site) — `getCompleteProfile` lê lifestyle; passa o próprio `userId` do subject ao novo gate (self-resolvido = behavior-preserving). Ver achado abaixo.

## As três travas
- **(1) `canRepresentActor` antes de tudo** — read/write/consent só com representabilidade provada; cobre a **leitura sensível** de graça.
- **(2) `performedByActorId` server-side** — autoria real do `req.user` (borda, `findByUserId`); 403 se irresolvível.
- **(3) leitura private-by-default** — já estrutural (visibility sempre private, sem parâmetro cross-actor); a Trava 1 a torna private-por-**autoridade**.

## Achado registrado (superfície de fatia 6 — NÃO consertado aqui)
`core.service.getCompleteProfile(tenantId, userId)` lê o lifestyle do `userId` e é chamado por **groups** (`groups.routes.ts:234`) e **social** (`social-2.0.service.ts:301`) com `userId` de **terceiro** → **leitura cross-user de dado sensível, PRÉ-EXISTENTE**. No call-site interno só há o `userId` do subject; passá-lo deixa o gate self-satisfeito (= comportamento idêntico ao anterior) **sem fingir proteção cross-user**. A exposição caller≠subject é **fatia 6**, registrada na DT-mãe.

## Prova
- **e2e novo** `validate-pipeline-e2e-lifestyle-authorship` **10/10**: ALLOW read dev · BLOCK read/declare/retire estranho→403 · **anti-forja** (audit não cresce após declare bloqueado = consentimento não-forjado; write-free) · non-leak inexistente→403 · estrutural (gate antes da existência; `performedBy` real via `findByUserId` sem `?? actorId`; routes threadam `userId`+`performerActorId`).
- **Backend tsc** fora de geo = **0**. **4 gates OK** (`critical_new=0`/`warning_new=1`=c3; dev **365**).
- **Sem regressão:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · professional-c1 16/16.

## O que NÃO foi tocado
Conteúdo de DECISION-0071 (valores permitidos / visibility / anonimização) · `canActAs`/`checkOwnership` · money latente · fixtures stale · F6 (ledger/wallet/location) · profile-C1/plan/identity (fechados) · Bank · migration · frontend · `docs/memorias/`/autorais.

## DTs
- `DT-LIFESTYLE-CONSENT-AUTHORSHIP-UNBOUND` → **CLOSED**. **Fatia 5 COMPLETA** (5.1+5.2+5.3).

## Próximo passo
**Fatia 6 — leitura cross-user**: `social-2.0 GET /ledger`, `identity GET /wallet-statement|/ledger|/configurations`, `me-active-location`, `impact-overview`, `pending-responsibilities` **+ `getCompleteProfile` (lifestyle/dado sensível)**. Só aí a DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` fecha.
