# CP-5 — validação read-only Grupo C (`batch2_hint` = `no_genesis_user`)

**Data (UTC):** 2026-04-17  
**Ambiente:** `unificard_dev` (local)  
**Norma:** `EXECUTAR/IDENTITY_RECONCILIATION_RUNBOOK.md` — *Queries read-only — candidatos Grupo C* (PASSO 1–3 com CTE `joined` / `hinted` + `CASE` espelhando `identity-cp5-export-a2-candidates.ts`).

---

## Erratum (normativo)

Uma execução intermédia usou critério simplificado (`user_id IS NULL` + `NOT EXISTS` em `users` por `user_id`). **Esse predicado não é equivalente garantido** ao `batch2_hint = no_genesis_user` do export (ex.: actores com `user_id` órfão ou match genesis caem noutros hints). O SQL canónico é **apenas** o do runbook (reconstrução completa). Nesta base, a contagem coincidiu (315) entre o atalho e o canónico — coincidência **não** constitui prova de equivalência.

Tentativa de `WHERE actors.batch2_hint = 'no_genesis_user'` → **erro `42703`** (coluna inexistente no DDL) — violação de **FASE S** (predicado sem verificação de schema), não “falha de dados”.

---

## Auditoria CASE ↔ TypeScript (ordem dos ramos)

| Ordem | TypeScript (`identity-cp5-export-a2-candidates.ts`) | SQL (`hinted.batch2_hint_equivalent`) |
|-------|------------------------------------------------------|----------------------------------------|
| 1 | `user_row_by_user_id && gu_via_user_id` | `user_row_by_user_id AND gu_via_user_id IS NOT NULL` |
| 2 | `user_row_genesis_match && gu_via_genesis` | `user_row_genesis_match AND gu_via_genesis IS NOT NULL` |
| 3 | `user_row_by_user_id && !gu_via_user_id` | `user_row_by_user_id AND gu_via_user_id IS NULL` |
| 4 | `!user_row_by_user_id && r.user_id` | `(NOT user_row_by_user_id) AND user_id IS NOT NULL` |
| 5 | `!user_row_genesis_match` | `NOT user_row_genesis_match` → `no_genesis_user` |
| else | `unresolved_manual` | `ELSE` → `unresolved_manual` |

**Re-validação (read-only, 2026-04-14):** reexecução dos PASSO 1–3 do runbook (SQL idêntico ao bloco canónico) sobre `unificard_dev` local — resultados **iguais** às secções abaixo (`total_candidatos` = 315; amostras 20 / 10 coincidentes).

---

## Regras

- Apenas `SELECT`; sem `UPDATE`.  
- `batch2_hint` **não** é coluna de BD.  
- §GLOBAL BLOCK: só leitura / auditoria; nenhuma escrita material derivada deste ficheiro sem PROPOSTA + template Grupo C.

---

## PASSO 1 — `total_candidatos` (hint reconstruído)

```json
[
  { "total_candidatos": "315" }
]
```

---

## PASSO 2 — amostra 20 linhas (`ORDER BY tenant_id, id`)

```json
[
  { "id": "54d495c6-206c-4541-89b6-5d517b6d5c56", "display_name": "Chaos Escrow", "tenant_id": "04f81eb4-329f-48af-90d3-411a157a8ffd" },
  { "id": "b4452d1e-3015-412e-b62b-fdd367201a27", "display_name": "Chaos Funding", "tenant_id": "04f81eb4-329f-48af-90d3-411a157a8ffd" },
  { "id": "b864ca5e-d24b-4031-8186-eefabaab716b", "display_name": "Chaos User 2", "tenant_id": "04f81eb4-329f-48af-90d3-411a157a8ffd" },
  { "id": "c53e965b-cb80-42c9-972b-19ad97e9c054", "display_name": "Chaos User 1", "tenant_id": "04f81eb4-329f-48af-90d3-411a157a8ffd" },
  { "id": "df93b161-612c-4b4a-ba14-1216a6c8d11b", "display_name": "Chaos Clearing", "tenant_id": "04f81eb4-329f-48af-90d3-411a157a8ffd" },
  { "id": "e1d579f9-961a-4eee-a238-f7637e85a6f3", "display_name": "Chaos Bank Settlement", "tenant_id": "04f81eb4-329f-48af-90d3-411a157a8ffd" },
  { "id": "1641a799-266d-433d-8a21-c3330568016a", "display_name": "Seller inv-prod7-3ef5b8ab", "tenant_id": "0afc4c0d-98b5-4270-9c32-5599c088a8a0" },
  { "id": "c48c5acd-0408-4c78-9536-8a446297d01d", "display_name": "Buyer inv-prod7-3ef5b8ab", "tenant_id": "0afc4c0d-98b5-4270-9c32-5599c088a8a0" },
  { "id": "1bfddd27-7772-402b-ae06-899f8e4981b3", "display_name": "Chaos Escrow", "tenant_id": "0bb97401-1feb-42f2-a2c7-d570dadbaded" },
  { "id": "33578699-9cd7-4c9f-bcc3-9f55091b40b0", "display_name": "Chaos User 2", "tenant_id": "0bb97401-1feb-42f2-a2c7-d570dadbaded" },
  { "id": "45f0819d-b2e4-4e2f-bd41-0f5c87bed11e", "display_name": "Chaos Funding", "tenant_id": "0bb97401-1feb-42f2-a2c7-d570dadbaded" },
  { "id": "511ecd0f-c655-406d-a889-3ae42a4d1827", "display_name": "Chaos Bank Settlement", "tenant_id": "0bb97401-1feb-42f2-a2c7-d570dadbaded" },
  { "id": "5af7eb4c-01de-4f66-a86b-6f283538f303", "display_name": "Chaos Clearing", "tenant_id": "0bb97401-1feb-42f2-a2c7-d570dadbaded" },
  { "id": "97efdd47-d173-4292-8a50-938d8236c770", "display_name": "Chaos User 1", "tenant_id": "0bb97401-1feb-42f2-a2c7-d570dadbaded" },
  { "id": "1ffd2167-cd51-423f-8f22-6e111ab098bb", "display_name": "Chaos Bank Settlement", "tenant_id": "1066bc56-f461-4d54-9b09-e73ba52ec12d" },
  { "id": "8cca69d4-c12c-42d2-aa72-9cd082b4414e", "display_name": "Chaos Clearing", "tenant_id": "1066bc56-f461-4d54-9b09-e73ba52ec12d" },
  { "id": "95091fa4-08f6-4df3-99b4-8613fde8f751", "display_name": "Chaos User 1", "tenant_id": "1066bc56-f461-4d54-9b09-e73ba52ec12d" },
  { "id": "d9a4a817-079f-4754-a0a1-5dfba10616e5", "display_name": "Chaos Funding", "tenant_id": "1066bc56-f461-4d54-9b09-e73ba52ec12d" },
  { "id": "e2600c22-9de4-4cea-884b-2ed3426d54d3", "display_name": "Chaos User 2", "tenant_id": "1066bc56-f461-4d54-9b09-e73ba52ec12d" },
  { "id": "e37115e9-c513-4755-8a38-f9771656a7c1", "display_name": "Chaos Escrow", "tenant_id": "1066bc56-f461-4d54-9b09-e73ba52ec12d" }
]
```

---

## PASSO 3 — fora de `Chaos%` (10 linhas)

```json
[
  { "id": "1641a799-266d-433d-8a21-c3330568016a", "display_name": "Seller inv-prod7-3ef5b8ab" },
  { "id": "c48c5acd-0408-4c78-9536-8a446297d01d", "display_name": "Buyer inv-prod7-3ef5b8ab" },
  { "id": "acb981d3-69cf-4e7b-981b-950efd5dae89", "display_name": "E2E Seller" },
  { "id": "f74a5540-839f-433e-b693-6e310c4ed1ce", "display_name": "E2E Seller" },
  { "id": "db4810da-aff2-4498-a545-97fffe9db203", "display_name": "E2E Seller" },
  { "id": "f088ed8e-61fc-432a-8487-e026ecc67a8b", "display_name": "E2E Seller" },
  { "id": "6cceb175-c2b3-4e68-ad57-8bf9735f2e63", "display_name": "E2E Seller" },
  { "id": "1926b04d-63b4-4423-b453-e4811ea6c869", "display_name": "E2E Loja Supermercado" },
  { "id": "fbd111f7-38d9-4e98-bc77-d72d50634556", "display_name": "E2E Seller" },
  { "id": "1fdd579f-f70d-4dad-a2f9-1611a61c1b7f", "display_name": "E2E Seller" }
]
```

---

## Nota de contagem

`total_candidatos` = subset **`person`** + `is_identity_required` + hint `no_genesis_user` reconstruído. **Não** é a métrica **A2** completa (`user` / `actor_human` incluídos).
