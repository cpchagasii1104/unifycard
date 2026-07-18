# EXECUTION LOG — R-8 (fronteira Bank) + R-7 (perfil efêmero governado) — 2026-07-18

> **MODO: EXECUTOR.** GO material do Gate `docs/04_audit/GATE_READONLY_R8_R7_DESTRAVAMENTO_D_A_2026-07-18.md` (R-8 e R-7 = VEREDITO A). Dois envelopes, commits/provas separados. **Nenhum selo emitido; A e D permanecem CONDICIONAIS/AGUARDA YALA.**

**HEAD inicial:** `8163a252e` · **HEAD final:** `b7c72b2af`.

## Commits (por concern)
- `9e620a696` R-8 material (endpoint sem SQL direto; reuso do reader Bank) + guard novo + E2E caso H.
- `7e744f4e7` R-7 (N1 dormente → `IGNORED_MIGRATIONS`; log SKIPPED honesto).
- `a1d1dae65` versiona o relatório de Gate (byte-exato).
- `2bea83770` R-8 refino: consumo via **PORTAS** públicas do Bank (não import de repositório) + ratchet `financial-ssot` 592→591.
- `b7c72b2af` cartório R-8/R-7 (AGUARDA YALA; DTs → PARCIALMENTE REMEDIADAS).

## R-8 — fronteira Bank do endpoint
- **Causa:** `getUserRegionalFund` montava as movimentações do fundo por SQL direto a `bank_ledger`/`bank_transactions` em `core/unifybank` (fora de `modules/bank`).
- **Via escolhida (Gate VEREDITO A · reuso):** portas públicas do Bank — `bankPortsRegistry.getBankAccount().getLedgerEntriesByAccount` (extrato; impl. `bankAccountService`→`bankLedgerRepository.getEntriesByAccount`) + `getBankTransactionRead().getMetadataByTransactionIds`. Saldo permanece via `getBalance`. **Sem repository/port paralelo; sem alterar mapping region↔account; contrato `RegionalFundView` byte-idêntico.**
- **Guard:** `audit-unifybank-no-direct-ledger-sql` (escopado ao método por brace-match; exige uso via `bankPortsRegistry` e MORDE import de repositório do Bank ou `FROM bank_ledger`). Integrado ao runner (191→192). **Prova negativa:** reintroduzir `SELECT FROM bank_ledger` no método → guard MORDE; restauração byte-exata.
- **Provas:** typecheck 0; E2E `regional-fund-residence-reader` **8/8** (A–G + **H** = movimentações reais 4200 + saldo do ledger via porta + metadata `context=donation`; isolamento SP≠Curitiba; Δbank=0); `audit-regional-fund-contract` GATE OK; `red-gates-baseline` GATE OK (financial-ssot 591/591 após ratchet); bank-boundary guards GATE OK.
- **Δbank=0** (leitura pura; sem escrita/lock/cache/saldo reconstruído). **Dívida-irmã OPEN** (statement/admin/donation/governance). **Fatia D não selada.**

## R-7 — perfil FULL efêmero governado
- **Causa:** a migration N1 `20260713140000` é DORMENTE self-aborting; sob FULL o runner abortava, forçando pré-marcação manual não versionada (bypass condenado).
- **Alteração (Gate VEREDITO A · mecanismo governado):** N1 adicionada a `IGNORED_MIGRATIONS` (`migration-runner-core.ts`) → `shouldExecuteMigration=false` → SKIPPED, nunca executada, nunca em `schema_migrations`. Migration INTOCADA. Log de `migrate.ts` → "SKIPPED (skip governado ... NÃO marcadas como aplicadas)".
- **Provas (banco efêmero governado, SEM pré-marca):** `migrate.ts` FULL exit 0; `⏭️ SKIPPED: 20260713140000...` no log; N1 **ausente de `schema_migrations`** (`[]`); 526 migrations aplicadas; actor-page E2E **19/19** (spoof L/M/N/O, fallback P, `ACTOR_USER_ANCHOR_AMBIGUOUS`, Δbank=0); `unificard_dev` intocado (520 migrations, N1 ausente). **Prova negativa:** remover N1 de `IGNORED_MIGRATIONS` → `migrate.ts` FULL aborta na N1; restauração byte-exata. `audit-migration-runner-isolation` GATE OK.
- **FORA (bloqueado/separado):** (b) objetos `20260713100000`/`120000` em dev sem registry (persistente, VEREDITO C); (c) registry por filename; alteração da migration N1. **Fatia A não selada.**

## Runner canônico
```text
comando:  node scripts/run-regression-guards.mjs   (PATH += node_modules/.bin)
dir:      C:\unificard\backend · node v22.16.0 · commit 2bea83770 · ~52s
RESULTADO: 192/192 · exit 0 · 0 GATE FAIL
warnings/ratchets (não-fatais, GATE OK):
  - RATCHET financial-vocabulary 3855 < 3889 (pré-existente/cumulativo; fora do escopo R-8/R-7)
  - 🟡 fiscal-tax-catalog: DT-INVOICING OPEN + hardcode ausente (esperado; DT intencionalmente OPEN)
dev antes==depois: migrations=520 · bank(ledger/tx)=0/0 · N1 ausente. Δbank=0; migrations aplicadas=0.
```

## Estado final
- **Fatia A** = AGUARDA YALA (prova FULL agora reprodutível do repo, sem pré-marca).
- **Fatia C** = já selada (contenção fail-closed) em campanha anterior — não tocada aqui.
- **Fatia D** = AGUARDA YALA (endpoint fechado; dívida-irmã OPEN).
- **DTs:** DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL e DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED = **PARCIALMENTE REMEDIADAS** (partes remanescentes OPEN).
- **Nenhum selo emitido.** N0/N1/N2/ontologia intactos; PORTA 01 fechada; D9.2-B/B-CITY-2/Invoicing material/RFC não tocados; `02_decisions_FULL.txt` intocado.
