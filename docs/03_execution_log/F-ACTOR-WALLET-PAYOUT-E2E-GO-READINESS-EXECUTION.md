# F-ACTOR-WALLET-PAYOUT-E2E-GO-READINESS — EXECUTION (MACRO MATERIAL · F2/F3/C3/C7 FULL-GREEN em DB efêmero · payout NÃO autorizado)

Macrofrente que encerra o ping-pong de microfrentes e deixa o payout de actor_wallet **tecnicamente GO-ready
em prova**: F2/F3/C3/C7 rodam **full-green** em DB efêmero, resolvendo na mesma frente todos os bloqueios de
teste/prova/fixture/runner/guard (KYC canônico, acúmulo de recovery, request ativo, cleanup imutável).
**NÃO ativa payout, NÃO semeia PORTA-1/financial_approval real, NÃO liga worker, NÃO abre external payout, NÃO
toca Bank/Core runtime, NÃO raw insert em bank_*, NÃO desliga trigger, NÃO relaxa KYC/recovery/coverage.**

- **HEAD before:** `9525cfa4` · **HEAD after:** (este commit) · **branch:** `rescue-structural`
- **working tree before/after:** limpo no escopo material (docs/memorias + untracked alheios pré-existentes)
- **migrations before/after:** 394/394 (NENHUMA) · **modo:** EXECUTOR (ultracode) · **natureza:** macro material / E2E GO-readiness

## Re-verificação fail-closed (antes de editar)
Rodada baseline de `validate:payout-proof-e2e` confirmou: assertEphemeral forte; runner cria/migra/self-seed/roda/dropa
DB efêmero; funding coverage-aware OK; **F2 20/20 full-green**; **F3 falha** exatamente em `KYC_PENDING_BLOCKS_FINANCIAL`
(T1/T5–T8/T17/T18), "request ativo" (T2–T4, cascata do T1 travado em `approved`) e available=0/pending=10050
(T9–T12/T16, cascata de obligations não-drenadas) + fatal `approval_requests cannot be deleted` no cleanup; **C3/C7 não
alcançados** (runner sequencial para no F3). PORTA-1 NOT SEEDED; worker default-off; payout HTTP 403/disabled. Nenhum
indício de payout ligado/seed real/worker ativo → seguiu a execução.

## Diagnóstico (causa-raiz única + cascata)
O gate financeiro de **debit-side** (`bank-transaction.service.ts → requireFinancialRiskClearance →
authority-decision.evaluateKycLayer`) bloqueia `KYC_PENDING_BLOCKS_FINANCIAL` em **qualquer transfer de actor_wallet**.
A PF self-seedada nasce `identities.kyc_status='pending'` (Fatia C1). Logo todo `executeActorWalletPayout` (F3) e todo
`debitActorWalletForRecovery`/drain (C3/C7) eram barrados. As demais falhas eram **cascata**: T1 travado em `approved`
(execute falhou no KYC) disparava o active-gate em T2–T4; obligations de T5–T7 não drenadas acumulavam como `pending`
inflando o snapshot. O fatal de cleanup era ortogonal: `prevent_approval_request_delete()` (DECISION-0128) sobre delete
não-best-effort.

## Implementado (só test-support / E2Es / guard / docs)
- **KYC canônico (CHECKPOINT A)** — `payout-e2e-self-seed.ts::approveKycCanonical(globalUserId, operatorUserId)`: aprova
  a identity pelo **workflow real submit→review** (`identityValidationService.submitIdentityValidation` →
  `reviewIdentityValidation`), que projeta `identities.kyc_status='approved'`. **Sem raw UPDATE de kyc_status, sem
  constante global** — fixture efêmera coerente (assertEphemeral no topo). Aplicado a debtor + creditor (debit-side).
  Como a identity é global e persiste no DB efêmero, **desbloqueia F3 e também C3/C7** com uma única aprovação.
- **Cleanup imutável best-effort (CHECKPOINT B/C/D)** — `approval_requests`/`approval_votes` deletes viram `.catch(()=>{})`
  em F3 (`cleanupPayoutRequests`), C3 (10×) e C7 (4×): governança imutável (DECISION-0128); em efêmero o DB é dropado.
  Obligations **não** têm trigger de delete (substrate `20260530570000`), então o teardown delas segue válido. Active-gate
  e idempotency continuam isolados pelo padrão existente (idem keys únicas por cenário + `ensureNoActiveRequest`
  cancelando por caminho terminal canônico; sem relaxar constraint, sem delete na marra).
- **Guard estendido (CHECKPOINT F)** — `audit-payout-e2e-ephemeral-guard.mjs`: além de ephemeral + funding canônico,
  passa a exigir **KYC canônico** no self-seed (usa `reviewIdentityValidation`) e **proíbe raw `UPDATE identities …
  kyc_status`** (bypass). Em `validate:regression-guards`.
- **Negative-proof (CHECKPOINT G)** — `negative-proof-payout-e2e-kyc-canonical.ps1`: NP1 raw `UPDATE
  identities.kyc_status` (bypass) → guard FAIL; NP2 remover a chamada canônica `reviewIdentityValidation` → guard FAIL.
  Test-Bite byte-exato, pwsh 7 + WPS 5.1. (Mantém-se `negative-proof-payout-e2e-funding-coverage.ps1`: raw bank insert /
  DISABLE TRIGGER / remover assertEphemeral.)

## Runner strategy (CHECKPOINT D)
**Preferência 2** — mesmo DB efêmero, isolamento por cenário (idem keys únicas, drain/zeragem por E2E, cleanup
best-effort) + isolamento global por KYC/coverage no self-seed. Mantido sequencial F2→F3→C3→C7 reportando claramente
cada suite; o DB efêmero é criado/migrado/self-seedado/dropado pelo runner. (Preferência 1 — 1 DB por E2E — descartada:
quadruplicaria a migração de 394 sem ganho de correção, já que KYC/coverage são globais e cada suite zera/funda o
próprio saldo.)

## E2E results (DB efêmero `unificard_payout_proof_e2e`)
- **F2 (request): 20/20 — FULL-GREEN ✓**
- **F3 (execution): 18/18 — FULL-GREEN ✓** (happy path + drain D-3/D-4 + idempotência + concorrência + rollback)
- **C3 (debit recovery): 18/18 — FULL-GREEN ✓**
- **C7 (finalization): 14/14 — FULL-GREEN ✓**
- `validate:payout-proof-e2e` → **OK (exit 0)**.

## Proofs de NÃO-GO / Bank / KYC (CHECKPOINT H)
payout: **NOT AUTHORIZED** · PORTA-1: **NÃO semeada** (financial_approval real não criado; só fixtures efêmeras) ·
ENABLE_PAYOUT_WORKER: **default-off** (runner faz Remove-Item) · external payout/PIX/TED/PSP: **NÃO aberto** · HTTP payout
execution: **403/disabled** (inalterado) · Bank/Core runtime: **intocado** (só serviços canônicos em DB efêmero) ·
raw insert bank_*: **não** · DISABLE TRIGGER/session_replication_role: **não** · coverage invariant: **intacto** (funding
coverage-aware) · KYC: **não relaxado/não bypass** (submit→review canônico, só efêmero) · recovery obligations: **não
deletadas na marra** (sem trigger; teardown best-effort; status por caminho canônico de drain/finalize) ·
availableBalanceCents: **não-autorizador** (segue projeção) · seller_available: **não usado**. assertEphemeral: forte
(recusa unificard_dev — provado). unificard_dev: **0/0, intocado**.

## Gates
actor-writer OK · bank-ledger OK · regression-guards **75 OK / 0 FAIL** · arch `--strict` **critical_new=0**
(warning_new=4 pré-existentes, nenhum nos arquivos desta frente) · check:migrations 394/394 · tsc 43 errors
(O1: Yala consolidou tsc 43 — registro anterior dizia 34; nenhum novo nos arquivos desta frente; pré-existentes em event-rfq/event-settlement/account.routes/f6-5-6b) ·
`validate:payout-proof-e2e` **OK**. Negative-proofs (funding + KYC) mordem em pwsh 7 + WPS 5.1.

## Estados
- `F-ACTOR-WALLET-PAYOUT-E2E-GO-READINESS` → **EXECUTED / PENDING YALA**
- `DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED` → **EXECUTED / PENDING YALA** (self-seed completo: base-graph + coverage + KYC; 4/4 E2E green)
- `DT-PAYOUT-E2E-EPHEMERAL-FUNDING-COVERAGE` → **EXECUTED / PENDING YALA** (coverage canônico + F2/F3/C3/C7 full-green)
- **Payout NOT AUTHORIZED · PORTA-1 NOT SEEDED · worker default-off · external payout NOT AUTHORIZED.**

## Veredito
Payout de actor_wallet **tecnicamente GO-ready em prova**: F2/F3/C3/C7 full-green em DB efêmero por caminhos canônicos
(KYC submit→review, funding coverage-aware), sem ativar payout, sem seed real, sem burlar Bank/KYC/recovery/coverage.
GO-live segue **decisão soberana de Clayton** (PORTA-1 seed · worker arming · TOCTOU KYC/ATL/risco · RLS hardening).
