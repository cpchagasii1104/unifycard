# Fase 2B — Verificação inicial (executor técnico)

**Data:** 2026-04-11  
**Tipo:** Pré-modificação (PASSO 1 apenas) — **nenhum ficheiro de código alterado nesta execução.**

---

## Pré-requisitos documentais

| Artefacto | Estado |
|-----------|--------|
| `PRODUTO_PLANO_MESTRE_COMPLETO.md` (raiz) | **Ausente** — existe `EXECUTAR/STAND_BY_PRODUTO_PLANO_MESTRE_COMPLETO.md` |
| `ORIENTACAO_PRODUTO_EXECUTAR.md` (raiz) | **Ausente** — existe `EXECUTAR/STAND_BY_ORIENTACAO_PRODUTO_EXECUTAR.md` |
| `BACKEND_SRC_FULL.txt` | **Ausente** no repositório — verificação feita contra **`backend/src/`** (código real prevalece) |

---

## PASSO 1 — Estado real no código (concept_ref / canonical)

### 1.1 `concept-offer-refs.adapter.ts`

- `canonicalVisibleForTenant`: aceita `scope === 'scoped'` com `tenant_id === tenantId` **e** `scope === 'global'` com `tenant_id == null`.
- `resolveVisibleCanonicalToConceptRef` / batch: usam `sqlCanonicalIdMatchesTenantContext('cp', …)` de `canonical-product-readiness.ts`.
- **Conclusão:** não está “scoped-only” no predicado de visibilidade de canónico; alinha a **global + scoped** (nomenclatura DDL: `global` / `scoped`, não `GLOBAL`/`TENANT` literais).

### 1.2 `canonical-product-readiness.ts` (helper partilhado)

```text
(scope = 'scoped' AND tenant_id = <expr>) OR (scope = 'global' AND tenant_id IS NULL)
```

- `sqlOrderScopedCanonicalFirst` para desempate (scoped primeiro) em caminhos de descoberta.

### 1.3 `canonical-product.repository.ts`

- `tenantId: string | null` em `CanonicalProductPersistRow` (comentário: NULL = global).
- Métodos de descoberta (`findByTenantAndGtin`, fingerprint, nome/marca/categoria): `sqlCanonicalIdMatchesTenantContext` + `sqlOrderScopedCanonicalFirst`.
- `findIndustrialById`: filtra por `id` **e** `idMatch` (visibilidade no contexto do tenant — Escopo A com C.11 via helper).

### 1.4 Serviço de onboarding (exemplo de uso)

- `store-onboarding.service.ts` — `listAvailableCatalogProducts`: `cpVis = sqlCanonicalIdMatchesTenantContext('cp', '$1::uuid')` + `scopedFirst`.

### 1.5 Anti-regressão C.22 (grep rápido em `backend/src`)

- `cp.tenant_id =` em `.ts`: ocorrências em **SELECT** de colunas / diagnóstico, não padrão proibido `cp.tenant_id = $` / `cp.tenant_id = p.tenant_id` como único filtro de visibilidade (amostra: `concept-offer-refs.adapter.ts`, `store-onboarding.service.ts`).

---

## Divergência a reportar

- **Pedido do utilizador:** “Fase 2B NÃO implementada (adapter/repository/services scoped-only)”.
- **Código actual:** predicados **scoped + global** e `tenant_id` nullable já reflectidos nos helpers e no adapter/repositório/serviços analisados.
- **`STAND_BY_ORIENTACAO_PRODUTO_EXECUTAR.md`:** menciona **Bloco 2 (Fase 2B) PASS** com log `2026-04-10_bloco2_global.md`.

**Resolução:** tratámos o **código em `backend/src/`** como fonte de verdade para esta verificação; a narrativa “2B não feita” **não** bate com o estado actual do repo **sem** nova prova (diff/commit) em contrário.

---

## Próximo passo (se o Clayton quiser fechar 2B formalmente)

1. Reconciliar status no documento mestre em vigor (`STAND_BY_*` ou cópia renomeada para `PRODUTO_PLANO_MESTRE_COMPLETO.md`).
2. Opcional: `pnpm exec` / grep C.22 completo em `backend/src` conforme checklist do `PROMPT_AGENT_BLOCO_2B_CANONICAL_GLOBAL.md`.
3. **Não** alterar adapter até haver **bloqueador novo** com evidência (FAIL FAST).

---

**Status desta execução:** **PASS** na verificação inicial de alinhamento **global + scoped + tenant_id NULL** no pipeline canónico analisado; **bloqueador documental** se a execução obrigar ficheiros com nomes exactos `PRODUTO_PLANO_MESTRE_COMPLETO.md` / `BACKEND_SRC_FULL.txt` na raiz.

**Actualização 2026-04-11:** reconciliação SSOT (Opção A) e checkpoint anti-regressão documentados em **`2B_reconciliation.md`**; cabeçalho `EXECUTAR/STAND_BY_PRODUTO_PLANO_MESTRE_COMPLETO.md` actualizado.
