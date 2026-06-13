# 2026-06-13 — F-DISPUTE-REVERSAL-HTTP-AUTHORITY-CONTAINMENT (P0)

Contenção EMERGENCIAL de P0 financeiro confirmado por 3 paralelas READ-ONLY.
Parent `8af211be` · branch `rescue-structural` · dev 378/378 (sem migration nova).

## P0 (causa-raiz confirmada)

`POST /reconciliation/disputes/:id/reversal` (protectedScope `/reconciliation`, autenticada,
SEM admin-gate real) lia `actor.kind` ∈ {system,admin,support} e `actor.actorId` do **body**
(`parseActor`), não usava `req.user`, sem `canRepresentActor`/`canActAs`/`authorityService`, e
chamava `reconciliationDisputeService.executeDisputeFinancialReversal` →
`requestAndExecuteReversalSync` (`authoritySource:'system'`, `reversalType:'external_reversal'`)
movendo dinheiro REAL em `reversals`/`bank_transactions`/`bank_ledger`. Qualquer usuário
autenticado disparava reversal financeiro declarando `actor` no body.

Norma violada: DECISION-0113 (actorId do cliente = hint, nunca autoridade);
CORE_ESTORNOS_FINANCEIROS_CANONICO (estorno manual exige autoridade verificada; `system` é
caller sistêmico/externo, não humano via HTTP); DECISION-0052 (external_reversal/system ≠ ação
humana direta); Lei 5 (ledger só pelo Bank).

## Contenção (menor superfície segura)

`backend/src/modules/reconciliation/reconciliation-dispute.routes.ts` — no handler de
`/disputes/:id/reversal`, **primeira instrução** (antes de `parseActor` e de
`executeDisputeFinancialReversal`):

```
return reply.status(403).send({
  ok: false,
  code: 'DISPUTE_REVERSAL_HTTP_DISABLED',
  message: 'Manual dispute reversal through HTTP is disabled until authority binding is implemented.',
});
```

A rota permanece registrada mas **não alcança o reversal engine**. `body.actor` não chega mais
ao motor por esta rota. Não foi usado `requireRole`/`requirePermission` (RBAC V2 dormente/
divergente). Motor financeiro **intacto** (`reversal.service.ts` / `requestAndExecuteReversalSync`
não alterados). Zero migration; zero escrita Bank; sem CHECKs de `reversals`; sem reclassificação
de reversalType/authoritySource; sem Core de Aprovação Financeira.

## Rotas irmãs (mapeadas, NÃO implementadas)

`POST /reconciliation/disputes/from-discrepancy` · `/:id/to-review` · `/:id/resolve` compartilham
a raiz `parseActor(req.body?.actor)` mas **não movem dinheiro diretamente** → registradas em
`DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY` (P1, frente própria). Não redesenhadas aqui.

## Provas

| Prova | Resultado |
| --- | --- |
| e2e NOVO `validate-pipeline-e2e-dispute-reversal-http-containment` (DB efêmera) | **7/7** |
| T1 actor.kind='system' no body → 403 DISPUTE_REVERSAL_HTTP_DISABLED | ✅ |
| T2 serviço NÃO chamado (id inexistente não vira 404 DISPUTE_NOT_FOUND — gate curto-circuita) | ✅ |
| T3 zero nova linha em reversals/bank_transactions/bank_ledger | ✅ |
| T4 admin/support no body também → 403 (sem atalho por kind) | ✅ |
| S1/S2 gate precede parseActor/reversal engine; motor não alterado | ✅ |
| Gates | actor-writer OK · bank-ledger OK · regression-guards EXIT 0 · arch --strict critical_new=0 |
| git diff --check (arquivos da frente) | 0 (trailing-whitespace remanescente é só drift protegido `MINHA_MEMORIA_*`, fora da frente) |
| tsc backend | 25 pré-existentes (arco 0113), ZERO novo em reconciliation/dispute/reversal/bank |
| migration count | 378 (nenhuma nova) |

## Bank untouched

dev: `reversals`=0 · `bank_ledger`=0 · `bank_transactions`=0 (sem escrita). `reversal.service.ts`/
`requestAndExecuteReversalSync` não tocados.

## Cartório

- `DT-DISPUTE-REVERSAL-AUTHORITY-CLIENT-DECLARED`: **OPEN / P0 CONTAINED** (modelo definitivo —
  authority binding verificada — pendente, frente futura).
- `DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY`: **OPEN (P1)** (rotas irmãs `body.actor`; frente própria).

## Estado

- F-DISPUTE-REVERSAL-HTTP-AUTHORITY-CONTAINMENT: **IMPLEMENTED / HOLD PARA RESEAL FINANCEIRO**.
- Não seguir para authority/PJ/cargos/grants/CNAE; não iniciar modelo definitivo de reversal.

## ADENDO — TSC CLEANUP (F-DISPUTE-REVERSAL-HTTP-CONTAINMENT-TSC-CLEANUP, 2026-06-13)

O reseal apontou 2 erros TS NOVOS em codigo MORTO abaixo do `return 403` (linhas 212/219): o
early-return tornou o resto do handler inalcancavel e o TS perdeu narrowing.

- Correcao (commit sobre `6fbb01eb`): removido todo o corpo morto do handler de
  `POST /disputes/:id/reversal`; o handler agora contem APENAS o gate `403
  DISPUTE_REVERSAL_HTTP_DISABLED` — sem caminho (alcancavel OU morto) que chame `parseActor` /
  `executeDisputeFinancialReversal` / `requestAndExecuteReversalSync`. parseActor/
  parseOptionalReason/reconciliationDisputeService/ReconciliationDisputeActor seguem usados
  pelas rotas irmas (from-discrepancy/to-review/resolve) — sem unused. S1 do e2e reajustado.
- Provas: e2e dispute-reversal-http-containment 7/7 (403 antes de parse/engine; zero linha em
  reversals/bank_transactions/bank_ledger). Gates: actor-writer OK; bank-ledger OK;
  regression-guards EXIT 0; arch --strict critical_new=0. tsc backend 25 (baseline exato do arco
  0113); reconciliation/dispute/reversal/bank = ZERO erros; os 2 erros do reseal eliminados.
  git diff --check (arquivos da frente) = 0. Sem migration; Bank/motor intactos.
- Nota de ambiente: durante o cleanup o node_modules vendorizado sofreu churn (deps untracked
  bullmq/pino e o dist de @unificard/contracts foram prunados por um pnpm install); restaurado
  por git checkout do tracked + pnpm install --force (repopular store) + rebuild de
  packages/contracts (tsc -b). Estado final: node_modules ao HEAD, contracts reconstruido, tsc
  de volta ao baseline 25. Nenhum arquivo de node_modules/packages entra no commit.
- Estado: F-DISPUTE-REVERSAL-HTTP-AUTHORITY-CONTAINMENT — CLOSED apos cleanup tsc.
