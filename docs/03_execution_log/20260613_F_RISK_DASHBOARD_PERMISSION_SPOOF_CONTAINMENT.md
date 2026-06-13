# 2026-06-13 — F-RISK-DASHBOARD-PERMISSION-SPOOF-CONTAINMENT (MODO: EXECUTOR)

Corrige o resíduo prioritário do baseline 0113: o spoof subject==target no `risk-dashboard` (DECISION-0124).
Parent `52f6c0d0` · branch `rescue-structural` · dev **380 (inalterado, sem migration)** · zero Bank.

## Bug (provado)

O preHandler `requireRiskPermission` fazia `const actorId = req.actionContext.actorId` (cliente-declarado)
e `businessAuthorizationService.requirePermission(tenantId, actorId, actorId, 'financial:view_all_ledger',
...)` — a assinatura é `(tenantId, userId/SUBJECT, actorId/TARGET, action, ctx)`, logo o **actorId
client-declarado era usado como SUBJECT**. Um cliente declarava-se qualquer actor e se autoautorizava.

## Modelo subject vs target adotado (binding seguro, Option A)

- **subject** = `req.user?.userId ?? req.user?.id` (SERVER-SIDE/JWT; 401 se ausente) — NUNCA actionContext.
- **target/contexto** = `req.actionContext.actorId` (HINT).
- Mantido `requirePermission` (NÃO `canActAs`): `canActAs` concede `view_all_ledger` por ownership puro
  (capability=null) → enfraqueceria o gate admin; `requirePermission` enforça o GRANT admin. O dashboard é
  admin cross-actor (service só recebe tenantId) — por isso binding por grant, não por representabilidade.

## Guard

Novo check DURO `SUBJECT_EQUALS_TARGET` em `audit-actor-authority-boundary.mjs`: detecta
`requirePermission(tenantId, X, X, ...)` (mesmo identificador como subject e target) — SEMPRE FALHA (não
baselineável). Prova negativa fase 2 injeta o antipadrão → guard FALHA → restaura. `risk-dashboard`
permanece baselineado com nota refinada (spoof CLOSED; baselineado só pela heurística que não reconhece
`requirePermission`; mesma classe dos demais admin readers, R2 fine-grained DECISION_REQUIRED).

## Provas

| Prova | Resultado |
| --- | --- |
| e2e `validate-pipeline-e2e-risk-dashboard-permission-spoof` (DB efêmera, Fastify inject) | **7/7** |
| T1/T2 Bob (sem grant) declarando actorId=Admin → 403 (subject=req.user, não actionContext) | ✅ |
| T1b Bob declarando próprio actor → 403 (requirePermission enforça GRANT, não ownership) | ✅ |
| T-noauth sem utilizador → 401 | ✅ |
| T-struct subject=req.user.userId; requirePermission(tenantId, userId, actorId); sem subject==target | ✅ |
| T6 guard SUBJECT_EQUALS_TARGET + nota spoof CLOSED | ✅ |
| T8 Bank intocado · T9 contenções/bindings anteriores intactos | ✅ |
| Guard 0113 | flagged=7 baseline=7 new=0 stale=0 + prova negativa DUPLA OK |
| Gates | actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113), zero novo em risk-dashboard | sem migration · dev 380 |

## Hard stops respeitados

Zero Bank/ledger/transactions/payout writer; sem migration; sem RBAC V2/FASE6/R2; canActAs NÃO usado
(evita enfraquecer o gate); requirePermission não promovido a soberano (a primitive é grant-based e o
subject é server-side); só `risk-dashboard` tocado; dispute/reversal + POST /service-orders + booking/order/
service_offering + event/public-profiles bindings intactos.

## Cartório

- `DT-RISK-DASHBOARD-PERMISSION-SUBJECT-SPOOF`: **CLOSED** (subject server-side; guard hard-check anti-regressão).
- `DT-0113-CLASSIC-CHANNEL-READERS`: PARTIAL (baseline 7; risk-dashboard agora justificado como admin reader spoof-CLOSED).
- `DT-0113-AUTHORITY-CLIENT-DECLARED-ACTOR-BOUNDARY`: baseline 7 (risk-dashboard re-baselineado, spoof fechado).

## Estado

F-RISK-DASHBOARD-PERMISSION-SPOOF-CONTAINMENT: **IMPLEMENTED / HOLD PARA RESEAL**.
