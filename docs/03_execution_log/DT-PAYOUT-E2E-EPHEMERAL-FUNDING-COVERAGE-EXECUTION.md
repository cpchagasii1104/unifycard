# DT-PAYOUT-E2E-EPHEMERAL-FUNDING-COVERAGE — EXECUTION (MATERIAL / coverage SOLVED · F2 full-green · F3/C3/C7 PARTIAL)

Resolve o remainder financeiro `COVERAGE_EXCEEDED` da frente self-seed via **funding coverage-aware por caminho
canônico** (sem burlar o Bank). **Coverage SOLVED + F2 20/20 full-green em DB efêmero.** F3/C3/C7 ainda PARTIAL por
gates mais profundos (KYC/recovery). **NÃO ativa payout, NÃO semeia PORTA-1/financial_approval real, NÃO liga worker,
NÃO abre external payout, NÃO toca Bank runtime, NÃO raw insert em bank_*, NÃO desliga trigger.**

- **HEAD before:** `c108c847` · **HEAD after:** (este commit) · **branch:** `rescue-structural`
- **migrations before/after:** 394/394 (NENHUMA) · **modo:** EXECUTOR (ultracode) · **natureza:** material/E2E funding coverage-aware

## READ-FIRST — invariant de coverage

`check_coverage_before_credit()` (`migrations/0003_bank_core.sql`): crédito a conta `owner_type='system'` é
**coverage-exempt** (RETURN NEW); crédito a conta não-system é bloqueado quando
`non_system_credits / system_capacity ≥ 80%`. Tenant novo → system capacity 0 → qualquer crédito a actor_wallet = 100%
→ COVERAGE_EXCEEDED. **Caminho canônico (de `validate-financial-flow-real.ts`):** creditar conta SYSTEM via
`bankTransactionService.createSimpleTransaction` (genesis; coverage-exempt) → capacidade > 0 → créditos de teste a
contas não-system passam sob 80%. (Proibido: raw insert / DISABLE TRIGGER / session_replication_role.)

## Implementado

- **M** `payout-e2e-self-seed.ts` — `fundSystemCoverage(tenantId, actingActorId)`: garante `system:reserve` e minta
  capacidade via `createSimpleTransaction` (50_000_000, concept `system-reserve-credit`, `buildSystemAuthorship`).
  **Caminho canônico; sem raw insert; sem trigger bypass.** Com capacidade no system, os créditos de teste dos E2Es
  passam o coverage.
- **M** E2Es (F2/C3/C7) — cleanup **best-effort** (`.catch`) em vez de skip-all: registros financeiros/governança são
  imutáveis (DECISION-0128); `payout_requests` é deletável (reseta o gate de request ativo entre cenários) e
  `approval_requests`/obligations imutáveis caem em `.catch` (em efêmero o DB é dropado). (F3 já era best-effort.)
- **M** F2 T12 — actor throwaway `'user'` (exigia global_user_id por chk_actor_requires_identity) → `actor_organizational`
  + `responsible_actor_id` (fixture actor). Preserva o intent (ACTOR_WALLET_NOT_FOUND por ausência de wallet).
- **M** guard `audit-payout-e2e-ephemeral-guard.mjs` — passa a exigir, no helper de funding: assertEphemeral + bloqueio
  unificard_dev + **proíbe raw INSERT em bank_ledger/transactions/splits + DISABLE TRIGGER/session_replication_role** +
  exige `createSimpleTransaction` (funding canônico).
- **NEW** `negative-proof-payout-e2e-funding-coverage.ps1` — NP1 raw bank insert · NP2 DISABLE TRIGGER · NP3 remover
  assertEphemeral → todos mordem (pwsh 7 + WPS 5.1), restauração byte-idêntica.

## E2E results (DB efêmero)

- **F2 (request): 20/20 — FULL-GREEN ✓** (coverage cleared; cleanup best-effort; T12 fix).
- **F3 (execution): PARTIAL** — bloqueios mais profundos: `KYC_PENDING_BLOCKS_FINANCIAL` (actor self-seedado nasce com
  KYC pendente; falta aprovar KYC canônico em efêmero); acúmulo de `pending recovery` (obligations imutáveis acumulam →
  availableBalance 0); `request ativo` entre cenários. NÃO mascarado.
- **C3/C7: não alcançados** (runner sequencial para no F3). Status não verificado nesta frente.

## Proofs de NÃO-GO / Bank

raw insert bank_*: **não** (funding via createSimpleTransaction/transfer). trigger bypass: **não**.
session_replication_role: **não**. Bank/Core runtime: **inalterado** (só serviços canônicos chamados em DB efêmero).
Payout: **NOT AUTHORIZED**. PORTA-1: **NÃO semeada**. financial_approval real: **não criado** (register/seedDefaultRBAC =
identidade/RBAC, em DB efêmero). ENABLE_PAYOUT_WORKER: **default-off**. external payout: **NOT AUTHORIZED**.
seller_available: **não usado**. availableBalanceCents: **não-autorizador** (segue projeção). assertEphemeral: forte
(recusa unificard_dev — provado). Runner: cria/migra/self-seed+funding/roda/dropa DB efêmero.

## Gates

actor-writer OK · bank-ledger OK · regression-guards **75 OK / 0 FAIL** · arch `--strict` **critical_new=0** ·
check:migrations 394/394 · tsc **43**. `validate:payout-proof-e2e`: F2 full-green; falha honestamente no F3 (KYC/recovery).

## Estados

- `DT-PAYOUT-E2E-EPHEMERAL-FUNDING-COVERAGE` → **PARTIAL**: coverage **SOLVED** (canônico); **F2 full-green**;
  F3/C3/C7 remanescentes (KYC approval canônico em efêmero + acúmulo de recovery obligations imutáveis).
- `DT-PAYOUT-E2E-EPHEMERAL-SELF-SEED` → **PARTIAL / MATERIAL_REMAINDER** (base-graph + coverage sólidos; 1/4 E2E green).
- **Payout NOT AUTHORIZED · PORTA-1 não semeada · worker default-off · external payout NOT AUTHORIZED.**

## Veredito

COVERAGE_EXCEEDED resolvido por funding canônico coverage-aware (named objective); **F2 20/20 full-green** em efêmero;
guard+negative-proof do funding entregues. F3/C3/C7 PARTIAL por KYC/recovery — remainder registrado, sem mascarar.
Payout segue fechado. Próximo passo: aprovar KYC canônico no self-seed + lidar com acúmulo de recovery obligations
(frente própria) para F3/C3/C7 full-green; depois Yala.
