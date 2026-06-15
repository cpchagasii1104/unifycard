# 2026-06-15 — ONDA DECISION-0131 · B1f (CANAL-1 actionContext.actorId — TRANSVERSAL AUTHORITY LOCK)

Pós-PASS Yala do C4 (commit `abb3dcb2`). B1f = transformar o que PDV/groups/reversal ensinaram numa **trava transversal**:
o `actionContext.actorId` (canal-1 da DECISION-0113) entra no guard 0113 `audit-actor-authority-boundary.mjs`. **ZERO
runtime change** — só guard + neg-proof + cartório. Parent `abb3dcb2` · branch `rescue-structural` · dev **385/385**.

## READ-FIRST (READ-ONLY) — blast radius

O guard 0113 já cobria: body.actor (6º canal), body.actorId, params.actorId, query.actorId, x-actor-id, metadata.serviceId,
authoritySource:system. **Faltava o canal-1: `actionContext.actorId`** (o `x-action-context` é declarado pelo cliente =
HINT, nunca autoridade — DECISION-0113). Medição de 1ª mão (55 `*.routes.ts` que usam actionContext.actorId):

| Grupo | N | Tratamento |
| --- | --- | --- |
| binding helper presente (canActAs/canRepresentActor/assertRepresents/…) | 22 | já cleared |
| safe-subject reader (Forma C/D/E: company/tenant capability + resolveForUser) | 6 | reconhecido (SAFE_SUBJECT_READERS) |
| Forma A (requirePermission([ vincula canal-1) | 1 | reconhecido (groups) |
| **RESÍDUO canal-1 sem binding** | **31** | **CONGELADO no BASELINE** |

## Por que o `requirePermission([` vincula o canal-1 (e só ele)

`requirePermission(actionContext.actorId)` → `authorityService.canPerformAction(actorId, …, {userId})` →
`canActAs(req.user, actionContext.actorId)`: liga req.user ao actor DECLARADO no canal-1. Logo é binding real do canal-1.
**NÃO** vincula body/params/query/x-actor-id (esses declaram um ator DIFERENTE do verificado). Por isso o clearing por
requirePermission só vale quando o ÚNICO canal do arquivo é `actionContext.actorId` (STRICT_CHANNELS → exige binding).

## Patch (só guard, ZERO runtime)

- **`scripts/audit-actor-authority-boundary.mjs`:** (1) `actionContext.actorId` adicionado a `CLIENT_ACTOR_CHANNELS`;
  (2) clearing canal-1 Forma A (`REQUIRE_PERMISSION_PREHANDLER` quando `onlyActionContext`); (3) **31 rotas** adicionadas
  ao `BASELINE` (notas `C1`/`C1_MONEY`); (4) novo contador `canal1_bound_by_requirePermission` no relatório.
- **`scripts/negative-proof-actor-authority-boundary.ps1`:** +2 fases B1f (canal-1 nova sem binding FALHA · canal-1 com
  requirePermission([ fica VERDE) + baseline assert 0→31 + canal1Recognized.
- **NÃO tocado:** nenhum `.ts` de runtime · as 31 rotas (debt PRÉ-EXISTENTE, NÃO corrigido) · identidade/RBAC/Bank/Core.

## Provas

- **Guard** `audit-actor-authority-boundary.mjs`: GATE OK — `flagged=31 baseline=31 new=0 safe_subject_recognized=6
  canal1_bound_by_requirePermission=1`.
- **Negative-proof** (estendido): canal-1 nova sem binding → FALHA; canal-1 com `requirePermission([` → VERDE (Forma A);
  6º canal body.actor → FALHA; subject==target spoof → FALHA; recognizer Formas A/B/C/D/E (aceita req.user, rejeita
  actionContext/params/query/subject==target); 31 resíduos congelados; **restauração limpa** (probes removidos).
- **Sem e2e:** frente é guard estrutural + neg-proof; nenhum runtime tocado.

| Prova | Resultado |
| --- | --- |
| audit-actor-authority-boundary guard | GATE OK (canal-1 incluído; 31 baseline; new=0) |
| negative-proof (estendido) | todas as fases verdes; restauração limpa |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards (chain) | rc=0 |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 (0 atribuível) |
| tsc | build **25** · strict **43** (INALTERADO — zero `.ts` tocado) |

## DT

- **DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE** (OPEN): 31 rotas canal-1 sem binding (debt PRÉ-EXISTENTE congelado);
  subconjunto money-adjacent = prioridade; convergência por subsistema (requirePermission/canRepresentActor), NÃO em massa;
  vínculo com a DT-mãe DECISION-0113 (5 canais).

## NÃO TOCADOS

Runtime (`.ts`) · as 31 rotas canal-1 · identidade/mapper/namespace · RBAC/FASE 6 · Bank/Core · migration/seed.
dev 385/385.

## Estado

B1f **IMPLEMENTED / HOLD PARA RESEAL**. O canal-1 `actionContext.actorId` entrou no guard transversal 0113: o princípio
"cliente declara intenção, servidor decide autoridade" agora cobre os **5 canais**; `requirePermission([` reconhecido como
binder do canal-1; os **31 resíduos PRÉ-EXISTENTES congelados** no baseline com DT; **nova rota canal-1 sem binding =
guard FALHA**. ZERO runtime; dev 385; baseline 0113 estrutural travado.
