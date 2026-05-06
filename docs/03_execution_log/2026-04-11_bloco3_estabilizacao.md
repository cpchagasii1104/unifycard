# Bloco 3 — Estabilização (2026-04-11)

| Item | Estado | Nota |
|------|--------|------|
| 3A granularity | N/A | Decisão não tomada nesta execução |
| 3B seed ficheiro | [✓] repo | `20260503200000_seed_concepts_item_comercial.sql` versionado |
| 3C seed ficheiro | [✓] repo | `20260503300000_seed_canonical_products_global.sql` versionado |
| Counts SQL / órfãs / constraint INSERT test | **[✓] PASS** | Evidência `docs/03_execution_log/2026-04-12_bloco3_sql_output_after_repair.txt` + migrations `20260518120000_*`, `20260518121000_*` |
| 5A `product_type` | [~] | Migration `20260504100000` no repo; grep TS/normalização não reexecutado na íntegra |
| 5B DDL | [✓] repo | `20260505100000`, `20260506100000` referenciados no plano |
| Fase 4 `importProductTemplates` | **[✓] Fechado** | 0 ocorrências em `backend/**/*.ts` — `2026-04-09_fase4_legacy_removed.md` |

**Resultado:** **PASS** (2026-04-12) — critérios operacionais Bloco 3 com Postgres + data repair versionado; ver `docs/03_execution_log/2026-04-12_bloco3_execucao_continua.md`.

**Histórico:** 2026-04-11 FAIL/PENDENTE sem BD; 2026-04-12 PARTIAL após primeira retoma SQL; 2026-04-12 **PASS** após migrations `20260518120000_bloco3_data_repair_n1_roots_and_e2e_cleanup.sql` e `20260518121000_bloco3_scaffold_global_for_e2e_categories.sql`.
