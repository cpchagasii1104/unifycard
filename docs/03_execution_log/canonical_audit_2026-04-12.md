# Auditoria contínua — Canonical Gates (C.7 / C.10 / C.22)

**Âmbito:** `backend/src/` (ficheiros `.ts`)  
**Data:** 2026-04-12  
**Modo:** só leitura — **nenhuma alteração de código**

---

## Metodologia

1. `rg "canonical_products" backend/src --glob "*.ts"` — inventário completo de referências.
2. Para cada ocorrência em **SQL** (`FROM` / `JOIN` / `INSERT` / subconsultas): leitura de contexto (WHERE/JOIN).
3. Classificação:
   - **REGRA 1 (FAIL):** `FROM` ou `JOIN` em `canonical_products` **e** condição de visibilidade **baseada em** `tenant_id` **em SQL** **sem** `sqlCanonicalIdMatchesTenantContext` (ex.: `WHERE cp.tenant_id = $1`, `WHERE cp.tenant_id = p.tenant_id`).
   - **REGRA 2 (REVIEW):** `tenant_id =` noutros contextos (não FAIL para canonical salvo violação acima).
   - **REGRA 3 (PASS):** uso de `sqlCanonicalIdMatchesTenantContext` na cadeia de visibilidade da query.
   - **REGRA 4 (excepção):** `concept.commands.ts` — acesso por PK sem helper (explicitamente permitido).

---

## Resultado global

| Classificação | Contagem |
|---------------|----------|
| **FAIL** | **0** |
| **PASS** | Ver lista abaixo |
| **REVIEW** | Ver secção (amostragem + métrica) |

**FAIL FAST:** não aplicável — **nenhum FAIL** — **sem regressão detectada** no âmbito das regras 1–4.

---

## FAIL

*(vazio)*

---

## PASS — usos correctos (queries `canonical_products` + visibilidade)

| Ficheiro | Resumo |
|----------|--------|
| `core/catalog/canonical/canonical-product-readiness.ts` | Define `sqlCanonicalIdMatchesTenantContext` / `sqlOrderScopedCanonicalFirst` (comentários + SQL gerado). |
| `core/catalog/canonical/canonical-product.repository.ts` | `findByTenantAndGtin`, `findByTenantAndFingerprintV1`, `findIndustrialByFingerprintInputs`, `findByTenantNameBrandCategory`, `findIndustrialById`: todas com `${vis}` / `${idMatch}` = helper. `INSERT`: escrita, não listagem por visibilidade tenant. |
| `core/catalog/canonical/canonical-product.service.ts` | `search`, `findByGTIN`, listagens: `canVis` / `sqlCanonicalIdMatchesTenantContext` em `WHERE`. |
| `modules/catalog/catalog.service.ts` | `findByGTIN`, `findById`, `search` (ramo INDUSTRIAL): helper no `WHERE`. |
| `modules/marketplace/store-onboarding.service.ts` | `listAvailableCatalogProducts`, `getCategoryProductStats` (subquery), `findCatalogProductsByCategories`: `cpVis` / helper + alias `cp` ou `canonical_products`. |
| `modules/marketplace/product.repository.ts` | `getProductById` (validação canónico): `cpVis` em `WHERE` sobre `cp`; `listProducts` EXISTS com `cpVis` + READY. |
| `modules/marketplace/adapters/concept-offer-refs.adapter.ts` | `resolveVisibleCanonicalToConceptRef`: `AND ${tenantMatch}` com `sqlCanonicalIdMatchesTenantContext('cp', '$2::uuid')`. `resolveRefsBatchFromVariants`: `LEFT JOIN canonical_products cp ON cp.id = … AND ${cpTenant}` com `sqlCanonicalIdMatchesTenantContext('cp', 'p.tenant_id')`. |

### PASS — comentários / tipos (sem SQL)

| Ficheiro | Nota |
|----------|------|
| `modules/marketplace/product-catalog.types.ts` | Comentário de documentação. |
| `modules/marketplace/store-onboarding.types.ts` | Comentário de documentação. |
| `core/catalog/canonical/canonical-product-creation.pipeline.ts` | Comentário; sem query `canonical_products` no ficheiro. |
| `core/catalog/canonical/canonical-concept-resolution-queue.service.ts` | Comentário; SQL usa `canonical_concept_resolution_queue`, não `canonical_products`. |

### PASS (excepção REGRA 4) — PK sem helper na query

| Ficheiro | Linha (aprox.) | Motivo |
|----------|----------------|--------|
| `commands/concept.commands.ts` | ~15 | `SELECT tenant_id FROM canonical_products WHERE id = $1` — **excepção normativa** (PK only). |

### PASS — caminho diagnóstico no adapter (não viola REGRA 1)

| Ficheiro | Função | Motivo |
|----------|--------|--------|
| `modules/marketplace/adapters/concept-offer-refs.adapter.ts` | `diagnoseCanonicalPointer` | `FROM canonical_products cp WHERE cp.id = $1` — **sem** condição de visibilidade por `cp.tenant_id` em SQL; após o SELECT, **`canonicalVisibleForTenant(bare, tenantId)`** em TypeScript (mesma semântica scoped/global que o helper). **Não** entra no literal da REGRA 1 (que exige filtro de visibilidade **baseado em tenant_id** na query **sem** helper). |

---

## REVIEW — `tenant_id =` fora do escopo anti-pattern `canonical_products`

**Instrução:** marcar ocorrências de `tenant_id =` para revisão humana; **FAIL** apenas se envolver visibilidade `canonical_products` sem helper.

### Métrica

- `rg "tenant_id\\s*=" backend/src --glob "*.ts"` → ocorrências em **~200+ ficheiros** (contagem por ficheiro no grep do executor).

### Interpretação

- A grande maioria refere **`products`**, **`actors`**, **`bank_*`**, **`orders`**, etc. — **isolamento multi-tenant habitual**, **sem** `FROM canonical_products` / `JOIN canonical_products`.
- **Ficheiros com `canonical_products` no mesmo repo** já classificados em **PASS** acima; nenhum usa `cp.tenant_id = $1` / `cp.tenant_id = p.tenant_id` como **única** regra de visibilidade de canónico.

### Amostra de ficheiros só “REVIEW” (não-canonical)

`companies.service.ts`, `bank-ledger.repository.ts`, `order-item.repository.ts`, `groups.repository.ts`, `services-discovery.service.ts`, … (lista completa disponível via mesmo comando `rg`).

### Casos no adapter com `tenant_id` em **products** / **variants** (não `cp`)

- `concept-offer-refs.adapter.ts`: `ON p.tenant_id = pv.tenant_id`, `WHERE pv.tenant_id = $1` — **JOIN/WHERE em `products` / `product_variants`**, não substituem o helper em `canonical_products`.

---

## Evidência de comando

```text
rg "canonical_products" backend/src --glob "*.ts"
```

→ 4 ficheiros com SQL relevante + adapter + repo + service + catalog + onboarding + product.repository + `concept.commands.ts` (lista na secção PASS).

---

## Conclusão para o plano

- **C.7 / C.10 / C.22 (inventário actual):** **PASS** — **não bloquear** avanço por regressão de visibilidade `canonical_products` nesta auditoria.
- **Recomendação:** manter gate CI (`check:canonical-gates`) e repetir esta auditoria após PRs que toquem em `canonical_products` ou em helpers de readiness.

---

## Assinatura

Auditoria gerada por executor automático (Cursor); revisão humana opcional para endurecer política (“toda leitura `canonical_products` deve incluir literalmente o helper na mesma string SQL”) — **actualmente não exigido** pelo texto literal da REGRA 1 fornecida.
