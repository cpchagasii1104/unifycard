# DECISION-0158 — Baseline formal (ratchet só-desce) para os gates vermelhos

> **Arquivo canônico.** Fonte append-only viva: `REMEDIATION_DECISIONS_LOG.md` (§ DECISION-0158). Criado em 2026-07-03 para fechar a lacuna de rastreabilidade apontada no `auditoria.md` (achado B4).

- **Data:** 2026-07-02
- **Frente:** F-RED-GATES-BASELINE (achado B4 de `auditoria.md`) · **HEAD (pré-commit):** `f2e7680ef`
- **Tipo:** Governança de qualidade / gate-institucional — **MATERIAL money-free** (type-only fixes + baseline JSON + guard-ratchet; NÃO toca runtime/migration/dinheiro/dados).
- **Status:** **PROMULGADA / MATERIAL.** Resolve o "Exige DECISION: baseline formal vs zeragem" do blocker B4.

## Contexto
O laudo `auditoria.md` (B4) apontou o **ponto cego institucional**: 3 gates vermelhos (typecheck 35 no config do gate · `financial-vocabulary` 3.8k · `financial-ssot` ~580) conviviam com um pipeline "verde" — a suíte `validate:regression-guards` não os enxergava. Zeragem das ~4.4k violações financeiras exigiria mexer em massa em código money-adjacent dos trilhos em HOLD (rides/marketplace/treasury) — contra a norma "não-agir em dívida classificada" enquanto o dinheiro está contido.

## Decisão soberana (Clayton, via AskUserQuestion) — Baseline formal + drenagem do typecheck
1. **Typecheck do gate (`tsconfig.build`) = ZERADO e mantido em zero.** Os 35 erros drenados (34 = um padrão único: narrowing de união discriminada quebrado sob `strict:false` — fix `status?: never` nos 3 producers, type-only; 1 = anotação de tipo em E2E). Baseline = 0: qualquer erro novo FALHA.
2. **`financial-vocabulary` e `financial-ssot` = congelados no teto ratificado** (`red-gates-baseline.json`: 3.846 e 587). **Ratchet só-desce:** count > baseline = GATE FAIL; count < baseline = abaixar o baseline no mesmo commit. **Subir o teto exige DECISION própria.**
3. **O pipeline passa a ENXERGAR os 3 gates:** guard `audit-red-gates-baseline.mjs` wired na cadeia `validate:regression-guards` (via agregador — a extensão direta estourou o limite de linha de comando do Windows; exceção de custo ~60-90s documentada) + script standalone `validate:red-gates-baseline`.
4. **A drenagem real das violações financeiras** (4.4k) segue como frente contínua (`DT-FINANCIAL-SSOT-RED-SERVICE-PAYMENT-EXECUTION-REPOSITORY` e correlatas OPEN) — o baseline contém a EXPANSÃO, não fecha a dívida.

## Materialização / Prova
HEAD material `8ce514db3`. Typecheck gate 35→0 (dev strict 47→46; resto = ruído `req.tenant` fora do config do gate). Negative-proof do ratchet: baseline abaixado temporariamente → FALHOU nos 2 mecanismos; restaurado → OK. Cadeia completa EXIT 0; bank-ledger/actor-writer OK; arch strict `critical_new=0`. **Δbank=0.**

## Consequências
**B4 fechado como ponto cego** (a dívida financeira continua, contida com teto e rampa). Com isto, **TODOS os pré-requisitos técnicos de PORTA-1 listados no laudo (§2) estão fechados/contidos**: B1 · B2 · B3 · B4 · B5. O que resta = PORTA-1 em si (B8/B9 + rail bancário externo) e frentes de drenagem documentadas.

- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Fable 5).
- **Referências:** `auditoria.md` (B4, §2) · `backend/scripts/red-gates-baseline.json` · `backend/scripts/audit-red-gates-baseline.mjs` · `tsconfig.build.json`.
