# 2026-06-13 — F-0113-AUTHORITY-FACADE-BOUNDARY-SEAL

Selar a fronteira da DECISION-0113 após os achados A/B/C/D + P0 dispute reversal.
Frente docs-only + guard estrutural — **zero runtime de negócio, zero Bank, zero migration,
zero schema**. Parent `48da5536` · branch `rescue-structural` · dev 378/378.

## READ-FIRST

`authorization.service.ts` (façade: `canActAs` resolvedor + `canRepresentActor`
representabilidade + `AuthoritySource = ownership|delegation|system`); `audit-actor-writer-
boundaries.mjs` (guard existente — só findOrCreate); `validate:regression-guards`; survey de
`*.routes.ts` por canais client-declared (`body.actor`/`actorId`/`params.actorId`/`query.actorId`/
`x-actor-id`/`authoritySource:'system'`/`metadata.serviceId`); DECISION-0113 doc + DT log.

## body.actor incorporado à regra 0113 (6º canal)

ADENDO na DECISION-0113: além dos 5 canais clássicos (actionContext.actorId, x-actor-id,
query.actor_id, params.actorId, params.id de recurso privado), registrado o **6º canal** =
qualquer objeto de ator no BODY (`body.actor` / `body.actor.actorId` / `body.actor.kind` /
`authoritySource` do body / `actor.kind` do body). Regra: HINT, nunca autoridade; binding
server-side por `authorityService.canPerformAction`/`canActAs`/`canRepresentActor` ou caller
sistêmico real. `authoritySource:'system'` não é disparável por rota HTTP humana.

Hierarquia consolidada (não reescreve norma): authority.service (porta) → canActAs (resolvedor)
→ canRepresentActor (representabilidade) → company_users (SSOT PJ); RBAC V2 NÃO soberano
(FASE 6/dormente-divergente); CNAE = evidência fiscal, não autorização.

## Guard criado

`backend/scripts/audit-actor-authority-boundary.mjs` — varre `*.routes.ts`, detecta canal
client-declared sem helper de binding no arquivo, compara contra BASELINE EXPLÍCITO (11
arquivos com DT), **FALHA em rota NOVA** fora do baseline. Heurística file-level (cerca de
regressão, não prova de correção). Integrado em `validate:regression-guards` + alias
`validate:actor-authority-boundary`. Prova negativa `negative-proof-actor-authority-boundary.ps1`
(injeta `body.actor` sem binding → FALHA → remove → verde).

## Baseline explícito (11 arquivos, congelados — cada um com DT)

- **6º canal (body.actor):** `reconciliation-dispute.routes.ts` (/reversal P0 CONTIDO 403; irmãs
  → DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY P1) · `event.routes.ts` (body.actor_id/actor_type →
  DT-0113-EVENT-ACTOR-BODY-BINDING P1).
- **canais clássicos (params/query) readers/filtros → DT-0113-CLASSIC-CHANNEL-READERS:**
  public-profile · business-audit · bank-http · risk-dashboard · policy-engine · payout · trust ·
  marketplace-categories · reporting.

## DTs

- `DT-0113-AUTHORITY-CLIENT-DECLARED-ACTOR-BOUNDARY`: **OPEN / BASELINE SELADO** (6º canal
  registrado; guard de regressão; baseline congelado).
- `DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY` (P1) e `DT-0113-EVENT-ACTOR-BODY-BINDING` (P1) /
  `DT-0113-CLASSIC-CHANNEL-READERS`: resíduos de runtime para frentes próprias.

## Provas de invariância

- **RBAC V2 não promovido:** guard PROÍBE `requireRole`/`requirePermission` como solução; binding
  exigido é `canActAs`/`canRepresentActor`/`canPerformAction`. RBAC V2 documentado como NÃO
  soberano. Nenhum `actor_roles` criado.
- **company_users** permanece SSOT material PJ (citado na hierarquia; não alterado).
- **P0 reversal containment intacto:** `reconciliation-dispute.routes.ts` segue com o 403
  `DISPUTE_REVERSAL_HTTP_DISABLED` como primeira instrução (não tocado).
- **Bank/reversal/PJ/CNAE não tocados:** `reversal.service.ts` sem alteração (git limpo);
  zero Bank; zero migration; zero schema.

## Gates / tsc

- validate:actor-writer-boundaries OK · validate:bank-ledger-boundaries OK ·
  validate:regression-guards EXIT 0 (inclui actor-authority-boundary 11/11 new=0) ·
  arch --strict critical_new=0 (4 warnings pré-existentes).
- tsc backend **25 (baseline arco 0113)**, zero novo (nenhum `.ts` de runtime tocado).
- git diff --check (arquivos da frente) 0 · migration count inalterado (378).

## Estado

- F-0113-AUTHORITY-FACADE-BOUNDARY-SEAL: **IMPLEMENTED / HOLD PARA RESEAL**.
- Próxima frente recomendada: **dispute body.actor P1** (rotas irmãs from-discrepancy/
  to-review/resolve — binding por `req.user`/representabilidade), depois booking→order.
- NÃO seguir para dispute P1 / booking / PJ-cargos-grants nesta frente.
