# Verificação BD — Bloco 1 (economic_guardianship, canonical_products, products)

**Data:** 2026-04-10  
**Comandos:** `pnpm migrate` (nada pendente) + consultas Node (`pg` + `dotenv`) a `information_schema` / `pg_indexes` / `pg_constraint` (script temporário removido após captura).

---

## economic_guardianship

### Estado antes da sessão

- Não foi necessário alterar schema: `pnpm migrate` reportou migrations já registadas.

### Estado depois (evidência `information_schema.columns`)

Colunas observadas na tabela `public.economic_guardianship`:

| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| … | … | … |
| **limit_amount_cents** | **bigint** | **NO** |

- Coluna **`limit_amount`**: **ausente** (não aparece no inventário de colunas).
- **CHECK:** `chk_economic_guardianship_limit_amount_cents_positive` → `CHECK ((limit_amount_cents > 0))`

### Migration aplicada

- **Sim** (estado actual da BD): correcção `20260513100000_economic_guardianship_limit_amount_cents.sql` reflectida no schema (`limit_amount_cents` BIGINT NOT NULL + CHECK > 0; sem `limit_amount`).

---

## canonical_products

| Verificação | Resultado |
|-------------|-----------|
| `scope` existe e NOT NULL | **OK** (`is_nullable` = NO) |
| `tenant_id` nullable | **OK** (`is_nullable` = YES) |
| Índices parciais gtin global/scoped | **OK** — `uidx_canonical_gtin_global`, `uidx_canonical_gtin_scoped` |
| Índices parciais fingerprint global/scoped | **OK** — `uidx_canonical_fingerprint_global`, `uidx_canonical_fingerprint_scoped` |

---

## products constraint INDUSTRIAL

- **Presente:** **sim** — `chk_products_industrial_requires_canonical` em `pg_constraint` sobre `public.products`.

### Anexo — saída bruta (JSON)

```json
{
  "economic_guardianship_columns": [
    { "column_name": "id", "data_type": "uuid", "is_nullable": "NO" },
    { "column_name": "tenant_id", "data_type": "uuid", "is_nullable": "NO" },
    { "column_name": "subject_actor_id", "data_type": "uuid", "is_nullable": "NO" },
    { "column_name": "guardian_actor_id", "data_type": "uuid", "is_nullable": "NO" },
    { "column_name": "scope", "data_type": "text", "is_nullable": "NO" },
    { "column_name": "effective_at", "data_type": "timestamp with time zone", "is_nullable": "NO" },
    { "column_name": "expires_at", "data_type": "timestamp with time zone", "is_nullable": "NO" },
    { "column_name": "created_at", "data_type": "timestamp with time zone", "is_nullable": "NO" },
    { "column_name": "limit_amount_cents", "data_type": "bigint", "is_nullable": "NO" }
  ],
  "economic_guardianship_check_constraints": [
    {
      "conname": "chk_economic_guardianship_limit_amount_cents_positive",
      "def": "CHECK ((limit_amount_cents > 0))"
    }
  ],
  "canonical_products_scope_tenant": [
    { "column_name": "scope", "is_nullable": "NO" },
    { "column_name": "tenant_id", "is_nullable": "YES" }
  ],
  "canonical_products_indexes": [
    "canonical_products_pkey",
    "idx_canonical_products_concept_id",
    "idx_canonical_products_tenant",
    "idx_canonical_products_tenant_category",
    "idx_canonical_products_tenant_gtin_lookup",
    "uidx_canonical_fingerprint_global",
    "uidx_canonical_fingerprint_scoped",
    "uidx_canonical_gtin_global",
    "uidx_canonical_gtin_scoped"
  ],
  "products_industrial_constraint": [
    { "conname": "chk_products_industrial_requires_canonical" }
  ]
}
```

---

## STATUS FINAL

**PASS**
