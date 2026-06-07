# Execução — DECISION MONEY AUTHORITY + F-MONEY-LIVE-AUTHORSHIP-MAP-SEAL (DECISION-0114) — docs-only

**Data:** 2026-06-07 · **Modo:** EXECUTOR DOCS-ONLY · **Branch:** `rescue-structural` · **HEAD origem:** `04b74909`
**Decisor:** Clayton (D1–D5) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Registrar institucionalmente a **autoridade inicial** sobre o Fundo Regional e sobre AP/AR latente, **selar** o `F-MONEY-LIVE-AUTHORSHIP-MAP`, e preparar o trilho da futura `F3.1 — LIVE-NOW` — **sem alterar runtime**.

## READ-FIRST (confirmado)
- HEAD `04b74909`, dev 365, branch `rescue-structural`.
- **DECISION-0114 LIVRE** (0113 era a última; confirmado em `docs/02_decisions/` e no log).
- **Estado do mapa re-confirmado de 1ª mão:** Proxies dead ("migrated to Bank") em `unifycard`/`settlement`/`region-account`/`accounts-payable`/`accounts-receivable`/`payment-split`/`payout`; live-writes vivas em `event-settlement.repository` (UPDATE event_settlements), `payment-method.repository` (INSERT + unsetDefaultForActor), `unifycard-method.repository` (INSERT unifycard_payment_methods).

## Implementação (docs-only)
1. **`DECISION_0114_REGION_FUND_AND_AP_AR_INITIAL_AUTHORITY.md`** (novo) — D1–D5: Fundo Regional = plataforma (não empresa); autoridade inicial MVP = **fundador/criador resolvido pelo SSOT** (sem CPF hardcoded, sem criar user/actor, sem novo identificador); delegação futura = frente própria formal; AP/AR latente segue a mesma autoridade inicial; reativar AP/AR exige decisão de modelo + gate. Bloqueios explícitos (não religa Proxy, não autoriza Bank/movimentação/role/tabela/ledger).
2. **`REMEDIATION_DT_LOG.md`** — 3 DTs OPEN: `DT-MONEY-LATENT-REACTIVATION-TRAP`, `DT-REGION-FUND-DELEGATION-MODEL-PENDING`, `DT-AP-AR-FINANCE-AUTHORITY-MODEL-PENDING`. (Disciplina do envelope: **não** usei nome "authority missing" — a DECISION já registra autoridade inicial; o gap é delegação/modelo futuro.)
3. **`REMEDIATION_DECISIONS_LOG.md`** — entrada 0114.
4. **STATUS / opus / este log** — atualizados.

## Decisão registrada (núcleo)
Fundo Regional é da **plataforma**, não de empresa; **autoridade inicial = fundador/criador** (SSOT, sem CPF hardcoded); delegação futura só por mecanismo formal. AP/AR latente segue a mesma autoridade inicial; reativação exige DECISION de modelo (tenant-finance / company-finance / delegado / híbrido) + gate. **Não religar Proxy.**

## Confirmações exigidas
- **F3.1 ficou limitada às 3 rotas vivas:** `POST /events/:id/settlement/settle`, `POST /payment-methods`, `POST /unifycard/methods`.
- **Proxies latentes continuam bloqueados** (fora da F3.1): unifycard txn, settlement, region credit/debit, AP/AR, payment-split, payout.

## O que NÃO foi feito (escopo)
Zero código/migration/Bank/frontend/runtime · nenhuma rota/service alterada · nenhum Proxy religado · nenhuma role/tabela/ledger criada · `company_status`/KYB intocados · `docs/memorias/`/autorais intocados · **sem CPF hardcoded**, sem criar user/actor/identidade · F3.1 não executada.

## Prova
- **4 gates docs-only OK:** `actor-writer` · `bank-ledger` · `regression-guards` (365, numeração única) · `arch --strict` `critical_new=0`/`warning_new=1`=c3.
- Working tree: só docs + os autorais protegidos/untracked; commit `decisions:`.

## DTs
- `DT-MONEY-LATENT-REACTIVATION-TRAP` · `DT-REGION-FUND-DELEGATION-MODEL-PENDING` · `DT-AP-AR-FINANCE-AUTHORITY-MODEL-PENDING` → **OPEN**.
- `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` → segue OPEN (fatia 3 = F3.1).

## Próximo passo
`F-MONEY-LIVE-AUTHORSHIP-GATE-F3_1` (código) — gatear as 3 rotas vivas: event-settlement = autoridade sobre o evento; payment-method = `canRepresentActor(req.user, input.actorId)`; unifycard-method = tenant-admin. Suite financeira + `validate:bank-ledger-boundaries` + tríade spoof/legítimo/sem-vínculo.
