# 2026-06-19 — R8N AUTOMATION + HUMAN-MVP GHOST/PRODUCT CONTAINMENT (cirúrgico)

Containment dos 2 itens C_CONTAIN ghost do baseline canal-1 (DECISION-0113 / Z2): **automation** e **human-mvp**,
ambos provados SCHEMA-GHOST (dead-at-db). **NÃO é financeira, NÃO toca Bank/Core/ledger, NÃO decide produto G10,
NÃO cria migration.**

## Anchor / Pré-flight

HEAD inicial `cc768433` · branch `rescue-structural` · dev 394 · migrations 394/394 · actor-writer/bank-ledger
boundaries OK · working tree material limpo. Parent canal-1 OPEN baseline 5; DT-mãe 0113 OPEN.

## READ-FIRST — prova material (verificação em dev + worker/frontend)

**Tabelas (to_regclass em unificard_dev) — TODAS GHOST(null):** `alerts`, `scheduled_actions` (automation);
`human_mvp_skills`, `human_mvp_service_offers`, `human_mvp_opportunities`, `human_mvp_event_instances`,
`human_mvp_activity_executions`, `skills`, `service_offers`, `opportunities` (human-mvp). → ambos os módulos são
**dead-at-db**.

**automation** (`automation.routes.ts`): GET alerts(×3)/schedule(×2) = reads (ghost). POST /alerts + PATCH
/alerts/:id/status liam `actionContext.actorId` SÓ p/ breadcrumb de auditoria. POST /schedule + POST
/schedule/:id/cancel passavam `actionContext.actorId` como authorship (canal-1). `executeDueActions` (worker) tem
**ZERO caller vivo** fora da rota run-due (já contida 403 AUTOMATION_RUN_DUE_HTTP_DISABLED, guard R18) → conter as
rotas NÃO quebra worker. `bank_refs`=NONE.

**human-mvp** (`human-mvp.routes.ts`): 5 POST (skills/service-offers/opportunities/event-instances/
activity-executions). Só `/skills` lia `actionContext.actorId` (resolve actor→globalUserId). Registrado sob `/n`,
**SEM frontend caller** (grep frontend vazio) + todas as tabelas ghost → **NÃO é a vertical G10 viva** (protótipo
morto). `bank_refs`=NONE.

## Classificação + Decisão por item

- **automation → C_GHOST_CONTAIN** (STOP_AUTOMATION_SIDE_EFFECT_SCOPE NÃO acionado: executeDueActions sem caller
  vivo; service intocado). As 9 rotas de dados → **501 `AUTOMATION_SCHEMA_GHOST_CONTAINED`** antes de service/sink;
  imports de service removidos; `POST /schedule/run-due` PRESERVA 403 AUTOMATION_RUN_DUE_HTTP_DISABLED (guard R18).
- **human-mvp → C_GHOST_CONTAIN** (STOP_HUMAN_MVP_PRODUCT_DECISION_REQUIRED NÃO acionado: tabelas ghost + sem
  frontend → não é G10 vivo). As 5 rotas POST → **501 `HUMAN_MVP_SCHEMA_GHOST_CONTAINED`** antes de service/sink;
  imports de service removidos.

Nenhum STOP acionado (sem money path, sem worker vivo, sem produto G10 vivo, owner não relevante p/ ghost).

## Baseline canal-1 — 5 → 3

- **automation REMOVIDO** + **human-mvp REMOVIDO** (canal-1 sumiu dos arquivos; guard dedicado).
- Detector: **flagged 3 · baseline 3 · new=0 · stale 0** (safe_subject 7 · service_bound 4 · self_bound 1 ·
  not_authority 1). GATE OK. Restantes: services-discovery [PARTIAL], unifycard-method [M5 money], organizers [PARTIAL].

## Prova material — guard + negative-proof + E2E

- E2E DB-free `validate-pipeline-e2e-automation-human-mvp-ghost.ts` → **20/20**: 9 rotas automation → 501; run-due
  → 403 (gate preservado); 5 rotas human-mvp → 501; spoof actionContext → ainda 501; guards (ghost-containment +
  internal-surfaces R18) + baseline verdes. (Rotas contidas não importam service → registro DB-free.)
- Guard `audit-automation-human-mvp-ghost-containment.mjs` (wired): exige 501 nas rotas + run-due 403; PROÍBE
  alertService/scheduledActionService/executeDueActions/auditService/humanMvp*Service + actionContext.actorId +
  bank_*.
- **Negative-proof versionado** `negative-proof-automation-human-mvp-ghost-containment.ps1` (ASCII/sem-BOM, pwsh 7
  + WPS 5.1): (1) reintroduzir alertService numa rota automation → GATE FAIL; (2) reintroduzir humanMvpSkillService
  numa rota human-mvp → GATE FAIL; cada um restaura byte-idêntico + git inalterado.

## Gates

actor-writer-boundaries OK · **bank-ledger-boundaries OK** · regression-guards OK (+ guard novo; R18
internal-surfaces preservado) · actor-authority-boundary **new=0** (baseline 5→3) · arch `--strict`
**critical_new=0** (warning_new=4 pré-existente) · check:migrations **394/394** (sem migration) · tsc **43**.

## Escopo negativo

NÃO tocou unifycard-method/services-discovery/organizers/business-authorization · NÃO tocou Bank/bank_ledger/
transactions/splits/payout/recovery/settlement · NÃO criou migration/materializou schema ghost · NÃO decidiu
produto G10 · NÃO quebrou fluxo G10 vivo (não existe) · NÃO alterou worker/materializer (executeDueActions
intocado) · NÃO fecha DT-mãe 0113 nem parent canal-1 (3>0).

## Estado

**🟡 IMPLEMENTED / HOLD YALA**. automation → **CONTAINED (501 schema-ghost) / HOLD YALA**; human-mvp →
**CONTAINED (501 schema-ghost) / HOLD YALA** (ambos removidos do baseline). `DT-AUTHORITY-Z2-AUTOMATION-SCHEMA-GHOST`
+ `DT-AUTHORITY-Z2-HUMAN-MVP-SCHEMA-GHOST` → IMPLEMENTED_AS_CONTAINED / HOLD YALA. DT-mãe 0113 + parent canal-1 OPEN
(baseline 3). Próximo passo: **Yala reseal**.

## Fila restante para fechar 0113 (3 entradas)

- **MONEY → IA-DINHEIRO (2):** services-discovery [PARTIAL — rotas não-money], unifycard-method [M5 money defer,
  fee-unit defect no settlement].
- **organizers [PARTIAL]:** create/add-member/link-event (event-organizer authority) — frente própria.
- _(Residual: organizer billing SaaS-vs-split; event_settlements ghost; CRM AR read; DECISION-0110/0114 D5;
  automation worker/scheduled_actions e human-mvp/G10 = reativação exige schema + decisão própria.)_
