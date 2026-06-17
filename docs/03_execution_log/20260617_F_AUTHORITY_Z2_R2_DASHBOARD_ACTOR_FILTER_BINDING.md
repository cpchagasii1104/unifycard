# 2026-06-17 — F-AUTHORITY-Z2-R2-DASHBOARD-ACTOR-FILTER-BINDING (material, cirúrgico)

Contenção **localizada** de vazamento cross-actor em dashboard (DECISION-0113 / Z2): `/overview`, `/today`,
`/month` aceitavam `query.actorId` como filtro de relatório **sem provar representação**, protegidos apenas por
`dashboard:view` (permissão de MÓDULO). Permissão de módulo **não** é autoridade sobre o actor filtrado.
Sem refactor amplo de RBAC; sem migration; Bank/ledger/referral/groups intocados.

## Anchor / Pré-flight

HEAD inicial `13f3ee2e` · branch `rescue-structural` · dev 394 · pending=[]. Anchors `6e94916f`/`4aeebe7f`/
`37eb5efa`/`13f3ee2e` presentes. Sem sujeira material em dashboard/authorization/rbac/action-context/groups/bank/ledger.

## Causa-raiz (READ-FIRST)

`dashboard.routes.ts`: `/sales` (linha ~187) já usava o helper canônico `resolveReportActorId` (DECISION-0113:
`query.actorId` é HINT → exige `canRepresentActor`; self via actionContext senão; 401/403/400 + null se negado).
MAS `/overview`, `/today`, `/month` faziam `if (query.actorId) { filters.actorId = query.actorId; }` **cru** —
filtro por actorId **declarado**, sob `requirePermission(['dashboard:view'])` apenas. A frente f6-5 havia
classificado essas 3 como "C intactas"; Z2-R2 reclassifica e **binda**.

Norma: `08_AUTORIDADE`/`AUTHORITY_LAW` (autoridade rastreável; declaração não prova) + `DECISION-0113`
(actorId declarado = HINT; autoridade = `canRepresentActor`).

## Correção (cirúrgica — só `dashboard.routes.ts`)

Os 3 handlers passam a gatear o caminho `query.actorId` pelo MESMO helper de `/sales` (preservando o self quando
não há `query.actorId`):
```
if (query.actorId) {
  const authorizedActorId = await resolveReportActorId(req, reply); // canRepresentActor(req.user.userId, target)
  if (authorizedActorId === null) return;                          // 401/403/400 já enviado
  filters.actorId = authorizedActorId;                             // actor AUTORIZADO, não o cru
}
```
- **Comportamento legítimo preservado:** usuário vê dashboard dos actors que representa; ausência de `query.actorId`
  segue o fallback self existente (sem filtro); spoof de actor alheio vira 403; `dashboard:view` permanece
  permissão de módulo (não vira supergrant sobre o actor alvo). `/sales` intocado.
- e2e `dashboard-reports-actorid-authority-f6-5.ts`: assertion B11 atualizada (overview/today/month agora gateados
  → `resolveReportActorId` chamado 4x em dashboard) + note descritiva.

## E2E

`run-dashboard-actor-filter-ephemeral.ps1` → **7/7 verdes**:
- A1 overview/today/month/sales gateiam `query.actorId` via `resolveReportActorId` (≥4 chamadas).
- A2 sem `filters.actorId = query.actorId` cru. A3 filtro = `filters.actorId = authorizedActorId`.
- A4 `resolveReportActorId` = `canRepresentActor(req.tenant.id, userId, target)` + `req.user.userId` + 403 fail-closed.
- B1 `canRepresentActor(A.userId, A.actor) === true` (filtra o próprio → autorizado).
- B2 `canRepresentActor(A.userId, B.actor) === false` (`query.actorId` = actor de B → 403 REPORT_ACTOR_NOT_REPRESENTABLE).
- B3 `dashboard:view` sozinho não autoriza actor alheio.

`dashboard-reports-actorid-authority-f6-5.ts` → **15/15 verdes** (read-only static; B11 reflete Z2-R2; sem regressão).

## Guard + Negative-proof

Novo `scripts/audit-dashboard-actor-filter-requires-representation.mjs` em `validate:regression-guards`:
proíbe `filters.actorId = query.actorId`; exige `resolveReportActorId`, `filters.actorId = authorizedActorId`,
e ≥4 chamadas do helper (overview/today/month/sales). **Negative-proof:** reintroduzido
`filters.actorId = query.actorId` em `/today` → **GATE FAIL (exit 1)** → restaurado **byte-idêntico** → GATE OK.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
arch --strict **critical_new=0** (warning_new=4 pré-existente) · check:migrations OK (**sem migration**) ·
tsc **25** baseline (0 na frente).

## Escopo negativo

Sem migration; **zero refactor de RBAC** (só os 3 handlers de dashboard); Bank Core/ledger/`bank_splits`/payout/
recovery/referral/groups/event-rfq/automation **intocados**. `/sales` não editado (já gateado). `reports.routes.ts`
não editado (rotas "C" remanescentes = resíduo da DT-mãe).

## Warnings não-bloqueantes (reseal Yala = PASS_WITH_WARNINGS)

- **W1** — negative-proof narrada neste log, sem `.ps1` reproduzível commitado → melhoria futura de Evidence Pack / guard reproducibility.
- **W2** — guard `audit-dashboard-actor-filter-requires-representation` hardcoded em `dashboard.routes.ts`; **não cobre** `reports.routes.ts` (intencional nesta frente; resíduo p/ guard Z2 cross-module futuro).
- **W3** — regex do guard não pega variações como `filters.actorId = (query.actorId)` ou bracket notation → robustez futura.

## Resíduo vivo — próxima contenção (NÃO corrigido neste seal)

- **`F-AUTHORITY-Z2-R3-REPORTS-ACTOR-FILTER-BINDING`** — candidato natural próximo. `reports.routes.ts` ainda
  contém actor filter cru em rotas operacionais: `/inventory/suggestions` e `/inventory/holding-costs`
  (`options.actorId = query.actorId`), protegidas apenas por `reports:view_operational`. **NÃO bloqueia o
  fechamento de R2 dashboard; bloqueia o fechamento da DT-mãe** `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`.
  Deve virar a próxima contenção R3. `reports.routes.ts` **não foi tocado** nesta frente nem neste seal.

## Estado

**✅ CLOSED / YALA PASS MATERIAL** (seal docs-only 2026-06-17 sobre commit material `fb73cd95`; reseal Yala
material READ-ONLY = PASS_WITH_WARNINGS). dev 394. `DT-AUTHORITY-Z2-DASHBOARD-ACTOR-FILTER-UNBOUND` → **CLOSED /
YALA PASS MATERIAL**. **Esta frente fechou somente a contenção localizada de dashboard actor filter binding. Não
fecha Z2 inteiro, Z1, Z3, authority global nem a DT-mãe 0113** — `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`
**permanece OPEN**. Nenhum código material alterado no seal.
