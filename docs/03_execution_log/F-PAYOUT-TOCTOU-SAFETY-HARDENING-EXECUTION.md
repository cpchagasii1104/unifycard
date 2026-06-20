# F-PAYOUT-TOCTOU-SAFETY-HARDENING — EXECUTION (MACRO MATERIAL · execute-time ≥ approval-time · payout NÃO autorizado)

Fecha os três riscos TOCTOU do Decision Pack no payout interno de actor_wallet, sob o axioma **EXECUTE-TIME nunca
pode ser mais permissivo que APPROVAL-TIME**. **NÃO ativa worker, NÃO abre HTTP execution, NÃO abre external payout,
NÃO semeia PORTA-1, NÃO altera destination_type, NÃO relaxa Bank/RLS, NÃO aplica migration de RLS no dev.**

- **HEAD before:** `e0fe89b9` · **HEAD after:** (este commit) · **branch:** `rescue-structural`
- **working tree before/after:** limpo no escopo material (docs/memorias + untracked alheios)
- **migrations before/after:** 395/395 (NENHUMA migration nesta frente) · **modo:** EXECUTOR (ultracode) · **natureza:** payout execute-time TOCTOU safety

## Matriz approval-time vs execute-time (descoberta)
Diagnóstico do código vivo (não inventado):
- **A cadeia actor_wallet payout NÃO tinha gate de risco em approval-time** — `requestActorWalletPayout` (F2) e
  `approveActorWalletPayout` (F2.5) **não** chamam `requireFinancialRiskClearance`; o Core de aprovação também não.
- A ÚNICA verificação de risco/KYC no execute era **indireta**, dentro de `bankTransactionService.transfer` →
  `requireFinancialRiskClearanceForDebitSide`, cuja assinatura aceita **apenas** `'financial_transfer' | 'financial_payment'`
  e o payout passa **`'financial_transfer'`** (linha 1029) → aplica `maxTransferCentsPerOperation`, **nunca**
  `maxPayoutCentsPerOperation`. **Envelope errado** (o risco de payout não usa o limite de payout).
- `evaluateKycLayer` bloqueia `kyc_status` ∈ {pending, rejected} e só passa `approved` (a coluna é CHECK-constrained a
  pending/approved/rejected — não há estado "review/expired" no nível de kyc_status; "under_review" vive em
  identity_validation_requests e só promove kyc_status→approved ao concluir).
- `evaluateAtlLayer` bloqueia root inativo / `atl_level <= 0`. `evaluateGuardaLayer` aplica o envelope por `action`.
- Drain (`drainRecoveryObligationsForCredit`) consome só `approved`/`partially_recovered`; **não bloqueia
  `pending_approval`** nascida entre approval e execute.

**Conclusão:** os 3 riscos são reais e fecháveis por **revalidação execute-time fail-closed com predicados canônicos**,
sem inventar regra social. (Sem ambiguidade → não houve DECISION_REQUIRED.)

## Correção (cirúrgica em executeActorWalletPayout)
Após validar o approval_request (status approved, não expirado) e **antes** de marcar `processing`/drenar/transferir:
1. **`requireFinancialRiskClearance(tenantId, { actorId, action: 'financial_payout', amountCents: intendedPayout })`** —
   revalida ATL → KYC → KYB → GUARDA com o **ENVELOPE DE PAYOUT** (maxPayoutCentsPerOperation), explícito e ≥ estrito que
   o transfer genérico. Erros mapeados por camada: `KYC*/IDENTITY/KYB` → **PAYOUT_KYC_NOT_APPROVED_AT_EXECUTE**;
   `ATL/AUTHORITY_ROOT/SSOT_ROOT` → **PAYOUT_ATL_NOT_CLEARED_AT_EXECUTE**; demais (risco/limite) →
   **PAYOUT_RISK_NOT_CLEARED_AT_EXECUTE**. (Defesa em profundidade: a clearance genérica do transfer permanece.)
2. **Bloqueio de recovery `pending_approval`**: `SELECT … FROM actor_wallet_recovery_obligations WHERE debtor_actor_id=…
   AND status='pending_approval' FOR UPDATE`; se existir → **PAYOUT_RECOVERY_PENDING_APPROVAL_AT_EXECUTE** (não drena
   pending_approval como approved, não ignora). Lock no mesmo client da transação (consistente com o drain seguinte).

Preservado: saldo via `bankLedgerRepository.calculateBalance`; `availableBalanceCents` só projeção; locks/idempotência/
concorrência (SELECT FOR UPDATE no payout_request; idempotência por completed; transfer reference lock); semântica de
drain de `approved`/`partially_recovered` inalterada.

## Provas materiais (DB efêmero, validate:payout-toctou-safety) — 5/5
T1 happy → completed · **T2 KYC pending pós-approval → PAYOUT_KYC_NOT_APPROVED_AT_EXECUTE** · **T3 recovery
pending_approval pós-approval → PAYOUT_RECOVERY_PENDING_APPROVAL_AT_EXECUTE** · **T4 limite payout=50 / transfer=1_000_000,
payout 100 → PAYOUT_RISK_NOT_CLEARED_AT_EXECUTE (prova envelope de payout, não transfer)** · **T5 atl_level=0 →
PAYOUT_ATL_NOT_CLEARED_AT_EXECUTE**.

## Regressão (validate:payout-proof-e2e) — intacta
F2 20/20 · F3 18/18 · C3 18/18 · C7 14/14 (a revalidação execute-time passa para actores self-seedados com KYC approved,
sem obrigação pendente e limites default — happy paths preservados).

## Guard + negative-proofs
- **Guard** `audit-payout-toctou-safety.mjs` (em `validate:regression-guards`; 77 OK/0 FAIL): exige no execute a invocação
  de `requireFinancialRiskClearance(tenantId, …)` com `action:'financial_payout'`, proíbe `action:'financial_transfer'`
  na revalidação, exige bloqueio de recovery pending_approval + erros observáveis, exige saldo via bank_ledger.
- **Negative-proof** `negative-proof-payout-toctou-safety.ps1` (pwsh 7 + WPS 5.1; 4/4 mordem): NP1 envelope payout→transfer ·
  NP2 remove erro recovery pending_approval · NP3 remove invocação da clearance · NP4 saldo sai de bank_ledger.
  (NP5 worker default-on / NP6 HTTP execution permanecem cobertos por guards existentes —
  audit-financial-workers-dormancy / audit-payout-execution-seal / audit-payout-request-only-entrypoint — não duplicados.)

## NÃO-GO preservado
payout: **NOT AUTHORIZED** · PORTA-1: **NOT SEEDED** (financial_approval real não criado; fixtures só efêmeras) ·
ENABLE_PAYOUT_WORKER: **default-off** · HTTP execution: **disabled/403** · external payout/PIX-out/TED/PSP: **NÃO aberto** ·
destination_type: **internal_settlement-only** · DB-role/RLS: **READY/PROVEN-EPHEMERAL/PROD-FAIL-CLOSED/NOT LIVE IN DEV
(inalterado)** · Bank/Core ledger: **não relaxado** · availableBalanceCents: **só projeção**.

## Gates
actor-writer OK · bank-ledger OK · regression-guards **77 OK / 0 FAIL** · arch `--strict` **critical_new=0**
(warning_new=4 pré-existentes) · check:migrations 395/395 · tsc **34** (nenhum novo desta frente; Yala consolida 43) ·
`validate:payout-toctou-safety` **OK (5/5)** · `validate:payout-proof-e2e` **OK (regressão intacta)**.

## Estados
- `F-PAYOUT-TOCTOU-SAFETY-HARDENING` → **EXECUTED / PENDING YALA**.
- **Payout NOT AUTHORIZED · PORTA-1 NOT SEEDED · worker default-off · external payout NOT AUTHORIZED.**
- `DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD` permanece **OPEN** (inalterada).

## Veredito
TOCTOU execute-time fechado: KYC/ATL/risco revalidados com envelope de payout + recovery pending_approval bloqueado, todos
fail-closed e provados em efêmero, sem quebrar a regressão. Payout segue fechado. **Próxima macro:
F-ACTOR-WALLET-PAYOUT-EXTERNAL-RAIL-DESIGN** (ou closeout/correção se a Yala achar resíduo).
