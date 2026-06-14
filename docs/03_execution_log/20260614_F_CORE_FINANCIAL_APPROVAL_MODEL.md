# 2026-06-14 — F-CORE-FINANCIAL-APPROVAL-MODEL (MODO: EXECUTOR / macrofrente única)

Materializa o **motor runtime NÃO-EXECUTOR** do Core de Aprovação Financeira (DECISION-0128): "a sala de
aprovação, não a porta do cofre". Registra request/decision/governança; **não move dinheiro**. Parent
`d01580ce` · branch `rescue-structural` · dev 383 → **384**. Baseline DECISION-0113 inalterado (**2**).

## Decisão técnica — ADAPTAR, não duplicar (READ-FIRST interno)

O substrato canônico **já existia**: `approval_requests` + `approval_votes`
(migration `20260530569000_financial_approval_substrate.sql`, DECISION-0054), cujo próprio cabeçalho dizia
*"Fora do escopo (frentes futuras): approval service / rotas públicas"*. Os tipos existiam
(`financial-approval.types.ts`) mas **sem service/repository**; sem motor (confirmado pelo READ-FIRST do Core).
→ Esta frente **NÃO duplica tabelas**: constrói o service/repository/governança SOBRE as tabelas canônicas
e adiciona apenas o que faltava (idempotência + imutabilidade). `operation_type` já cobre transfer/payment/
manual_refund/actor_wallet_recovery/actor_wallet_payout/add_beneficiary/remove_beneficiary/change_limit/
change_policy — **não estendido** nesta frente (card_authorization/dispute_resolution são frentes futuras
próprias, DECISION-0128 §16).

## Migration `20260614140000_financial_approval_core_governance.sql` (additiva, não-financeira, sem backfill)

1. `approval_requests.idempotency_key` (VARCHAR) + `uq_approval_request_idempotency` (unique parcial por tenant).
2. `approval_votes` append-only: triggers `approval_votes_no_update` / `approval_votes_no_delete`.
3. `approval_requests` sem DELETE: trigger `approval_requests_no_delete` (registro de governança não some).
4. `approval_requests` congela estado terminal: trigger `approval_requests_freeze_terminal`
   (approved/rejected/expired/cancelled não regride — decisão não é sobrescrita silenciosamente).
Aplicada ao dev via runner canônico → **384**. Zero `bank_*`/payout/ledger.

## Código (NÃO-EXECUTOR)

- `src/core/financial-approval/financial-approval.types.ts` — estende contratos do service (sem novo substrato).
- `src/core/financial-approval/financial-approval.repository.ts` — acesso às tabelas canônicas; colunas
  explícitas (sem `SELECT *`); idempotência por (tenant_id, idempotency_key); voto append-only.
- `src/core/financial-approval/financial-approval.service.ts` — `createFinancialApprovalRequest`,
  `recordFinancialApprovalDecision` (resolve pending/approved/rejected/expired, **`executed: false`**),
  `cancelFinancialApprovalRequest`, `getFinancialApprovalRequest`, `listFinancialApprovalRequests`.
  Subject (user) e tenant **sempre server-side** (parâmetros); `actorId` cliente nunca é subject. **NENHUMA**
  função `execute*`/`postLedger`/`debit`/`credit`/`settle`/`authorizeCard`; nenhum import de Bank/payout.
- **Sem rota HTTP** (GO: modelar service+tests primeiro; não expor superfície humana sem necessidade).

## Guard + provas

- **Guard NOVO** `scripts/audit-financial-approval-core-boundary.mjs` no `validate:regression-guards`: FALHA se o
  Core escrever `bank_*`, chamar executor financeiro/Bank port, usar `availableBalanceCents`, referenciar
  `can_execute_*`, ler `req.body/query/params/actionContext`, ou importar módulo de Bank/payout.
- **Negative proof** `scripts/negative-proof-financial-approval-core-boundary.ps1`: injeta Bank port e
  `availableBalanceCents` no Core → guard FALHA nos 2 → restauração **byte-idêntica** (SHA256) → verde.
- **E2E** `validate-pipeline-e2e-financial-approval-core-model.ts` (DB efêmera, wrapper
  `run-financial-approval-core-ephemeral.ps1`): **17/17**. Seed próprio (identidade→actor→conta).
- **Colisão tratada:** a imutabilidade quebraria o cleanup-por-DELETE de
  `validate-pipeline-e2e-financial-approval-substrate.ts` → seu cleanup virou tolerante (UPDATE→cancelled +
  try/catch; rows são governança imutável). Sem outra mudança nesse e2e.

| Prova | Resultado |
| --- | --- |
| e2e (DB efêmera 384) | **17/17** (T1 pending · T2 approved/executed:false · T3 rejected · T4 cancelled · T5 amount round-trip + zero coluna money não-BIGINT · T6 isolamento tenant · T7 subject server-side · T8 idempotência · T9 voto append-only · T10 delete proibido · T11/12/13 bank_ledger/bank_transactions/payout intocados · T14 baseline 0113=2 · T15 zero can_execute_* · T16 terminal congelado · S1 Core não-executor) |
| negative proof | guard morde Bank port + availableBalanceCents; restauração byte-idêntica |
| financial-approval-core guard | GATE OK (no chain) |
| actor-authority-boundary (0113) | `flagged=2 baseline=2 new=0 safe_subject_recognized=4` (inalterado) |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 |
| arch patterns --strict | `critical_new=0` exit 0 (4 warning_new pré-existentes, nenhum nos arquivos da frente) |
| tsc backend | **25** (baseline arc-0113; zero erro nos arquivos tocados) |
| dev migration | 383 → **384** |

## Hard stops respeitados

Não move dinheiro. `bank_ledger`/`bank_transactions`/`bank_splits`/payout/bank-http/actor_wallet payout/
seller_available **intocados**. Dispute/reversal **contidos**. Cartão físico **não** implementado. `can_execute_*`
**não** criado em `company_users`/`tenant_operator_grants`. `availableBalanceCents` **não** usado como autorização.
tenant/body/query **não** viram autoridade; `actorId` cliente **não** vira subject. Sem ledger/saldo/Bank paralelo;
sem worker financeiro; sem endpoint humano que execute dinheiro. **bank-http/payout permanecem baseline 0113 = 2.**

## Estado

F-CORE-FINANCIAL-APPROVAL-MODEL: **IMPLEMENTED / HOLD PARA RESEAL**. Core MODEL (não-executor) materializado;
Core EXECUTION segue **HOLD/DECISION_REQUIRED**. Próximas frentes (DECISION-0128 §16): F-BANK-HTTP-AUTHORITY-BINDING
→ F-ACTOR-WALLET-PAYOUT-WIRING → F-PAYOUT-EXECUTION-SEAL → F-DISPUTE-REVERSAL-REOPEN → F-CARD-AUTHORIZATION-CORE.
