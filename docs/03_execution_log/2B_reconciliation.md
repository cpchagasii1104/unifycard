# Reconciliação SSOT — Fase 2B vs prompts externos

**Data:** 2026-04-11  
**Decisão:** **Opção A** — o **código versionado em `backend/src/`** e os **logs de execução em `docs/03_execution_log/`** são a fonte de verdade operacional para o estado da Fase 2B. O plano em `EXECUTAR/STAND_BY_PRODUTO_PLANO_MESTRE_COMPLETO.md` já estava alinhado com isso (**PASS 2026-04-10**, auditoria **2026-04-12**).

**Responsável pela decisão registada:** equipa UnifiCard; **evidência levantada por** executor técnico (Cursor), **validação humana** pelo proprietário do processo (Clayton) na conversa que formalizou a reconciliação.

---

## 1. Divergência encontrada

| Fonte | Alegação / estado |
|--------|-------------------|
| Prompt ou instrução externa (sessão anterior) | Fase 2B **não implementada**; adapter/repository/services **«scoped-only»**; bloqueador activo. |
| Código + `sqlCanonicalIdMatchesTenantContext` | Predicado **global ∪ scoped** (`scope = 'global'` + `tenant_id IS NULL` **ou** `scope = 'scoped'` + `tenant_id` do contexto). |
| `EXECUTAR/STAND_BY_PRODUTO_PLANO_MESTRE_COMPLETO.md` | **2B [✓] PASS** com referência a `2026-04-10_bloco2_global.md` e nota **2026-04-12** (anti-regressão DDL + grep). |

**Conclusão:** o bloqueador «2B scoped-only» estava **desactualizado em relação ao repositório**. O problema real era **desalinhamento de SSOT** entre artefacto externo (prompt) e o estado já documentado + implementado no Git.

---

## 2. Evidências de código (resumo)

- **Helper único:** `backend/src/core/catalog/canonical/canonical-product-readiness.ts` — `sqlCanonicalIdMatchesTenantContext` (regra `(scoped ∧ tenant) ∨ (global ∧ tenant_id IS NULL)`).
- **Adapter:** `backend/src/modules/marketplace/adapters/concept-offer-refs.adapter.ts` — `canonicalVisibleForTenant` espelha a mesma semântica; joins a `canonical_products` usam o helper onde aplicável (inventário C.22).
- **Repositório / serviços:** `canonical-product.repository.ts`, `canonical-product.service.ts`, `catalog.service.ts`, `store-onboarding.service.ts`, `product.repository.ts` (EXISTS sobre `cp` com `cpVis`) — leituras de `canonical_products` alinhadas ao helper.

**Excepção documentada (já no plano):** `concept.commands.ts` — `SELECT tenant_id FROM canonical_products WHERE id = $1` (lookup por **PK**), aceite na norma; não substitui visibilidade por GTIN/listagem.

---

## 3. Checkpoint anti-regressão (C.7 / C.22)

### 3.1 Grep genérico `tenant_id =` em `backend/src`

Um `rg 'tenant_id\\s*=' backend/src` devolve **muitas** ocorrências em tabelas que **não** são `canonical_products` (`products`, `actors`, `bank_*`, etc.). **Isso não é violação da 2B** por si só.

### 3.2 Regra útil para revisão humana / futura automação

- **Sinal vermelho (2B):** `FROM canonical_products` / `JOIN canonical_products` com filtro **apenas** `canonical_products.tenant_id = $…` ou `cp.tenant_id = p.tenant_id` **sem** `sqlCanonicalIdMatchesTenantContext` (ou equivalente normativo explícito) na cadeia de visibilidade.
- **Estado verificado 2026-04-11:** inventário em `2026-04-10_bloco2_global.md` + cabeçalho plano **2026-04-12** — **zero** anti-pattern `cp.tenant_id = $` / `cp.tenant_id = p.tenant_id` em joins a `canonical_products` em `backend/` (`.ts`/`.sql`).

### 3.3 Comando sugerido para varrimento focado (manual ou CI futuro)

Revisar todos os ficheiros que referenciam `canonical_products` e confirmar que o `WHERE`/`JOIN` de visibilidade passa pelo helper (ou é o caso PK excepcionado).

---

## 4. Bloqueador residual (protocolo, não semântica 2B)

Continua **pendente de governança**:

- Ausência na raiz do repo dos nomes exactos **`PRODUTO_PLANO_MESTRE_COMPLETO.md`**, **`ORIENTACAO_PRODUTO_EXECUTAR.md`**, **`BACKEND_SRC_FULL.txt`** (podem existir apenas `EXECUTAR/STAND_BY_*` ou não existir dump).

**Risco:** scripts ou auditores externos que exijam caminhos fixos falham mesmo com código correcto.

**Mitigação sugerida (sem expandir âmbito neste log):** symlink, cópia com nome canónico na CI, ou geração automatizada de `BACKEND_SRC_FULL.txt` no pipeline.

---

## 5. Estado oficial após esta reconciliação

- **Fase 2B:** **[✓] concluída e validada** no sentido C.7/C.10/C.22 para o núcleo em `backend/src` (coerente com o plano `STAND_BY_*`).
- **Bloqueador «2B scoped-only»:** **removido** como descrição do estado actual do código.
- **Próximo foco de execução (já apontado no plano):** trabalho fora do âmbito 2B — **Bloco 3 SQL PASS** (2026-04-12 — `2026-04-12_bloco3_execucao_continua.md`, `2026-04-11_EXECUTION_COMPLETE.md`); seguir orientação vigente para marcos ainda PEND/FAIL (ex.: itens não fechados na tabela de execução).

---

## 6. Referências cruzadas

- `docs/03_execution_log/2026-04-10_bloco2_global.md`
- `docs/03_execution_log/2B_execution.md` (verificação inicial 2026-04-11)
- `EXECUTAR/STAND_BY_PRODUTO_PLANO_MESTRE_COMPLETO.md` (cabeçalho + secção 2B)
