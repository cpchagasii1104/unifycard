# 2026-06-14 — F-PAYOUT-EXECUTION-SEAL (MODO: EXECUTOR / macrofrente única)

Primeira frente a **selar a execução real de payout** sobre o trilho canônico `actor_wallet_payout_requests`,
consumindo o Core de Aprovação Financeira, com recovery lock, idempotência, Bank ledger via port e executor
**system-only / default-off**. Parent `3644817e` · branch `rescue-structural` · dev 384 (sem migration).
Move dinheiro **só em DB efêmera**. payout HTTP segue fail-closed; workers seguem default-off.

## READ-FIRST

O executor `executeActorWalletPayout` (`actor-wallet-payout.service.ts`) **já existia e estava correto**:
FOR UPDATE no payout_request, validação de status/approval, drain de recovery + recompute, `min(approved,
availableAfterDrain)`, transfer via `bankTransactionService.transfer` (BankTransactionPort) com
`referenceType=actor_wallet_payout` + `referenceId` (idempotência), TX única (rollback seguro), `performedByUserId`
obrigatório. Os **dois gaps** (do READ-FIRST do seal) eram:
- **B1** — nenhuma ponte de PRODUÇÃO `pending_approval → approved` (só o script F3 fazia via SQL cru).
- **B2** — F2 criava approval e F3 lia approval por **SQL cru**, bypassando o Core service.

## Patch

- **Core repo** (`financial-approval.repository.ts`): novas variantes transaction-composable
  `insertApprovalRequestTx(client, ...)` e `findApprovalRequestByIdTx(client, tenantId, id)` (aceitam PoolClient;
  encapsulam o SQL de approval no Core; não movem dinheiro). Core-boundary guard segue verde.
- **F2** (`requestActorWalletPayout`): cria o approval via `insertApprovalRequestTx` (na MESMA TX) + `idempotency_key`
  no approval (`awpayout-approval:<key>`) — **sem SQL cru de approval**.
- **F3** (`executeActorWalletPayout`): lê o approval via `findApprovalRequestByIdTx` — **sem SQL cru de approval**.
- **B1 — APPROVE BRIDGE NOVO** `approveActorWalletPayout(tenantId, payoutRequestId, approvedByUserId)`: system-only,
  server-side subject; FOR UPDATE no payout_request; resolve o approval via Core `recordFinancialApprovalDecision`
  (voto 'approve' → `approved`, required_approvals=1; idempotente); flip `pending_approval → approved` +
  `approved_amount_cents`. **Não move dinheiro.** Single-approval (quórum/4-olhos = frente futura). Sem rota HTTP.

## Execution flow (selado)

```
request (F2, zero $)  → approval_request 'pending' (via Core repo) + payout_request 'pending_approval'
approve (bridge)      → recordFinancialApprovalDecision(approve) → approval 'approved' → payout 'approved'
execute (F3, MOVE $)  → FOR UPDATE payout_request → valida approval (approved/type/não-expirado, via Core)
                        → drain recovery (FOR UPDATE FIFO) → recompute saldo (bank_ledger) → min(approved, after)
                        → bankTransactionService.transfer (BankTransactionPort, referenceType/Id) → ledger débito+crédito
                        → status 'completed' → COMMIT → evento depois (outbox no Bank, pós-financeiro)
idempotência: status 'completed' → completed_idempotent; uq_bank_transactions_reference (1 tx/payout)
concorrência: FOR UPDATE serializa → exatamente uma 'completed'
```

## Guard + provas

- **Guard NOVO** `audit-payout-execution-seal.mjs` no `validate:regression-guards`: FALHA se o executor ler/escrever
  approval por SQL cru, escrever bank_* direto, usar `seller_available`/`can_execute_*`/autoridade client-declared,
  ou faltar (leitura/criação de approval via Core, bridge `recordFinancialApprovalDecision`, FOR UPDATE, recovery
  drain, transfer via port com referenceType); ou se o executor for exposto por HTTP / auto-iniciado no BOOT.
- **Negative proof** `negative-proof-payout-execution-seal.ps1`: injeta (a) SQL cru de approval, (b) bank_* direto,
  (c) `seller_available` → guard FALHA nos 3 → restauração **byte-idêntica** (SHA256).
- **E2E** `validate-pipeline-e2e-payout-execution-seal.ts` (DB efêmera, **MOVE DINHEIRO**): **13/13** — T1 fluxo
  completo (request→approve→execute; wallet→settlement) · T2 execute sem approve → PAYOUT_NOT_APPROVED, zero ledger ·
  T3 approve via Core (approval approved + voto registrado) · T4 re-execute idempotente · T5 approve idempotente ·
  T6 concorrência (uma completed) · T7 recovery ativa drena (comprometido vai p/ creditor) · T8 approve exige
  approver server-side · T9 ledger double-entry · T10 referenceType/idempotência por reference · T11 amount_cents
  BIGINT · T12 baseline 0113=0 + payout HTTP fail-closed + workers default-off + execution-seal verde · T13 zero can_execute_*.

| Prova | Resultado |
| --- | --- |
| e2e (DB efêmera, move dinheiro) | **13/13** |
| negative proof | morde SQL cru approval + bank_* direto + seller_available; restauração byte-idêntica |
| payout-execution-seal guard | GATE OK (no chain) |
| financial-approval-core guard | GATE OK (Core segue não-executor) |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 (todos os selos vizinhos verdes; baseline 0113=0) |
| arch --strict | `critical_new=0` exit 0 (4 warning_new pré-existentes, nenhum nos arquivos da frente) |
| tsc backend | **25** (baseline arc-0113; zero erro nos arquivos tocados) |

## Hard stops respeitados

payout HTTP continua **fail-closed** · worker NÃO inicia por padrão (executor é service system-only, sem rota/BOOT) ·
`seller_available` não autoriza/não usado · `availableBalanceCents` não autoriza (F3 decide por `bank_ledger` sob
FOR UPDATE) · `payout_requests` legado não usado · Bank só via `BankTransactionPort` · sem SQL direto em `bank_*` ·
DECISION-0113 baseline = 0 · bank-http request-only · dispute/reversal/cartão fora · `can_execute_*` não criado.

## Ressalvas (fora desta frente)

- **payout HTTP request-only futuro** — segue fail-closed (decisão de produto pendente).
- **multi-approval/quórum** — single-approval só; `approval_type` parallel/sequential não validado (frente futura).
- **PIX/TED externo** — travado por `chk_payout_request_destination_type='internal_settlement'`.
- **seller_available tombstone definitivo** — apenas bloqueado como autoridade; tombstone do worker legado = frente própria.
- **dispute/reversal/cartão** — continuam fora.
- O executor existe e move dinheiro, mas **não tem caller automático** (system-only, sem worker ligado): um worker
  system-only gated/default-off que o consuma é frente futura (F5 do READ-FIRST).

## Estado

F-PAYOUT-EXECUTION-SEAL: **IMPLEMENTED / HOLD PARA RESEAL**. **Core EXECUTION de payout SELADO** no trilho
canônico (request→approve via Core→execute), Core-aprovado, recovery-aware, idempotente, system-only.
DECISION-0113 baseline = 0. Próximas: worker system-only (F5), payout HTTP request-only (decisão), multi-approval,
seller_available tombstone, dispute/reversal/cartão.
