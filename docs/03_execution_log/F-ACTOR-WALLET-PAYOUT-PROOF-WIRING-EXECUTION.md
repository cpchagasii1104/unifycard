# F-ACTOR-WALLET-PAYOUT-PROOF-WIRING — EXECUTION (MATERIAL / PROOF-WIRING / PARTIAL / PENDING YALA)

Transforma a prova comportamental de payout em gate confiável **sem ativar payout, sem semear PORTA-1, sem ligar
worker, sem mover dinheiro real**. Static proof-wiring COMPLETO; execução comportamental em DB efêmera PARCIAL
(fixtures dev-dependentes). **NÃO toca produção do payout, Bank/Core, settlement, fee.**

- **HEAD before:** `5f4c5562` · **HEAD after:** (este commit) · **branch:** `rescue-structural`
- **working tree before:** limpo · **working tree after:** material (5 arquivos: 4 E2E + package.json) + 3 scripts novos + docs
- **migrations before/after:** 394/394 (NENHUMA migration criada) · **modo:** EXECUTOR (ultracode) · **natureza:** proof wiring

## READ-FIRST (3 paralelas READ-ONLY)

Inventário E2E: F2(request)/F3(execution—move dinheiro)/C3(debit recovery—move dinheiro)/C7(finalization) tinham
**zero assertEphemeral** e estavam **unwired**; só payout-approve-endpoint tinha assertEphemeral. Wiring de gate:
`audit-bank-ledger-boundaries` **NÃO** estava no `validate:regression-guards` default (só script avulso). Guards de
invariante de payout (FOR UPDATE, availableBalanceCents non-auth, approver≠requester, worker default-off,
idempotency) **já existem** (audit-payout-execution-seal/-worker-system-only/-approve-endpoint/financial-workers-
dormancy/bank-http-authority-binding) com negative-proofs próprios.

## Re-verificação fail-closed (READ-ONLY — NENHUM STOP)

1. ENABLE_PAYOUT_WORKER default-off estrito (`=== 'true'`; sem auto-enable por NODE_ENV). ✓
2. HTTP payout execution → 403 PAYOUT_HTTP_EXECUTION_DISABLED. ✓
3. financial_approval fail-closed (policy + authority obrigatórias; 0/0/0 ⇒ nenhum payout; PORTA-1 fechada). ✓
4. seller_available/seller_payout NÃO usados pelo actor_wallet payout (legado tombstoned). ✓
5. availableBalanceCents = projeção de leitura, NÃO autoridade (executor recalcula bank_ledger FOR UPDATE). ✓
6. FOR UPDATE triplo no executor (payout_request + bank_accounts + obligations). ✓
7. Recovery drena antes do payout (policy bloqueia + executor drena). ✓
8. Idempotência via uq_bank_transactions_reference. ✓

## Arquivos alterados

- **M** F2/F3/C3/C7 (`validate-pipeline-e2e-{f2,f3,c3,c7}*.ts`) — adicionado `assertEphemeral` + chamada no início de
  main()/runTests() (recusa `unificard_dev` e exige `EXPECTED_DATABASE_NAME`). **Sem mudar a lógica de teste.**
- **NEW** `scripts/audit-payout-e2e-ephemeral-guard.mjs` (wired em regression-guards) — exige assertEphemeral
  definido+chamado + bloqueio de unificard_dev nos 5 E2Es sensíveis.
- **NEW** `scripts/negative-proof-payout-e2e-ephemeral-guard.ps1` — NPa/NPb (pwsh 7 + WPS 5.1).
- **NEW** `scripts/run-payout-proof-e2e-ephemeral.ps1` — runner que cria/migra/roda(F2..C7)/dropa DB efêmera.
- **M** `package.json` — wire de `audit-bank-ledger-boundaries` + `audit-payout-e2e-ephemeral-guard` no
  `validate:regression-guards` default; novo script `validate:payout-proof-e2e`.

## assertEphemeral — PROVADO

Rodar F2 contra a DB default (`unificard_dev`) ⇒ **"Refusing to run payout/recovery E2E against non-ephemeral
database."** (recusa antes de tocar dados). No runner efêmero ⇒ "🔒 DB efêmera confirmada: unificard_payout_proof_e2e".

## E2Es wired / execução — PARCIAL (lacuna registrada, sem máscara)

Os 4 E2Es estão wired em `validate:payout-proof-e2e` (runner efêmero). O runner **cria a DB efêmera + migra FULL
(394) com sucesso e assertEphemeral confirma efêmera**, MAS os E2Es dependem de **fixtures semeadas no dev**
(`getFixtures` carrega actor/user conhecidos) ausentes numa DB efêmera nova → F2 falha em getFixtures. **NÃO mascarado
com teste frouxo.** Gap registrado como follow-up `DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED` (tornar os E2Es self-seeding
antes de contar como prova comportamental verde em efêmero). A barreira de segurança (assertEphemeral) está ativa e
provada; a execução-em-efêmero é a parte PARCIAL.

## guards wired / negative-proofs

- `audit-payout-e2e-ephemeral-guard` (NEW, wired, GREEN) + negative-proof NPa (remove chamada)/NPb (remove bloqueio
  unificard_dev) — mordem em pwsh 7 + WPS 5.1, restauração byte-idêntica.
- `audit-bank-ledger-boundaries` agora no **regression default** → bank_* escrito fora de modules/bank falha no gate
  default (NP7 wired).
- Negative-proofs de produção EXISTENTES re-executados como evidência (mordem): payout-execution-seal (raw approval
  SQL **NP4** + bank_* direto **NP7** + seller_available **NP3**); payout-worker-system-only (seller + bank + BOOT
  religando legado **NP6**); financial-workers-dormancy (start incondicional + fail-open + NODE_ENV **NP6**);
  bank-http-authority-binding (reabrir Bank exec + availableBalanceCents **NP2**). NP1 (FOR UPDATE) e NP5
  (idempotency) são asseguradas por audit-payout-execution-seal.

## Provas de NÃO-GO preservado

PORTA-1 fechada (sem seed de financial_approval_policies/authorities) · ENABLE_PAYOUT_WORKER NÃO ligado · payout HTTP
403/disabled · payout externo NOT AUTHORIZED · seller_available isolado · availableBalanceCents não-autorizador ·
Bank boundary verde. **Follow-ups registrados:** RLS hardening (se aplicável) e TOCTOU KYC/ATL/risco continuam decisão
pendente de Clayton (não resolvidos nesta frente; não bloqueiam a prova-wiring).

## Gates

actor-writer/bank-ledger OK · regression-guards **75 GATE OK / 0 FAIL** (+ 2 wires) · arch critical_new=0 ·
check:migrations 394/394 · detector baseline 0 · tsc **43** (zero novos).

## Escopo negativo

NÃO alterou produção do payout · NÃO semeou financial_approval · NÃO ligou ENABLE_PAYOUT_WORKER · NÃO executou payout
real · NÃO chamou endpoint real · NÃO abriu PIX/TED/PSP · NÃO tocou Bank/Core p/ mover dinheiro · NÃO usou
seller_available no actor_wallet · NÃO reusou payout_requests legado · NÃO tocou fee/settlement/regional_fees ·
NÃO tocou regional-fee.repository.ts/settlement.service.ts · NÃO fechou DT de payout material · NÃO marcou payout
autorizado · NÃO criou migration.

## Estados

- `F-ACTOR-WALLET-PAYOUT-PROOF-WIRING` → **MATERIAL / PROOF-WIRING / PARTIAL / PENDING YALA**.
- `DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED` → **OPEN** (tornar F2/F3/C3/C7 self-seeding para prova comportamental verde em efêmero).
- Payout → **NOT AUTHORIZED**. PORTA-1 → **NÃO semeada (decisão Clayton)**. Worker → **default-off**. External payout → **NOT AUTHORIZED**.

## Veredito

Static proof-wiring de payout COMPLETO e gateável (assertEphemeral provado + guard + bank-boundary no default +
negative-proofs mordem); execução comportamental em efêmero PARCIAL (fixtures self-seed = follow-up). **Payout
continua fechado.** Próxima decisão: Clayton (PORTA-1 seed / worker arming / TOCTOU / RLS) + self-seed dos E2Es.
