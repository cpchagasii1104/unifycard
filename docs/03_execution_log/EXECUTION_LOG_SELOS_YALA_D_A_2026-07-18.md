# EXECUTION LOG — Registro dos selos YALA das Fatias D e A (docs-only) — 2026-07-18

> **MODO ÚNICO: EXECUTOR.** Ato exclusivamente **docs-only, append-only**: versionar o relatório YALA e registrar os DOIS selos autorizados com a redação literal da §6. **Zero mudança material.**

**HEAD inicial:** `04f4584be` · **HEAD final:** `e76757898`.
**Autorização:** `docs/04_audit/YALA_FINAL_FATIAS_D_A_R8_R7_2026-07-18.md` (§6) — vereditos independentes **FATIA D = PASS/APTA (endpoint)** e **FATIA A = PASS/APTA (viewer + perfil efêmero)**.

## Commits produzidos (docs-only)
- `017830e0a` — versiona o relatório YALA (byte-exato).
- `e76757898` — registra os dois selos no cartório (append-only, redação literal da §6).
- (este) — execution log.

## Relatório YALA versionado
- Arquivo: `docs/04_audit/YALA_FINAL_FATIAS_D_A_R8_R7_2026-07-18.md`.
- **sha256 antes do add == depois do commit:** `f2eec0fbacf66404a8936f1073e91d0f577c3a1bdffc097037146df3034957b6` (byte-exato; não editado/normalizado).

## Preflight confirmado (do relatório YALA)
HEAD auditado `04f4584be`; intervalo `8163a252e..04f4584be`; runner **192/192 · exit 0 · 0 GATE FAIL** (re-executado pela YALA); typecheck backend/frontend = 0; **Δbank=0**; migrations=**520**; **N1 ausente** de `schema_migrations`; **invoices=NULL**; N0/N1/N2/ontologia intactos.

## Selos registrados (redação veio LITERALMENTE da §6 do relatório YALA)
**SELO D — FATIA D · FRONTEIRA BANK DO ENDPOINT DO FUNDO REGIONAL — ✅ SELADA PELA YALA (RESTRITO)**
> Autorizado pela auditoria independente `docs/04_audit/YALA_FINAL_FATIAS_D_A_R8_R7_2026-07-18.md` (§1 = PASS). O caminho vivo de `GET /bank/regional-fund` (`transparency.service.getUserRegionalFund`) **não faz mais SQL direto a `bank_*`**: saldo via `bankPortsRegistry.getBankAccount().getBalance`; extrato via `getLedgerEntriesByAccount` (reuso de `bankLedgerRepository.getEntriesByAccount`); metadados via `getMetadataByTransactionIds` (tenant-scoped) — implementações em `modules/bank`. Contrato `RegionalFundView` preservado; guard `audit-unifybank-no-direct-ledger-sql` no runner (192/192); E2E territorial verde; Δbank=0; ratchet financial-ssot 592→591 legítimo. **RESTRIÇÕES:** NÃO declara `core/unifybank` soberano; NÃO declara a fronteira Bank saneada; a **DT-UNIFYBANK segue OPEN** (dívida-irmã statement/admin/donation/governance). Commits `9e620a696`+`2bea83770`; runner verde no HEAD `04f4584be`.

**SELO A — FATIA A · PERFIL FULL EFÊMERO GOVERNADO + VIEWER ACTOR PAGE — ✅ SELADA PELA YALA (RESTRITO)**
> Autorizado por esta auditoria (§2 = PASS). A prova FULL da Actor Page é agora **reproduzível do repositório sem pré-marcação falsa**: N1 dormente `20260713140000` em `IGNORED_MIGRATIONS` (SKIPPED ≠ APPLIED; N1 byte-intacta; nada inserido em `schema_migrations`); `migrate FULL` efêmero completa sem abortar; **actor-page 19/19** (spoof L/M/N/O, fallback P, Δbank=0); DB efêmera destruída; `unificard_dev` intocado. **RESTRIÇÕES:** NÃO fecha a DT-EPHEMERAL (partes (b) registry persistente do dev e (c) registry-por-filename seguem OPEN); NÃO reconcilia o registry do dev; NÃO altera a N1. Commit `7e744f4e7`; runner verde no HEAD `04f4584be`.

## Confirmações
- **Redação dos dois selos copiada LITERALMENTE da §6** (linhas 99-100 e 102-103 do relatório) — sem improviso, sem ampliação de alcance.
- **Zero mudança material:** somente `docs/04_audit/YALA_FINAL_FATIAS_D_A_R8_R7_2026-07-18.md`, `REMEDIATION_DT_LOG.md` e este execution log. Nenhum código/guard/baseline/migration/frontend tocado. **migrations=0; Δbank=0; nenhuma alteração de banco.**
- **Nenhum selo além de D e A.** Nenhum terceiro selo; módulo Invoicing NÃO declarado materializado; `core/unifybank` NÃO declarado soberano.
- **DTs que permaneceram OPEN (não fechadas):**
  - `DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL` = 🔴 OPEN · PARCIALMENTE REMEDIADA;
  - `DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED` = 🔴 OPEN · PARCIALMENTE REMEDIADA;
  - `DT-INVOICING-HARDCODED-TAX-RATE` = 🔴 OPEN · PARCIALMENTE REMEDIADA.
- **D9.2-B / B-CITY-2 / PORTA 01:** fechados/intocados. N0/N1/N2/ontologia/vocabulário intactos.
- **Untracked pré-existentes preservados:** `02_decisions_FULL.txt` e `docs/04_audit/YALA1_AUDITORIA_CAMPANHA_ACD_2026-07-18.md` — não tocados/movidos/apagados.

Após este registro: **STOP.**
