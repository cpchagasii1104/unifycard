# DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED — EXECUTION (MATERIAL / PARTIAL / MATERIAL_REMAINDER)

Torna os E2Es F2/F3/C3/C7 autossuficientes em DB efêmero. **Static + base-graph self-seed CONCLUÍDOS**; execução
comportamental full-green ainda BLOQUEADA por um invariante financeiro do Bank (coverage trigger) sobre os seed
credits dos próprios E2Es. **NÃO ativa payout, NÃO semeia PORTA-1/financial_approval real, NÃO liga worker, NÃO abre
external payout, NÃO toca produção (só DB efêmero descartável).** **NÃO mascarado / sem relaxar assert / sem fixtures dev.**

- **HEAD before:** `15cc3645` · **HEAD after:** (este commit) · **branch:** `rescue-structural`
- **working tree before:** limpo · **working tree after:** material (runner) + helper novo + docs
- **migrations before/after:** 394/394 (NENHUMA migration) · **modo:** EXECUTOR (ultracode) · **natureza:** material/E2E self-seed

## READ-FIRST (2 paralelas READ-ONLY) + re-verificação fail-closed

Os 4 E2Es já têm assertEphemeral + runner efêmero; dependiam de fixtures dev-seeded via getFixtures/buildFixture
(tenant+user+actor+bank_accounts). As partes difíceis (obligations/approvals/ledger/payout-requests) já têm helpers
inline raw-INSERT. Re-verificação: payout dormente/fail-closed (worker default-off; HTTP 403; approval 0/0/0;
seller_available isolado; availableBalanceCents não-autoridade) — nenhum STOP.

## O que foi feito (CONCLUÍDO)

- **NEW** `src/scripts/test-support/payout-e2e-self-seed.ts` — semeia, SÓ em DB efêmero (assertEphemeral próprio),
  o grafo mínimo por caminhos canônicos: `authService.register` (→ global_users→users→identities→actor) p/ debtor +
  creditor; `ensureUserActor`; `bankAccountService.ensureActorWalletAccount` (debtor) + `ensureUserWalletForActor`
  (creditor) + `ensurePlatformAccounts` (bank_settlement); concept `actor-wallet-recovery` (governance-aware).
  **Sem referência direta a tabelas SSOT bancárias** (verificação via serviço; arch critical_new=0).
- **Problema resolvido (não-óbvio):** o cadastro orgânico resolve o **tenant SERVER-SIDE** (`unificard-inicial`),
  ignorando o tenantId passado → users caíam em tenant ≠ dos actors/contas. Solução: o helper **descobre o tenant
  efetivo** do user registrado e alinha actors/contas a ele, e **emite o tenant** (`scripts/.tmp-payout-e2e-tenant.txt`)
  para o runner repassar como `E2E_TENANT_ID` aos E2Es.
- **M** `scripts/run-payout-proof-e2e-ephemeral.ps1` — chama o self-seed após migrate; lê o tenant efetivo e o repassa
  como `E2E_TENANT_ID`; limpa o tmp + dropa a DB no finally.
- **Verificado:** self-seed completa (`actor_wallet=true user_wallet=true bank_settlement=true`); **F2 passa o
  getFixtures** (antes falhava ali) — o grafo base está correto e tenant-alinhado.

## Lacuna remanescente (PARTIAL — registrada, não mascarada)

Após o self-seed, **F2 falha em `seedWalletCreditF2` com `COVERAGE_EXCEEDED: 100.00 cobertura`** — trigger de
cobertura do Bank em `bank_ledger` (`migrations/0003_bank_core.sql`) que **bloqueia crédito "nu" em conta não-system
num tenant novo** (comportamento conhecido; ver comentário em `validate-pipeline-e2e-payout-execution-seal.ts`). Os
seed credits dos E2Es (seedWalletCreditF2 etc.) fazem INSERT direto de credit sem lastro; em DB efêmero novo isso
viola a cobertura. **Para full-green é preciso funding coverage-aware** (transfer balanceado a partir de conta system
lastreada, em vez de credit nu) nos helpers de seed dos 4 E2Es — mudança mais profunda de money-seed, com possíveis
muros adicionais. **NÃO resolvido nesta frente** (evitar relaxar invariante financeiro / não mascarar).

## Estados

- `DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED` → **PARTIAL / MATERIAL_REMAINDER** (continua **OPEN**). Concluído: base-graph
  self-seed + tenant-alignment + runner wiring. Remanescente: funding coverage-aware dos seed credits p/ E2E full-green.
- `F-ACTOR-WALLET-PAYOUT-PROOF-WIRING` → permanece CLOSED_WITH_REMAINDER (inalterado).
- **Payout → NOT AUTHORIZED.** **PORTA-1 → NÃO semeada.** **Worker → default-off.** **External payout → NOT AUTHORIZED.**

## Escopo negativo

NÃO ativou payout · NÃO semeou financial_approval real (register/seedDefaultRBAC são identidade/RBAC, em DB efêmero) ·
NÃO ligou ENABLE_PAYOUT_WORKER · NÃO executou payout real (F2 parou no coverage antes de qualquer execução) · NÃO
abriu payout HTTP/external · NÃO tocou Bank/Core runtime · NÃO usou seller_available · NÃO tocou fee/settlement/
regional_fees · NÃO tocou regional-fee.repository.ts/settlement.service.ts · NÃO rodou em unificard_dev (assertEphemeral
em 3 camadas: runner DB name + self-seed + E2Es) · NÃO criou migration · NÃO relaxou assert · NÃO usou fixtures dev.

## Gates

actor-writer OK · bank-ledger OK · regression-guards **75 OK / 0 FAIL** · arch `--strict` **critical_new=0** · 
check:migrations 394/394 · detector baseline 0 · tsc **43**. (`validate:payout-proof-e2e` falha honestamente no
coverage wall — sinal PARTIAL, fora do regression default.)

## Veredito

Self-seed do grafo base CONCLUÍDO e tenant-alinhado (problema não-óbvio resolvido); E2E full-green em efêmero
BLOQUEADO pelo coverage trigger do Bank sobre os seed credits → **PARTIAL**, lacuna precisa registrada. **Payout
continua fechado.** Próximo passo: funding coverage-aware dos seed credits (frente própria) + Yala.
