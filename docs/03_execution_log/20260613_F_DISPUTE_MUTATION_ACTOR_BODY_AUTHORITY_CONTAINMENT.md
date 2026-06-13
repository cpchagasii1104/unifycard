# 2026-06-13 — F-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY-CONTAINMENT (P1)

Conter o resíduo P1 baselineado `DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY`: as 3 rotas irmãs de
mutação de disputa que liam `actor` do BODY sem binding (6º canal, DECISION-0113). Parent
`dbfa7181` · branch `rescue-structural` · dev 378/378 · sem migration.

## Causa (P1)

`POST /reconciliation/disputes/from-discrepancy` · `/:id/to-review` · `/:id/resolve` liam
`actor.kind/actorId` do BODY (system/admin/support) via `parseActor(req.body?.actor)` e mutavam
estado via `reconciliationDisputeService` SEM binding server-side. Não movem dinheiro
diretamente (P1), mas alteram estado sensível; `/to-review` preparava UNDER_REVIEW que habilitava
o reversal.

## Contenção (edge HTTP, fail-closed)

Cada um dos 3 handlers reduzido ao **`403 DISPUTE_MUTATION_HTTP_DISABLED`** ("Manual dispute
mutation through HTTP is disabled until authority binding is implemented.") como ÚNICA instrução
— sem caminho (alcançável OU morto) que chame `parseActor` / o service de mutação (lição do
reseal anterior: zero dead code). `parseActor` / `parseOptionalReason` / import
`ReconciliationDisputeActor` REMOVIDOS (sem caller restante → sem unused symbol). Comentário de
cabeçalho do arquivo atualizado.

Mantido intacto: `GET /disputes/:id/events` (leitura, `listDisputeAuditEvents`). Fora do escopo
e NÃO reaberto: `POST /disputes/:id/reversal` (segue `403 DISPUTE_REVERSAL_HTTP_DISABLED`, P0).
Não usado `requireRole/requirePermission` (RBAC V2 não soberano); `actor.kind=system/admin/
support` do body não liberado; `authoritySource` não derivado do body; modelo definitivo de
autorização não implementado.

## Guard / baseline atualizado (sem maquiagem)

A rota deixou de conter `body.actor`/`parseActor` → o guard `audit-actor-authority-boundary.mjs`
não a detecta mais. Removido do BASELINE: **flagged=10 · baseline=10 · new=0 · stale=0**. Prova
negativa `negative-proof-actor-authority-boundary.ps1` verde.

## Provas

| Prova | Resultado |
| --- | --- |
| e2e NOVO `validate-pipeline-e2e-dispute-mutation-http-containment` (DB efêmera) | **11/11** |
| T1 from-discrepancy system → 403 DISPUTE_MUTATION_HTTP_DISABLED | ✅ |
| T2 to-review admin → 403 | ✅ |
| T3 resolve support → 403 | ✅ |
| T4 id inexistente NÃO vira 404 (service não chamado) | ✅ |
| T5 zero linha em reconciliation_disputes / reconciliation_dispute_events | ✅ |
| T6 /reversal continua 403 DISPUTE_REVERSAL_HTTP_DISABLED (P0 intacto) | ✅ |
| T7 GET /disputes/:id/events não quebrado | ✅ |
| S1/S2/S3 sem parseActor/service de mutação; /events preservado; reversal.service intacto | ✅ |
| Gates | actor-writer OK · bank-ledger OK · regression-guards EXIT 0 (actor-authority-boundary 10/10 new=0 stale=0) · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113), ZERO novo em reconciliation/dispute/reversal/bank; sem unused/unreachable |
| git diff --check (arquivos da frente) | 0 |
| migration count | 378 (inalterado) |

## Hard stops / Bank untouched

`reversal.service.ts` / `requestAndExecuteReversalSync` NÃO tocados; zero Bank; zero migration;
zero `bank_ledger`/`bank_transactions`/`reversals` escrito; sem PJ/CNAE/RBAC V2/FASE6/R2; sem
booking/order; sem modelo definitivo.

## Cartório

- `DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY`: OPEN → **P1 CONTAINED**.
- `DT-0113-AUTHORITY-CLIENT-DECLARED-ACTOR-BOUNDARY`: OPEN / BASELINE SELADO (baseline reduzido
  a 10; reconciliation-dispute saiu — mitigado).

## Estado

- F-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY-CONTAINMENT: **IMPLEMENTED / HOLD PARA RESEAL**.
- Próxima frente recomendada: **booking→order** (`metadata.serviceId` vínculo fraco) ou modelo
  definitivo de autoridade de dispute/reversal. NÃO iniciar agora.
