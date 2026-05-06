# Execução contínua ORIENTACAO_PRODUTO_EXECUTAR.md — 2026-04-11

## Blocos

| Bloco | Nome | Status | Log |
|-------|------|--------|-----|
| 1 | Fundação | **PASS** (estático) / BD **PEND** | `2026-04-11_bloco1_foundation.md` |
| 2 | Global canonical | **PASS** | `2026-04-11_bloco2_canonical_global.md` + `2026-04-10_bloco2_global.md` |
| 3 | Estabilização | **PASS** (2026-04-12 — data repair + evidência `2026-04-12_bloco3_sql_output_after_repair.txt`; critério #1 operacional = `#1b` `item-comercial` em `2026-04-12_bloco3_sql_evidence.sql`) | `2026-04-11_bloco3_estabilizacao.md` + `2026-04-12_bloco3_execucao_continua.md` |
| 4 | Contrato de erro | **PASS** | `2026-04-11_bloco4_contrato_erro.md` + `2026-04-10_fase_5c.md` |
| 5 | Prova de realidade | **FAIL** | `2026-04-11_bloco5_prova.md` |

## Pendências

- Aplicar `pnpm migrate` + validar `economic_guardianship` / `canonical_products` com `psql` (Bloco 1 #6–9).
- ~~Fechar critérios SQL Bloco 3 #1/#2~~ — **fechado** 2026-04-12 (`2026-04-12_bloco3_sql_output_after_repair.txt` + migrations `20260518120000_*`, `20260518121000_*`).
- ~~Deprecar Fase 4 (`importProductTemplates`)~~ — **feito** (0 ocorrências em `backend/**/*.ts`; ver `2026-04-09_fase4_legacy_removed.md`).
- C.17: `DATABASE_URL` + `pnpm test:e2e:catalog` + log com SHA.
- Inserir §4.10 em `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` (Bloco 5).
- C.25 automação CI quando spec fechada.
- C.27/C.28/C.30 matriz após C.17.

## Riscos

- **Regra literal «concept_id só no adapter»** vs código e **C.22** do plano (`canonical_products` / outros domínios): conflito normativo; autoridade operacional = plano mestre + grep C.22, não grep global `concept_id`.
- **Plano «concluído»** não pode ser declarado enquanto Bloco 5 = FAIL.

## Nota

Nenhum `EXECUTION_ABORTED.md`: a corrida documentou FAIL/PEND sem inconsistência não recuperável no código verificado; bloqueadores históricos **ambiente (PG)** superados para Bloco 3 em 2026-04-12; **norma Git (§4.10)** segue fora deste fecho se aplicável.
