# 2026-06-17 — F-AUTHORITY-Z2-R3-REPORTS-ACTOR-FILTER-BINDING (material, cirúrgico)

Contenção **localizada** de vazamento cross-actor em reports (DECISION-0113 / Z2): rotas operacionais
aceitavam `query.actorId` como filtro **sem provar representação**, protegidas só por `reports:view_operational`
(permissão de MÓDULO). Permissão de módulo **não** é autoridade sobre o actor filtrado. Sem refactor amplo de
RBAC; sem migration; Bank/ledger/referral/groups/dashboard intocados.

## Anchor / Pré-flight

HEAD inicial `24a45196` · branch `rescue-structural` · dev 394 · pending=[]. Anchors `6e94916f`/`4aeebe7f`/
`37eb5efa`/`13f3ee2e`/`fb73cd95`/`24a45196` presentes. Sem sujeira material em reports/dashboard/authorization/
rbac/action-context/groups/bank/ledger.

## Causa-raiz (READ-FIRST)

`reports.routes.ts` já tinha o helper canônico `resolveReportActorId` (DECISION-0113: `query.actorId` é HINT →
`canRepresentActor`; self via actionContext senão; 401/403/400 + null), usado por **5 rotas** (financial +
margin×3 + pricing). MAS 3 rotas operacionais ficaram cruas:
- `/inventory/suggestions` e `/inventory/holding-costs`: `if (query.actorId) { options.actorId = query.actorId; }`.
- `/reports/sales`: `if (query.actorId) { filters.actorId = query.actorId; }`.
sob `requirePermission(['reports:view_operational'])` apenas — Yala (R2) sinalizou as 2 de inventory.

Norma: `08_AUTORIDADE`/`AUTHORITY_LAW` (autoridade rastreável; declaração não prova) + `DECISION-0113`.

## Correção (cirúrgica — só `reports.routes.ts`)

As 3 rotas passam a usar o helper já vivo, no MESMO padrão das 5 já gateadas no arquivo (incondicional —
self-ou-representado, nunca tenant-wide silencioso):
```
const authorizedActorId = await resolveReportActorId(req, reply); // canRepresentActor(req.user.userId, target)
if (authorizedActorId === null) return;                           // 401/403/400 já enviado
options.actorId = authorizedActorId;   // (filters.actorId em /reports/sales)
```
- **Denominador completo:** além das 2 rotas nomeadas (suggestions/holding-costs), `/reports/sales` (mesma classe,
  mesmo arquivo, mesmo helper) também foi bindado — fecha o resíduo de reports actor-filter por inteiro (não deixa R4).
- **Comportamento legítimo preservado:** usuário vê reports dos actors que representa; sem `query.actorId` → self
  (consistente com as 5 já gateadas, e fecha o buraco tenant-wide-quando-sem-actorId); spoof de actor alheio → 403;
  `reports:view_operational` permanece permissão de módulo (não vira supergrant sobre o actor alvo).
- `resolveReportActorId` em reports passa de 5 → **8** chamadas; **0** actor-filter cru.
- e2e `dashboard-reports-actorid-authority-f6-5.ts`: B9 (5→8), B10 (2 cru → 0; agora gateados), note atualizada.

## E2E

`run-reports-actor-filter-ephemeral.ps1` → **7/7 verdes**:
- A1 reports gateados via `resolveReportActorId` (≥8). A2 sem `options.actorId`/`filters.actorId = query.actorId` cru.
- A3 filtro = `*.actorId = authorizedActorId`. A4 helper = `canRepresentActor(req.tenant.id, userId, target)` +
  `req.user.userId` + 403 `REPORT_ACTOR_NOT_REPRESENTABLE` fail-closed.
- B1 `canRepresentActor(A.userId, A.actor) === true`. B2 `canRepresentActor(A.userId, B.actor) === false` (query.actorId
  = actor de B → 403). B3 `reports:view_operational` sozinho não autoriza actor alheio.

`dashboard-reports-actorid-authority-f6-5.ts` → **15/15 verdes** (read-only static; B9=8x, B10=0 cru; R2 dashboard sem regressão).

## Guard + Negative-proof

Novo `scripts/audit-reports-actor-filter-requires-representation.mjs` em `validate:regression-guards`:
proíbe `options.actorId = query.actorId` e `filters.actorId = query.actorId`; exige `resolveReportActorId`,
`*.actorId = authorizedActorId`, e ≥8 chamadas do helper. **Negative-proof:** reintroduzido
`options.actorId = query.actorId` em `/inventory/suggestions` → **GATE FAIL (exit 1)** → restaurado **byte-idêntico** → GATE OK.

## Gates

actor-writer-boundaries OK · bank-ledger-boundaries OK · regression-guards OK (+ guard novo) ·
arch --strict **critical_new=0** (warning_new=4 pré-existente) · check:migrations OK (**sem migration**) ·
tsc **25** baseline (0 na frente).

## Escopo negativo

Sem migration; **zero refactor de RBAC** (só as 3 rotas de reports); Bank Core/ledger/`bank_splits`/payout/recovery/
referral/groups/dashboard/event-rfq/automation **intocados**. As 5 rotas já gateadas de reports não foram alteradas.

## Estado

**🟡 IMPLEMENTED / HOLD YALA** (commit material 2026-06-17). dev 394. `DT-AUTHORITY-Z2-REPORTS-ACTOR-FILTER-UNBOUND`
→ **IMPLEMENTED_AS_CONTAINED / HOLD YALA**. **Esta frente fechou somente a contenção localizada de reports actor
filter binding. Não fecha Z2 inteiro, Z1, Z3, authority global nem a DT-mãe 0113** — `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`
**permanece OPEN**. R1 groups e R2 dashboard **não reabertos**. **CLOSED só no seal pós-Yala PASS material.**
