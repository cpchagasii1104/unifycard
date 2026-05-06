# Bloco 3 — DATA REPAIR + fecho (2026-04-12)

## Antes (evidência inicial)

- `2026-04-12_bloco3_sql_output.txt`: **#1b** inexistente; **#1a** `marketplace-%` = 0 linhas; **#2** = 23 órfãos; **#3a/#3b/#4** = PASS parcial.
- Causa **#1a**: `concepts.domain` = N0 (`item-comercial`, `produtos-e-comercio`, …), não slugs N1 `marketplace-*` (ORIENTACAO legado).
- Causa **#2**: raízes N1 `marketplace-*` sem canónico global próprio (seed 3C só em folhas) + categorias `cat-e2e-*` com produtos (DELETE inviável).

## Acções (versionadas — sem UPDATE manual ad hoc)

| Ficheiro | Conteúdo |
|----------|----------|
| `backend/migrations/20260518120000_bloco3_data_repair_n1_roots_and_e2e_cleanup.sql` | `set_config` governance; limpeza `cat-e2e-*` **onde** sem produtos/filhos; concepts `bloco3-root-*`; INSERT `canonical_products` global READY para 6 raízes marketplace. |
| `backend/migrations/20260518121000_bloco3_scaffold_global_for_e2e_categories.sql` | concepts `bloco3-e2e-<uuid>`; INSERT global READY por categoria `cat-e2e-*` (produtos retidos). |
| `docs/03_execution_log/2026-04-12_bloco3_sql_evidence.sql` | Critério **#1b** (`domain = 'item-comercial'`) + **#1a** legado documentado; restantes inalterados na intenção. |

**Comandos:** `pnpm run migrate` (×2, uma por migration nova); `psql -f …sql_evidence.sql -o …after_repair.txt`; teste **#4** `psql -f …sql_constraint_test.sql`.

## Depois (`2026-04-12_bloco3_sql_output_after_repair.txt`)

| Critério | Resultado |
|----------|-----------|
| #1a legado `LIKE 'marketplace-%'` | 0 linhas (esperado com N0) |
| #1b `item-comercial` | **52** (> 0) **PASS** |
| #2 órfãs §3C | **0 linhas** **PASS** |
| #3a | 0 **PASS** |
| #3b | 52 **PASS** |
| #4 `chk_products_industrial_requires_canonical` | ERRO PG esperado **PASS** |

## STATUS

**PASS** (Bloco 3 fechado no critério operacional #1 = **#1b** + #2–#4). **#1a** mantém-se só como trilho legado ORIENTACAO vs SSOT N0.

## Próximo passo

- Bloco **4** já estava **PASS** no mapa `2026-04-11_EXECUTION_COMPLETE.md` — não reabrir sem nova ordem do plano.
- Manter gates: `pnpm run check:canonical-gates` em PRs.

## DESBLOQUEIO (retoma DB)

- `DATABASE_URL`: `backend/.env` (valor não registado).
- `SELECT 1`: OK.
- `migrate`: aplicadas `20260518120000_*` e `20260518121000_*`.
