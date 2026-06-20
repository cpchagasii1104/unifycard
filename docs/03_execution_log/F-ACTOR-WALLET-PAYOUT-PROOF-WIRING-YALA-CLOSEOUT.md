# F-ACTOR-WALLET-PAYOUT-PROOF-WIRING-YALA-CLOSEOUT — EXECUTION (docs-only)

Registra o **Yala reseal material = PASS_WITH_WARNINGS** do commit `db3d6248` e fecha a frente
`F-ACTOR-WALLET-PAYOUT-PROOF-WIRING` como **CLOSED_WITH_REMAINDER**, **sem abrir payout** e mantendo
`DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED` **OPEN**. **DOCS-ONLY: sem código, sem migration, sem runtime, sem banco, sem
Bank/Core, sem payout, sem semear PORTA-1, sem ligar worker, sem external payout.**

- **HEAD before:** `db3d6248` · **HEAD after:** (este commit docs-only) · **branch:** `rescue-structural`
- **working tree before:** limpo (material) · **working tree after:** só docs/cartório
- **migrations:** 394/394 PASS · **modo:** EXECUTOR · **natureza:** docs-only / Yala closeout

## Arquivos lidos

00_AGENT_PROTOCOL · 07_NOMENCLATURA_CANONICA · SSOT_EXCLUSIVE_BANK_RULE · SSOT_CONTRACT · SSOT_REGISTRY_UNIFICARD ·
PROHIBITED_STRUCTURES · LEIS_OPERACIONAIS_UNIFICARD · REMEDIATION_DECISIONS_LOG · REMEDIATION_DT_LOG ·
STATUS_EXECUCAO_GLOBAL · F-ACTOR-WALLET-PAYOUT-PROOF-WIRING-EXECUTION.md · DECISION_0053/0128/0129/0130 (referência).

## Yala verdict

Yala reseal material do commit `db3d6248` = **PASS_WITH_WARNINGS** (proof-wiring estático correto; payout fechado;
PORTA-1 fechada; worker default-off; E2Es protegidos+wired mas ainda fixture/dev-dependent → PARTIAL registrado;
gates verdes). Pode fechar como **CLOSED_WITH_REMAINDER**. NÃO pode: abrir payout, semear PORTA-1, ligar worker,
declarar E2E comportamental full-green em efêmero, fechar `DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED`.

## Escopo fechado (proof-wiring estático)

- `assertEphemeral` forte em F2/F3/C3/C7 (recusa `unificard_dev` + exige `EXPECTED_DATABASE_NAME` + regex de nome
  efêmero) — provado (F2 vs dev recusa).
- runner efêmero `run-payout-proof-e2e-ephemeral.ps1` com dupla barreira (nome ≠ unificard_dev + assertEphemeral nos E2Es).
- guard `audit-payout-e2e-ephemeral-guard` wired no regression default.
- `audit-bank-ledger-boundaries` no regression default (bank_* fora de modules/bank falha no gate default).
- regression-guards **75 OK / 0 FAIL**.
- payout fail-closed preservado; PORTA-1 fechada; worker default-off; external payout NOT AUTHORIZED.
- negative-proofs: novo NPa/NPb mordem; production existentes (execution-seal/worker-system-only/financial-workers-
  dormancy/bank-http) re-executados e mordem.

## Remainder aberto

`DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED` → **OPEN / MATERIAL_REQUIRED**. Motivo: F2/F3/C3/C7 estão protegidos (assertEphemeral)
e wired (runner efêmero), mas ainda dependem de **fixtures dev-seeded** (`getFixtures`). Falta **self-seed efêmero**
para prova comportamental **full-green** contra DB efêmero. Antes de qualquer PORTA-1/payout real, esses E2Es devem
ter self-seed + prova comportamental verde em efêmero.

## Limite deste fechamento

NÃO autoriza payout · NÃO semeia financial approval · NÃO liga worker · NÃO abre external payout · NÃO substitui a
decisão Clayton sobre PORTA-1 · NÃO resolve TOCTOU KYC/ATL/risco · NÃO resolve RLS hardening.

## Estados

- `F-ACTOR-WALLET-PAYOUT-PROOF-WIRING` → **CLOSED_WITH_REMAINDER / MATERIAL / PROOF-WIRING / YALA PASS_WITH_WARNINGS**.
- `DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED` → **OPEN / MATERIAL_REQUIRED** (não fechada).
- `DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD` → **OPEN / BLOCKER_BEFORE_SETTLEMENT_REACTIVATION** (inalterada).
- **Payout → NOT AUTHORIZED.** **PORTA-1 → CLOSED / NOT SEEDED / Clayton decision required.** **Worker → DEFAULT-OFF.**
  **External payout → NOT AUTHORIZED.**

## Follow-ups

- **RLS follow-up:** hardening (se aplicável) = decisão pendente Clayton (não resolvido; não bloqueia o proof-wiring).
- **TOCTOU follow-up:** KYC/ATL/risco = decisão pendente Clayton.
- **Next technical front:** `DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED` (self-seed dos E2Es).
- **Clayton decisions pending:** PORTA-1 seed · worker arming · TOCTOU KYC/ATL/risco · possível RLS hardening.

## Escopo negativo

NÃO editou código/testes/guards/package.json · NÃO criou migration · NÃO tocou banco/runtime/Bank/Core/payout · NÃO
semeou financial approval · NÃO ligou ENABLE_PAYOUT_WORKER · NÃO abriu payout HTTP/external · NÃO tocou
fee/settlement/regional_fees · NÃO fechou DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED nem DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD ·
NÃO alterou norma. Docs-only; HEAD material permanece `db3d6248`.

## Gates

actor-writer-boundaries · bank-ledger-boundaries · regression-guards (75 OK/0 FAIL) · arch --strict (critical_new=0) ·
check:migrations 394/394 · baseline 0113 = 0 — ver bloco de saída no relatório.

## Veredito

Cartório fechado corretamente. Proof-wiring **CLOSED_WITH_REMAINDER** (Yala PASS_WITH_WARNINGS). DT self-seed aberta.
**Payout NOT AUTHORIZED · PORTA-1 fechada · worker default-off · external payout NOT AUTHORIZED.**
