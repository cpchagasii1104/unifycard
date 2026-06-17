# 2026-06-17 — F-AUTHORITY-Z2-R1-GROUPS-HANDROLLED-BYPASS-CONTAINMENT (material, cirúrgico)

Contenção **localizada** de um bypass de autoridade em groups (DECISION-0113 / Z2): o gate hand-rolled
`requireGroupOwnerOrPermission` tratava o `actionContext.actorId` **declarado pelo cliente** como autoridade.
`actorId` do cliente é HINT, **nunca** authority. Sem refactor amplo de RBAC; sem migration; Bank/ledger/referral intocados.

## Anchor / Pré-flight

HEAD inicial `4aeebe7f` · branch `rescue-structural` · dev 394 · pending=[]. Sem sujeira material em
groups/authorization/rbac/action-context/availability/bank/ledger/migrations. Anchors `6e94916f`/`4aeebe7f` presentes.

## Causa-raiz (READ-FIRST)

`groups.routes.ts` `requireGroupOwnerOrPermission` (preHandler de groups:update/delete/read/member-mgmt) tinha
**3 vetores de spoof num único gate**, todos ancorados no actorId declarado:
1. `const isOwner = group.ownerActorId === req.actionContext.actorId;` — declarar o owner actor concedia owner-bypass.
2. `userIdForCheck = actor.user_id` resolvido de `findById(actionContext.actorId)` — a identidade do check de **admin**
   vinha do actor declarado.
3. o mesmo `userIdForCheck` (declarado) alimentava o **RBAC fallback** (`userHasAllPermissions`).

Norma: `AUTHORITY_LAW`/`08_AUTORIDADE` (autoridade rastreável ao usuário/CPF; actor declarado não prova) +
`DECISION-0113` (actorId declarado = HINT, autoridade = `canRepresentActor`).

## Correção (cirúrgica — só `groups.routes.ts`)

- `userIdForCheck = req.user.userId` (usuário **autenticado** server-side; 401 fail-closed se ausente) — substitui
  a derivação `actor.user_id` do actor declarado.
- `isOwner = await authorizationService.canRepresentActor(tenantId, userIdForCheck, group.ownerActorId)` — ownership
  = o usuário autenticado **representa** o owner actor (não "declara").
- admin (`isUserAdminOrOwner`) e RBAC fallback (`userHasAllPermissions`) passam a usar o `userIdForCheck` autenticado.
- `actionContext.actorId` permanece como HINT/contexto (logs `action: group_owner_bypass`), nunca como prova.
- **Comportamento legítimo preservado:** dono real (representação), admin real (membership), e holder de permissão
  RBAC real continuam autorizados; o fallback de permissão **não vira supergrant** (checa o usuário autenticado).

## Probe `unified-availability.routes.ts` (~1543/1547) — classificação PROVA

`if (ownerAuthorityActorId && req.actionContext.actorId === ownerAuthorityActorId) { allowed = await
canRepresentActor(req.tenant.id, userId, ownerAuthorityActorId); }` e o ramo self (`=== existing.actorId`):
o `===` é **seletor de ramo**; a autorização REAL é `canRepresentActor(usuário autenticado, targetActor)` na
linha seguinte, fail-closed. Declarar o actorId só roteia, nunca autoriza. **PROVA — já protegido.** Sem patch;
**F-AUTHORITY-Z2-R2 NÃO necessária.**

## E2E

`run-groups-owner-gate-ephemeral.ps1` → **6/6 verdes**:
- A1 ownership via `canRepresentActor(tenantId, userIdForCheck, group.ownerActorId)`.
- A2 `userIdForCheck = req.user.userId` (não `actor.user_id` do declarado).
- A3 bypass removido (nenhum `ownerActorId === actionContext.actorId`).
- B1 dono real: `canRepresentActor(A.userId, A.actor) === true` (autorizado).
- B2 spoof: `canRepresentActor(C.userId, A.actor) === false` (terceiro declarando o actor de A → 403).
- B3 declarar `actionContext.actorId` sozinho não autoriza (só representação server-side resolve).

## Guard + Negative-proof

Novo `scripts/audit-groups-no-actioncontext-owner-bypass.mjs` em `validate:regression-guards`: proíbe
`ownerActorId === actionContext.actorId` e `userIdForCheck = actor.user_id`; exige
`canRepresentActor(tenantId, userIdForCheck, group.ownerActorId)` + `userIdForCheck = req.user.userId`.
**Negative-proof:** reintroduzido `isOwner = group.ownerActorId === req.actionContext.actorId` → **GATE FAIL (exit 1)**
→ restaurado **byte-idêntico** → GATE OK.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
arch --strict **critical_new=0** (warning_new=4 pré-existente) · check:migrations OK (**sem migration**) ·
tsc **25** baseline (0 na frente).

## Escopo negativo

Sem migration; **zero refactor de RBAC** (só o gate de groups); Bank Core/ledger/`bank_splits`/payout/recovery/
referral/`canManageCompany`/dashboard/event-rfq/automation **intocados**. `unified-availability` **não editado** (PROVA).

## Estado

**🟡 IMPLEMENTED / HOLD YALA** (commit material 2026-06-17). dev 394. `DT-AUTHORITY-Z2-GROUPS-HANDROLLED-OWNER-BYPASS`
→ **IMPLEMENTED_AS_CONTAINED / HOLD YALA**. **DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` permanece OPEN**
(contenção localizada, não fechamento do arco DECISION-0113). **CLOSED só no seal pós-Yala PASS material.**
